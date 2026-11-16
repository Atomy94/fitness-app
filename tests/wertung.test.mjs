import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagWertung, wochenProzent, kcalAnteil, trainingAnteil } from '../js/core/wertung.js';
import { setzeZiel, zielWert } from '../js/core/ziele.js';
import { stand, kraft, cardio, MO, DI, MI, DO, FR, SA, SO, SPAETER } from './hilfe.mjs';

const nah = (ist, soll, text) => assert.ok(Math.abs(ist - soll) < 1e-6, `${text || ''} erwartet ${soll}, ist ${ist}`);
const tag = (s, datum, werte) => { s.tage[datum] = { datum, ...werte }; };

test('Gewichte und Grenze stehen in den Daten', () => {
  const s = stand();
  const z = (k) => zielWert(s.ziele, k, MO);
  assert.deepEqual([z('wertung_kcal_pct'), z('wertung_eiweiss_pct'), z('wertung_training_pct'), z('wertung_schritte_pct')], [30, 20, 25, 25]);
  assert.equal(z('wertung_kcal_null_abstand'), 500);
  assert.equal(z('wertung_guter_tag'), 80);
});

test('Kalorien: 100 % im Korridor, zu wenig UND zu viel fallen linear bis 0 % bei 500 kcal Abstand', () => {
  const k = { min: 2100, max: 2450 };
  for (const [kcal, soll] of [[2100, 1], [2300, 1], [2450, 1], [2000, 0.8], [1850, 0.5], [1600, 0], [1200, 0], [2550, 0.8], [2700, 0.5], [2950, 0], [4000, 0]]) nah(kcalAnteil(kcal, k, 500), soll, `${kcal} kcal:`);
  assert.equal(kcalAnteil(undefined, k, 500), null);
  assert.deepEqual([trainingAnteil('gruen'), trainingAnteil('gelb'), trainingAnteil('rot'), trainingAnteil('offen'), trainingAnteil('grau'), trainingAnteil('leer')], [1, 0.5, 0, 0, null, null]);
});

test('Plantag: alle drei Bereiche zählen (Ernährung 50, Training 25, Schritte 25)', () => {
  const s = stand();
  tag(s, MO, { kcal: 1850, eiweiss_g: 120, schritte: 5000 }); // Kalorien 50 %, Eiweiß 80 %, Schritte 100 %
  s.trainings.push(kraft(MO));
  const w = tagWertung(s, MO, SPAETER);
  assert.equal(w.gewertet, true);
  nah(w.teile.kcal, 50); nah(w.teile.eiweiss, 80);
  nah(w.bereiche.ernaehrung.prozent, 62); // (30·0,5 + 20·0,8) / 50
  nah(w.bereiche.training.prozent, 100);
  nah(w.bereiche.schritte.prozent, 100);
  nah(w.prozent, 81); // 15 + 16 + 25 + 25
  assert.equal(w.gut, true);
  assert.equal(w.vorlaeufig, false);
  // verkürzt = 50 %, ausgefallen = 0 %
  s.trainings[0].verkuerzt = true;
  nah(tagWertung(s, MO, SPAETER).prozent, 68.5);
  s.trainings = [];
  nah(tagWertung(s, MO, SPAETER).prozent, 56);
  assert.equal(tagWertung(s, MO, SPAETER).gut, false);
});

test('Ruhetag: Training wird nicht gewertet, seine 25 % verteilen sich anteilig', () => {
  const s = stand();
  tag(s, MI, { kcal: 2200, eiweiss_g: 150, schritte: 2500 }); // Ernährung 100 %, Schritte 50 %
  const w = tagWertung(s, MI, SPAETER);
  assert.equal(w.bereiche.training.prozent, null);
  nah(w.prozent, (50 * 1 + 25 * 0.5) / 75 * 100); // 83,33 %
  // Zusatztraining am Ruhetag ändert die Wertung nicht
  s.trainings.push(cardio(MI, 'Laufband', 40));
  nah(tagWertung(s, MI, SPAETER).prozent, 83.3333333);
});

test('Samstag: Bonus erledigt 100 %, ausgefallen wird nicht gewertet', () => {
  const s = stand();
  tag(s, SA, { kcal: 2200, eiweiss_g: 150, schritte: 5000 });
  let w = tagWertung(s, SA, SPAETER);
  assert.equal(w.bereiche.training.prozent, null); // ausgefallen: keine Strafe
  nah(w.prozent, 100);
  s.trainings.push(kraft(SA, 'Kraft C'));
  w = tagWertung(s, SA, SPAETER);
  nah(w.bereiche.training.prozent, 100);
  nah(w.prozent, 100);
});

test('Sonntag: Fußball oder Spaziergang ab 45 Min. = 100 %, sonst 0 %', () => {
  const s = stand();
  tag(s, SO, { kcal: 2500, eiweiss_g: 150, schritte: 5000, fussball: true });
  nah(tagWertung(s, SO, SPAETER).prozent, 100); // Fußballtag: Korridor 2.400–2.750
  tag(s, SO, { kcal: 2200, eiweiss_g: 150, schritte: 5000, fussball: false });
  nah(tagWertung(s, SO, SPAETER).prozent, 75); // ausgefallen ohne Ersatz
  s.trainings.push(cardio(SO, 'Spaziergang', 45));
  nah(tagWertung(s, SO, SPAETER).prozent, 100);
});

test('Laufband-Tag: ab 25 Min. 100 %, 15–24 Min. 50 %, darunter 0 %', () => {
  for (const [min, soll] of [[30, 100], [20, 50], [10, 0]]) {
    const s = stand();
    tag(s, DI, { kcal: 2200, eiweiss_g: 150, schritte: 5000 });
    s.trainings.push(cardio(DI, 'Laufband', min));
    nah(tagWertung(s, DI, SPAETER).bereiche.training.prozent, soll, `${min} Min.:`);
  }
});

test('Zu viel und zu wenig Kalorien, Eiweiß und Schritte nie über 100 %', () => {
  const s = stand();
  tag(s, MI, { kcal: 2700, eiweiss_g: 220, schritte: 20000 }); // 250 kcal über dem Korridor
  let w = tagWertung(s, MI, SPAETER);
  nah(w.teile.kcal, 50); nah(w.teile.eiweiss, 100); nah(w.bereiche.schritte.prozent, 100);
  nah(w.prozent, (30 * 0.5 + 20 + 25) / 75 * 100); // 80 %
  assert.ok(w.prozent <= 100);
  tag(s, MI, { kcal: 1500, eiweiss_g: 75, schritte: 0 }); // weit zu wenig
  w = tagWertung(s, MI, SPAETER);
  nah(w.teile.kcal, 0); nah(w.teile.eiweiss, 50);
  nah(w.prozent, (20 * 0.5) / 75 * 100);
  tag(s, MI, { kcal: 2300, eiweiss_g: 500, schritte: 99999 });
  assert.equal(tagWertung(s, MI, SPAETER).prozent, 100); // mehr als 100 % gibt es nicht
});

test('Fehlende Daten: ohne Ernährungsdaten grau; fehlende Schritte verteilen ihr Gewicht', () => {
  const s = stand();
  assert.equal(tagWertung(s, MO, SPAETER).gewertet, false); // gar keine Daten
  tag(s, MO, { schritte: 9000 });
  s.trainings.push(kraft(MO));
  let w = tagWertung(s, MO, SPAETER);
  assert.equal(w.gewertet, false);
  assert.equal(w.prozent, null);
  assert.equal(w.gut, false);
  nah(w.bereiche.schritte.prozent, 100); // die Bereiche werden trotzdem berechnet und angezeigt
  // Ernährung da, Schritte fehlen
  tag(s, MO, { kcal: 2200, eiweiss_g: 150 });
  w = tagWertung(s, MO, SPAETER);
  assert.equal(w.bereiche.schritte.prozent, null);
  nah(w.prozent, 100); // Ernährung 50 + Training 25, auf 75 bezogen
  // nur Kalorien, kein Eiweißwert: Ernährung = Kalorienwertung
  tag(s, MO, { kcal: 1850 });
  w = tagWertung(s, MO, SPAETER);
  assert.equal(w.teile.eiweiss, null);
  nah(w.bereiche.ernaehrung.prozent, 50);
  // Zukunft wird nicht gewertet
  tag(s, DO, { kcal: 2200, eiweiss_g: 150 });
  assert.equal(tagWertung(s, DO, MO).gewertet, false);
});

test('Heute ist vorläufig; offenes Training zählt bis dahin 0 %', () => {
  const s = stand();
  tag(s, MO, { kcal: 2200, eiweiss_g: 150, schritte: 2500 });
  const w = tagWertung(s, MO, MO);
  assert.equal(w.vorlaeufig, true);
  nah(w.bereiche.training.prozent, 0);
  nah(w.prozent, 62.5); // 50 + 0 + 12,5
  assert.equal(tagWertung(s, MO, DI).vorlaeufig, false);
});

test('Geänderte Gewichte und Grenze gelten ab ihrem Datum', () => {
  const s = stand();
  tag(s, MI, { kcal: 2200, eiweiss_g: 150, schritte: 2500 });
  tag(s, '2026-11-18', { kcal: 2200, eiweiss_g: 150, schritte: 2500 }); // Mittwoch der Folgewoche
  setzeZiel(s.ziele, 'wertung_schritte_pct', '2026-11-16', 50);
  setzeZiel(s.ziele, 'wertung_guter_tag', '2026-11-16', 90);
  nah(tagWertung(s, MI, SPAETER).prozent, 83.3333333);
  assert.equal(tagWertung(s, MI, SPAETER).gut, true);
  const neu = tagWertung(s, '2026-11-18', SPAETER);
  nah(neu.prozent, (50 + 50 * 0.5) / 100 * 100); // 75 %
  assert.equal(neu.schwelle, 90);
});

test('Wochenwertung: Durchschnitt der gewerteten Tage, Bereiche einzeln, laufende Woche vorläufig', () => {
  const s = stand();
  tag(s, MO, { kcal: 2200, eiweiss_g: 150, schritte: 5000 }); s.trainings.push(kraft(MO)); // 100 %
  tag(s, DI, { kcal: 1850, eiweiss_g: 120, schritte: 5000 }); // Laufband ausgefallen: 15 + 16 + 0 + 25 = 56 %
  tag(s, MI, { kcal: 2200, eiweiss_g: 150, schritte: 2500 }); // Ruhetag: 83,33 %
  tag(s, DO, { schritte: 6000 }); // ohne Ernährungsdaten: nicht gewertet
  const w = wochenProzent(s, MO, SPAETER);
  assert.equal(w.anzahl, 3);
  nah(w.prozent, (100 + 56 + 83.3333333) / 3);
  assert.equal(w.guteTage, 2);
  assert.equal(w.vorlaeufig, false);
  nah(w.bereiche.ernaehrung, (100 + 62 + 100) / 3);
  nah(w.bereiche.training, 50); // Mo 100, Di 0; Mi nicht gewertet
  nah(w.bereiche.schritte, (100 + 100 + 50) / 3);
  // laufende Woche: nur die bisherigen Tage, als vorläufig markiert
  const lauf = wochenProzent(s, MO, DI);
  assert.equal(lauf.vorlaeufig, true);
  assert.equal(lauf.anzahl, 2);
  assert.equal(wochenProzent(s, MO, SO).vorlaeufig, true);
  assert.equal(wochenProzent(s, MO, '2026-11-16').vorlaeufig, false);
  // Woche ohne gewertete Tage
  const leer = wochenProzent(stand(), MO, SPAETER);
  assert.equal(leer.prozent, null);
  assert.equal(leer.anzahl, 0);
});
