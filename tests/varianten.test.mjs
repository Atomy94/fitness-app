import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variante, zuletztSchwer } from '../js/core/kraft.js';
import { leseImport, verarbeite, KOPF } from '../js/core/import.js';
import { liesmichDatei } from '../js/core/claude-dateien.js';
import { stand, kraft } from './hilfe.mjs';

const block = (eintraege) => `${KOPF}\n${JSON.stringify({ eintraege })}`;

test('Variante: einfache Version ist die Übung ohne den Zusatz', () => {
  const u = { name: 'Liegestütze', saetze: 3, wdh: '8-15', kg: 0, pause_sek: 20, notiz: 'locker', schwer: { name: 'Liegestütze Füße erhöht' } };
  assert.deepEqual(variante(u, false), { name: 'Liegestütze', saetze: 3, wdh: '8-15', kg: 0, pause_sek: 20, notiz: 'locker' });
  assert.deepEqual(variante({ name: 'Dead Bug', saetze: 2, wdh: '10', kg: null }, true), { name: 'Dead Bug', saetze: 2, wdh: '10', kg: null }); // ohne schwere Version
  assert.equal(variante({ name: 'X', saetze: 3, wdh: '10', kg: null, schwer: { name: '' } }, true).name, 'X'); // leerer Name zählt nicht
});

test('Variante: anspruchsvolle Version erbt Sätze und Pause, eigene Angaben gehen vor', () => {
  const u = { name: 'Liegestütze', saetze: 3, wdh: '8-15', kg: 0, pause_sek: 20, notiz: 'locker', schwer: { name: 'Liegestütze Füße erhöht', wdh: '6-10', notiz: 'Füße auf Stuhl' } };
  assert.deepEqual(variante(u, true), { name: 'Liegestütze Füße erhöht', saetze: 3, wdh: '6-10', kg: 0, pause_sek: 20, notiz: 'Füße auf Stuhl' });
  // nur der Name ist angegeben: Wiederholungen und Gewicht kommen von der einfachen Version, die Notiz nicht
  assert.deepEqual(variante({ name: 'Rudern', saetze: 3, wdh: '8-12', kg: 16, notiz: 'a', schwer: { name: 'Rudern mit Halten' } }, true), { name: 'Rudern mit Halten', saetze: 3, wdh: '8-12', kg: 16 });
  // eigene Sätze, eigenes Gewicht, eigene Pause
  assert.deepEqual(variante({ name: 'A', saetze: 3, wdh: '12', kg: 20, pause_sek: 20, schwer: { name: 'B', saetze: 2, wdh: '8-12', kg: 10, pause_sek: 60 } }, true), { name: 'B', saetze: 2, wdh: '8-12', kg: 10, pause_sek: 60 });
  // Wechsel von Wiederholungen zu Haltezeit und umgekehrt
  assert.deepEqual(variante({ name: 'Dead Bug', saetze: 2, wdh: '10', kg: null, schwer: { name: 'Hollow Hold', sek: 25 } }, true), { name: 'Hollow Hold', saetze: 2, wdh: '', kg: null, sek: 25 });
  assert.deepEqual(variante({ name: 'Seitstütz', saetze: 2, wdh: '', kg: null, sek: 40, schwer: { name: 'Seitstütz mit Beinheben' } }, true), { name: 'Seitstütz mit Beinheben', saetze: 2, wdh: '', kg: null, sek: 40 });
  assert.deepEqual(variante({ name: 'Seitstütz', saetze: 2, wdh: '', kg: null, sek: 40, schwer: { name: 'Copenhagen', wdh: '8' } }, true), { name: 'Copenhagen', saetze: 2, wdh: '8', kg: null });
});

test('Vorbelegung: zuletzt trainierte Version wird wieder vorgeschlagen', () => {
  const u = { name: 'Kreuzheben gestreckt, Kurzhanteln', saetze: 3, wdh: '12', kg: 20, schwer: { name: 'Einbeiniges Kreuzheben' } };
  const s = stand();
  assert.equal(zuletztSchwer(s, u, '2026-12-31'), false); // noch nie trainiert
  s.trainings.push(kraft('2026-11-12', 'Kraft B', { uebungen: [{ name: 'Kreuzheben gestreckt', saetze: [{ kg: 20, wdh: 12 }] }] }));
  assert.equal(zuletztSchwer(s, u, '2026-12-31'), false);
  s.trainings.push(kraft('2026-11-19', 'Kraft B', { uebungen: [{ name: 'Einbeiniges Kreuzheben', saetze: [{ kg: 10, wdh: 8 }] }] }));
  assert.equal(zuletztSchwer(s, u, '2026-12-31'), true);
  assert.equal(zuletztSchwer(s, u, '2026-11-15'), false); // Nachtrag für einen früheren Tag
  s.trainings.push(kraft('2026-11-26', 'Kraft B', { uebungen: [{ name: 'Kreuzheben gestreckt', saetze: [{ kg: 20, wdh: 12 }] }, { name: 'Einbeiniges Kreuzheben', saetze: [] }] }));
  assert.equal(zuletztSchwer(s, u, '2026-12-31'), false); // wieder die einfache; Übung ohne Sätze zählt nicht
  assert.equal(zuletztSchwer(s, { name: 'Dead Bug' }, '2026-12-31'), false);
});

test('Import: Plan-Einheit mit anspruchsvoller Version', () => {
  const r = leseImport(block([{ typ: 'einheit', name: 'Kraft B', uebungen: [
    { name: 'Kreuzheben gestreckt', saetze: 3, wdh: 12, kg: 20, pause_sek: 20, schwer: { name: ' Einbeiniges Kreuzheben ', wdh: '8-12', kg: '10', notiz: 'je Bein', unbekannt: 1 } },
    { name: 'Seitstütz', sek: 40, schwer: null },
  ] }]));
  assert.equal(r.ok, true, r.fehler.join(' | '));
  const e = verarbeite(stand(), r.eintraege);
  const plan = e.state.einstellungen.plan.einheiten['Kraft B'];
  assert.deepEqual(plan[0].schwer, { name: 'Einbeiniges Kreuzheben', kg: 10, wdh: '8-12', notiz: 'je Bein' }); // keine Vorgabewerte, Fehlendes wird geerbt
  assert.equal(Object.hasOwn(plan[1], 'schwer'), false);
  assert.ok(e.posten[0].felder[0].neu.includes('[anspruchsvoller: Einbeiniges Kreuzheben]'));
  assert.deepEqual(variante(plan[0], true), { name: 'Einbeiniges Kreuzheben', saetze: 3, wdh: '8-12', kg: 10, pause_sek: 20, notiz: 'je Bein' });
});

test('Import: fehlerhafte anspruchsvolle Version wird abgelehnt', () => {
  for (const [schwer, muster] of [
    [{ wdh: '8' }, /anspruchsvollere Version braucht einen "name"/],
    ['Einbeinig', /anspruchsvollere Version braucht einen "name"/],
    [{ name: 'X', kg: 'schwer' }, /schwer\.kg.*Zahl/],
    [{ name: 'X', pause_sek: 9999 }, /außerhalb/],
  ]) {
    const r = leseImport(block([{ typ: 'einheit', name: 'Kraft A', uebungen: [{ name: 'Basis', schwer }] }]));
    assert.equal(r.ok, false, JSON.stringify(schwer));
    assert.match(r.fehler.join(' | '), muster);
  }
});

test('Anleitung für Claude erklärt die anspruchsvolle Version', () => {
  const text = liesmichDatei();
  assert.ok(text.includes('"schwer": {'));
  assert.match(text, /`schwer` ist optional die anspruchsvollere Version/);
});
