import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kcalStatus, eiweissStatus, ernaehrungStatus, schritteStatus, ballaststoffStatus, gesFettStatus, kreatinStatus,
  kcalWocheStatus, trainingStatus, tagBewertung, wochenWertung, gleitSchnitt, zielpfad, fussballGespielt,
  GRUEN, GELB, ROT, GRAU, LEER, OFFEN,
} from '../js/core/bewertung.js';
import { tagesZiele, zielWert, setzeZiel, minimalAktiv } from '../js/core/ziele.js';
import { stand, kraft, cardio, MO, DI, MI, DO, FR, SA, SO, SPAETER } from './hilfe.mjs';

const normal = { min: 2100, max: 2450, gelbMin: 1950, gelbMax: 2650 };

test('Kalorienkorridor Mo–Sa: zu wenig ist nicht grün', () => {
  assert.equal(kcalStatus(2100, normal), GRUEN);
  assert.equal(kcalStatus(2450, normal), GRUEN);
  assert.equal(kcalStatus(2099, normal), GELB);
  assert.equal(kcalStatus(1950, normal), GELB);
  assert.equal(kcalStatus(1949, normal), ROT);
  assert.equal(kcalStatus(2451, normal), GELB);
  assert.equal(kcalStatus(2650, normal), GELB);
  assert.equal(kcalStatus(2651, normal), ROT);
  assert.equal(kcalStatus(1200, normal), ROT);
  assert.equal(kcalStatus(null, normal), LEER);
  assert.equal(kcalStatus(undefined, normal), LEER);
});

test('Eiweiß: grün ab 150, gelb 135–149, darunter rot', () => {
  const z = { min: 150, gelbMin: 135 };
  assert.equal(eiweissStatus(150, z), GRUEN);
  assert.equal(eiweissStatus(172, z), GRUEN);
  assert.equal(eiweissStatus(149, z), GELB);
  assert.equal(eiweissStatus(149.9, z), GELB);
  assert.equal(eiweissStatus(135, z), GELB);
  assert.equal(eiweissStatus(134, z), ROT);
  assert.equal(eiweissStatus(null, z), LEER);
});

test('Bereich Ernährung: grün nur wenn beide grün, rot wenn eines rot, sonst gelb', () => {
  assert.equal(ernaehrungStatus(GRUEN, GRUEN), GRUEN);
  assert.equal(ernaehrungStatus(GRUEN, GELB), GELB);
  assert.equal(ernaehrungStatus(GELB, GRUEN), GELB);
  assert.equal(ernaehrungStatus(GELB, GELB), GELB);
  assert.equal(ernaehrungStatus(ROT, GRUEN), ROT);
  assert.equal(ernaehrungStatus(GRUEN, ROT), ROT);
  assert.equal(ernaehrungStatus(GELB, ROT), ROT);
  assert.equal(ernaehrungStatus(LEER, LEER), LEER);
  assert.equal(ernaehrungStatus(GRUEN, LEER), GRUEN);
  assert.equal(ernaehrungStatus(LEER, ROT), ROT);
});

test('Schritte: grün ab Ziel, gelb 90–99 %, rot unter 90 %', () => {
  const z = { ziel: 5000, gelbPct: 90 };
  assert.equal(schritteStatus(5000, z), GRUEN);
  assert.equal(schritteStatus(9000, z), GRUEN);
  assert.equal(schritteStatus(4999, z), GELB);
  assert.equal(schritteStatus(4500, z), GELB);
  assert.equal(schritteStatus(4499, z), ROT);
  assert.equal(schritteStatus(0, z), ROT);
  assert.equal(schritteStatus(null, z), LEER);
});

test('Ballaststoffe, gesättigte Fette, Kreatin', () => {
  const b = { min: 30, gelbMin: 25 };
  assert.equal(ballaststoffStatus(30, b), GRUEN);
  assert.equal(ballaststoffStatus(28.5, b), GELB);
  assert.equal(ballaststoffStatus(25, b), GELB);
  assert.equal(ballaststoffStatus(24.9, b), ROT);
  assert.equal(ballaststoffStatus(undefined, b), LEER);
  const g = { max: 25, gelbMax: 30 };
  assert.equal(gesFettStatus(25, g), GRUEN);
  assert.equal(gesFettStatus(26, g), GELB);
  assert.equal(gesFettStatus(30, g), GELB);
  assert.equal(gesFettStatus(35.1, g), ROT);
  assert.equal(kreatinStatus(true), GRUEN);
  assert.equal(kreatinStatus(false), ROT);
  assert.equal(kreatinStatus(null), LEER);
});

test('Ballaststoffe, gesättigte Fette und Kreatin beeinflussen den Bereich Ernährung NICHT', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, kcal: 2200, eiweiss_g: 160, ballaststoffe_g: 5, ges_fett_g: 60, kreatin: false };
  const b = tagBewertung(s, MO, SPAETER);
  assert.equal(b.ernaehrung, GRUEN);
  assert.equal(b.ballaststoffe, ROT);
  assert.equal(b.gesFett, ROT);
  assert.equal(b.kreatin, ROT);
});

test('Kalorien-Wochenschnitt: grün 2.150–2.450, gelb 2.000–2.149 und 2.451–2.600, sonst rot', () => {
  const z = { min: 2150, max: 2450, gelbMin: 2000, gelbMax: 2600 };
  assert.equal(kcalWocheStatus(2150, z), GRUEN);
  assert.equal(kcalWocheStatus(2450, z), GRUEN);
  assert.equal(kcalWocheStatus(2149, z), GELB);
  assert.equal(kcalWocheStatus(2000, z), GELB);
  assert.equal(kcalWocheStatus(1999, z), ROT);
  assert.equal(kcalWocheStatus(2500, z), GELB);
  assert.equal(kcalWocheStatus(2601, z), ROT);
  assert.equal(kcalWocheStatus(null, z), LEER);
});

test('Sonntag MIT Fußball: Korridor 2.400–2.750, Ziel 2.500', () => {
  const s = stand();
  s.tage[SO] = { datum: SO, kcal: 2500, eiweiss_g: 160, fussball: true };
  const b = tagBewertung(s, SO, SPAETER);
  assert.equal(b.fussball, true);
  assert.equal(b.ziele.kcal.ziel, 2500);
  assert.equal(b.kcal, GRUEN);
  assert.equal(b.training, GRUEN);
  s.tage[SO].kcal = 2300; assert.equal(tagBewertung(s, SO, SPAETER).kcal, GELB);
  s.tage[SO].kcal = 2249; assert.equal(tagBewertung(s, SO, SPAETER).kcal, ROT);
  s.tage[SO].kcal = 2750; assert.equal(tagBewertung(s, SO, SPAETER).kcal, GRUEN);
  s.tage[SO].kcal = 2950; assert.equal(tagBewertung(s, SO, SPAETER).kcal, GELB);
  s.tage[SO].kcal = 2951; assert.equal(tagBewertung(s, SO, SPAETER).kcal, ROT);
});

test('Sonntag OHNE Fußball: Kalorienziel 2.200, Spaziergang ab 45 Min. zählt', () => {
  const s = stand();
  s.tage[SO] = { datum: SO, kcal: 2500, eiweiss_g: 160, fussball: false };
  let b = tagBewertung(s, SO, SPAETER);
  assert.equal(b.ziele.kcal.ziel, 2200);
  assert.equal(b.kcal, GELB); // 2.500 liegt über dem Mo–Sa-Korridor
  assert.equal(b.training, ROT); // ausgefallen, kein Ersatz
  s.trainings.push(cardio(SO, 'Spaziergang', 44));
  assert.equal(tagBewertung(s, SO, SPAETER).training, ROT);
  s.trainings.push(cardio(SO, 'Spaziergang', 1));
  assert.equal(tagBewertung(s, SO, SPAETER).training, GRUEN);
  s.tage[SO].kcal = 2200;
  assert.equal(tagBewertung(s, SO, SPAETER).kcal, GRUEN);
});

test('Sonntag: eingetragene Fußball-Einheit zählt als gespielt; ohne Angabe gilt für heute der Plan', () => {
  const s = stand();
  assert.equal(fussballGespielt(s, SO, SO), true); // heute, noch nichts eingetragen: Plan
  assert.equal(fussballGespielt(s, SO, SPAETER), false); // vergangen ohne Angabe
  assert.equal(trainingStatus(s, SO, SO).status, OFFEN);
  s.trainings.push(cardio(SO, 'Hallenfußball', 60));
  assert.equal(fussballGespielt(s, SO, SPAETER), true);
  assert.equal(trainingStatus(s, SO, SPAETER).status, GRUEN);
  assert.equal(fussballGespielt(s, SA, SPAETER), false); // Samstag ist kein Fußballtag
});

test('Training Kraft A/B: erledigt grün, verkürzt gelb, ausgefallen rot', () => {
  const s = stand();
  assert.equal(trainingStatus(s, MO, SPAETER).status, ROT);
  assert.equal(trainingStatus(s, MO, MO).status, OFFEN);
  s.trainings.push(kraft(MO, 'Kraft A', { verkuerzt: true }));
  assert.equal(trainingStatus(s, MO, SPAETER).status, GELB);
  s.trainings.push(kraft(DO, 'Kraft B'));
  assert.equal(trainingStatus(s, DO, SPAETER).status, GRUEN);
});

test('Training Laufband Di/Fr: ab 25 Min. grün, 15–24 gelb, darunter oder ausgefallen rot', () => {
  for (const [min, erwartet] of [[30, GRUEN], [25, GRUEN], [24, GELB], [15, GELB], [14, ROT]]) {
    const s = stand();
    s.trainings.push(cardio(DI, 'Laufband', min));
    assert.equal(trainingStatus(s, DI, SPAETER).status, erwartet, `${min} Min.`);
  }
  assert.equal(trainingStatus(stand(), FR, SPAETER).status, ROT);
  const s = stand();
  s.trainings.push(cardio(FR, 'Laufband', 10), cardio(FR, 'Laufband', 15)); // zwei Einheiten zählen zusammen
  assert.equal(trainingStatus(s, FR, SPAETER).status, GRUEN);
});

test('Samstag Bonus: erledigt grün, ausgefallen grau (nicht rot)', () => {
  const s = stand();
  assert.equal(trainingStatus(s, SA, SPAETER).status, GRAU);
  s.trainings.push(kraft(SA, 'Studio Oberkörper'));
  assert.equal(trainingStatus(s, SA, SPAETER).status, GRUEN);
});

test('Nicht-Plantag (Mittwoch): grau, Training wird als Zusatz markiert, aber nicht bewertet', () => {
  const s = stand();
  let t = trainingStatus(s, MI, SPAETER);
  assert.equal(t.status, GRAU);
  assert.equal(t.zusatz, false);
  s.trainings.push(cardio(MI, 'Laufband', 31));
  t = trainingStatus(s, MI, SPAETER);
  assert.equal(t.status, GRAU);
  assert.equal(t.zusatz, true);
});

test('Training vor Planstart und in der Zukunft: leer', () => {
  const s = stand();
  assert.equal(trainingStatus(s, '2026-11-05', SPAETER).status, LEER); // Donnerstag vor dem Start
  assert.equal(trainingStatus(s, DO, MO).status, LEER); // Zukunft
});

test('Schritte-Phasen: 5.000 → 7.000 → 8.000', () => {
  const s = stand();
  assert.equal(tagesZiele(s, '2026-11-09', false).schritte.ziel, 5000);
  assert.equal(tagesZiele(s, '2026-11-22', false).schritte.ziel, 5000);
  assert.equal(tagesZiele(s, '2026-11-23', false).schritte.ziel, 7000);
  assert.equal(tagesZiele(s, '2026-12-06', false).schritte.ziel, 7000);
  assert.equal(tagesZiele(s, '2026-12-07', false).schritte.ziel, 8000);
  s.tage['2026-11-23'] = { datum: '2026-11-23', schritte: 6300 };
  assert.equal(tagBewertung(s, '2026-11-23', SPAETER).schritte, GELB);
  s.tage['2026-11-22'] = { datum: '2026-11-22', schritte: 6300 };
  assert.equal(tagBewertung(s, '2026-11-22', SPAETER).schritte, GRUEN);
});

test('Minimalversion: Schritte 6.000, Kalorien 2.100–2.500, Laufband ohne Wertung, Kraft Mo/Do', () => {
  const s = stand();
  s.einstellungen.minimal.zeitraeume.push({ von: '2026-12-07', bis: null });
  const mo = '2026-12-07', di = '2026-12-08', doo = '2026-12-10', sa = '2026-12-12';
  assert.equal(minimalAktiv(s.einstellungen, '2026-12-06'), false);
  assert.equal(minimalAktiv(s.einstellungen, mo), true);
  const z = tagesZiele(s, mo, false);
  assert.equal(z.minimal, true);
  assert.equal(z.schritte.ziel, 6000);
  assert.equal(z.kcal.min, 2100);
  assert.equal(z.kcal.max, 2500);
  assert.equal(z.eiweiss.min, 150);
  s.tage[mo] = { datum: mo, kcal: 2480, eiweiss_g: 150, schritte: 6000 };
  const b = tagBewertung(s, mo, SPAETER);
  assert.equal(b.kcal, GRUEN); // außerhalb der Minimalversion wäre 2.480 gelb
  assert.equal(b.ernaehrung, GRUEN);
  assert.equal(b.schritte, GRUEN); // 6.000 statt 8.000
  assert.equal(b.training, ROT); // Kraft am Montag bleibt Pflicht
  assert.equal(trainingStatus(s, di, SPAETER).status, GRAU); // Laufband ohne Wertung
  s.trainings.push(cardio(di, 'Laufband', 30));
  const t = trainingStatus(s, di, SPAETER);
  assert.equal(t.status, GRAU);
  assert.equal(t.zusatz, true);
  s.trainings.push(kraft(doo, 'Kraft B'));
  assert.equal(trainingStatus(s, doo, SPAETER).status, GRUEN);
  assert.equal(trainingStatus(s, sa, SPAETER).status, GRAU);
});

test('Minimalversion mit Enddatum und manuell: gilt nur im Zeitraum', () => {
  const s = stand();
  s.einstellungen.minimal.zeitraeume.push({ von: '2026-12-07', bis: '2027-01-20' }, { von: '2026-11-16', bis: '2026-11-18' });
  assert.equal(minimalAktiv(s.einstellungen, '2027-01-20'), true);
  assert.equal(minimalAktiv(s.einstellungen, '2027-01-21'), false);
  assert.equal(minimalAktiv(s.einstellungen, '2026-11-17'), true);
  assert.equal(tagesZiele(s, '2026-11-17', false).schritte.ziel, 6000);
  assert.equal(tagesZiele(s, '2026-11-19', false).schritte.ziel, 5000);
  assert.equal(tagesZiele(s, '2027-01-21', false).schritte.ziel, 8000);
});

test('Gültigkeitsdatum: vergangene Tage werden mit dem alten Ziel bewertet', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, kcal: 2150, eiweiss_g: 160 };
  s.tage['2026-12-01'] = { datum: '2026-12-01', kcal: 2150, eiweiss_g: 160 };
  assert.equal(tagBewertung(s, MO, SPAETER).kcal, GRUEN);
  setzeZiel(s.ziele, 'kcal_mo_sa_min', '2026-11-30', 2350);
  assert.equal(zielWert(s.ziele, 'kcal_mo_sa_min', '2026-11-29'), 2100);
  assert.equal(zielWert(s.ziele, 'kcal_mo_sa_min', '2026-11-30'), 2350);
  assert.equal(tagBewertung(s, MO, SPAETER).kcal, GRUEN); // alter Tag bleibt grün
  assert.equal(tagBewertung(s, '2026-12-01', SPAETER).kcal, GELB); // neuer Tag: unter 2.350
  assert.equal(zielWert(s.ziele, 'kcal_mo_sa_min', '2026-01-01'), 2100); // vor dem ersten Eintrag: frühester Wert
  setzeZiel(s.ziele, 'kcal_mo_sa_min', '2026-11-30', 2300); // gleiches Datum ersetzt
  assert.equal(s.ziele.filter((z) => z.schluessel === 'kcal_mo_sa_min').length, 2);
  assert.equal(zielWert(s.ziele, 'kcal_mo_sa_min', '2027-01-01'), 2300);
});

test('Geänderter Wochenplan: vergangene Tage werden nach dem alten Plan bewertet', () => {
  const s = stand();
  const alt = structuredClone(s.einstellungen.plan.wochenplan);
  s.einstellungen.plan.wochenplanAlt = [{ bis: '2026-11-22', wochenplan: alt }];
  s.einstellungen.plan.wochenplan[3] = { typ: 'kraft', einheit: 'Kraft A', text: 'Kraft A' }; // neu: Mittwoch
  s.einstellungen.plan.wochenplan[1] = { typ: 'frei', text: '' };
  assert.equal(trainingStatus(s, MO, SPAETER).status, ROT); // alter Plan: Montag Pflicht
  assert.equal(trainingStatus(s, MI, SPAETER).status, GRAU);
  assert.equal(trainingStatus(s, '2026-11-23', SPAETER).status, GRAU); // neuer Plan: Montag frei
  assert.equal(trainingStatus(s, '2026-11-25', SPAETER).status, ROT); // neuer Plan: Mittwoch Pflicht
});

test('Wochenwertung: drei Bereiche getrennt, Training x von y Plantagen', () => {
  const s = stand();
  const kcal = { [MO]: 2200, [DI]: 2300, [MI]: 1900, [DO]: 2150, [FR]: 2460, [SA]: 2100, [SO]: 2500 };
  const eiw = { [MO]: 160, [DI]: 140, [MI]: 170, [DO]: 150, [FR]: 155, [SA]: 151, [SO]: 165 };
  const schr = { [MO]: 5200, [DI]: 4600, [MI]: 3000, [DO]: 5000, [FR]: 7000, [SA]: 4400, [SO]: 9000 };
  for (const d of Object.keys(kcal)) s.tage[d] = { datum: d, kcal: kcal[d], eiweiss_g: eiw[d], schritte: schr[d] };
  s.tage[SO].fussball = true;
  s.trainings.push(kraft(MO), cardio(DI, 'Laufband', 20), cardio(MI, 'Laufband', 30), cardio(FR, 'Laufband', 26));
  const w = wochenWertung(s, MO, SPAETER);
  // Ernährung grün: Mo, Do, Sa, So (Di Eiweiß gelb, Mi kcal rot, Fr kcal gelb)
  assert.deepEqual(w.ernaehrung, { x: 4, von: 7 });
  // Training: Mo grün, Di gelb, Do rot (ausgefallen), Fr grün, So grün; Mi/Sa grau → 3 von 5
  assert.deepEqual(w.training, { x: 3, von: 5 });
  // Schritte grün: Mo, Do, Fr, So
  assert.deepEqual(w.schritte, { x: 4, von: 7 });
  assert.equal(Math.round(w.schritteSchnitt), Math.round(38200 / 7));
  assert.equal(Math.round(w.kcalSchnitt), Math.round(15610 / 7));
  assert.equal(w.kcalSchnittStatus, GRUEN);
  assert.equal(w.tage[2].zusatz, true);
  assert.equal(Object.hasOwn(w, 'gesamt'), false); // bewusst kein Gesamtwert
  // Bonus erledigt: Samstag wird zum gewerteten Tag
  s.trainings.push(kraft(SA, 'Kraft C'));
  assert.deepEqual(wochenWertung(s, MO, SPAETER).training, { x: 4, von: 6 });
});

test('Wochenwertung ohne Daten', () => {
  const w = wochenWertung(stand(), '2026-11-02', SPAETER);
  assert.equal(w.kcalSchnitt, null);
  assert.equal(w.kcalSchnittStatus, LEER);
  assert.equal(w.hatDaten, false);
  assert.deepEqual(w.training, { x: 0, von: 0 });
});

test('7-Tage-Schnitt Gewicht', () => {
  const p = [94.8, 94.1, 95.0, 93.8, 93.4, 93.4].map((wert, i) => ({ datum: `2026-11-${String(9 + i).padStart(2, '0')}`, wert }));
  const g = gleitSchnitt(p);
  assert.equal(g.length, 6);
  assert.equal(g[0].wert, 94.8);
  assert.ok(Math.abs(g[5].wert - 94.0833) < 0.001);
  // Fenster wandert: nach 8 Tagen fällt der erste Wert heraus
  const lang = Array.from({ length: 8 }, (_, i) => ({ datum: `2026-11-${String(9 + i).padStart(2, '0')}`, wert: i === 0 ? 100 : 90 }));
  const gl = gleitSchnitt(lang);
  assert.ok(Math.abs(gl[6].wert - (100 + 6 * 90) / 7) < 1e-9);
  assert.equal(gl[7].wert, 90);
  // Lücken: nur vorhandene Werte im Fenster zählen
  const luecke = gleitSchnitt([{ datum: '2026-11-01', wert: 80 }, { datum: '2026-11-20', wert: 90 }, { datum: '2026-11-21', wert: null }]);
  assert.equal(luecke.length, 2);
  assert.equal(luecke[1].wert, 90);
});

test('Zielpfad Bauchumfang: linear von 102 auf 92', () => {
  const z = { von: '2026-11-09', bis: '2027-05-31', start: 102, ziel: 92 };
  assert.equal(zielpfad('2026-11-09', z), 102);
  assert.equal(zielpfad('2026-10-01', z), 102);
  assert.equal(zielpfad('2027-05-31', z), 92);
  assert.equal(zielpfad('2027-08-01', z), 92);
  assert.ok(Math.abs(zielpfad('2027-02-18', z) - (102 - 10 * (101 / 203))) < 1e-9);
});
