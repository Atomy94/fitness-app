// Bildschirm "Fortschritt": Gewicht (7-Tage-Schnitt), Bauchumfang mit Zielpfad, Körperanalyse, Krafttests.

import { S, heuteIso, neu, speichern, meldung } from '../store.js';
import { h, karte, diagramm, zahlFeld, datumFeld } from './dom.js';
import { gleitSchnitt, zielpfad } from '../core/bewertung.js';
import { zielWert, minimalAktiv } from '../core/ziele.js';
import { neueId } from '../core/state.js';
import { fmt } from '../core/zahl.js';
import { de, plusTage } from '../core/datum.js';

const vz = (n, stellen = 1) => (n > 0 ? '+' : '') + fmt(n, stellen, true);
const nachDatum = (a, b) => (a.datum < b.datum ? -1 : 1);

function gewichtKarte(d) {
  const punkte = Object.values(S.state.tage).filter((t) => typeof t.gewicht_kg === 'number').map((t) => ({ datum: t.datum, wert: t.gewicht_kg })).sort(nachDatum);
  if (!punkte.length) return karte('Gewicht', h('p', { class: 'leer' }, 'Noch keine Gewichtswerte'));
  const schnitt = gleitSchnitt(punkte);
  const aktuell = schnitt.at(-1);
  const vor7 = [...schnitt].reverse().find((p) => p.datum <= plusTage(aktuell.datum, -7));
  return karte('Gewicht',
    h('div', { class: 'zeile' },
      h('div', { class: 'wachs' }, h('div', { style: 'font-size:26px;font-weight:700' }, `${fmt(aktuell.wert, 1, true)} kg`), h('div', { class: 'klein' }, `7-Tage-Schnitt (${de(aktuell.datum)})`)),
      vor7 ? h('div', { class: 'rechtsb' }, h('div', { class: 'fett' }, `${vz(aktuell.wert - vor7.wert)} kg`), h('div', { class: 'klein' }, 'in 7 Tagen')) : null,
    ),
    h('div', { class: 'abstand' }, diagramm({ stellen: 1, serien: [
      { name: 'Tageswerte', klasse: 'cg', punkte: punkte.map((p) => ({ x: p.datum, y: p.wert })), linie: false, radius: 2.5 },
      { name: '7-Tage-Schnitt', klasse: 'c1', punkte: schnitt.map((p) => ({ x: p.datum, y: p.wert })), punkteZeigen: false, dick: 3 },
    ] })),
    h('p', { class: 'klein abstand' }, 'Einzelne Tage schwanken. Maßgeblich ist die Linie des Schnitts.'),
  );
}

function bauchKarte(d) {
  const st = S.state;
  const e = st.einstellungen;
  const start = zielWert(st.ziele, 'bauch_start', d);
  const ziel = zielWert(st.ziele, 'bauch_ziel', d);
  const pfad = { von: e.zielpfad.von, bis: e.zielpfad.bis, start, ziel };
  const messungen = st.messungen.filter((m) => typeof m.bauch_cm === 'number' && !m.ungueltig).sort(nachDatum);
  const letzte = messungen.at(-1) || null;
  const soll = zielpfad(d, pfad);
  const abweichung = letzte ? letzte.bauch_cm - zielpfad(letzte.datum, pfad) : null;
  return karte('Bauchumfang (Hauptkennzahl)',
    h('div', { class: 'zeile' },
      h('div', { class: 'wachs' }, h('div', { style: 'font-size:26px;font-weight:700' }, letzte ? `${fmt(letzte.bauch_cm, 1)} cm` : '–'), h('div', { class: 'klein' }, letzte ? `gemessen am ${de(letzte.datum)}` : 'noch keine Messung')),
      h('div', { class: 'rechtsb' }, h('div', { class: 'fett' }, `Soll heute ca. ${fmt(soll, 1)} cm`), h('div', { class: 'klein' }, `Start ${fmt(start, 1)} cm · Ziel ${fmt(ziel, 1)} cm`)),
    ),
    abweichung !== null ? h('p', { class: 'abstand' }, h('span', { class: `marke s-${abweichung <= 0.25 ? 'gruen' : abweichung <= 1 ? 'gelb' : 'rot'}` },
      abweichung <= 0.25 ? 'im Zielpfad' : `${fmt(abweichung, 1)} cm über dem Zielpfad`)) : null,
    h('div', { class: 'abstand' }, diagramm({ stellen: 0,
      hLinien: [{ y: ziel, text: `Ziel ${fmt(ziel)} cm`, name: 'Ziel' }],
      serien: [
        { name: 'Zielpfad', klasse: 'ct', punkte: [{ x: pfad.von, y: start }, { x: pfad.bis, y: ziel }], strich: '3 4', punkteZeigen: false, dick: 1.5 },
        { name: 'Gemessen', klasse: 'c1', punkte: messungen.map((m) => ({ x: m.datum, y: m.bauch_cm })), dick: 3, radius: 4 },
      ] })),
    h('p', { class: 'klein abstand' }, `Zielpfad: gleichmäßig von ${fmt(start)} cm (${de(pfad.von)}) auf ${fmt(ziel)} cm (${de(pfad.bis)}).`),
  );
}

function minimalKarte(d) {
  const st = S.state;
  if (!minimalAktiv(st.einstellungen, d)) return null;
  const zr = st.einstellungen.minimal.zeitraeume.filter((z) => z.von <= d && (!z.bis || d <= z.bis)).sort((a, b) => (a.von < b.von ? 1 : -1))[0];
  const gew = gleitSchnitt(Object.values(st.tage).filter((t) => typeof t.gewicht_kg === 'number').map((t) => ({ datum: t.datum, wert: t.gewicht_kg })));
  const vorher = [...gew].reverse().find((p) => p.datum <= zr.von) || gew[0];
  const jetzt = gew.at(-1);
  const bauch = st.messungen.filter((m) => typeof m.bauch_cm === 'number' && !m.ungueltig).sort(nachDatum);
  const bVor = [...bauch].reverse().find((m) => m.datum <= zr.von) || bauch[0];
  const bJetzt = bauch.at(-1);
  const zeile = (name, diff, einheit, grenze) => h('li', null, h('span', { class: 'wachs' }, name),
    diff === null ? h('span', { class: 'klein' }, 'noch kein Vergleich') : h('span', { class: `marke s-${diff <= grenze ? 'gruen' : 'gelb'}` }, `${vz(diff)} ${einheit} · ${diff <= grenze ? 'gehalten ✓' : 'leicht gestiegen'}`));
  return karte('Minimalversion aktiv',
    h('p', null, 'In dieser Phase gilt: Gewicht und Bauchumfang halten ist der Erfolg.'),
    h('ul', { class: 'liste abstand' },
      zeile(`Gewicht seit ${de(zr.von)}`, vorher && jetzt && jetzt.datum > zr.von ? jetzt.wert - vorher.wert : null, 'kg', 0.5),
      zeile('Bauchumfang', bVor && bJetzt && bJetzt.datum > zr.von ? bJetzt.bauch_cm - bVor.bauch_cm : null, 'cm', 0.5),
    ),
  );
}

function tanitaKarte() {
  const felder = [['koerperfett_pct', 'Fett %', 1], ['gewicht_kg', 'kg', 1], ['muskelmasse_kg', 'Muskel kg', 1], ['viszeral', 'Visz.', 0]];
  const liste = S.state.messungen.filter((m) => felder.some(([f]) => typeof m[f] === 'number') && typeof m.koerperfett_pct === 'number').sort(nachDatum);
  if (!liste.length) return karte('Körperanalyse', h('p', { class: 'leer' }, 'Noch keine Messungen'));
  return karte('Körperanalyse (Tanita)',
    diagramm({ stellen: 1, einheit: '% Körperfett', serien: [{ name: 'Körperfett', klasse: 'c2', dick: 2.5, radius: 4,
      punkte: liste.filter((m) => !m.ungueltig).map((m) => ({ x: m.datum, y: m.koerperfett_pct })) },
    { name: 'ungültige Messung', klasse: 'cg', linie: false, radius: 4, hohl: true, punkte: liste.filter((m) => m.ungueltig).map((m) => ({ x: m.datum, y: m.koerperfett_pct })) }] }),
    h('table', { class: 'tabelle abstand' },
      h('thead', null, h('tr', null, h('th', null, 'Datum'), felder.map(([, name]) => h('th', { class: 'r' }, name)))),
      h('tbody', null, [...liste].reverse().map((m) => h('tr', { class: m.ungueltig ? 'aus' : '', title: m.grund || '' },
        h('td', null, de(m.datum), m.ungueltig ? h('div', { class: 'klein', style: 'text-decoration:none' }, `ungültig${m.grund ? ': ' + m.grund : ''}`) : null),
        felder.map(([f, , st]) => h('td', { class: 'r' }, fmt(m[f], st)))))),
    ),
  );
}

function kraftKarte() {
  const liste = S.state.messungen.filter((m) => typeof m.liegestuetze_max === 'number' || typeof m.kniebeugen_max === 'number').sort(nachDatum);
  if (!liste.length) return karte('Krafttests', h('p', { class: 'leer' }, 'Noch keine Tests'));
  const letzter = (f) => [...liste].reverse().find((m) => typeof m[f] === 'number');
  const l = letzter('liegestuetze_max'), k = letzter('kniebeugen_max');
  return karte('Krafttests (am Stück)',
    h('div', { class: 'raster2' },
      h('div', null, h('div', { style: 'font-size:24px;font-weight:700' }, l ? l.liegestuetze_max : '–'), h('div', { class: 'klein' }, 'Liegestütze')),
      h('div', null, h('div', { style: 'font-size:24px;font-weight:700' }, k ? k.kniebeugen_max : '–'), h('div', { class: 'klein' }, 'Kniebeugen')),
    ),
    h('div', { class: 'abstand' }, diagramm({ yMin: 0, serien: [
      { name: 'Liegestütze', klasse: 'c1', radius: 4, punkte: liste.filter((m) => typeof m.liegestuetze_max === 'number').map((m) => ({ x: m.datum, y: m.liegestuetze_max })) },
      { name: 'Kniebeugen', klasse: 'c3', radius: 4, strich: '6 4', punkte: liste.filter((m) => typeof m.kniebeugen_max === 'number').map((m) => ({ x: m.datum, y: m.kniebeugen_max })) },
    ] })),
  );
}

function eingabeKarte(d) {
  const f = { datum: d };
  const feld = (label, name, einheit, extra = {}) => zahlFeld({ label, einheit, wert: null, onChange: (v) => { f[name] = v; }, ...extra });
  return h('section', { class: 'karte' }, h('details', null, h('summary', null, '+ Messung eintragen'),
    datumFeld({ label: 'Datum', wert: d, onChange: (v) => { f.datum = v; } }),
    h('div', { class: 'raster2' },
      feld('Bauchumfang', 'bauch_cm', 'cm', { min: 30, max: 250 }),
      feld('Körperfett', 'koerperfett_pct', '%', { min: 1, max: 80 }),
      feld('Liegestütze am Stück', 'liegestuetze_max', null, { ganz: true, min: 0, max: 1000 }),
      feld('Kniebeugen am Stück', 'kniebeugen_max', null, { ganz: true, min: 0, max: 5000 }),
    ),
    h('button', { type: 'button', class: 'knopf haupt breit', onclick: () => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const gruppen = [['Maßband', ['bauch_cm']], ['Tanita', ['koerperfett_pct']], ['Krafttest', ['liegestuetze_max', 'kniebeugen_max']]];
      let anzahl = 0;
      for (const [quelle, namen] of gruppen) {
        const werte = namen.filter((n) => typeof f[n] === 'number');
        if (!werte.length) continue;
        let m = S.state.messungen.find((x) => x.datum === f.datum && (x.quelle || '') === quelle);
        if (!m) { m = { id: neueId(), datum: f.datum, quelle }; S.state.messungen.push(m); }
        for (const n of werte) m[n] = f[n];
        anzahl++;
      }
      if (!anzahl) { meldung('Bitte mindestens einen Wert eintragen.'); return; }
      speichern('messungen');
      meldung('Messung gespeichert');
      neu();
    } }, 'Speichern'),
  ));
}

function messListe() {
  const liste = [...S.state.messungen].sort(nachDatum).reverse();
  if (!liste.length) return null;
  const text = (m) => [
    typeof m.bauch_cm === 'number' ? `Bauch ${fmt(m.bauch_cm, 1)} cm` : null,
    typeof m.koerperfett_pct === 'number' ? `Fett ${fmt(m.koerperfett_pct, 1)} %` : null,
    typeof m.liegestuetze_max === 'number' ? `${m.liegestuetze_max} Liegestütze` : null,
    typeof m.kniebeugen_max === 'number' ? `${m.kniebeugen_max} Kniebeugen` : null,
  ].filter(Boolean).join(' · ') || m.quelle;
  return h('section', { class: 'karte' }, h('details', null, h('summary', null, `Alle Messungen (${liste.length})`),
    h('ul', { class: 'liste' }, liste.map((m) => h('li', null,
      h('span', { class: 'wachs' }, text(m), h('div', { class: 'klein' }, `${de(m.datum)}${m.quelle ? ' · ' + m.quelle : ''}${m.ungueltig ? ' · ungültig' : ''}`)),
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { m.ungueltig = !m.ungueltig; speichern('messungen'); neu(); } }, m.ungueltig ? 'gültig' : 'ungültig'),
      h('button', { type: 'button', class: 'knopf schmal gefahr', 'aria-label': 'Löschen', onclick: () => { if (confirm('Messung löschen?')) { S.state.messungen = S.state.messungen.filter((x) => x !== m); speichern('messungen'); neu(); } } }, '✕'),
    ))),
  ));
}

export function fortschrittScreen() {
  const d = heuteIso();
  return { titel: 'Fortschritt', knoten: h('div', null, minimalKarte(d), bauchKarte(d), gewichtKarte(d), eingabeKarte(d), tanitaKarte(), kraftKarte(), messListe()) };
}
