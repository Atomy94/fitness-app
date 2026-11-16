import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pausenSignal, KURZ_SEK } from '../js/core/signal.js';

const rund = (liste) => liste.map((t) => ({ in: Math.round(t.in * 100) / 100, dauer: Math.round(t.dauer * 100) / 100, lang: t.lang }));

test('Pausen-Signal: kurzer Ton bei 3 und 2 Sekunden, langer Ton in der letzten Sekunde bis zum Ende', () => {
  assert.deepEqual(rund(pausenSignal(60)), [
    { in: 57, dauer: KURZ_SEK, lang: false },
    { in: 58, dauer: KURZ_SEK, lang: false },
    { in: 59, dauer: 1, lang: true },
  ]);
  const t = pausenSignal(75);
  assert.equal(t.at(-1).in + t.at(-1).dauer, 75); // der lange Ton endet genau mit der Pause
});

test('Pausen-Signal: kurze oder schon weit gelaufene Pause – vergangene Töne entfallen', () => {
  assert.deepEqual(rund(pausenSignal(3)), [{ in: 0, dauer: KURZ_SEK, lang: false }, { in: 1, dauer: KURZ_SEK, lang: false }, { in: 2, dauer: 1, lang: true }]);
  assert.deepEqual(rund(pausenSignal(2.5)), [{ in: 0.5, dauer: KURZ_SEK, lang: false }, { in: 1.5, dauer: 1, lang: true }]);
  assert.deepEqual(rund(pausenSignal(1.2)), [{ in: 0.2, dauer: 1, lang: true }]);
  assert.deepEqual(rund(pausenSignal(0.6)), [{ in: 0, dauer: 0.6, lang: true }]); // letzte Sekunde läuft schon
});

test('Pausen-Signal: keine Pause, kein Ton', () => {
  assert.deepEqual(pausenSignal(0), []);
  assert.deepEqual(pausenSignal(-5), []);
  assert.deepEqual(pausenSignal(undefined), []);
});
