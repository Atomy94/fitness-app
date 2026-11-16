import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abendVorschlag, standardSnacks, quarkHinweis } from '../js/core/vorschlag.js';
import { tagesZiele, setzeZiel } from '../js/core/ziele.js';
import { ergaenze } from '../js/core/state.js';
import { stand, MO, SO } from './hilfe.mjs';

const SNACKS = standardSnacks();
const ziele = (datum = MO, fussball = false) => tagesZiele(stand(), datum, fussball);
const namen = (v) => v.liste.map((x) => x.snacks.map((s) => s.name.split(' ')[0]).join('+'));

test('Grundlage: Korridor, Eiweiß-Mindestwert und Fettgrenze kommen aus den Daten', () => {
  const z = ziele();
  assert.deepEqual([z.kcal.min, z.kcal.max, z.eiweiss.min, z.fettMax], [2100, 2450, 150, 75]);
  assert.equal(SNACKS.length, 4);
  assert.deepEqual(SNACKS.find((s) => /Skyr/.test(s.name)), { id: 'snack-skyr', name: 'Skyr 150 g + Beeren 100 g', kcal: 135, eiweiss_g: 17, fett_g: 0.5 });
});

test('Eiweiß fehlt: zuerst der Snack, der die Eiweißlücke schließt', () => {
  const v = abendVorschlag({ kcal: 2150, eiweiss_g: 128, fett_g: 60 }, ziele(), SNACKS);
  assert.equal(v.status, 'vorschlag');
  assert.deepEqual(v.fehlt, { kcal: 0, eiweiss: 22 });
  assert.deepEqual(v.frei, { kcal: 300, fett: 15 });
  // 22 g fehlen: Shake (24 g), Handkäse (30 g) und Quark (30 g) reichen allein; Skyr (17 g) nicht.
  // Unter den ausreichenden gewinnt der mit den wenigsten Kalorien.
  assert.deepEqual(namen(v), ['Proteinshake', 'Handkäse']);
  assert.deepEqual(v.liste[0].danach, { kcal: 2270, eiweiss: 152, fett: 62 });
  assert.deepEqual(v.liste[0].erreicht, { kcal: true, eiweiss: true });
  assert.ok(v.liste.every((x) => x.danach.kcal <= 2450));
});

test('Großes Eiweißloch: Kombination aus zwei Snacks', () => {
  const v = abendVorschlag({ kcal: 1900, eiweiss_g: 95, fett_g: 50 }, ziele(), SNACKS);
  assert.deepEqual(v.fehlt, { kcal: 200, eiweiss: 55 });
  assert.equal(v.liste[0].snacks.length, 2);
  assert.equal(v.liste[0].eiweiss, 60); // Quark + Handkäse
  assert.deepEqual(v.liste[0].erreicht, { kcal: true, eiweiss: true });
  assert.equal(v.liste[0].danach.kcal, 2195);
});

test('Nur Kalorien fehlen: die kalorienreicheren Snacks zuerst', () => {
  const v = abendVorschlag({ kcal: 1980, eiweiss_g: 165, fett_g: 55 }, ziele(), SNACKS);
  assert.deepEqual(v.fehlt, { kcal: 120, eiweiss: 0 });
  // Alle vier schließen die Lücke von 120 kcal allein; gewählt wird der kalorienreichste, dann der nächste.
  assert.deepEqual(namen(v), ['Magerquark', 'Skyr']);
  assert.equal(v.liste[0].danach.kcal, 2150);
  // Größere Lücke: ein Snack reicht nicht, also zwei
  const gross = abendVorschlag({ kcal: 1800, eiweiss_g: 165, fett_g: 55 }, ziele(), SNACKS);
  assert.equal(gross.fehlt.kcal, 300);
  assert.equal(gross.liste[0].snacks.length, 2);
  assert.equal(gross.liste[0].kcal, 305); // Quark + Skyr
});

test('Alles erreicht: kein Vorschlag', () => {
  const v = abendVorschlag({ kcal: 2200, eiweiss_g: 160, fett_g: 70 }, ziele(), SNACKS);
  assert.equal(v.status, 'erreicht');
  assert.deepEqual(v.liste, []);
  assert.deepEqual(v.fehlt, { kcal: 0, eiweiss: 0 });
  // genau auf der Untergrenze zählt als erreicht
  assert.equal(abendVorschlag({ kcal: 2100, eiweiss_g: 150 }, ziele(), SNACKS).status, 'erreicht');
});

test('Kein Vorschlag führt über die Obergrenze des Korridors', () => {
  // 130 kcal frei, Eiweiß fehlt: nur Handkäse (125) und Shake (120) passen noch, Quark (170) und Skyr (135) nicht
  let v = abendVorschlag({ kcal: 2320, eiweiss_g: 125, fett_g: 60 }, ziele(), SNACKS);
  assert.equal(v.frei.kcal, 130);
  assert.deepEqual(namen(v), ['Handkäse', 'Proteinshake']);
  assert.ok(v.liste.every((x) => x.danach.kcal <= 2450));
  // nur noch 100 kcal frei: nichts passt mehr
  v = abendVorschlag({ kcal: 2350, eiweiss_g: 125, fett_g: 60 }, ziele(), SNACKS);
  assert.equal(v.status, 'nichts_passt');
  assert.deepEqual(v.liste, []);
  assert.deepEqual(v.fehlt, { kcal: 0, eiweiss: 25 });
  // schon über der Obergrenze
  v = abendVorschlag({ kcal: 2600, eiweiss_g: 120, fett_g: 60 }, ziele(), SNACKS);
  assert.equal(v.status, 'nichts_passt');
  assert.equal(v.frei.kcal, 0);
});

test('Fettgrenze: Snacks, die darüber führen, fallen weg; ohne Fettwert wird sie nicht geprüft', () => {
  // 1,5 g Fett frei: der Shake (2 g) fällt weg
  const v = abendVorschlag({ kcal: 2150, eiweiss_g: 128, fett_g: 73.5 }, ziele(), SNACKS);
  assert.equal(v.frei.fett, 1.5);
  assert.deepEqual(namen(v), ['Handkäse', 'Magerquark']);
  const ohne = abendVorschlag({ kcal: 2150, eiweiss_g: 128 }, ziele(), SNACKS);
  assert.equal(ohne.frei.fett, null);
  assert.equal(namen(ohne)[0], 'Proteinshake');
  assert.equal(ohne.liste[0].danach.fett, null);
});

test('Fußballtag und geänderte Grenzen: gerechnet wird mit dem Korridor des Tages', () => {
  const v = abendVorschlag({ kcal: 2250, eiweiss_g: 160, fett_g: 60 }, ziele(SO, true), SNACKS);
  assert.deepEqual(v.fehlt, { kcal: 150, eiweiss: 0 }); // Fußballtag: grün ab 2.400
  assert.equal(abendVorschlag({ kcal: 2250, eiweiss_g: 160, fett_g: 60 }, ziele(MO), SNACKS).status, 'erreicht');
  const s = stand();
  setzeZiel(s.ziele, 'eiweiss_min', MO, 170);
  assert.equal(abendVorschlag({ kcal: 2250, eiweiss_g: 160 }, tagesZiele(s, MO, false), SNACKS).fehlt.eiweiss, 10);
});

test('Ohne Tageswerte oder ohne Snack-Liste', () => {
  assert.equal(abendVorschlag({}, ziele(), SNACKS).status, 'keine_daten');
  assert.equal(abendVorschlag(null, ziele(), SNACKS).status, 'keine_daten');
  assert.equal(abendVorschlag({ kcal: 1800, eiweiss_g: 100 }, ziele(), []).status, 'nichts_passt');
  assert.equal(abendVorschlag({ kcal: 1800 }, ziele(), SNACKS).fehlt.eiweiss, 150); // fehlendes Eiweiß zählt als 0
  // unvollständige Einträge der Liste werden übergangen
  const v = abendVorschlag({ kcal: 2000, eiweiss_g: 140 }, ziele(), [{ name: '' }, { name: 'Ohne Werte' }, { name: 'Ei', kcal: 90, eiweiss_g: 13, fett_g: 6 }]);
  assert.deepEqual(namen(v), ['Ei']);
});

test('Quark-Grenze wird als Hinweis geführt und bei älteren Ständen nachgetragen', () => {
  const liste = standardSnacks();
  quarkHinweis(liste, 250);
  assert.match(liste.find((s) => /quark/i.test(s.name)).hinweis, /höchstens 250 g pro Tag/);
  assert.equal(liste.filter((s) => s.hinweis).length, 1);
  quarkHinweis(liste, undefined); // ohne Grenze passiert nichts
  const alt = ergaenze({ tage: {}, einstellungen: { start: '2026-11-09', plan: {}, minimal: {}, archiv: { nutrition_targets: { quark_max_g_per_day: 250 } } } }, '2026-11-16');
  assert.equal(alt.einstellungen.snacks.length, 4);
  assert.equal(alt.einstellungen.vorschlagAbStunde, 20);
  assert.ok(alt.einstellungen.snacks.some((s) => s.hinweis));
  // eine schon vorhandene (auch geleerte) Liste bleibt unangetastet
  const eigen = ergaenze({ tage: {}, einstellungen: { start: '2026-11-09', plan: {}, minimal: {}, snacks: [] } }, '2026-11-16');
  assert.deepEqual(eigen.einstellungen.snacks, []);
});
