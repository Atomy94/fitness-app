import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rekord, markiereRekorde, satzAnzeige } from '../js/core/kraft.js';

const s = (kg, wdh) => ({ kg, wdh });
const FRUEHER = [s(14, 12), s(14, 12), s(16, 10), s(16, 8)];

test('Anzeige eines Satzes', () => {
  assert.equal(satzAnzeige(s(16, 12)), '16 kg × 12');
  assert.equal(satzAnzeige(s(17.5, 10)), '17,5 kg × 10');
  assert.equal(satzAnzeige({ wdh: 15, kg: 0 }), '15 Wdh.');
  assert.equal(satzAnzeige({ sek: 40 }), '40 Sek.');
});

test('Rekord: mehr Gewicht bei mindestens gleich vielen Wiederholungen', () => {
  assert.deepEqual(rekord(s(18, 10), FRUEHER), { art: 'gewicht', text: '18 kg × 10' }); // schwerer als alles bisher mit 10+ Wdh.
  assert.deepEqual(rekord(s(16, 12), FRUEHER), { art: 'gewicht', text: '16 kg × 12' }); // 12 Wdh. gab es bisher nur mit 14 kg
  assert.equal(rekord(s(16, 10), FRUEHER), null); // genau so schon geschafft
  assert.equal(rekord(s(14, 10), FRUEHER), null); // leichter und nicht mehr Wiederholungen
});

test('Rekord: mehr Wiederholungen bei gleichem Gewicht', () => {
  assert.deepEqual(rekord(s(14, 13), [s(14, 12), s(20, 15)]), { art: 'wdh', text: '14 kg × 13' });
  assert.equal(rekord(s(14, 12), [s(14, 12), s(20, 15)]), null);
});

test('Rekord: höchster Satz (kg × Wiederholungen)', () => {
  // 12 kg × 20 = 240: kein Gewichts- und kein Wiederholungsrekord bei gleichem Gewicht, aber der höchste Satz
  assert.deepEqual(rekord(s(12, 20), [s(14, 12), s(16, 10)]), { art: 'volumen', text: '12 kg × 20' });
  assert.equal(rekord(s(12, 13), [s(14, 12), s(16, 10)]), null); // 156 < 168
});

test('Rekord ohne Gewicht: Wiederholungen bzw. Sekunden zählen', () => {
  const lieg = [{ wdh: 15, kg: 0 }, { wdh: 5, kg: 0 }, { wdh: 4 }];
  assert.deepEqual(rekord({ wdh: 16, kg: 0 }, lieg), { art: 'wdh', text: '16 Wdh.' });
  assert.equal(rekord({ wdh: 15, kg: 0 }, lieg), null);
  assert.deepEqual(rekord({ sek: 45 }, [{ sek: 30 }, { sek: 40 }]), { art: 'zeit', text: '45 Sek.' });
  assert.equal(rekord({ sek: 40 }, [{ sek: 30 }, { sek: 40 }]), null);
  assert.equal(rekord({ sek: 40 }, [{ wdh: 10, kg: 0 }]), null); // keine früheren Zeiten
});

test('Kein Rekord ohne Vorgeschichte oder ohne Wiederholungen', () => {
  assert.equal(rekord(s(20, 10), []), null);
  assert.equal(rekord(s(20, 10), undefined), null);
  assert.equal(rekord(s(20, 0), FRUEHER), null);
  assert.equal(rekord(null, FRUEHER), null);
  // erstes Mal mit Gewicht nach reinen Körpergewichts-Sätzen: mehr Gewicht bei gleich vielen Wiederholungen
  assert.deepEqual(rekord(s(5, 10), [{ wdh: 10, kg: 0 }]), { art: 'gewicht', text: '5 kg × 10' });
});

test('Verlauf: Rekorde werden an der Einheit markiert, in der sie fielen', () => {
  const v = markiereRekorde([
    { datum: '2026-11-09', saetze: [s(14, 12), s(14, 12), s(14, 12)] },
    { datum: '2026-11-16', saetze: [s(16, 10), s(16, 10), s(16, 9)] },
    { datum: '2026-11-23', saetze: [s(16, 10), s(16, 10), s(16, 10)] },
    { datum: '2026-11-30', saetze: [s(16, 12), s(16, 11), s(16, 12)] },
  ]);
  assert.deepEqual(v.map((e) => e.rekorde.map((r) => `${r.art}:${r.text}`)), [
    [], // die erste Einheit hat nie Rekorde
    ['gewicht:16 kg × 10'], // so schwer mit 10 Wiederholungen noch nie (bisher 14 kg); die Sätze danach wiederholen es nur
    [],
    ['gewicht:16 kg × 12'], // nur der erste Satz; der dritte wiederholt ihn bloß
  ]);
  assert.equal(v[3].rekorde[0].satz, v[3].saetze[0]);
  assert.equal(v[0].datum, '2026-11-09'); // übrige Felder bleiben erhalten
  // innerhalb einer Einheit: jeder Satz wird auch gegen die Sätze davor geprüft
  const w = markiereRekorde([{ saetze: [s(10, 10)] }, { saetze: [s(10, 11), s(10, 12), s(10, 12)] }]);
  assert.deepEqual(w[1].rekorde.map((r) => r.text), ['10 kg × 11', '10 kg × 12']);
});
