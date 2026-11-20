import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leseImport, verarbeite } from '../js/core/import.js';
import { ergaenze } from '../js/core/state.js';
import { stand, MO, DI } from './hilfe.mjs';

const block = (eintraege) => `FITNESS-IMPORT v1\n${JSON.stringify({ eintraege })}`;

test('Gewicht aus dem Import wird auf eine Nachkommastelle gerundet (Tag und Messung)', () => {
  const r = leseImport(block([
    { typ: 'tag', datum: MO, gewicht_kg: 93.4567 },
    { typ: 'messung', datum: DI, quelle: 'Tanita', gewicht_kg: 92.04999 },
    { typ: 'tag', datum: DI, gewicht_kg: '92,96' },
  ]));
  assert.equal(r.ok, true, r.fehler.join('\n'));
  const { state } = verarbeite(stand(), r.eintraege);
  assert.equal(state.tage[MO].gewicht_kg, 93.5);
  assert.equal(state.tage[DI].gewicht_kg, 93);
  assert.equal(state.messungen.find((m) => m.quelle === 'Tanita').gewicht_kg, 92);
});

test('Gleicher Wert nach dem Runden gilt als unverändert', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, gewicht_kg: 93.5 };
  const r = leseImport(block([{ typ: 'tag', datum: MO, gewicht_kg: 93.4512 }]));
  const { posten } = verarbeite(s, r.eintraege);
  assert.equal(posten[0].art, 'gleich');
});

test('Andere Werte bleiben ungerundet', () => {
  const r = leseImport(block([{ typ: 'tag', datum: MO, salz_g: 6.25, ballaststoffe_g: 28.55 }]));
  const { state } = verarbeite(stand(), r.eintraege);
  assert.equal(state.tage[MO].salz_g, 6.25);
  assert.equal(state.tage[MO].ballaststoffe_g, 28.55);
});

test('Vorhandene Gewichte werden beim Laden gerundet', () => {
  const s = stand();
  s.tage[MO] = { datum: MO, gewicht_kg: 94.2833333 };
  s.messungen.push({ id: 'm1', datum: DI, quelle: 'Tanita', gewicht_kg: 93.96, koerperfett_pct: 22.45 });
  ergaenze(s, DI);
  assert.equal(s.tage[MO].gewicht_kg, 94.3);
  assert.equal(s.messungen[0].gewicht_kg, 94);
  assert.equal(s.messungen[0].koerperfett_pct, 22.45);
});
