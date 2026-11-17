import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStufe, checkGrenzen, wendeVorschlagAn, checkFelder, checkText, fragtRegionen, uebungsRegion, checkZeile } from '../js/core/check.js';
import { tagBewertung } from '../js/core/bewertung.js';
import { tagWertung } from '../js/core/wertung.js';
import { setzeZiel } from '../js/core/ziele.js';
import { leseImport, verarbeite } from '../js/core/import.js';
import { stand, kraft, MO, SA, SPAETER, START } from './hilfe.mjs';

const G = { normal: 11, leicht: 7, reduziert: 4 };
const c = (muskelkater, schlaf, energie, regionen = []) => ({ muskelkater, schlaf, energie, regionen });

// Erfundene Einheit mit Übungen aus allen drei Regionen
const PLAN = [
  { name: 'Liegestütze', saetze: 3, wdh: '8-12', schwer: { name: 'Liegestütze erhöht' } },
  { name: 'Goblet Squat', saetze: 3, wdh: '10-12' },
  { name: 'Rudern einarmig', saetze: 4, wdh: '10' },
  { name: 'Unterarmstütz', saetze: 2, sek: 30 },
];

test('Grenzwerte stehen in den Daten (Startwerte 11 / 7 / 4) und gelten ab ihrem Datum', () => {
  const s = stand();
  assert.deepEqual(checkGrenzen(s.ziele, MO), G);
  setzeZiel(s.ziele, 'check_normal_ab', '2026-12-01', 12);
  assert.equal(checkGrenzen(s.ziele, MO).normal, 11);
  assert.equal(checkGrenzen(s.ziele, '2026-12-02').normal, 12);
});

test('Stufen nach Summe: 11–15 normal, 7–10 leicht, 4–6 reduziert, 3 Ersatz', () => {
  assert.equal(checkStufe(c(5, 5, 5), G).stufe, 'normal');
  assert.equal(checkStufe(c(4, 4, 3), G).stufe, 'normal'); // 11
  assert.equal(checkStufe(c(4, 3, 3), G).stufe, 'leicht'); // 10
  assert.equal(checkStufe(c(3, 2, 2), G).stufe, 'leicht'); // 7
  assert.equal(checkStufe(c(2, 2, 2), G).stufe, 'reduziert'); // 6
  assert.equal(checkStufe(c(2, 1, 1), G).stufe, 'reduziert'); // 4
  assert.equal(checkStufe(c(1, 1, 1), G).stufe, 'ersatz'); // 3
  assert.equal(checkStufe(c(5, 5, 5), G).summe, 15);
});

test('Nicht alle Fragen beantwortet: noch kein Vorschlag', () => {
  assert.equal(checkStufe({ muskelkater: 5, schlaf: 4 }, G), null);
  assert.equal(checkStufe(null, G), null);
});

test('Ein einzelner Wert = 1 führt immer zur reduzierten Einheit', () => {
  const e = checkStufe(c(5, 5, 1), G); // Summe 11, aber Energie 1
  assert.equal(e.stufe, 'reduziert');
  assert.equal(e.eins, true);
  const t = checkText(e, c(5, 5, 1));
  assert.match(t.grund, /Energie auf 1/);
  assert.equal(t.hinweis, 'Heute kurz halten – Bewegung zählt mehr als Leistung.');
  assert.equal(checkStufe(c(1, 5, 4), G).stufe, 'reduziert');
});

test('Normal: Plan bleibt, Auswahl der Versionen unverändert', () => {
  const r = wendeVorschlagAn(PLAN, [false, false, false, false], checkStufe(c(5, 4, 4), G), c(5, 4, 4));
  assert.deepEqual(r.wahl, [false, false, false, false]);
  assert.deepEqual(r.saetze, [null, null, null, null]);
  assert.match(checkText(checkStufe(c(5, 4, 4), G), c(5, 4, 4)).grund, /anspruchsvollere Version/);
});

test('Leicht: alle Übungen einfach, ohne Muskelkater gleiche Satzzahl', () => {
  const ch = c(4, 3, 2);
  const r = wendeVorschlagAn(PLAN, [true, false, false, false], checkStufe(ch, G), ch);
  assert.deepEqual(r.wahl, [false, false, false, false]);
  assert.deepEqual(r.saetze, [null, null, null, null]);
});

test('Leicht mit Muskelkater in mehreren Regionen: dort je ein Satz weniger', () => {
  const ch = c(2, 3, 3, ['Beine', 'Rumpf']); // Summe 8
  assert.equal(fragtRegionen(ch), true);
  const e = checkStufe(ch, G);
  assert.equal(e.stufe, 'leicht');
  const r = wendeVorschlagAn(PLAN, [true, false, false, false], e, ch);
  assert.deepEqual(r.wahl, [false, false, false, false]);
  assert.deepEqual(r.saetze, [null, 2, null, 1]); // Squat 3→2, Unterarmstütz 2→1, Oberkörper unverändert
  assert.match(checkText(e, ch).grund, /Beine, Rumpf je ein Satz weniger/);
});

test('Regionen zählen nur bei Muskelkater 2 oder schlechter', () => {
  const ch = c(3, 2, 3, ['Oberkörper']); // Muskelkater 3: keine Regionenfrage
  assert.equal(fragtRegionen(ch), false);
  const r = wendeVorschlagAn(PLAN, [], checkStufe(ch, G), ch);
  assert.deepEqual(r.saetze, [null, null, null, null]);
  assert.equal(checkFelder(ch, checkStufe(ch, G), true).check_regionen, undefined);
});

test('Reduziert: alle einfach, höchstens 2 Sätze', () => {
  const ch = c(2, 2, 2, ['Oberkörper']);
  const r = wendeVorschlagAn(PLAN, [true, false, false, false], checkStufe(ch, G), ch);
  assert.deepEqual(r.wahl, [false, false, false, false]);
  assert.deepEqual(r.saetze, [2, 2, 2, 2]);
});

test('Summe 3: Vorschlag Spaziergang oder Laufband statt Kraft', () => {
  const e = checkStufe(c(1, 1, 1), G);
  assert.match(checkText(e, c(1, 1, 1)).grund, /20–30 Min\. Spaziergang oder Laufband/);
});

test('Regionen der Übungen', () => {
  assert.equal(uebungsRegion('Liegestütze (Studio)'), 'Oberkörper');
  assert.equal(uebungsRegion('Klimmzüge mit Band'), 'Oberkörper');
  assert.equal(uebungsRegion('Bulgarian Split Squat'), 'Beine');
  assert.equal(uebungsRegion('Glute Bridge'), 'Beine');
  assert.equal(uebungsRegion('Dead Bug'), 'Rumpf');
  assert.equal(uebungsRegion('Seitstütz'), 'Rumpf');
});

test('Gespeicherte Felder: Werte, Regionen, Vorschlag und ob angenommen', () => {
  const ch = c(2, 3, 3, ['Beine', 'Rumpf']);
  const f = checkFelder(ch, checkStufe(ch, G), true);
  assert.deepEqual(f, { check_muskelkater: 2, check_schlaf: 3, check_energie: 3, check_regionen: ['Beine', 'Rumpf'], check_vorschlag: 'leicht', check_angenommen: true });
  assert.deepEqual(checkFelder(c(5, 5), null, true), {});
  assert.match(checkZeile(f), /Muskelkater 2 · Schlaf 3 · Energie 3 \(Muskelkater: Beine, Rumpf\) – einfache Version/);
});

test('Vorschlag abgelehnt: normal trainiert, gespeichert mit angenommen = false, vollständig = grün', () => {
  const ch = c(2, 2, 2);
  const f = checkFelder(ch, checkStufe(ch, G), false);
  assert.equal(f.check_angenommen, false);
  assert.match(checkZeile(f), /reduzierte Einheit vorgeschlagen, normal trainiert/);
  const s = stand();
  s.trainings.push(kraft(MO, 'Kraft A', f));
  assert.equal(tagBewertung(s, MO, SPAETER).training, 'gruen');
});

test('Wertung: angepasster Vorschlag vollständig = erledigt (100 %), abgebrochen = verkürzt, ersetzt = verkürzt (50 %)', () => {
  const voll = stand();
  voll.trainings.push(kraft(MO, 'Kraft A', { check_vorschlag: 'reduziert', check_angenommen: true }));
  assert.equal(tagBewertung(voll, MO, SPAETER).training, 'gruen');

  const ab = stand();
  ab.trainings.push(kraft(MO, 'Kraft A', { verkuerzt: true, check_vorschlag: 'leicht', check_angenommen: true }));
  assert.equal(tagBewertung(ab, MO, SPAETER).training, 'gelb');

  const ers = stand();
  ers.tage[MO] = { datum: MO, kcal: 2200, eiweiss_g: 150, schritte: 5000 };
  ers.trainings.push(kraft(MO, 'Kraft A', { verkuerzt: true, ersetzt: true, check_vorschlag: 'ersatz', check_angenommen: true }));
  assert.equal(tagBewertung(ers, MO, SPAETER).training, 'gelb');
  assert.equal(tagWertung(ers, MO, SPAETER).bereiche.training.prozent, 50);
});

test('Bonus-Tag: durch Bewegung ersetzt zählt gelb, echte Krafteinheit grün', () => {
  const s = stand();
  s.trainings.push(kraft(SA, 'Kraft C', { verkuerzt: true, ersetzt: true }));
  assert.equal(tagBewertung(s, SA, SPAETER).training, 'gelb');
  s.trainings.push(kraft(SA, 'Studio'));
  assert.equal(tagBewertung(s, SA, SPAETER).training, 'gruen');
});

test('Import: Check-Felder werden übernommen, falsche Werte abgelehnt', () => {
  const block = (extra) => `FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'training', datum: START, einheit: 'Kraft A', uebungen: [], ...extra }] })}`;
  const r = leseImport(block({ check_muskelkater: 2, check_schlaf: 4, check_energie: 3, check_regionen: ['Beine'], check_vorschlag: 'leicht', check_angenommen: true }));
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const s = stand();
  const { state } = verarbeite(s, r.eintraege);
  const t = state.trainings.find((x) => x.einheit === 'Kraft A');
  assert.equal(t.check_muskelkater, 2);
  assert.deepEqual(t.check_regionen, ['Beine']);
  assert.equal(t.check_vorschlag, 'leicht');
  assert.equal(leseImport(block({ check_schlaf: 6 })).ok, false);
  assert.equal(leseImport(block({ check_regionen: ['Arme'] })).ok, false);
  assert.equal(leseImport(block({ check_vorschlag: 'egal' })).ok, false);
});
