// Bildschirm "Mehr": Wochen-Check-in, Gesundheit, Einstellungen, Trainingsplan, Daten.

import { S, heuteIso, neu, speichern, setzeState, wechsleModus, demoZuruecksetzen, allesLoeschen, meldung } from '../store.js';
import { h, karte, zahlFeld, textFeld, datumFeld, diagramm, kopiere, marke } from './dom.js';
import { importiereHealthData, dateiKnopf } from './heute.js';
import { VERSION } from '../version.js';
import { wochenWerte, checkinZeilen, checkinText } from '../core/checkin.js';
import { leseImport } from '../core/import.js';
import { vorschauKarte } from './vorschau.js';
import { exportText } from '../core/claude-dateien.js';
import { istVerbunden } from '../cloud.js';
import { ZIEL_INFO, zielWert, zielVerlauf, setzeZiel, minimalAktiv } from '../core/ziele.js';
import { SAMMLUNGEN, neueId } from '../core/state.js';
import { fmt } from '../core/zahl.js';
import { de, deKurz, montag, plusTage, WT_LANG, istDatum } from '../core/datum.js';

const zurueck = 'mehr';
const blur = () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); };

// ---------- Menü ----------

function menue() {
  const punkt = (ziel, name, text) => h('a', { href: ziel.startsWith('#') ? ziel : `#mehr/${ziel}` }, h('span', { class: 'wachs' }, h('b', null, name), h('div', { class: 'klein' }, text)), h('span', { class: 'pfeil' }, '›'));
  return { titel: 'Mehr', knoten: h('div', null,
    karte(null, h('div', { class: 'liste' },
      punkt('#rezepte', 'Rezepte', 'Frühstück, Mittagessen, Abendessen, Snacks mit Mengen und Nährwerten'),
      punkt('checkin', 'Wochen-Check-in', 'Wochenwerte ansehen und für Claude kopieren'),
      punkt('#cloud', 'Claude-Verbindung (Dropbox)', istVerbunden() ? 'Verbunden – Claude kann lesen und Einträge ablegen' : 'Einrichten, damit Claude selbst lesen und ablegen kann'),
      punkt('import', 'Von Claude importieren', 'Datenblock „FITNESS-IMPORT v1“ einfügen'),
      punkt('gesundheit', 'Gesundheit', 'Blutwerte und Supplements'),
      punkt('einstellungen', 'Einstellungen', 'Ziele, Grenzwerte, Phasen, Minimalversion'),
      punkt('plan', 'Trainingsplan', 'Wochenplan und Übungen bearbeiten'),
      punkt('daten', 'Daten', 'Sicherung, Wiederherstellung, Export, Testdaten'),
    )),
    h('p', { class: 'klein', style: 'text-align:center' }, `Version ${VERSION}${S.modus === 'demo' ? ' · Testdaten-Modus' : ''} · Alle Daten liegen nur auf diesem Gerät.`),
  ) };
}

// ---------- Wochen-Check-in ----------

let ciWoche = null;

function checkinScreen() {
  const d = heuteIso();
  if (!ciWoche) ciWoche = montag(d);
  const w = wochenWerte(S.state, ciWoche, d);
  const frei = S.state.checkins[ciWoche] || (S.state.checkins[ciWoche] = {});
  const merke = (feld) => (v) => { frei[feld] = v; speichern('checkins'); };
  const wt = w.wertung;
  const knoten = h('div', null,
    h('div', { class: 'zeile', style: 'margin-bottom:12px' },
      h('button', { type: 'button', class: 'knopf schmal', 'aria-label': 'Vorwoche', onclick: () => { ciWoche = plusTage(ciWoche, -7); neu(); } }, '‹'),
      h('b', { class: 'wachs', style: 'text-align:center' }, `KW ${w.kw} · ${deKurz(w.montag)}–${de(w.sonntag)}`),
      h('button', { type: 'button', class: 'knopf schmal', 'aria-label': 'Folgewoche', disabled: plusTage(ciWoche, 7) > d, onclick: () => { ciWoche = plusTage(ciWoche, 7); neu(); } }, '›'),
    ),
    w.minimal ? h('div', { class: 'hinweis ruhig' }, h('b', null, 'Minimalversion aktiv'), h('small', null, 'Erfolg in dieser Woche: Gewicht und Bauchumfang halten.')) : null,
    karte('Werte der Woche (Mo–So)',
      h('ul', { class: 'liste' }, checkinZeilen(w).map(([name, wert]) => h('li', null, h('span', { class: 'wachs' }, name), h('b', { class: 'rechtsb', style: 'max-width:62%' }, wert)))),
      h('p', { class: 'abstand' }, 'Kalorien-Wochenschnitt: ', wt.kcalSchnitt === null ? '–' : marke(wt.kcalSchnittStatus)),
    ),
    karte('Deine Angaben',
      textFeld({ label: 'Verdauung / Sättigung', wert: frei.verdauung, mehrzeilig: true, onChange: merke('verdauung') }),
      textFeld({ label: 'Besonderheiten', wert: frei.besonderheiten, mehrzeilig: true, onChange: merke('besonderheiten') }),
      h('button', { type: 'button', class: 'knopf haupt breit', onclick: async () => {
        blur();
        const ok = await kopiere(checkinText(wochenWerte(S.state, ciWoche, d), S.state.checkins[ciWoche]));
        meldung(ok ? 'Check-in kopiert – jetzt in Claude einfügen' : 'Kopieren nicht möglich');
      } }, 'Für Claude kopieren'),
    ),
  );
  return { titel: 'Wochen-Check-in', zurueck, knoten };
}

// ---------- Claude-Import ----------

const imp = { text: '', ergebnis: null, ersetzen: {} };

function importScreen() {
  const feld = h('textarea', { rows: 8, placeholder: 'FITNESS-IMPORT v1\n{ "eintraege": [ … ] }', style: 'font-family:ui-monospace,Menlo,monospace;font-size:13px;min-height:170px', oninput: () => { imp.text = feld.value; } });
  feld.value = imp.text;
  const pruefe = () => { blur(); imp.text = feld.value; imp.ersetzen = {}; imp.ergebnis = leseImport(imp.text); neu(); };
  const teile = [karte('Block von Claude einfügen',
    feld,
    h('div', { class: 'knopfreihe abstand' },
      h('button', { type: 'button', class: 'knopf', onclick: async () => {
        try { feld.value = await navigator.clipboard.readText(); imp.text = feld.value; pruefe(); } catch { meldung('Bitte lange ins Feld tippen und „Einsetzen“ wählen.'); }
      } }, 'Aus Zwischenablage'),
      h('button', { type: 'button', class: 'knopf haupt', onclick: pruefe }, 'Prüfen'),
    ),
    h('p', { class: 'klein abstand' }, 'Es wird erst gespeichert, wenn du nach der Vorschau auf „Übernehmen“ tippst.'),
  )];

  if (imp.ergebnis) {
    teile.push(vorschauKarte({
      ergebnis: imp.ergebnis, ersetzen: imp.ersetzen, state: S.state,
      onWahl: neu,
      onAbbrechen: () => { imp.ergebnis = null; neu(); },
      onUebernehmen: async (neuerStand, anzahl) => {
        await setzeState(neuerStand);
        imp.text = ''; imp.ergebnis = null; imp.ersetzen = {};
        meldung(`${anzahl} ${anzahl === 1 ? 'Eintrag' : 'Einträge'} übernommen`);
        location.hash = '#heute';
      },
    }));
  }
  return { titel: 'Von Claude importieren', zurueck, knoten: h('div', null, teile) };
}

// ---------- Gesundheit ----------

function gesundheitScreen() {
  const st = S.state;
  const d = heuteIso();
  const gruppen = new Map();
  for (const b of st.blutwerte) { if (!gruppen.has(b.name)) gruppen.set(b.name, []); gruppen.get(b.name).push(b); }
  const lage = (b) => (typeof b.wert !== 'number' ? null : typeof b.norm_max === 'number' && b.wert > b.norm_max ? 'hoch' : typeof b.norm_min === 'number' && b.wert < b.norm_min ? 'niedrig' : typeof b.norm_min === 'number' || typeof b.norm_max === 'number' ? 'normal' : null);
  const norm = (b) => (typeof b.norm_min === 'number' && typeof b.norm_max === 'number' ? `Norm ${fmt(b.norm_min, 2)}–${fmt(b.norm_max, 2)}` : typeof b.norm_max === 'number' ? `Norm bis ${fmt(b.norm_max, 2)}` : typeof b.norm_min === 'number' ? `Norm ab ${fmt(b.norm_min, 2)}` : 'kein Normbereich hinterlegt');
  const namen = [...gruppen.keys()].sort((a, b) => {
    const la = lage(gruppen.get(a).sort((x, y) => (x.datum < y.datum ? 1 : -1))[0]);
    const lb = lage(gruppen.get(b).sort((x, y) => (x.datum < y.datum ? 1 : -1))[0]);
    const rang = (l) => (l === 'hoch' || l === 'niedrig' ? 0 : 1);
    return rang(la) - rang(lb) || a.localeCompare(b, 'de');
  });

  const neuB = { datum: d };
  const eingabe = h('section', { class: 'karte' }, h('details', null, h('summary', null, '+ Blutwert eintragen'),
    textFeld({ label: 'Name (z. B. Ferritin)', wert: '', onChange: (v) => { neuB.name = v; } }),
    datumFeld({ label: 'Datum', wert: d, onChange: (v) => { neuB.datum = v; } }),
    h('div', { class: 'raster2' },
      zahlFeld({ label: 'Wert', wert: null, onChange: (v) => { neuB.wert = v; } }),
      textFeld({ label: 'Einheit', wert: '', onChange: (v) => { neuB.einheit = v; } }),
      zahlFeld({ label: 'Norm ab', wert: null, onChange: (v) => { neuB.norm_min = v; } }),
      zahlFeld({ label: 'Norm bis', wert: null, onChange: (v) => { neuB.norm_max = v; } }),
    ),
    h('button', { type: 'button', class: 'knopf haupt breit', onclick: () => {
      blur();
      if (!neuB.name || typeof neuB.wert !== 'number') { meldung('Bitte Name und Wert eintragen.'); return; }
      const b = { id: neueId(), datum: neuB.datum, name: neuB.name, wert: neuB.wert, einheit: neuB.einheit || '' };
      if (typeof neuB.norm_min === 'number') b.norm_min = neuB.norm_min;
      if (typeof neuB.norm_max === 'number') b.norm_max = neuB.norm_max;
      st.blutwerte.push(b); speichern('blutwerte'); meldung('Blutwert gespeichert'); neu();
    } }, 'Speichern'),
  ));

  const wertKarte = (name) => {
    const liste = gruppen.get(name).sort((a, b) => (a.datum < b.datum ? 1 : -1));
    const b = liste[0];
    const l = lage(b);
    const mitZahl = liste.filter((x) => typeof x.wert === 'number');
    return h('section', { class: 'karte' },
      h('div', { class: 'zeile' },
        h('div', { class: 'wachs' }, h('b', null, name), h('div', { class: 'klein' }, `${de(b.datum)} · ${norm(b)}`)),
        h('div', { class: 'rechtsb' }, h('div', { style: 'font-size:20px;font-weight:700' }, `${typeof b.wert === 'number' ? fmt(b.wert, 2) : b.wert_text || '–'} ${b.einheit || ''}`),
          l === 'hoch' ? h('span', { class: 'marke s-rot' }, '↑ über der Norm') : l === 'niedrig' ? h('span', { class: 'marke s-rot' }, '↓ unter der Norm') : l === 'normal' ? h('span', { class: 'marke s-gruen' }, 'in der Norm') : null),
      ),
      mitZahl.length > 1 ? h('div', { class: 'abstand' }, diagramm({ hoehe: 150, stellen: 1,
        hLinien: [typeof b.norm_max === 'number' ? { y: b.norm_max, text: 'Norm bis' } : null, typeof b.norm_min === 'number' ? { y: b.norm_min, text: 'Norm ab' } : null].filter(Boolean),
        serien: [{ klasse: 'c1', radius: 4, punkte: mitZahl.map((x) => ({ x: x.datum, y: x.wert })) }] })) : null,
      h('details', null, h('summary', { class: 'klein' }, `${liste.length} ${liste.length === 1 ? 'Messung' : 'Messungen'}`),
        h('ul', { class: 'liste' }, liste.map((x) => h('li', null,
          h('span', { class: 'wachs' }, `${de(x.datum)}: ${typeof x.wert === 'number' ? fmt(x.wert, 2) : x.wert_text || '–'} ${x.einheit || ''}`, lage(x) === 'hoch' || lage(x) === 'niedrig' ? ' ⚠' : ''),
          h('button', { type: 'button', class: 'knopf schmal gefahr', 'aria-label': 'Löschen', onclick: () => { if (confirm('Diesen Blutwert löschen?')) { st.blutwerte = st.blutwerte.filter((y) => y !== x); speichern('blutwerte'); neu(); } } }, '✕'))))),
    );
  };

  const sup = st.einstellungen.supplements || [];
  const neuS = {};
  const supplements = karte('Supplements',
    sup.length ? h('ul', { class: 'liste' }, sup.map((x) => h('li', null,
      h('span', { class: 'wachs' }, h('b', null, x.name), x.info ? h('div', { class: 'klein' }, x.info) : null),
      h('button', { type: 'button', class: 'knopf schmal gefahr', 'aria-label': 'Löschen', onclick: () => { if (confirm(`„${x.name}“ entfernen?`)) { st.einstellungen.supplements = sup.filter((y) => y !== x); speichern('einstellungen'); neu(); } } }, '✕')))) : h('p', { class: 'leer' }, 'Keine Supplements eingetragen'),
    h('details', null, h('summary', null, '+ Supplement hinzufügen'),
      textFeld({ label: 'Name', wert: '', onChange: (v) => { neuS.name = v; } }),
      textFeld({ label: 'Dosis / Hinweis', wert: '', onChange: (v) => { neuS.info = v; } }),
      h('button', { type: 'button', class: 'knopf haupt breit', onclick: () => { blur(); if (!neuS.name) return; st.einstellungen.supplements = [...sup, { name: neuS.name, info: neuS.info || '' }]; speichern('einstellungen'); neu(); } }, 'Hinzufügen')),
  );

  return { titel: 'Gesundheit', zurueck, knoten: h('div', null,
    h('h2', { class: 'klein', style: 'margin:4px 4px 8px' }, 'BLUTWERTE (auffällige zuerst)'),
    namen.length ? namen.map(wertKarte) : karte(null, h('p', { class: 'leer' }, 'Noch keine Blutwerte')),
    eingabe, supplements,
    h('p', { class: 'klein', style: 'text-align:center' }, 'Die Anzeige ersetzt keine ärztliche Beurteilung.'),
  ) };
}

// ---------- Einstellungen ----------

let offenesZiel = null;

function zielZeile(schluessel, d) {
  const st = S.state;
  const info = ZIEL_INFO[schluessel];
  const verlauf = zielVerlauf(st.ziele, schluessel);
  const aktuell = zielWert(st.ziele, schluessel, d);
  const kommend = verlauf.filter((z) => z.gueltig_ab > d);
  const offen = offenesZiel === schluessel;
  const f = { wert: null, ab: d };
  return h('li', { style: 'flex-wrap:wrap' },
    h('span', { class: 'wachs' }, info.name, kommend.length ? h('div', { class: 'klein' }, kommend.map((z) => `ab ${de(z.gueltig_ab)}: ${fmt(z.wert, 1)}`).join(' · ')) : null),
    h('b', null, `${fmt(aktuell, 1)} ${info.einheit}`),
    h('button', { type: 'button', class: 'knopf schmal', onclick: () => { offenesZiel = offen ? null : schluessel; neu(); } }, offen ? 'Schließen' : 'Ändern'),
    offen ? h('div', { style: 'flex-basis:100%;padding:8px 0' },
      h('div', { class: 'raster2' },
        zahlFeld({ label: 'Neuer Wert', einheit: info.einheit, wert: null, onChange: (v) => { f.wert = v; } }),
        datumFeld({ label: 'Gültig ab', wert: d, onChange: (v) => { f.ab = v; } }),
      ),
      h('button', { type: 'button', class: 'knopf haupt breit', onclick: () => {
        blur();
        if (typeof f.wert !== 'number') { meldung('Bitte einen Wert eintragen.'); return; }
        setzeZiel(st.ziele, schluessel, f.ab, f.wert); speichern('ziele'); meldung(`Gilt ab ${de(f.ab)}. Frühere Tage behalten das alte Ziel.`); neu();
      } }, 'Speichern'),
      h('p', { class: 'klein abstand' }, 'Bisherige Werte:'),
      h('ul', { class: 'liste' }, verlauf.map((z) => h('li', null, h('span', { class: 'wachs' }, `ab ${de(z.gueltig_ab)}`), h('b', null, `${fmt(z.wert, 1)} ${info.einheit}`),
        verlauf.length > 1 ? h('button', { type: 'button', class: 'knopf schmal gefahr', 'aria-label': 'Eintrag löschen', onclick: () => { if (confirm('Diesen Eintrag löschen?')) { st.ziele = st.ziele.filter((x) => x !== z); speichern('ziele'); neu(); } } }, '✕') : null))),
    ) : null,
  );
}

function einstellungenScreen() {
  const st = S.state;
  const e = st.einstellungen;
  const d = heuteIso();
  const gruppen = new Map();
  for (const [k, info] of Object.entries(ZIEL_INFO)) { if (!gruppen.has(info.gruppe)) gruppen.set(info.gruppe, []); gruppen.get(info.gruppe).push(k); }
  const aktiv = minimalAktiv(e, d);
  const zr = e.minimal.zeitraeume;
  const sichere = () => { speichern('einstellungen'); neu(); };

  const minimal = karte('Minimalversion',
    h('p', null, aktiv ? 'Heute aktiv.' : 'Heute nicht aktiv.', ' Schritte, Kalorien-Korridor und Training richten sich in diesen Zeiträumen nach den Minimalwerten.'),
    h('div', { class: 'abstand' }, aktiv
      ? h('button', { type: 'button', class: 'knopf breit', onclick: () => {
        for (const z of zr) if (z.von <= d && (!z.bis || d <= z.bis)) z.bis = plusTage(d, -1);
        e.minimal.zeitraeume = zr.filter((z) => !z.bis || z.bis >= z.von); sichere();
      } }, 'Ab heute ausschalten')
      : h('button', { type: 'button', class: 'knopf haupt breit', onclick: () => { zr.push({ von: d, bis: null }); sichere(); } }, 'Ab heute einschalten')),
    zr.length ? h('p', { class: 'klein abstand' }, 'Zeiträume (Ende leer = bis auf Weiteres):') : null,
    zr.map((z) => h('div', { class: 'zeile', style: 'margin-top:6px' },
      datumFeld({ wert: z.von, onChange: (v) => { z.von = v; sichere(); } }),
      (() => { const i = h('input', { type: 'date', value: z.bis || '', onchange: () => { z.bis = i.value || null; sichere(); } }); return i; })(),
      h('button', { type: 'button', class: 'knopf schmal gefahr', 'aria-label': 'Zeitraum löschen', onclick: () => { if (confirm('Diesen Zeitraum löschen?')) { e.minimal.zeitraeume = zr.filter((x) => x !== z); sichere(); } } }, '✕'),
    )),
    h('div', { class: 'raster2 abstand' },
      zahlFeld({ label: 'Kraft: Dauer', einheit: 'Min.', wert: e.minimalKraft.minuten, ganz: true, min: 5, max: 120, onChange: (v) => { if (v) { e.minimalKraft.minuten = v; speichern('einstellungen'); } } }),
      zahlFeld({ label: 'Kraft: erste … Übungen', wert: e.minimalKraft.uebungen, ganz: true, min: 1, max: 20, onChange: (v) => { if (v) { e.minimalKraft.uebungen = v; speichern('einstellungen'); } } }),
    ),
  );

  const phasen = e.phasen && e.phasen.length ? karte('Phasen (aus dem Import)', h('ul', { class: 'liste' }, e.phasen.map((p) => h('li', null,
    h('span', { class: 'wachs' }, h('b', null, `${p.phase}. ${p.name}`), h('div', { class: 'klein' }, `${istDatum(p.from) ? de(p.from) : p.from || ''}${p.to ? ' – ' + (istDatum(p.to) ? de(p.to) : p.to) : ''}${p.expected ? ' · ' + p.expected : ''}`)))))) : null;

  const pfad = karte('Zielpfad Bauchumfang',
    h('div', { class: 'raster2' },
      datumFeld({ label: 'Beginn', wert: e.zielpfad.von, onChange: (v) => { e.zielpfad.von = v; speichern('einstellungen'); } }),
      datumFeld({ label: 'Ziel erreicht am', wert: e.zielpfad.bis, onChange: (v) => { e.zielpfad.bis = v; speichern('einstellungen'); } }),
    ),
    h('p', { class: 'klein' }, 'Start- und Zielwert stehen unten in der Gruppe „Bauchumfang“.'),
  );

  return { titel: 'Einstellungen', zurueck, knoten: h('div', null,
    minimal, phasen, pfad,
    h('p', { class: 'klein', style: 'margin:4px 4px 8px' }, 'ZIELE UND GRENZWERTE – Änderungen gelten ab dem gewählten Datum. Vergangene Tage werden weiter mit dem alten Wert bewertet.'),
    [...gruppen].map(([name, keys]) => karte(name, h('ul', { class: 'liste' }, keys.map((k) => zielZeile(k, d))),
      name === 'Schritte' ? h('p', { class: 'klein abstand' }, 'Die Phasen (5.000 → 7.000 → 8.000) sind mehrere Einträge beim „Tagesziel (Phase)“ mit unterschiedlichem Datum.') : null)),
  ) };
}

// ---------- Trainingsplan ----------

const planEdit = { ab: null, gesichert: false };
const TYPEN = [['kraft', 'Kraft (Pflicht)'], ['laufband', 'Laufband'], ['bonus', 'Kraft (Bonus)'], ['fussball', 'Fußball'], ['frei', 'Kein Trainingsziel']];

function planScreen() {
  const e = S.state.einstellungen;
  const plan = e.plan;
  const d = heuteIso();
  if (!planEdit.ab) planEdit.ab = d;
  const einheiten = Object.keys(plan.einheiten);
  const sichere = (neuZeichnen = true) => { speichern('einstellungen'); if (neuZeichnen) neu(); };

  // Vor der ersten Änderung den bisherigen Wochenplan für vergangene Tage aufbewahren.
  const bewahreAltenPlan = () => {
    if (planEdit.gesichert) return;
    planEdit.gesichert = true;
    const bis = plusTage(planEdit.ab, -1);
    if (bis < e.start) return;
    plan.wochenplanAlt = plan.wochenplanAlt || [];
    if (!plan.wochenplanAlt.some((a) => a.bis >= bis)) plan.wochenplanAlt.push({ bis, wochenplan: structuredClone(plan.wochenplan) });
  };

  const wochenZeile = (wt) => {
    const eintrag = plan.wochenplan[wt] || (plan.wochenplan[wt] = { typ: 'frei', text: '' });
    const typ = h('select', { onchange: () => {
      bewahreAltenPlan();
      eintrag.typ = typ.value;
      if (typ.value === 'kraft' || typ.value === 'bonus') eintrag.einheit = eintrag.einheit || einheiten[0]; else delete eintrag.einheit;
      if (typ.value === 'laufband') eintrag.minuten = eintrag.minuten || 30;
      eintrag.text = typ.value === 'kraft' ? eintrag.einheit : typ.value === 'bonus' ? `${eintrag.einheit} (Bonus)` : typ.value === 'laufband' ? 'Laufband 30 Min.' : typ.value === 'fussball' ? 'Hallenfußball' : 'Kein Trainingsziel';
      sichere();
    } }, TYPEN.map(([v, t]) => h('option', { value: v }, t)));
    typ.value = eintrag.typ || 'frei';
    let einheit = null;
    if (eintrag.typ === 'kraft' || eintrag.typ === 'bonus') {
      einheit = h('select', { onchange: () => { bewahreAltenPlan(); eintrag.einheit = einheit.value; sichere(); } }, einheiten.map((n) => h('option', { value: n }, n)));
      einheit.value = eintrag.einheit;
    }
    return h('div', { style: 'border-bottom:1px solid var(--rand);padding:8px 0' },
      h('b', null, WT_LANG[wt - 1]),
      h('div', { class: einheit ? 'raster2' : '', style: 'margin-top:4px' }, typ, einheit),
      h('div', { style: 'margin-top:6px' }, textFeld({ platzhalter: 'Anzeigetext', wert: eintrag.text, onChange: (v) => { eintrag.text = v; sichere(false); } })),
    );
  };

  const uebungZeile = (name, liste, u, i) => h('div', { style: 'border-bottom:1px solid var(--rand);padding:8px 0' },
    h('div', { class: 'zeile' },
      h('div', { class: 'wachs' }, textFeld({ platzhalter: 'Übung', wert: u.name, onChange: (v) => { u.name = v || u.name; sichere(false); } })),
      h('button', { type: 'button', class: 'knopf schmal', 'aria-label': 'Nach oben', disabled: i === 0, onclick: () => { [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]]; sichere(); } }, '↑'),
      h('button', { type: 'button', class: 'knopf schmal gefahr', 'aria-label': 'Übung löschen', onclick: () => { if (confirm(`„${u.name}“ aus ${name} entfernen?`)) { liste.splice(i, 1); sichere(); } } }, '✕'),
    ),
    h('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px' },
      zahlFeld({ label: 'Sätze', wert: u.saetze, ganz: true, min: 1, max: 20, onChange: (v) => { if (v) { u.saetze = v; sichere(false); } } }),
      textFeld({ label: 'Wdh.', wert: u.wdh, platzhalter: '10-12', onChange: (v) => { u.wdh = v; sichere(false); } }),
      zahlFeld({ label: 'kg', wert: u.kg, min: 0, max: 1000, onChange: (v) => { u.kg = v; delete u.kg_text; sichere(false); } }),
      zahlFeld({ label: 'Sek.', wert: u.sek ?? null, ganz: true, min: 0, max: 3600, onChange: (v) => { if (v) u.sek = v; else delete u.sek; sichere(false); } }),
    ),
    textFeld({ platzhalter: 'Hinweis (Tempo, Technik …)', wert: u.notiz, onChange: (v) => { if (v) u.notiz = v; else delete u.notiz; sichere(false); } }),
  );

  return { titel: 'Trainingsplan', zurueck, knoten: h('div', null,
    karte('Wochenplan',
      datumFeld({ label: 'Änderungen am Wochenplan gelten ab', wert: planEdit.ab, onChange: (v) => { planEdit.ab = v; planEdit.gesichert = false; } }),
      h('p', { class: 'klein' }, 'Tage davor werden weiter nach dem bisherigen Plan bewertet.'),
      [1, 2, 3, 4, 5, 6, 7].map(wochenZeile),
    ),
    einheiten.map((name) => karte(name,
      plan.einheiten[name].map((u, i) => uebungZeile(name, plan.einheiten[name], u, i)),
      h('button', { type: 'button', class: 'knopf schmal breit abstand', onclick: () => { plan.einheiten[name].push({ name: 'Neue Übung', saetze: 3, wdh: '10', kg: null }); sichere(); } }, '+ Übung'),
    )),
    karte('Zeiten',
      h('div', { class: 'raster2' },
        zahlFeld({ label: 'Einheit höchstens', einheit: 'Min.', wert: plan.maxMinuten, ganz: true, min: 5, max: 240, onChange: (v) => { if (v) { plan.maxMinuten = v; sichere(false); } } }),
        zahlFeld({ label: 'Pausentimer', einheit: 'Sek.', wert: e.pauseSek, ganz: true, min: 5, max: 600, onChange: (v) => { if (v) { e.pauseSek = v; sichere(false); } } }),
      ),
    ),
  ) };
}

// ---------- Daten ----------

async function sicherungErstellen() {
  const d = heuteIso();
  const daten = {};
  for (const s of SAMMLUNGEN) daten[s] = S.state[s];
  const inhalt = JSON.stringify({ format: 'fitness-sicherung', version: 1, erstellt: new Date().toISOString(), daten }, null, 1);
  const name = `fitness-sicherung-${d}.json`;
  const fertig = () => { S.state.einstellungen.letzteSicherung = d; speichern('einstellungen'); meldung('Sicherung erstellt'); neu(); };
  const herunterladen = () => {
    const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    fertig();
  };
  try {
    const datei = new File([inhalt], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [datei] })) {
      await navigator.share({ files: [datei], title: name });
      fertig();
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') { meldung('Sicherung abgebrochen'); return; }
  }
  herunterladen();
}

async function wiederherstellen(datei) {
  let s;
  try { s = JSON.parse(await datei.text()); } catch { alert('Die Datei ist kein gültiges JSON.'); return; }
  if (!s || s.format !== 'fitness-sicherung' || !s.daten || typeof s.daten.tage !== 'object') { alert('Das ist keine Sicherungsdatei dieser App.'); return; }
  const tage = Object.keys(s.daten.tage || {}).length;
  if (!confirm(`Sicherung vom ${de(String(s.erstellt).slice(0, 10))} mit ${tage} Tagen und ${(s.daten.trainings || []).length} Einheiten wiederherstellen?\n\nAlle aktuellen Daten in der App werden dadurch ersetzt.`)) return;
  await setzeState(s.daten);
  meldung('Sicherung wiederhergestellt');
  neu();
}

function datenScreen() {
  const st = S.state;
  const d = heuteIso();
  const ls = st.einstellungen.letzteSicherung;
  const demo = S.modus === 'demo';
  const kopiereExport = async (tage) => { const ok = await kopiere(exportText(S.state, heuteIso(), tage)); meldung(ok ? 'Export kopiert – jetzt in Claude einfügen' : 'Kopieren nicht möglich'); };
  return { titel: 'Daten', zurueck, knoten: h('div', null,
    demo ? h('div', { class: 'hinweis info' }, 'Testdaten-Modus', h('small', null, 'Alles auf dieser Seite betrifft gerade nur die Testdaten.')) : null,
    karte('Claude',
      h('a', { class: 'knopf haupt breit', href: '#mehr/import' }, 'Von Claude importieren'),
      h('div', { class: 'knopfreihe abstand' },
        h('button', { type: 'button', class: 'knopf', onclick: () => kopiereExport(28) }, 'Export: 4 Wochen'),
        h('button', { type: 'button', class: 'knopf', onclick: () => kopiereExport(0) }, 'Export: alles'),
      ),
      h('p', { class: 'klein abstand' }, 'Der Export landet in der Zwischenablage. Füge ihn im Claude-Chat ein.'),
    ),
    karte('Sicherung',
      h('p', null, ls ? `Letzte Sicherung: ${de(ls)}` : 'Noch keine Sicherung erstellt.'),
      h('button', { type: 'button', class: 'knopf haupt breit abstand', onclick: sicherungErstellen }, 'Sicherung erstellen'),
      h('p', { class: 'klein abstand' }, 'Im Teilen-Menü „In Dateien sichern“ wählen und in iCloud Drive ablegen.'),
      h('div', { class: 'abstand' }, dateiKnopf('Wiederherstellen …', wiederherstellen, 'knopf breit')),
    ),
    karte('Erstbefüllung',
      h('p', { class: 'klein' }, 'Übernimmt Profil, Ziele, Plan, Tageslog, Trainings, Messwerte und Blutwerte aus health-data.json. Ersetzt alle vorhandenen Daten.'),
      h('div', { class: 'abstand' }, dateiKnopf('health-data.json importieren …', async (datei) => {
        if (Object.keys(st.tage).length && !confirm('Alle vorhandenen Daten werden durch den Inhalt der Datei ersetzt. Fortfahren?')) return;
        if (await importiereHealthData(datei)) location.hash = '#heute';
      }, 'knopf breit')),
    ),
    karte('Testdaten',
      h('p', { class: 'klein' }, 'Drei Wochen erfundene Werte, um alle Ansichten zu prüfen. Sie liegen getrennt von deinen echten Daten.'),
      h('button', { type: 'button', class: 'knopf breit abstand', onclick: async () => { await wechsleModus(demo ? 'echt' : 'demo'); location.hash = '#heute'; neu(); } }, demo ? 'Zurück zu meinen echten Daten' : 'Testdaten anzeigen'),
      demo ? h('button', { type: 'button', class: 'knopf breit abstand', onclick: async () => { await demoZuruecksetzen(); meldung('Testdaten neu erzeugt'); neu(); } }, 'Testdaten neu erzeugen') : null,
    ),
    karte('Gefahrenbereich',
      h('button', { type: 'button', class: 'knopf gefahr breit', onclick: async () => {
        if (!confirm(demo ? 'Alle Testdaten löschen?' : 'Wirklich ALLE deine Daten in der App löschen? Das lässt sich nur mit einer Sicherung rückgängig machen.')) return;
        if (!demo && !confirm('Letzte Rückfrage: Alle Daten endgültig löschen?')) return;
        await allesLoeschen(); meldung('Daten gelöscht'); location.hash = '#heute'; neu();
      } }, demo ? 'Testdaten löschen' : 'Alle Daten löschen'),
    ),
  ) };
}

export function mehrScreen([sub]) {
  if (sub === 'checkin') return checkinScreen();
  if (sub === 'import') return importScreen();
  if (sub === 'gesundheit') return gesundheitScreen();
  if (sub === 'einstellungen') return einstellungenScreen();
  if (sub === 'plan') return planScreen();
  if (sub === 'daten') return datenScreen();
  return menue();
}
