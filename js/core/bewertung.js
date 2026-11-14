// Bewertungsregeln. Drei Bereiche werden GETRENNT bewertet: Ernährung, Training, Schritte.
// Reine Funktionen ohne Bildschirm-Code – vollständig durch tests/ abgedeckt.

import { tagesZiele, planTag, minimalAktiv, zielWert } from './ziele.js';
import { plusTage, wochenTage, diffTage } from './datum.js';
import { trainingsAm } from './state.js';

export const GRUEN = 'gruen';
export const GELB = 'gelb';
export const ROT = 'rot';
export const GRAU = 'grau'; // trifft heute nicht zu
export const LEER = 'leer'; // keine Daten
export const OFFEN = 'offen'; // heute geplant, noch nicht erledigt

const fehlt = (v) => v === null || v === undefined;

/** Kalorien sind ein Korridor: zu wenig ist genauso wenig grün wie zu viel. */
export function kcalStatus(kcal, z) {
  if (fehlt(kcal)) return LEER;
  if (kcal >= z.min && kcal <= z.max) return GRUEN;
  if (kcal >= z.gelbMin && kcal <= z.gelbMax) return GELB;
  return ROT;
}

export function eiweissStatus(g, z) {
  if (fehlt(g)) return LEER;
  if (g >= z.min) return GRUEN;
  if (g >= z.gelbMin) return GELB;
  return ROT;
}

/** grün: beide grün · rot: eines rot · sonst gelb. Fehlt ein Wert, zählt nur der vorhandene. */
export function ernaehrungStatus(kcalS, eiweissS) {
  const vorhanden = [kcalS, eiweissS].filter((s) => s !== LEER);
  if (vorhanden.length === 0) return LEER;
  if (vorhanden.includes(ROT)) return ROT;
  if (vorhanden.every((s) => s === GRUEN)) return GRUEN;
  return GELB;
}

export function schritteStatus(schritte, z) {
  if (fehlt(schritte)) return LEER;
  if (schritte >= z.ziel) return GRUEN;
  if (schritte >= (z.ziel * z.gelbPct) / 100) return GELB;
  return ROT;
}

export function ballaststoffStatus(g, z) {
  if (fehlt(g)) return LEER;
  if (g >= z.min) return GRUEN;
  if (g >= z.gelbMin) return GELB;
  return ROT;
}

export function gesFettStatus(g, z) {
  if (fehlt(g)) return LEER;
  if (g <= z.max) return GRUEN;
  if (g <= z.gelbMax) return GELB;
  return ROT;
}

export function kreatinStatus(v) {
  if (fehlt(v)) return LEER;
  return v ? GRUEN : ROT;
}

/** Wochenschnitt Kalorien: eigene Grenzen. Zwischen "grün bis" und "gelb bis" ist gelb. */
export function kcalWocheStatus(schnittWert, z) {
  if (fehlt(schnittWert)) return LEER;
  if (schnittWert >= z.min && schnittWert <= z.max) return GRUEN;
  if (schnittWert >= z.gelbMin && schnittWert <= z.gelbMax) return GELB;
  return ROT;
}

const istFussball = (t) => t.typ === 'cardio' && /fu(ß|ss)ball/i.test(t.art || '');
const istLaufband = (t) => t.typ === 'cardio' && /laufband/i.test(t.art || '');
const istSpaziergang = (t) => t.typ === 'cardio' && /spazier/i.test(t.art || '');
const minuten = (liste) => liste.reduce((s, t) => s + (t.dauer_min || 0), 0);

/**
 * Fand Fußball statt? Der Schalter im Tag entscheidet. Ohne Schalter: ja, wenn eine
 * Fußball-Einheit eingetragen ist; für heute/Zukunft gilt der Plan (ja), für vergangene Tage nein.
 */
export function fussballGespielt(state, datum, heuteIso) {
  const plan = planTag(state.einstellungen, datum);
  if (!plan || plan.typ !== 'fussball') return false;
  const einheiten = trainingsAm(state, datum);
  if (einheiten.some(istFussball)) return true;
  const tag = state.tage[datum];
  if (tag && typeof tag.fussball === 'boolean') return tag.fussball;
  return datum >= heuteIso;
}

/** Bewertung des Bereichs Training für einen Tag. */
export function trainingStatus(state, datum, heuteIso) {
  const e = state.einstellungen;
  const plan = planTag(e, datum);
  const einheiten = trainingsAm(state, datum);
  const minimal = minimalAktiv(e, datum);
  const ausserhalb = datum > heuteIso || (e.start && datum < e.start);
  const fehlend = datum === heuteIso ? OFFEN : ROT;
  let status = GRAU;

  if (ausserhalb) {
    status = LEER;
  } else if (!plan) {
    status = GRAU;
  } else if (plan.typ === 'kraft') {
    const kraft = einheiten.filter((t) => t.typ === 'kraft');
    if (kraft.some((t) => !t.verkuerzt)) status = GRUEN;
    else if (kraft.length) status = GELB;
    else status = fehlend;
  } else if (plan.typ === 'bonus') {
    status = einheiten.some((t) => t.typ === 'kraft') ? GRUEN : GRAU;
  } else if (plan.typ === 'laufband') {
    if (minimal) {
      status = GRAU; // Laufband ohne Wertung
    } else {
      const lb = einheiten.filter(istLaufband);
      const min = minuten(lb);
      const gruenAb = zielWert(state.ziele, 'laufband_min', datum);
      const gelbAb = zielWert(state.ziele, 'laufband_gelb_min', datum);
      if (lb.length && min >= gruenAb) status = GRUEN;
      else if (lb.length && min >= gelbAb) status = GELB;
      else if (lb.length) status = ROT;
      else status = fehlend;
    }
  } else if (plan.typ === 'fussball') {
    const tag = state.tage[datum];
    const gespielt = einheiten.some(istFussball) || (tag && tag.fussball === true);
    const spazier = minuten(einheiten.filter(istSpaziergang));
    if (gespielt) status = GRUEN;
    else if (spazier >= zielWert(state.ziele, 'spaziergang_min', datum)) status = GRUEN;
    else status = fehlend;
  }

  // Training ohne Wertung (Nicht-Plantag) wird als Zusatz mit Stern gezeigt.
  const zusatz = !ausserhalb && status === GRAU && einheiten.length > 0;
  return { status, zusatz, plan, einheiten, minimal };
}

/** Vollständige Bewertung eines Tages (alle drei Bereiche plus Einzelwerte). */
export function tagBewertung(state, datum, heuteIso) {
  const tag = state.tage[datum] || {};
  const fussball = fussballGespielt(state, datum, heuteIso);
  const ziele = tagesZiele(state, datum, fussball);
  const kcal = kcalStatus(tag.kcal, ziele.kcal);
  const eiweiss = eiweissStatus(tag.eiweiss_g, ziele.eiweiss);
  const tr = trainingStatus(state, datum, heuteIso);
  return {
    datum,
    tag,
    ziele,
    fussball,
    minimal: ziele.minimal,
    kcal,
    eiweiss,
    ernaehrung: ernaehrungStatus(kcal, eiweiss),
    training: tr.status,
    zusatz: tr.zusatz,
    plan: tr.plan,
    einheiten: tr.einheiten,
    schritte: schritteStatus(tag.schritte, ziele.schritte),
    ballaststoffe: ballaststoffStatus(tag.ballaststoffe_g, ziele.ballaststoffe),
    gesFett: gesFettStatus(tag.ges_fett_g, ziele.gesFett),
    kreatin: kreatinStatus(tag.kreatin),
  };
}

export function schnitt(werte) {
  const w = werte.filter((v) => !fehlt(v));
  if (!w.length) return null;
  return w.reduce((a, b) => a + b, 0) / w.length;
}

/**
 * Wochenwertung getrennt pro Bereich. Kein Gesamtwert, keine Serien.
 * Training: x von y Plantagen (y = Tage mit Wertung; Bonus zählt nur, wenn erledigt).
 */
export function wochenWertung(state, mo, heuteIso) {
  const tage = wochenTage(mo).map((d) => tagBewertung(state, d, heuteIso));
  const zaehle = (feld) => tage.filter((t) => t[feld] === GRUEN).length;
  const plantage = tage.filter((t) => [GRUEN, GELB, ROT, OFFEN].includes(t.training)).length;
  const kcalSchnitt = schnitt(tage.map((t) => t.tag.kcal));
  const kcalZiele = tagesZiele(state, plusTage(mo, 6), false).kcalWoche;
  return {
    montag: mo,
    tage,
    ernaehrung: { x: zaehle('ernaehrung'), von: 7 },
    training: { x: zaehle('training'), von: plantage },
    schritte: { x: zaehle('schritte'), von: 7 },
    schritteSchnitt: schnitt(tage.map((t) => t.tag.schritte)),
    kcalSchnitt,
    kcalSchnittStatus: kcalWocheStatus(kcalSchnitt, kcalZiele),
    hatDaten: tage.some((t) => t.ernaehrung !== LEER || t.schritte !== LEER || t.einheiten.length > 0),
  };
}

/**
 * Gleitender Schnitt (Standard 7 Tage): für jedes Datum mit Wert der Mittelwert
 * aller Werte im Fenster [Datum − 6 Tage, Datum]. Eingabe: [{ datum, wert }].
 */
export function gleitSchnitt(punkte, fenster = 7) {
  const sortiert = punkte.filter((p) => !fehlt(p.wert)).sort((a, b) => (a.datum < b.datum ? -1 : 1));
  return sortiert.map((p) => {
    const ab = plusTage(p.datum, -(fenster - 1));
    const imFenster = sortiert.filter((q) => q.datum >= ab && q.datum <= p.datum).map((q) => q.wert);
    return { datum: p.datum, wert: schnitt(imFenster), anzahl: imFenster.length };
  });
}

/** Sollwert auf dem linearen Zielpfad (vor dem Start = Startwert, nach dem Ende = Zielwert). */
export function zielpfad(datum, { von, bis, start, ziel }) {
  const gesamt = diffTage(von, bis);
  if (gesamt <= 0) return ziel;
  const anteil = Math.min(1, Math.max(0, diffTage(von, datum) / gesamt));
  return start + (ziel - start) * anteil;
}
