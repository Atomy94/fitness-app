import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streak, tagWertung } from '../js/core/wertung.js';
import { setzeZiel } from '../js/core/ziele.js';
import { plusTage } from '../js/core/datum.js';
import { stand, MO, DI, MI, DO, FR, SA, SO } from './hilfe.mjs';

// Einfache Tage: Der Wochenplan ist leer, es zählen nur Ernährung und Schritte.
function leererPlan() {
  const s = stand();
  for (let wt = 1; wt <= 7; wt++) s.einstellungen.plan.wochenplan[wt] = { typ: 'frei', text: '' };
  return s;
}
const gut = (s, d) => { s.tage[d] = { datum: d, kcal: 2200, eiweiss_g: 150, schritte: 5000 }; }; // 100 %
const schwach = (s, d) => { s.tage[d] = { datum: d, kcal: 1500, eiweiss_g: 60, schritte: 500 }; }; // weit unter 80 %
const NAE_MO = '2026-11-16', NAE_DI = '2026-11-17', NAE_MI = '2026-11-18', NAE_DO = '2026-11-19';

test('Grundlage: guter Tag ab 80 %, schwacher darunter', () => {
  const s = leererPlan();
  gut(s, MO); schwach(s, DI);
  assert.equal(tagWertung(s, MO, SO).gut, true);
  assert.equal(tagWertung(s, DI, SO).gut, false);
  assert.equal(tagWertung(s, MI, SO).gut, false); // ohne Daten
});

test('Streak zählt gute Tage in Folge und merkt sich den längsten', () => {
  const s = leererPlan();
  for (const d of [MO, DI, MI, DO]) gut(s, d);
  const r = streak(s, FR); // heute Freitag, noch ohne Daten
  assert.equal(r.aktuell, 4);
  assert.equal(r.laengster, 4);
  assert.deepEqual(r.joker, []);
  assert.equal(r.jokerFrei, true);
  assert.equal(r.heuteOffen, true);
  assert.deepEqual(streak(stand(), MO), { aktuell: 0, laengster: 0, joker: [], jokerFrei: true, heuteGut: false, heuteOffen: true });
});

test('Joker: ein schwacher Tag pro Woche reißt den Streak nicht, zählt aber nicht mit', () => {
  const s = leererPlan();
  gut(s, MO); gut(s, DI); schwach(s, MI); gut(s, DO); gut(s, FR);
  const r = streak(s, SA);
  assert.equal(r.aktuell, 4); // Mo, Di, Do, Fr – der Mittwoch zählt nicht
  assert.deepEqual(r.joker, [MI]);
  assert.equal(r.jokerFrei, false); // in dieser Woche verbraucht
});

test('Zweiter schwacher Tag in derselben Woche beendet den Streak', () => {
  const s = leererPlan();
  gut(s, MO); gut(s, DI); schwach(s, MI); gut(s, DO); schwach(s, FR); gut(s, SA);
  const r = streak(s, SO);
  assert.equal(r.aktuell, 1); // nur der Samstag nach dem Abbruch
  assert.equal(r.laengster, 3); // Mo, Di, Do
  assert.deepEqual(r.joker, [MI]); // der Freitag ist kein Joker, sondern der Abbruch
});

test('Tage ohne Ernährungsdaten zählen als schwache Tage', () => {
  const s = leererPlan();
  gut(s, MO); gut(s, DI); /* Mi fehlt */ gut(s, DO); /* Fr fehlt */ gut(s, SA);
  const r = streak(s, SO);
  assert.deepEqual(r.joker, [MI]);
  assert.equal(r.aktuell, 1);
  assert.equal(r.laengster, 3);
});

test('Wochenwechsel: jede Woche hat ihren eigenen Joker', () => {
  const s = leererPlan();
  for (const d of [MO, DI, MI, DO, FR, SA]) gut(s, d);
  schwach(s, SO); // Joker der ersten Woche (Sonntag)
  schwach(s, NAE_MO); // Montag der neuen Woche: neuer Joker, Streak hält
  gut(s, NAE_DI); gut(s, NAE_MI);
  let r = streak(s, NAE_DO);
  assert.equal(r.aktuell, 8);
  assert.deepEqual(r.joker, [SO, NAE_MO]);
  assert.equal(r.jokerFrei, false);
  // ein weiterer schwacher Tag in der zweiten Woche beendet ihn
  schwach(s, NAE_DO);
  r = streak(s, plusTage(NAE_DO, 1));
  assert.equal(r.aktuell, 0);
  assert.equal(r.laengster, 8);
  // neue Woche ohne schwachen Tag: Joker wieder frei
  assert.equal(streak(s, '2026-11-23').jokerFrei, true);
});

test('Erster schwacher Tag der Woche ohne laufenden Streak verbraucht trotzdem die eine Ausnahme der Woche', () => {
  const s = leererPlan();
  schwach(s, MO); gut(s, DI); gut(s, MI); schwach(s, DO); gut(s, FR);
  const r = streak(s, SA);
  assert.deepEqual(r.joker, []); // am Montag gab es nichts zu schützen, also kein Joker-Tag im Kalender
  assert.equal(r.aktuell, 1); // der Donnerstag war der zweite schwache Tag der Woche
  assert.equal(r.laengster, 2);
});

test('Heute kann den Streak erst beenden, wenn der Tag vorbei ist', () => {
  const s = leererPlan();
  gut(s, MO); schwach(s, DI); gut(s, MI); // Joker am Dienstag verbraucht
  // Donnerstag = heute, bisher schwach: Streak bleibt, kein Abbruch
  schwach(s, DO);
  let r = streak(s, DO);
  assert.equal(r.aktuell, 2);
  assert.equal(r.heuteOffen, true);
  assert.equal(r.heuteGut, false);
  // im Laufe des Tages wird er gut: zählt sofort mit
  gut(s, DO);
  r = streak(s, DO);
  assert.equal(r.aktuell, 3);
  assert.equal(r.heuteGut, true);
  assert.equal(r.heuteOffen, false);
  // bleibt er schwach, endet der Streak erst am nächsten Tag
  schwach(s, DO);
  assert.equal(streak(s, FR).aktuell, 0);
  // heute schwach verbraucht noch keinen Joker
  const t = leererPlan();
  gut(t, MO); schwach(t, DI);
  assert.equal(streak(t, DI).jokerFrei, true);
  assert.deepEqual(streak(t, DI).joker, []);
  assert.deepEqual(streak(t, MI).joker, [DI]);
});

test('Streak nutzt die Tageswertung samt Training und die Grenze aus den Daten', () => {
  const s = stand(); // normaler Plan: Montag Kraft A Pflicht
  s.tage[MO] = { datum: MO, kcal: 2200, eiweiss_g: 150, schritte: 5000 }; // ohne Training: 75 %
  assert.equal(streak(s, DI).aktuell, 0);
  setzeZiel(s.ziele, 'wertung_guter_tag', MO, 70);
  assert.equal(streak(s, DI).aktuell, 1);
});

test('Gezählt wird erst ab dem Planstart', () => {
  const s = leererPlan();
  s.tage['2026-11-05'] = { datum: '2026-11-05', kcal: 2200, eiweiss_g: 150, schritte: 9000 };
  gut(s, MO);
  assert.equal(streak(s, DI).aktuell, 1);
  assert.equal(streak(s, '2026-11-08').aktuell, 0); // heute liegt vor dem Start
});
