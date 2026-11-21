import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satzBeginn, satzZeiten, zeitBeiHaken, zeitZurueck, pauseBeginnt, pauseLaenger, pauseEndet, uebungenZumSpeichern, zeitAuswertung, berlinIso, dauerText } from '../js/core/satzzeit.js';
import { exportDaten } from '../js/core/claude-dateien.js';
import { stand, MO } from './hilfe.mjs';

// Erfundenes Training. Trainingsuhr in Sekunden (s), Uhrzeit = Start + Trainingsuhr (ohne Anhalten).
const START_MS = Date.parse('2026-11-21T16:00:00Z'); // 17:00 Berliner Zeit
const s = (sek) => sek * 1000;

function entwurf() {
  const satz = (kg, wdh) => ({ kg, wdh, fertig: false });
  return {
    startMs: START_MS, bereitLauf: 0,
    uebungen: [
      { name: 'Kniebeuge', pauseSek: 90, saetze: [satz(20, 10), satz(20, 10)] },
      // Supersatz: Rudern und Liegestütze im Wechsel
      { name: 'Rudern', pauseSek: 60, saetze: [satz(16, 12), satz(16, 12)] },
      { name: 'Liegestütze', pauseSek: 60, saetze: [satz(0, 15), satz(0, 15)] },
      { name: 'Seitstütz', zeit: true, pauseSek: 30, saetze: [{ sek: 40, fertig: false }] },
    ],
  };
}

// Ablauf wie in der App: ✓ setzt Zeiten, danach startet die Soll-Pause der Übung
function haken(en, ui, si, sek, { mitPause = true } = {}) {
  const u = en.uebungen[ui];
  const x = u.saetze[si];
  x.fertig = true;
  zeitBeiHaken(en, x, s(sek), START_MS + s(sek));
  if (mitPause) pauseBeginnt(en, s(sek), u.pauseSek);
}

test('Satzbeginn: Ende der Pause, nie vor dem letzten Satz; ✓ vor Pausenende = direkt danach', () => {
  assert.equal(satzBeginn({ endeLauf: s(50), bereitLauf: 0, letzteEndeLauf: null }), 0);
  assert.equal(satzBeginn({ endeLauf: s(200), bereitLauf: s(130), letzteEndeLauf: s(40) }), s(130));
  assert.equal(satzBeginn({ endeLauf: s(100), bereitLauf: s(130), letzteEndeLauf: s(40) }), s(40)); // Supersatz
  assert.equal(satzBeginn({ endeLauf: s(100), bereitLauf: undefined, letzteEndeLauf: s(40) }), s(40)); // alter Entwurf
});

test('Komplettes Training mit Supersatz: Satzdauer, gemessene Pause, ISO-Zeiten, geplante Pause', () => {
  const en = entwurf();
  haken(en, 0, 0, 45);              // Kniebeuge 1: 0–45, Pause bis 135
  pauseLaenger(en, s(15));          // +15 s → bereit ab 150
  haken(en, 0, 1, 190);             // Kniebeuge 2: 150–190
  pauseEndet(en, s(240));           // „Pause aus“ nach 50 s → Rudern beginnt bei 240
  haken(en, 1, 0, 280);             // Rudern 1: 240–280, Pause-Timer 60 s läuft …
  haken(en, 2, 0, 310);             // … Liegestütze 1 direkt danach (Supersatz): 280–310
  haken(en, 1, 1, 400);             // Rudern 2: Pause bis 370, Satz 370–400
  haken(en, 2, 1, 425);             // Liegestütze 2 direkt danach: 400–425
  haken(en, 3, 0, 500);             // Seitstütz: Pause bis 485, Satz 485–500

  const u = uebungenZumSpeichern(en, true);
  assert.deepEqual(u[0].saetze, [
    { wdh: 10, kg: 20, start: '2026-11-21T17:00:00', dauer_sek: 45, pause_sek: 105 },
    { wdh: 10, kg: 20, start: '2026-11-21T17:02:30', dauer_sek: 40, pause_sek: 50 },
  ]);
  assert.deepEqual(u[1].saetze.map((x) => [x.dauer_sek, x.pause_sek]), [[40, 0], [30, 0]]);
  assert.deepEqual(u[2].saetze.map((x) => [x.dauer_sek, x.pause_sek]), [[30, 60], [25, 60]]);
  assert.deepEqual(u[3].saetze, [{ sek: 40, start: '2026-11-21T17:08:05', dauer_sek: 15, pause_sek: null }]); // allerletzter Satz
  assert.deepEqual(u.map((x) => x.pause_geplant_sek), [90, 60, 60, 30]);

  const a = zeitAuswertung({ uebungen: u, start: berlinIso(START_MS), ende: berlinIso(START_MS + s(500)) });
  assert.equal(a.satzSek, 45 + 40 + 40 + 30 + 30 + 25 + 15);
  assert.equal(a.pauseSek, 105 + 50 + 0 + 60 + 0 + 60);
  assert.equal(a.gesamtSek, 500);
  assert.deepEqual(a.uebungen.map((x) => [x.pauseSchnitt, x.pauseGeplant]), [[78, 90], [0, 60], [60, 60], [null, 30]]);
});

test('Anhalten beendet die Pause; ✓ zurückgenommen verwirft die Zeiten; offene Sätze ohne Zeiten', () => {
  const en = entwurf();
  haken(en, 0, 0, 30);
  pauseEndet(en, s(50)); // Anhalten nach 20 s Pause (Trainingsuhr steht danach)
  haken(en, 0, 1, 80);   // nach dem Fortsetzen: 50–80
  const x = en.uebungen[0].saetze[1];
  assert.equal(x.startLauf, s(50));
  zeitZurueck(en, x); x.fertig = false;
  assert.equal(x.startLauf, undefined);
  haken(en, 0, 1, 95, { mitPause: false });
  const u = uebungenZumSpeichern(en, true);
  assert.equal(u.length, 1); // andere Übungen ohne bestätigte Sätze fallen weg
  assert.deepEqual(u[0].saetze.map((y) => [y.dauer_sek, y.pause_sek]), [[30, 20], [45, null]]);
  // Alle Sätze speichern (ohne ✓): unbestätigte ohne Zeitfelder
  const alle = uebungenZumSpeichern(en, false);
  assert.deepEqual(alle[1].saetze[0], { wdh: 12, kg: 16 });
  assert.equal(alle[1].pause_geplant_sek, undefined);
});

test('Nachtrag ohne Zeiten: Sätze wie bisher, keine neuen Felder', () => {
  const en = entwurf();
  en.uebungen[0].saetze.forEach((x) => { x.fertig = true; });
  const u = uebungenZumSpeichern(en, true, false);
  assert.deepEqual(u, [{ name: 'Kniebeuge', saetze: [{ wdh: 10, kg: 20 }, { wdh: 10, kg: 20 }] }]);
  assert.equal(zeitAuswertung({ uebungen: u }), null);
});

test('stand.md/Export: Zeitfelder erscheinen bei den Sätzen, alte Trainings bleiben unverändert', () => {
  const st = stand();
  st.trainings.push({ id: 'alt', typ: 'kraft', datum: MO, einheit: 'Kraft A', dauer_min: 30, verkuerzt: false, uebungen: [{ name: 'Rudern', saetze: [{ wdh: 10, kg: 14 }] }] });
  st.trainings.push({ id: 'neu', typ: 'kraft', datum: '2026-11-12', einheit: 'Kraft B', dauer_min: 9, verkuerzt: false, start: '2026-11-12T17:00:00', ende: '2026-11-12T17:09:00',
    uebungen: [{ name: 'Rudern', pause_geplant_sek: 60, saetze: [{ wdh: 12, kg: 16, start: '2026-11-12T17:00:00', dauer_sek: 38, pause_sek: 72 }, { wdh: 12, kg: 16, start: '2026-11-12T17:01:50', dauer_sek: 35, pause_sek: null }] }] });
  const d = exportDaten(st, '2026-11-21', 0);
  assert.deepEqual(d.trainings[0].uebungen[0].saetze, [{ wdh: 10, kg: 14 }]);
  assert.deepEqual(d.trainings[1].uebungen[0].saetze[0], { wdh: 12, kg: 16, start: '2026-11-12T17:00:00', dauer_sek: 38, pause_sek: 72 });
  assert.equal(d.trainings[1].uebungen[0].pause_geplant_sek, 60);
  assert.equal(d.trainings[1].start, '2026-11-12T17:00:00');
});

test('Texte und Berliner Zeit (auch im Sommer)', () => {
  assert.equal(dauerText(45), '45 Sek.');
  assert.equal(dauerText(125), '2:05 Min.');
  assert.equal(berlinIso(Date.UTC(2026, 6, 1, 10, 0, 0)), '2026-07-01T12:00:00');
});

test('Import: Zeiten an Training, Übung und Satz werden übernommen und geprüft', async () => {
  const { leseImport } = await import('../js/core/import.js');
  const block = (tr) => `FITNESS-IMPORT v1\n${JSON.stringify({ eintraege: [{ typ: 'training', datum: MO, einheit: 'Kraft A', ...tr }] })}`;
  const r = leseImport(block({ start: '2026-11-09T17:00', ende: '2026-11-09T17:40:10', uebungen: [{ name: 'Rudern', pause_geplant_sek: 60, saetze: [{ wdh: 12, kg: 16, start: '2026-11-09T17:05:12', dauer_sek: 38, pause_sek: 72 }, { wdh: 12, kg: 16, dauer_sek: 35, pause_sek: null }] }] }));
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const e = r.eintraege[0];
  assert.equal(e.start, '2026-11-09T17:00:00');
  assert.equal(e.uebungen[0].pause_geplant_sek, 60);
  assert.deepEqual(e.uebungen[0].saetze, [{ wdh: 12, kg: 16, start: '2026-11-09T17:05:12', dauer_sek: 38, pause_sek: 72 }, { wdh: 12, kg: 16, dauer_sek: 35 }]);
  assert.equal(leseImport(block({ start: 'gestern' })).ok, false);
  assert.equal(leseImport(block({ uebungen: [{ name: 'Rudern', saetze: [{ wdh: 10, dauer_sek: -3 }] }] })).ok, false);
});
