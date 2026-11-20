import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nacht, phasenAnteile, schlafSchnitt, schlafWoche, schlafVerlauf, schlafBedarf, schlafNote, dauerText, minText } from '../js/core/schlaf.js';
import { leseImport, verarbeite } from '../js/core/import.js';
import { setzeZiel } from '../js/core/ziele.js';
import { demoState } from '../js/core/demo.js';
import { stand, MO, DI, MI, DO, FR, SA, SO } from './hilfe.mjs';

// Erfundene Nächte
const voll = { schlaf_h: 7.25, schlaf_tief_min: 80, schlaf_rem_min: 95, schlaf_leicht_min: 260, schlaf_wach_min: 20, einschlafen: '23:10', aufwachen: '06:45', ruhepuls: 58, hrv_ms: 42 };

test('Nacht: alle Werte, Phasenanteile ergeben 100 %', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, ...voll };
  const n = nacht(s, MO);
  assert.equal(n.stunden, 7.25);
  assert.equal(n.einschlafen, '23:10');
  assert.equal(n.ruhepuls, 58);
  assert.equal(n.phasen.length, 4);
  const a = phasenAnteile(n);
  assert.equal(Math.round(a.reduce((x, p) => x + p.pct, 0)), 100);
  assert.equal(a[0].name, 'Tief');
});

test('Nacht ohne Gesamtdauer: Summe der Schlafphasen ohne Wachzeit', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, schlaf_tief_min: 60, schlaf_rem_min: 90, schlaf_leicht_min: 270, schlaf_wach_min: 30 };
  assert.equal(nacht(s, MO).stunden, 7);
});

test('Tag ohne Schlafwerte ist keine Nacht (Stress allein reicht nicht)', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, kcal: 2200, stress: 4 };
  assert.equal(nacht(s, MO), null);
  assert.equal(nacht(s, DI), null);
  assert.deepEqual(phasenAnteile(null), []);
});

test('Wochenschnitt und Vergleich zur Vorwoche', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, schlaf_h: 7, ruhepuls: 60, stress: 4 };
  s.tage[DI] = { datum: DI, schlaf_h: 6, ruhepuls: 62, stress: 6 };
  s.tage[MI] = { datum: MI, stress: 5 }; // kein Schlaf, aber Stress
  const w = schlafSchnitt(s, MO, SO);
  assert.equal(w.naechte, 2);
  assert.equal(w.stunden, 6.5);
  assert.equal(w.ruhepuls, 61);
  assert.equal(w.stress, 5);
  assert.equal(w.hrv, null);
  const nae = '2026-11-16';
  s.tage[nae] = { datum: nae, schlaf_h: 8 };
  const wo = schlafWoche(s, nae, '2026-11-17');
  assert.equal(wo.diese.stunden, 8);
  assert.equal(wo.vorher.stunden, 6.5);
});

test('Verlauf: 7-Tage-Schnitt nur aus Nächten mit Wert', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, schlaf_h: 6 };
  s.tage[MI] = { datum: MI, schlaf_h: 8 };
  s.tage[SO] = { datum: SO, schlaf_h: 7 };
  const v = schlafVerlauf(s, SO, 7);
  assert.equal(v.punkte.length, 7);
  assert.equal(v.punkte[1].stunden, null); // Dienstag ohne Wert
  assert.equal(v.schnitt7.find((p) => p.datum === MI).wert, 7);
  assert.equal(v.schnitt7.find((p) => p.datum === SO).wert, 7);
  assert.equal(v.schnitt7.find((p) => p.datum === DO).wert, null);
});

test('Schlafbedarf steht in den Daten (Startwert 7,5 Std.) und gilt ab Datum', () => {
  const s = stand();
  assert.equal(schlafBedarf(s, MO), 7.5);
  setzeZiel(s.ziele, 'schlaf_bedarf_h', FR, 8);
  assert.equal(schlafBedarf(s, DO), 7.5);
  assert.equal(schlafBedarf(s, SA), 8);
});

test('Vorbelegung im Check: Note aus Dauer und Bedarf', () => {
  assert.equal(schlafNote(7.5, 7.5), 5);
  assert.equal(schlafNote(8.2, 7.5), 5);
  assert.equal(schlafNote(6.5, 7.5), 4);
  assert.equal(schlafNote(6, 7.5), 3);
  assert.equal(schlafNote(5, 7.5), 2);
  assert.equal(schlafNote(4, 7.5), 1);
  assert.equal(schlafNote(null, 7.5), null);
});

test('Texte: Dauer und Minuten', () => {
  assert.equal(dauerText(7.25), '7:15 Std.');
  assert.equal(dauerText(null), '–');
  assert.equal(minText(45), '45 Min.');
  assert.equal(minText(95), '1:35 Std.');
});

test('Import: Schlafphasen, Uhrzeiten, Ruhepuls und HRV', () => {
  const r = leseImport(`FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'tag', datum: MO, schlaf_h: 7.4, schlaf_tief_min: 80, schlaf_rem_min: 95, schlaf_leicht_min: 250, schlaf_wach_min: 18, einschlafen: '23:05', aufwachen: '6.50', ruhepuls: 57, hrv_ms: 44.5 }] })}`);
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const { state } = verarbeite(stand(), r.eintraege);
  const t = state.tage[MO];
  assert.equal(t.schlaf_tief_min, 80);
  assert.equal(t.aufwachen, '06:50');
  assert.equal(t.hrv_ms, 44.5);
  const falsch = (feld, wert) => leseImport(`FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'tag', datum: MO, [feld]: wert }] })}`).ok;
  assert.equal(falsch('einschlafen', '25:00'), false);
  assert.equal(falsch('einschlafen', 'spät'), false);
  assert.equal(falsch('ruhepuls', 300), false);
  assert.equal(falsch('schlaf_rem_min', 12.5), false);
});

test('Testdaten enthalten Schlafphasen und Ruhepuls', () => {
  const s = demoState('2026-11-17');
  const mitPhasen = Object.keys(s.tage).filter((d) => nacht(s, d) && nacht(s, d).phasen.length === 4);
  assert.ok(mitPhasen.length >= 14);
  const n = nacht(s, mitPhasen[0]);
  assert.match(n.einschlafen, /^\d{2}:\d{2}$/);
  assert.ok(n.ruhepuls >= 57 && n.ruhepuls <= 61);
});

test('Import: leere oder 0-Messwerte aus dem Kurzbefehl ändern nichts und brechen den Import nicht ab', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, schlaf_h: 7, ruhepuls: 58 };
  const r = leseImport(`FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'tag', datum: MO, kcal: 2100, schlaf_h: '', ruhepuls: 0, hrv_ms: '0', einschlafen: '', schlaf_tief_min: '' }] })}`);
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const { state } = verarbeite(s, r.eintraege);
  assert.equal(state.tage[MO].kcal, 2100);
  assert.equal(state.tage[MO].schlaf_h, 7);
  assert.equal(state.tage[MO].ruhepuls, 58);
  assert.equal(state.tage[MO].hrv_ms, undefined);
});

test('Import: Werte in Anführungszeichen (aus dem Kurzbefehl) werden als Zahl gelesen', () => {
  const r = leseImport(`FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'tag', datum: MO, schlaf_h: '7.25', schlaf_rem_min: '95', ruhepuls: '57' }] })}`);
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const { state } = verarbeite(stand(), r.eintraege);
  assert.equal(state.tage[MO].schlaf_h, 7.25);
  assert.equal(state.tage[MO].schlaf_rem_min, 95);
});

test('Import: "7.125" in Anführungszeichen ist bei Messwerten 7,125 Std. (nicht siebentausend)', () => {
  const r = leseImport(`FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'tag', datum: MO, schlaf_h: '7.125', hrv_ms: '44.123' }] })}`);
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const { state } = verarbeite(stand(), r.eintraege);
  assert.equal(state.tage[MO].schlaf_h, 7.125);
  assert.equal(state.tage[MO].hrv_ms, 44.123);
});
