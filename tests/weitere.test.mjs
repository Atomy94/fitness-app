import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { parseZahl, fmt, fmtEingabe } from '../js/core/zahl.js';
import { heute, stundeBerlin, wochentag, montag, plusTage, diffTage, de, kw, monatsRaster, istDatum } from '../js/core/datum.js';
import { ausHealthData, gewichtAusText } from '../js/core/erstimport.js';
import { demoState } from '../js/core/demo.js';
import { wochenWerte, checkinText, checkinZeilen } from '../js/core/checkin.js';
import { tagBewertung, wochenWertung, GRUEN, GELB, ROT, GRAU } from '../js/core/bewertung.js';
import { tagesZiele, minimalAktiv, zielWert } from '../js/core/ziele.js';
import { ergaenze, leererState, uebungsSchluessel } from '../js/core/state.js';
import { stand, kraft, cardio, MO, SO, SPAETER } from './hilfe.mjs';

test('Zahlen: Komma als Dezimaltrenner', () => {
  assert.equal(parseZahl('93,4'), 93.4);
  assert.equal(parseZahl('93.4'), 93.4);
  assert.equal(parseZahl(' 7,5 '), 7.5);
  assert.equal(parseZahl('2.100'), 2100);
  assert.equal(parseZahl('2.100,5'), 2100.5);
  assert.equal(parseZahl('6900'), 6900);
  assert.equal(parseZahl('0'), 0);
  assert.equal(parseZahl(''), null);
  assert.equal(parseZahl('abc'), null);
  assert.equal(parseZahl('9,3,4'), null);
  assert.equal(fmt(2078), '2.078');
  assert.equal(fmt(93.4, 1), '93,4');
  assert.equal(fmt(93, 1, true), '93,0');
  assert.equal(fmt(null), '–');
  assert.equal(fmtEingabe(93.4), '93,4');
  assert.equal(fmtEingabe(null), '');
});

test('Datum: Woche beginnt am Montag, Format TT.MM.JJJJ, Zeitzone Berlin', () => {
  assert.equal(wochentag('2026-11-09'), 1);
  assert.equal(wochentag('2026-11-15'), 7);
  assert.equal(montag('2026-11-15'), '2026-11-09');
  assert.equal(montag('2026-11-09'), '2026-11-09');
  assert.equal(plusTage('2026-12-31', 1), '2027-01-01');
  assert.equal(diffTage('2026-11-09', '2027-05-31'), 203);
  assert.equal(de('2026-11-14'), '14.11.2026');
  assert.equal(kw('2026-11-09'), 46);
  assert.equal(kw('2027-01-03'), 53);
  assert.equal(kw('2027-01-04'), 1);
  assert.equal(istDatum('2026-02-29'), false);
  assert.equal(istDatum('2028-02-29'), true);
  // 23:30 Uhr UTC ist in Berlin schon der nächste Tag
  assert.equal(heute(new Date('2026-11-14T23:30:00Z')), '2026-11-15');
  assert.equal(heute(new Date('2026-07-01T21:59:00Z')), '2026-07-01'); // Sommerzeit: 23:59
  assert.equal(heute(new Date('2026-07-01T22:00:00Z')), '2026-07-02');
  assert.equal(stundeBerlin(new Date('2026-11-14T14:00:00Z')), 15);
  assert.equal(stundeBerlin(new Date('2026-11-14T23:10:00Z')), 0);
  const raster = monatsRaster(2026, 11);
  assert.equal(raster[0][0], '2026-10-26');
  assert.equal(raster.at(-1)[6], '2026-12-06');
  assert.ok(raster.every((w) => w.length === 7 && wochentag(w[0]) === 1));
});

// Erfundene Datei im Aufbau der health-data.json
const BEISPIEL = {
  profile: { name: 'Test' },
  goals: {
    start_date: '2026-11-09',
    targets: { waist_cm: { start: 100, target: 90 } },
    phases: [{ phase: 1, name: 'Aufbau', from: '2026-11-09', to: '2026-12-06' }, { phase: 2, name: 'Halten', from: '2026-12-07', to: 'Prüfung Jan 2027' }],
  },
  nutrition_targets: { kcal: { mon_sat: 2250, sunday_with_football: 2550 }, protein_g: { target: 165, min: 155 }, fat_g: { saturated_max: 24 }, fiber_g_min: 32 },
  supplements: [{ name: 'Kreatin', product: 'Marke', dose_g: 5, timing: 'morgens' }],
  training_plan: {
    max_duration_min: 30,
    weekly_schedule: { mon: 'Kraft A – Pflicht', sun: 'Fußball' },
    workouts: {
      A: [{ exercise: 'Liegestütze', sets: 3, reps: '10' }, { exercise: 'Rudern', sets: 3, reps: '10-12 je Seite', load_kg: 16 }, { exercise: 'Drücken', sets: 3, reps: '8-12', load_kg: '2 × 6-8', superset: '2a' }],
      B: [{ exercise: 'Seitstütz', sets: 2, duration_s: 40 }],
      C_home_alternative: [{ exercise: 'Liegestütze', sets: 3, reps: 10 }],
    },
  },
  movement_targets: { steps_per_day: [{ weeks: '1-2', target: 5000 }, { weeks: '3-4', target: 7000 }, { weeks: '5+', target: 8000 }] },
  measurements: {
    weight_daily: [{ date: '2026-11-09', kg: 94.8 }, { date: '2026-11-14', kg: 93.4 }],
    waist: [{ date: '2026-11-08', cm: 100 }],
    strength_tests: [{ date: '2026-11-09', test: 'Kniebeugen Körpergewicht max.', value: 50 }, { date: '2026-11-09', test: 'Liegestütze', value: '15 / 5 / 4' }],
    body_composition_tanita: [{ date: '2025-05-10', weight: 87.2, fat_pct: 16.2 }, { date: '2025-07-30', weight: 87.1, fat_pct: 11.7, invalid: true, reason: 'Fehlmessung' }],
  },
  daily_log: [
    { date: '2026-11-09', kcal: 1856, protein: 166, carbs: 144, fat: 62, steps: null, training: 'Ganzkörper A (alt)', treadmill: null },
    { date: '2026-11-13', kcal: 2101, protein: 158, steps: 6600, training: null, treadmill: { km: 2.5, min: 25 } },
    { date: '2026-11-14', kcal: 2078, protein: 172, fiber: 20.8, sat_fat: 35.1, steps: 6900, training: 'Studio', treadmill: { km: 2.85, min: 26 } },
  ],
  workout_log: [
    { date: '2026-11-09', workout: 'Ganzkörper A (alt)', duration_min: 50, sets: [{ exercise: 'Goblet Squat', load_kg: 17.5, reps: [12, 12, 12] }, { exercise: 'Liegestütze', reps: [15, 5, 4] }, { exercise: 'Hampelmänner', duration_s: [30, 30] }] },
    { date: '2026-11-14', workout: 'Studio', sets: [{ exercise: 'Dips', reps: '4 Sätze à 5–6' }] },
  ],
  health: {
    blood_test_2025_11_05: { iron_ug_dl: { value: 230, range: '70-180', flag: 'hoch' }, glucose_mg_dl: 84, crp_mg_l: '<5' },
    doctor_visit_2026_11_12: { results: 'ausstehend' },
  },
  foods_per_100g: [{ name: 'Chili', kcal: 72 }],
};

test('Erstbefüllung: health-data.json wird vollständig übersetzt', () => {
  const { state: s, bericht } = ausHealthData(BEISPIEL, '2026-11-14');
  assert.ok(bericht.length >= 4);
  assert.equal(s.einstellungen.start, '2026-11-09');
  assert.equal(s.einstellungen.eingerichtet, true);
  // Ziele aus der Datei
  assert.equal(zielWert(s.ziele, 'kcal_mo_sa_ziel', '2026-11-10'), 2250);
  assert.equal(zielWert(s.ziele, 'kcal_so_ziel', '2026-11-10'), 2550);
  assert.equal(zielWert(s.ziele, 'eiweiss_min', '2026-11-10'), 155);
  assert.equal(zielWert(s.ziele, 'ballaststoffe_min', '2026-11-10'), 32);
  assert.equal(zielWert(s.ziele, 'ges_fett_max', '2026-11-10'), 24);
  assert.equal(zielWert(s.ziele, 'bauch_ziel', '2026-11-10'), 90);
  assert.equal(zielWert(s.ziele, 'schritte_ziel', '2026-11-22'), 5000);
  assert.equal(zielWert(s.ziele, 'schritte_ziel', '2026-11-23'), 7000);
  assert.equal(zielWert(s.ziele, 'schritte_ziel', '2026-12-07'), 8000);
  // Minimalversion startet mit Phase 2, Ende offen
  assert.equal(minimalAktiv(s.einstellungen, '2026-12-06'), false);
  assert.equal(minimalAktiv(s.einstellungen, '2027-01-10'), true);
  // Plan
  const a = s.einstellungen.plan.einheiten['Kraft A'];
  assert.equal(a.length, 3);
  assert.equal(a[1].kg, 16);
  assert.equal(a[2].kg, 12);
  assert.equal(a[2].kg_text, '2 × 6-8');
  assert.match(a[2].notiz, /Supersatz 2a/);
  assert.equal(s.einstellungen.plan.einheiten['Kraft B'][0].sek, 40);
  assert.ok(s.einstellungen.plan.einheiten['Kraft C']);
  assert.equal(s.einstellungen.plan.wochenplan[1].text, 'Kraft A – Pflicht');
  assert.equal(s.einstellungen.plan.wochenplan[1].typ, 'kraft');
  // Tage
  assert.equal(s.tage['2026-11-09'].kcal, 1856);
  assert.equal(s.tage['2026-11-09'].gewicht_kg, 94.8);
  assert.equal(Object.hasOwn(s.tage['2026-11-09'], 'schritte'), false);
  assert.equal(s.tage['2026-11-14'].ges_fett_g, 35.1);
  // Eiweiß bis 13.11.2026: "Werte ungenau"
  assert.equal(s.tage['2026-11-09'].ungenau, true);
  assert.equal(s.tage['2026-11-13'].ungenau, true);
  assert.equal(s.tage['2026-11-14'].ungenau, undefined);
  // Trainings
  const k = s.trainings.filter((t) => t.typ === 'kraft');
  assert.equal(k.length, 2);
  assert.deepEqual(k[0].uebungen[0].saetze[0], { wdh: 12, kg: 17.5 });
  assert.deepEqual(k[0].uebungen[1].saetze.map((x) => x.wdh), [15, 5, 4]);
  assert.deepEqual(k[0].uebungen[2].saetze, [{ sek: 30 }, { sek: 30 }]);
  assert.equal(k[1].uebungen[0].notiz, '4 Sätze à 5–6');
  const c = s.trainings.filter((t) => t.typ === 'cardio');
  assert.equal(c.length, 2);
  assert.equal(c[0].dauer_min, 25);
  // Messungen
  assert.equal(s.messungen.find((m) => m.quelle === 'Maßband').bauch_cm, 100);
  const kt = s.messungen.find((m) => m.quelle === 'Krafttest');
  assert.equal(kt.liegestuetze_max, 15);
  assert.equal(kt.kniebeugen_max, 50);
  const tanita = s.messungen.filter((m) => m.quelle === 'Tanita');
  assert.equal(tanita.length, 2);
  assert.equal(tanita[1].ungueltig, true);
  // Blutwerte
  const eisen = s.blutwerte.find((b) => b.name === 'Eisen');
  assert.deepEqual([eisen.wert, eisen.norm_min, eisen.norm_max, eisen.datum], [230, 70, 180, '2025-11-05']);
  assert.equal(s.blutwerte.find((b) => b.name === 'Glukose').norm_min, undefined);
  assert.equal(s.blutwerte.find((b) => b.name === 'CRP').wert_text, '<5');
  // Rohdaten für spätere Funktionen bleiben erhalten
  assert.equal(s.einstellungen.archiv.foods_per_100g[0].name, 'Chili');
  // Bewertung der übernommenen Tage
  assert.equal(tagBewertung(s, '2026-11-09', '2026-11-14').training, GRUEN); // alte Einheit zählt als Kraft
  assert.equal(tagBewertung(s, '2026-11-09', '2026-11-14').kcal, ROT);
  assert.equal(tagBewertung(s, '2026-11-13', '2026-11-14').training, GRUEN); // Laufband Freitag 25 Min.
  assert.equal(tagBewertung(s, '2026-11-14', '2026-11-14').training, GRUEN); // Samstag Bonus
});

test('Erstbefüllung: fremde Datei wird abgelehnt', () => {
  assert.throws(() => ausHealthData({ irgendwas: 1 }, '2026-11-14'), /keine health-data/);
  assert.throws(() => ausHealthData(null, '2026-11-14'), /keine health-data/);
});

test('Gewicht aus Text', () => {
  assert.equal(gewichtAusText('2 × 10'), 20);
  assert.equal(gewichtAusText('2 × 4-5'), 8);
  assert.equal(gewichtAusText(16), 16);
  assert.equal(gewichtAusText(undefined), null);
});

test('Echte health-data.json (nur lokal vorhanden): lässt sich fehlerfrei einlesen', { skip: !existsSync('health-data.json') }, () => {
  const { state: s } = ausHealthData(JSON.parse(readFileSync('health-data.json', 'utf8')), '2026-11-14');
  assert.ok(Object.keys(s.tage).length >= 6);
  assert.ok(s.blutwerte.length >= 20);
  assert.equal(Object.keys(s.einstellungen.plan.einheiten).length, 3);
  for (const d of Object.keys(s.tage)) tagBewertung(s, d, '2026-11-14');
  const w = wochenWerte(s, '2026-11-09', '2026-11-14');
  assert.ok(w.gewicht > 80 && w.gewicht < 110);
  assert.ok(checkinText(w).includes('JSON:'));
});

test('Testdaten: 3 Wochen, alle Farben kommen vor', () => {
  const heuteIso = '2026-11-25'; // Mittwoch der dritten Woche
  const s = demoState(heuteIso);
  assert.equal(s.einstellungen.start, '2026-11-09');
  assert.equal(Object.keys(s.tage).length, 17);
  const b = Object.keys(s.tage).map((d) => tagBewertung(s, d, heuteIso));
  for (const feld of ['ernaehrung', 'training', 'schritte']) {
    const farben = new Set(b.map((x) => x[feld]));
    for (const f of [GRUEN, GELB, ROT]) assert.ok(farben.has(f), `${feld}: ${f} fehlt`);
  }
  assert.ok(b.some((x) => x.training === GRAU));
  assert.ok(b.some((x) => x.zusatz));
  assert.deepEqual(demoState(heuteIso), s); // immer gleich
});

test('Check-in: Wochenwerte und Text für Claude', () => {
  const s = stand();
  s.tage['2026-11-02'] = { datum: '2026-11-02', gewicht_kg: 95 };
  s.tage[MO] = { datum: MO, gewicht_kg: 94.8, kcal: 2200, eiweiss_g: 160, schritte: 6000, schlaf_h: 7, schlaf_qualitaet: 4, stress: 5, ballaststoffe_g: 30, ges_fett_g: 20 };
  s.tage['2026-11-10'] = { datum: '2026-11-10', gewicht_kg: 94.2, kcal: 2100, eiweiss_g: 150, schritte: 4000, schlaf_h: 8, stress: 7 };
  s.tage[SO] = { datum: SO, fussball: false };
  s.trainings.push(kraft(MO), kraft(MO, 'Extra'), kraft('2026-11-14', 'Kraft C'), cardio(SO, 'Spaziergang', 50));
  s.messungen.push({ id: 'm', datum: '2026-11-08', quelle: 'Maßband', bauch_cm: 102 });
  const w = wochenWerte(s, MO, SPAETER);
  assert.equal(w.gewicht, 94.5);
  assert.ok(Math.abs(w.gewichtDiff + 0.5) < 1e-9);
  assert.equal(w.bauch.cm, 102);
  assert.equal(w.bauch.inWoche, false);
  assert.equal(w.kraftIst, 1); // zwei Einheiten am selben Tag zählen einmal
  assert.equal(w.kraftSoll, 2);
  assert.equal(w.fussball, 'ausgefallen, Spaziergang als Ersatz');
  assert.equal(w.schritte, 5000);
  assert.equal(w.kcal, 2150);
  assert.equal(w.eiweiss, 155);
  assert.equal(w.schlaf, 7.5);
  assert.equal(w.stress, 6);
  const zeilen = Object.fromEntries(checkinZeilen(w));
  assert.equal(zeilen['Gewicht Ø'], '94,5 kg (-0,5 kg zur Vorwoche)');
  assert.equal(w.kraftBonus, 1); // Samstag ist kein Pflichttag
  assert.equal(zeilen['Krafteinheiten'], '1 von 2 + 1 Bonus');
  assert.equal(zeilen['Wertung Ernährung'], '2 von 7 Tagen');
  const text = checkinText(w, { verdauung: 'gut', besonderheiten: '' });
  assert.match(text, /KW 46 \(09\.11\.2026–15\.11\.2026\)/);
  assert.match(text, /Verdauung\/Sättigung: gut/);
  const json = JSON.parse(text.split('JSON:\n')[1]);
  assert.equal(json.kcal_schnitt, 2150);
  assert.equal(json.wertung.training, `${w.wertung.training.x}/${w.wertung.training.von}`);
  assert.equal(json.tage.length, 7);
});

test('Sonstiges: leerer Stand, Ergänzen alter Sicherungen, Übungsnamen', () => {
  const s = leererState('2026-11-14');
  assert.equal(s.einstellungen.start, '2026-11-09');
  assert.equal(tagesZiele(s, '2026-11-14', false).kcal.ziel, 2200);
  const alt = ergaenze({ tage: {}, einstellungen: { start: '2026-01-05', plan: {}, minimal: {} } }, '2026-11-14');
  assert.ok(Array.isArray(alt.trainings) && Array.isArray(alt.ziele));
  assert.ok(alt.einstellungen.plan.wochenplan[1]);
  assert.equal(alt.einstellungen.pauseSek, 60);
  assert.equal(uebungsSchluessel('Goblet Squat, Tempo 3-1-x'), uebungsSchluessel('Goblet Squat (Tempo 3-1-x)'));
  assert.equal(wochenWertung(s, '2026-11-09', '2026-11-14').ernaehrung.x, 0);
});

test('Offline: jede App-Datei steht in der Liste des Service Workers', { skip: !existsSync('sw.js') }, () => {
  const sw = readFileSync('sw.js', 'utf8');
  const liste = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const sammle = (ordner) => readdirSync(ordner).flatMap((n) => (statSync(`${ordner}/${n}`).isDirectory() ? sammle(`${ordner}/${n}`) : [`${ordner}/${n}`]));
  const dateien = ['index.html', 'manifest.webmanifest', ...sammle('js'), ...sammle('css'), ...sammle('icons')];
  for (const d of dateien) assert.ok(liste.includes(d), `${d} fehlt in sw.js`);
  for (const l of liste) assert.ok(existsSync(l), `${l} steht in sw.js, existiert aber nicht`);
  // Versionsnummer muss an beiden Stellen gleich sein, sonst kommt ein Update nicht an.
  const vSw = sw.match(/const VERSION = '([^']+)'/)[1];
  const vApp = readFileSync('js/version.js', 'utf8').match(/VERSION = '([^']+)'/)[1];
  assert.equal(vSw, vApp);
});
