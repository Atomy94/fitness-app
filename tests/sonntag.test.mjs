import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sonntagsMessungOffen } from '../js/core/bewertung.js';
import { stand, SA, SO } from './hilfe.mjs';

test('Sonntag ohne Bauchumfang: Hinweis offen', () => {
  assert.equal(sonntagsMessungOffen(stand(), SO), true);
});

test('kein Sonntag: kein Hinweis', () => {
  assert.equal(sonntagsMessungOffen(stand(), SA), false);
});

test('Bauchumfang an diesem Sonntag eingetragen: Hinweis weg', () => {
  const s = stand();
  s.messungen.push({ id: 'm1', datum: SO, quelle: 'Maßband', bauch_cm: 92.5 });
  assert.equal(sonntagsMessungOffen(s, SO), false);
});

test('Messung an einem anderen Tag oder ohne Bauchumfang zählt nicht', () => {
  const s = stand();
  s.messungen.push({ id: 'm1', datum: SA, quelle: 'Maßband', bauch_cm: 92.5 });
  s.messungen.push({ id: 'm2', datum: SO, quelle: 'Tanita', gewicht_kg: 80 });
  assert.equal(sonntagsMessungOffen(s, SO), true);
});

test('ungültige Messung zählt nicht', () => {
  const s = stand();
  s.messungen.push({ id: 'm1', datum: SO, quelle: 'Maßband', bauch_cm: 92.5, ungueltig: true });
  assert.equal(sonntagsMessungOffen(s, SO), true);
});
