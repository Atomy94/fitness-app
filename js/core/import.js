// Claude-Import "FITNESS-IMPORT v1". Format: siehe IMPORT-FORMAT.md (dort vollständig dokumentiert).
// Ablauf: leseImport(text) prüft → verarbeite(state, eintraege) liefert Vorschau UND neuen Stand.
// Gespeichert wird erst, wenn die App den neuen Stand nach "Übernehmen" übernimmt.

import { istDatum, de } from './datum.js';
import { parseZahl, fmt } from './zahl.js';
import { ZIEL_INFO, setzeZiel } from './ziele.js';
import { neueId } from './state.js';

export const KOPF = 'FITNESS-IMPORT v1';

// Feldtypen: [Typ, min, max]. '*' am Typ = Pflichtfeld.
const Z = (min, max) => ['zahl', min, max];
const G = (min, max) => ['ganz', min, max];
export const FELDER = {
  tag: {
    kcal: Z(0, 15000), eiweiss_g: Z(0, 1000), kh_g: Z(0, 2000), fett_g: Z(0, 1000),
    ballaststoffe_g: Z(0, 500), ges_fett_g: Z(0, 500), zucker_g: Z(0, 1000), salz_g: Z(0, 100),
    schritte: G(0, 200000), gewicht_kg: Z(20, 400), bauch_cm: Z(30, 250),
    schlaf_h: Z(0, 24), schlaf_qualitaet: G(1, 5), stress: G(1, 10),
    kreatin: ['bool'], fussball: ['bool'], ungenau: ['bool'], notiz: ['text'],
  },
  training: { einheit: ['text*'], dauer_min: Z(0, 600), verkuerzt: ['bool'], uebungen: ['uebungen'], notiz: ['text'] },
  cardio: { art: ['text*'], dauer_min: Z(0, 1440), km: Z(0, 500), notiz: ['text'] },
  messung: {
    bauch_cm: Z(30, 250), koerperfett_pct: Z(1, 80), gewicht_kg: Z(20, 400), muskelmasse_kg: Z(5, 200),
    fettmasse_kg: Z(0, 200), fettfrei_kg: Z(5, 300), viszeral: Z(0, 60), grundumsatz_kcal: Z(500, 6000),
    liegestuetze_max: G(0, 1000), kniebeugen_max: G(0, 5000),
    quelle: ['text'], ungueltig: ['bool'], grund: ['text'],
  },
  ziel: { gueltig_ab: ['datum*'], schluessel: ['text*'], wert: ['zahl*', -1e9, 1e9] },
  blutwert: { name: ['text*'], wert: Z(-1e9, 1e9), wert_text: ['text'], einheit: ['text'], norm_min: Z(-1e9, 1e9), norm_max: Z(-1e9, 1e9) },
};

export const FELD_NAMEN = {
  kcal: 'Kalorien', eiweiss_g: 'Eiweiß (g)', kh_g: 'Kohlenhydrate (g)', fett_g: 'Fett (g)',
  ballaststoffe_g: 'Ballaststoffe (g)', ges_fett_g: 'Gesättigte Fette (g)', zucker_g: 'Zucker (g)', salz_g: 'Salz (g)',
  schritte: 'Schritte', gewicht_kg: 'Gewicht (kg)', bauch_cm: 'Bauchumfang (cm)', schlaf_h: 'Schlaf (Std.)',
  schlaf_qualitaet: 'Schlafqualität', stress: 'Stress', kreatin: 'Kreatin', fussball: 'Fußball gespielt',
  ungenau: 'Werte ungenau', notiz: 'Notiz', einheit: 'Einheit', dauer_min: 'Dauer (Min.)', verkuerzt: 'Verkürzt',
  uebungen: 'Übungen', art: 'Art', km: 'Strecke (km)', koerperfett_pct: 'Körperfett (%)',
  muskelmasse_kg: 'Muskelmasse (kg)', fettmasse_kg: 'Fettmasse (kg)', fettfrei_kg: 'Fettfreie Masse (kg)',
  viszeral: 'Viszeralfett', grundumsatz_kcal: 'Grundumsatz (kcal)', liegestuetze_max: 'Liegestütze am Stück',
  kniebeugen_max: 'Kniebeugen am Stück', quelle: 'Quelle', ungueltig: 'Ungültig', grund: 'Grund',
  wert: 'Wert', wert_text: 'Wert (Text)', norm_min: 'Norm ab', norm_max: 'Norm bis', name: 'Name',
};

const TYP_NAMEN = { tag: 'Tag', training: 'Training', cardio: 'Cardio', messung: 'Messung', ziel: 'Ziel', blutwert: 'Blutwert' };

function pruefeWert(spec, wert, wo, fehler) {
  const typ = spec[0].replace('*', '');
  if (typ === 'zahl' || typ === 'ganz') {
    const n = typeof wert === 'string' ? parseZahl(wert) : wert;
    if (typeof n !== 'number' || !Number.isFinite(n)) { fehler.push(`${wo}: muss eine Zahl sein (ist: ${JSON.stringify(wert)}).`); return undefined; }
    if (typ === 'ganz' && !Number.isInteger(n)) { fehler.push(`${wo}: muss eine ganze Zahl sein (ist: ${fmt(n, 2)}).`); return undefined; }
    if (n < spec[1] || n > spec[2]) { fehler.push(`${wo}: ${fmt(n, 2)} liegt außerhalb des erlaubten Bereichs (${fmt(spec[1])}–${fmt(spec[2])}).`); return undefined; }
    return n;
  }
  if (typ === 'bool') {
    if (typeof wert !== 'boolean') { fehler.push(`${wo}: muss true oder false sein (ist: ${JSON.stringify(wert)}).`); return undefined; }
    return wert;
  }
  if (typ === 'text') {
    if (typeof wert !== 'string') { fehler.push(`${wo}: muss ein Text sein.`); return undefined; }
    return wert.trim();
  }
  if (typ === 'datum') {
    if (!istDatum(wert)) { fehler.push(`${wo}: ungültiges Datum ${JSON.stringify(wert)} (erwartet JJJJ-MM-TT).`); return undefined; }
    return wert;
  }
  if (typ === 'uebungen') return pruefeUebungen(wert, wo, fehler);
  return undefined;
}

function pruefeUebungen(wert, wo, fehler) {
  if (!Array.isArray(wert)) { fehler.push(`${wo}: muss eine Liste sein.`); return undefined; }
  const aus = [];
  wert.forEach((u, i) => {
    const w = `${wo}[${i + 1}]`;
    if (!u || typeof u !== 'object' || typeof u.name !== 'string' || !u.name.trim()) { fehler.push(`${w}: jede Übung braucht einen "name".`); return; }
    const saetze = [];
    if (u.saetze !== undefined && u.saetze !== null) {
      if (!Array.isArray(u.saetze)) { fehler.push(`${w}.saetze: muss eine Liste sein.`); return; }
      u.saetze.forEach((s, j) => {
        const ws = `${w}.saetze[${j + 1}]`;
        if (!s || typeof s !== 'object') { fehler.push(`${ws}: ungültiger Satz.`); return; }
        const satz = {};
        for (const [feld, spec] of [['wdh', G(0, 10000)], ['kg', Z(0, 1000)], ['sek', Z(0, 36000)]]) {
          if (s[feld] === undefined || s[feld] === null) continue;
          const v = pruefeWert(spec, s[feld], `${ws}.${feld}`, fehler);
          if (v !== undefined) satz[feld] = v;
        }
        saetze.push(satz);
      });
    }
    const uebung = { name: u.name.trim(), saetze };
    if (typeof u.notiz === 'string' && u.notiz.trim()) uebung.notiz = u.notiz.trim();
    aus.push(uebung);
  });
  return aus;
}

/**
 * Prüft den eingefügten Text. Ergebnis: { ok, fehler: [Text], eintraege: [geprüfte Einträge], hinweise: [Text] }.
 * Bei Fehlern wird NICHTS übernommen.
 */
export function leseImport(text) {
  const fehler = [];
  const hinweise = [];
  if (typeof text !== 'string' || !text.trim()) return { ok: false, fehler: ['Das Feld ist leer. Füge den Block von Claude ein.'], eintraege: [], hinweise };

  let s = text.trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
  if (!s.startsWith(KOPF)) {
    return { ok: false, fehler: [`Der Block muss mit der Zeile „${KOPF}“ beginnen.`], eintraege: [], hinweise };
  }
  s = s.slice(KOPF.length).trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();

  let daten;
  try {
    daten = JSON.parse(s);
  } catch (e) {
    return { ok: false, fehler: [`Der JSON-Teil ist nicht lesbar (vermutlich unvollständig kopiert): ${e.message}`], eintraege: [], hinweise };
  }
  if (!daten || typeof daten !== 'object' || !Array.isArray(daten.eintraege)) {
    return { ok: false, fehler: ['Es fehlt die Liste "eintraege".'], eintraege: [], hinweise };
  }
  if (daten.eintraege.length === 0) return { ok: false, fehler: ['Die Liste "eintraege" ist leer.'], eintraege: [], hinweise };

  const eintraege = [];
  daten.eintraege.forEach((roh, i) => {
    const nr = `Eintrag ${i + 1}`;
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) { fehler.push(`${nr}: ist kein gültiger Eintrag.`); return; }
    const felder = FELDER[roh.typ];
    if (!felder) { fehler.push(`${nr}: unbekannter Typ ${JSON.stringify(roh.typ)}. Erlaubt: ${Object.keys(FELDER).join(', ')}.`); return; }
    const wo = `${nr} (${TYP_NAMEN[roh.typ]})`;
    const e = { typ: roh.typ };

    if (roh.typ !== 'ziel') {
      if (!istDatum(roh.datum)) { fehler.push(`${wo}: ungültiges oder fehlendes Datum ${JSON.stringify(roh.datum)} (erwartet JJJJ-MM-TT).`); return; }
      e.datum = roh.datum;
    }
    const unbekannt = [];
    for (const [feld, wert] of Object.entries(roh)) {
      if (feld === 'typ' || (feld === 'datum' && roh.typ !== 'ziel')) continue;
      const spec = felder[feld];
      if (!spec) { unbekannt.push(feld); continue; }
      if (wert === null) continue; // null = nicht ändern
      const v = pruefeWert(spec, wert, `${wo}, Feld "${feld}"`, fehler);
      if (v !== undefined) e[feld] = v;
    }
    for (const [feld, spec] of Object.entries(felder)) {
      if (spec[0].endsWith('*') && (e[feld] === undefined || e[feld] === '')) fehler.push(`${wo}: Pflichtfeld "${feld}" fehlt.`);
    }
    if (roh.typ === 'ziel' && e.schluessel && !ZIEL_INFO[e.schluessel]) {
      fehler.push(`${wo}: unbekannter Ziel-Schlüssel "${e.schluessel}". Erlaubt: ${Object.keys(ZIEL_INFO).join(', ')}.`);
    }
    if (unbekannt.length) hinweise.push(`${wo}${e.datum ? ' ' + de(e.datum) : ''}: unbekannte Felder ignoriert: ${unbekannt.join(', ')}`);
    e.index = i;
    eintraege.push(e);
  });

  if (fehler.length) return { ok: false, fehler, eintraege: [], hinweise };
  return { ok: true, fehler: [], eintraege, hinweise };
}

const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const leer = (v) => v === undefined || v === null || v === '';

/** Übernimmt Felder in einen Datensatz und meldet die Unterschiede. */
function mische(ziel, quelle, felder) {
  const diff = [];
  for (const feld of felder) {
    if (quelle[feld] === undefined) continue;
    if (!gleich(ziel[feld], quelle[feld])) {
      diff.push({ feld, alt: leer(ziel[feld]) ? null : ziel[feld], neu: quelle[feld] });
      ziel[feld] = quelle[feld];
    }
  }
  return diff;
}

function messungFinden(state, datum, quelle) {
  const amTag = state.messungen.filter((m) => m.datum === datum);
  if (quelle !== undefined) return amTag.find((m) => (m.quelle || '') === quelle) || null;
  return amTag.length === 1 ? amTag[0] : null;
}

/**
 * Wendet geprüfte Einträge auf eine KOPIE des Stands an.
 * optionen.ersetzen: { [index]: false } überspringt das Ersetzen eines vorhandenen Trainings.
 * Ergebnis: { state: neuer Stand, posten: [{ index, typ, datum, titel, art, felder, rueckfrage }] }
 * art: 'neu' | 'aenderung' | 'ersetzt' | 'gleich' | 'uebersprungen'
 */
export function verarbeite(stateAlt, eintraege, optionen = {}) {
  const state = structuredClone(stateAlt);
  const ersetzen = optionen.ersetzen || {};
  const posten = [];

  for (const e of eintraege) {
    const p = { index: e.index, typ: e.typ, datum: e.datum || e.gueltig_ab, titel: '', art: 'neu', felder: [], rueckfrage: false };

    if (e.typ === 'tag') {
      p.titel = `Tag ${de(e.datum)}`;
      const vorhanden = !!state.tage[e.datum];
      const tag = state.tage[e.datum] || (state.tage[e.datum] = { datum: e.datum });
      const felder = Object.keys(FELDER.tag).filter((f) => f !== 'bauch_cm');
      // Ein neuer Eiweißwert ersetzt einen als ungenau markierten: Markierung fällt weg.
      const korrigiert = tag.ungenau === true && e.ungenau === undefined && e.eiweiss_g !== undefined && e.eiweiss_g !== tag.eiweiss_g;
      p.felder = mische(tag, korrigiert ? { ...e, ungenau: false } : e, felder);
      if (e.bauch_cm !== undefined) {
        let m = messungFinden(state, e.datum, 'Maßband');
        if (!m) { m = { id: neueId(), datum: e.datum, quelle: 'Maßband' }; state.messungen.push(m); }
        p.felder.push(...mische(m, e, ['bauch_cm']));
      }
      p.art = !vorhanden ? 'neu' : p.felder.length ? 'aenderung' : 'gleich';
    } else if (e.typ === 'training') {
      p.titel = `Training ${e.einheit}, ${de(e.datum)}`;
      const i = state.trainings.findIndex((t) => t.typ === 'kraft' && t.datum === e.datum && t.einheit === e.einheit);
      const neu = { id: neueId(), typ: 'kraft', datum: e.datum, einheit: e.einheit, dauer_min: e.dauer_min ?? null, verkuerzt: e.verkuerzt ?? false, uebungen: e.uebungen || [], notiz: e.notiz || '' };
      const anzahl = (n) => (n === 1 ? '1 Übung' : `${n} Übungen`);
      p.felder = [{ feld: 'uebungen', alt: null, neu: anzahl(neu.uebungen.length) }];
      if (i >= 0) {
        p.rueckfrage = true;
        const alt = state.trainings[i];
        p.felder = [{ feld: 'uebungen', alt: anzahl((alt.uebungen || []).length), neu: anzahl(neu.uebungen.length) }];
        if (ersetzen[e.index] === false) p.art = 'uebersprungen';
        else { neu.id = alt.id; state.trainings[i] = neu; p.art = 'ersetzt'; }
      } else {
        state.trainings.push(neu);
      }
    } else if (e.typ === 'cardio') {
      p.titel = `${e.art}, ${de(e.datum)}`;
      let c = state.trainings.find((t) => t.typ === 'cardio' && t.datum === e.datum && t.art === e.art);
      const vorhanden = !!c;
      if (!c) { c = { id: neueId(), typ: 'cardio', datum: e.datum, art: e.art }; state.trainings.push(c); }
      p.felder = mische(c, e, ['dauer_min', 'km', 'notiz']);
      p.art = !vorhanden ? 'neu' : p.felder.length ? 'aenderung' : 'gleich';
    } else if (e.typ === 'messung') {
      p.titel = `Messung ${de(e.datum)}${e.quelle ? ' (' + e.quelle + ')' : ''}`;
      let m = messungFinden(state, e.datum, e.quelle);
      const vorhanden = !!m;
      if (!m) { m = { id: neueId(), datum: e.datum, quelle: e.quelle || '' }; state.messungen.push(m); }
      p.felder = mische(m, e, Object.keys(FELDER.messung).filter((f) => f !== 'quelle'));
      p.art = !vorhanden ? 'neu' : p.felder.length ? 'aenderung' : 'gleich';
    } else if (e.typ === 'ziel') {
      const info = ZIEL_INFO[e.schluessel];
      p.titel = `Ziel „${info.gruppe}: ${info.name}“ ab ${de(e.gueltig_ab)}`;
      const alt = state.ziele.find((z) => z.schluessel === e.schluessel && z.gueltig_ab === e.gueltig_ab);
      if (alt && alt.wert === e.wert) p.art = 'gleich';
      else {
        p.art = alt ? 'aenderung' : 'neu';
        p.felder = [{ feld: 'wert', alt: alt ? alt.wert : null, neu: e.wert }];
        setzeZiel(state.ziele, e.schluessel, e.gueltig_ab, e.wert);
      }
    } else if (e.typ === 'blutwert') {
      p.titel = `Blutwert ${e.name}, ${de(e.datum)}`;
      let b = state.blutwerte.find((x) => x.datum === e.datum && x.name === e.name);
      const vorhanden = !!b;
      if (!b) { b = { id: neueId(), datum: e.datum, name: e.name }; state.blutwerte.push(b); }
      p.felder = mische(b, e, ['wert', 'wert_text', 'einheit', 'norm_min', 'norm_max']);
      p.art = !vorhanden ? 'neu' : p.felder.length ? 'aenderung' : 'gleich';
    }
    posten.push(p);
  }
  return { state, posten };
}
