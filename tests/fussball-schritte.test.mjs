import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagBewertung, wochenWertung } from '../js/core/bewertung.js';
import { tagWertung } from '../js/core/wertung.js';
import { exportDaten } from '../js/core/claude-dateien.js';
import { leseImport, verarbeite } from '../js/core/import.js';
import { stand, cardio, MO, SO, SPAETER } from './hilfe.mjs';

// Erfundene Werte. SO = Plantag Fußball, MO = Kraft.
function mitTag(datum, schritte) {
  const st = stand();
  st.tage[datum] = { datum, kcal: 2300, eiweiss_g: 160, schritte };
  return st;
}

test('Hallenfußball 60 Min. und 2.000 Schritte → Schritte grün, Tageswertung Schritte 100 %', () => {
  const st = mitTag(SO, 2000);
  st.trainings.push(cardio(SO, 'Hallenfußball', 60));
  const b = tagBewertung(st, SO, SPAETER);
  assert.equal(b.schritte, 'gruen');
  assert.equal(b.schritteErsetzt, true);
  assert.equal(tagWertung(st, SO, SPAETER).bereiche.schritte.prozent, 100);
});

test('Hallenfußball 30 Min. → normale Schritte-Wertung', () => {
  const st = mitTag(SO, 2000);
  st.trainings.push(cardio(SO, 'Hallenfußball', 30));
  const b = tagBewertung(st, SO, SPAETER);
  assert.equal(b.schritte, 'rot');
  assert.equal(b.schritteErsetzt, false);
  assert.equal(tagWertung(st, SO, SPAETER).bereiche.schritte.prozent, 40); // Ziel in den Testdaten 5.000
});

test('Grenze genau 45 Min., auch an einem Nicht-Fußball-Plantag und ohne gemessene Schritte', () => {
  const st = stand();
  st.tage[MO] = { datum: MO, kcal: 2300, eiweiss_g: 160 };
  st.trainings.push(cardio(MO, 'Hallenfußball', 45));
  assert.equal(tagBewertung(st, MO, SPAETER).schritte, 'gruen');
  st.trainings[st.trainings.length - 1].dauer_min = 44;
  assert.equal(tagBewertung(st, MO, SPAETER).schritte, 'leer');
});

test('Woche: Tag zählt bei Schritte x/7, Schrittdurchschnitt nur aus echten Schritten', () => {
  const st = mitTag(SO, 2000);
  st.tage[MO] = { datum: MO, schritte: 10000 };
  st.trainings.push(cardio(SO, 'Hallenfußball', 60));
  const w = wochenWertung(st, MO, SPAETER);
  assert.equal(w.schritte.x, 2);
  assert.equal(w.schritteSchnitt, 6000);
});

test('Mindestdauer als Ziel änderbar (Import typ "ziel") und gilt ab gueltig_ab', () => {
  const st = mitTag(SO, 2000);
  st.trainings.push(cardio(SO, 'Hallenfußball', 60));
  const r = leseImport(`FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'ziel', schluessel: 'fussball_ersetzt_schritte_min', gueltig_ab: MO, wert: 90 }] })}`);
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const neu = verarbeite(st, r.eintraege).state;
  assert.equal(tagBewertung(neu, SO, SPAETER).schritte, 'rot');
});

test('stand.md/Export: schritte_ersetzt_durch_fussball nur am betroffenen Tag', () => {
  const st = mitTag(SO, 2000);
  st.tage[MO] = { datum: MO, schritte: 3000 };
  st.trainings.push(cardio(SO, 'Hallenfußball', 60));
  const d = exportDaten(st, SPAETER, 0);
  const tag = (datum) => d.tage.find((t) => t.datum === datum);
  assert.equal(tag(SO).schritte_ersetzt_durch_fussball, true);
  assert.equal(tag(SO).status.schritte, 'gruen');
  assert.equal('schritte_ersetzt_durch_fussball' in tag(MO), false);
});
