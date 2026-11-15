import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rezepteAusArchiv, fuerMenge, KATEGORIEN } from '../js/core/rezepte.js';
import { kennzahlen, uebungsVerlaeufe, vergleich } from '../js/core/kraft.js';
import { leseImport, verarbeite, KOPF } from '../js/core/import.js';
import { ergaenze } from '../js/core/state.js';
import { stand, kraft } from './hilfe.mjs';

const block = (eintraege) => `${KOPF}\n${JSON.stringify({ eintraege })}`;

test('Rezepte: Übernahme aus den Rohdaten der health-data.json', () => {
  const r = rezepteAusArchiv({
    standard_meals: [
      { name: 'Frühstück A – Overnight Oats', days: 'Mo–Fr', ingredients: { Haferflocken: 60, Wasser_ml: 150, Eier: '3 Stück' }, kcal: 555, protein: 52 },
      { name: 'Nachmittag – Shake', ingredients: { Whey: 30 }, kcal: 116, protein: 22 },
    ],
    foods_per_100g: [{ name: 'Chili sin Carne', kcal: 72, protein: 7.3, carbs: 6.6, fat: 1.6, sat_fat: 0.3, fiber: 2.3, salt: 0.35 }, { name: 'Crunchy Edamame', kcal: 416, protein: 45.9 }],
  });
  assert.equal(r.length, 4);
  assert.equal(r[0].kategorie, 'Frühstück');
  assert.equal(r[0].bezug, 'portion');
  assert.deepEqual(r[0].zutaten, [{ name: 'Haferflocken', menge: '60 g' }, { name: 'Wasser', menge: '150 ml' }, { name: 'Eier', menge: '3 Stück' }]);
  assert.equal(r[0].eiweiss_g, 52);
  assert.match(r[0].notiz, /Mo–Fr/);
  assert.equal(r[1].kategorie, 'Snacks');
  assert.equal(r[2].bezug, '100g');
  assert.equal(r[2].kategorie, 'Abendessen');
  assert.equal(r[2].ges_fett_g, 0.3);
  assert.equal(r[3].kategorie, 'Snacks');
  assert.equal(new Set(r.map((x) => x.id)).size, 4);
  assert.ok(r.every((x) => KATEGORIEN.includes(x.kategorie)));
  assert.deepEqual(rezepteAusArchiv(undefined), []);
});

test('Rezepte: Portion aus Werten pro 100 g berechnen', () => {
  const w = fuerMenge({ kcal: 72, eiweiss_g: 7.3, notiz: 'x' }, 350);
  assert.equal(w.kcal, 252);
  assert.ok(Math.abs(w.eiweiss_g - 25.55) < 1e-9);
  assert.equal(Object.hasOwn(w, 'fett_g'), false);
});

test('Rezepte: ältere Stände und Sicherungen ohne Rezepte werden ergänzt', () => {
  const alt = ergaenze({ tage: {}, einstellungen: { start: '2026-11-09', plan: {}, minimal: {}, archiv: { standard_meals: [{ name: 'Frühstück', kcal: 500 }] } } }, '2026-11-15');
  assert.equal(alt.rezepte.length, 1);
  const leer = ergaenze({ tage: {}, rezepte: [], einstellungen: { start: '2026-11-09', plan: {}, minimal: {}, archiv: { standard_meals: [{ name: 'Frühstück' }] } } }, '2026-11-15');
  assert.equal(leer.rezepte.length, 0); // vorhandene (auch leere) Liste bleibt unangetastet
});

test('Import: Rezept neu anlegen und ergänzen (ohne Datum, Schlüssel ist der Name)', () => {
  const r = leseImport(block([{ typ: 'rezept', name: 'Linsensuppe', kategorie: 'mittagessen', bezug: '100g', kcal: 85, eiweiss_g: '5,2', zutaten: [{ name: 'Linsen', menge: '300 g' }, { name: 'Wasser', menge: 800 }] }]));
  assert.equal(r.ok, true, r.fehler.join('\n'));
  let e = verarbeite(stand(), r.eintraege);
  assert.equal(e.posten[0].art, 'neu');
  const rezept = e.state.rezepte[0];
  assert.equal(rezept.kategorie, 'Mittagessen');
  assert.equal(rezept.eiweiss_g, 5.2);
  assert.deepEqual(rezept.zutaten, [{ name: 'Linsen', menge: '300 g' }, { name: 'Wasser', menge: '800 g' }]);
  e = verarbeite(e.state, leseImport(block([{ typ: 'rezept', name: 'linsensuppe', kcal: 90 }])).eintraege);
  assert.equal(e.state.rezepte.length, 1);
  assert.equal(e.posten[0].art, 'aenderung');
  assert.deepEqual(e.posten[0].felder, [{ feld: 'kcal', alt: 85, neu: 90 }]);
  assert.equal(e.state.rezepte[0].zutaten.length, 2);
});

test('Import: fehlerhafte Rezepte werden abgelehnt', () => {
  for (const [eintrag, muster] of [
    [{ typ: 'rezept', kcal: 100 }, /Pflichtfeld "name"/],
    [{ typ: 'rezept', name: 'X', kategorie: 'Nachtisch' }, /unbekannte Kategorie/],
    [{ typ: 'rezept', name: 'X', bezug: 'teller' }, /portion.*100g/],
    [{ typ: 'rezept', name: 'X', zutaten: [{ menge: '5 g' }] }, /Zutat braucht/],
    [{ typ: 'rezept', name: 'X', kcal: -1 }, /außerhalb/],
  ]) {
    const r = leseImport(block([eintrag]));
    assert.equal(r.ok, false);
    assert.match(r.fehler.join(' '), muster);
  }
});

test('Kraft: Kennzahlen einer Übung', () => {
  assert.deepEqual(kennzahlen([{ kg: 20, wdh: 10 }, { kg: 22, wdh: 8 }, { kg: 20, wdh: 9 }]), { anzahl: 3, maxKg: 22, wdhSumme: 27, volumen: 556, sekSumme: 0 });
  assert.deepEqual(kennzahlen([{ sek: 30 }, { sek: 40 }]), { anzahl: 2, maxKg: 0, wdhSumme: 0, volumen: 0, sekSumme: 70 });
  assert.equal(kennzahlen([{ wdh: 15 }]).maxKg, 0);
});

test('Kraft: Verlauf je Übung über alle Einheiten, gleiche Übung trotz Namenszusatz', () => {
  const s = stand();
  s.trainings.push(
    kraft('2026-11-12', 'Kraft B', { uebungen: [{ name: 'Goblet Squat (Tempo 3-1-x)', saetze: [{ kg: 20, wdh: 10 }, { kg: 20, wdh: 10 }] }, { name: 'Seitstütz', saetze: [{ sek: 30 }] }] }),
    kraft('2026-11-09', 'Alt', { uebungen: [{ name: 'Goblet Squat', saetze: [{ kg: 17.5, wdh: 12 }, { kg: 17.5, wdh: 12 }] }, { name: 'Ohne Sätze', saetze: [] }] }),
    kraft('2026-11-19', 'Kraft B', { uebungen: [{ name: 'Goblet Squat, Tempo 3-1-x', saetze: [{ kg: 20, wdh: 12 }, { kg: 20, wdh: 11 }] }] }),
    { id: 'c', typ: 'cardio', datum: '2026-11-10', art: 'Laufband', dauer_min: 30 },
  );
  const v = uebungsVerlaeufe(s);
  assert.deepEqual(v.map((x) => x.name), ['Goblet Squat', 'Seitstütz']);
  const squat = v[0].eintraege;
  assert.deepEqual(squat.map((e) => e.datum), ['2026-11-09', '2026-11-12', '2026-11-19']); // älteste zuerst
  assert.deepEqual(squat.map((e) => e.maxKg), [17.5, 20, 20]);
  assert.deepEqual(squat.map((e) => e.wdhSumme), [24, 20, 23]);
  assert.equal(squat[2].volumen, 460);
  assert.ok(Array.isArray(squat[0].saetze) && squat[0].saetze.length === 2); // Sätze bleiben erhalten
});

test('Kraft: Vergleich zweier Einheiten', () => {
  const k = (saetze) => kennzahlen(saetze);
  assert.deepEqual(vergleich(k([{ kg: 17.5, wdh: 12 }]), k([{ kg: 20, wdh: 10 }])), { text: '+2,5 kg, −2 Wdh.', richtung: 1 }); // mehr Gewicht zählt
  assert.deepEqual(vergleich(k([{ kg: 20, wdh: 10 }]), k([{ kg: 20, wdh: 12 }])), { text: '+2 Wdh.', richtung: 1 });
  assert.deepEqual(vergleich(k([{ kg: 20, wdh: 12 }]), k([{ kg: 20, wdh: 9 }])), { text: '−3 Wdh.', richtung: -1 });
  assert.deepEqual(vergleich(k([{ kg: 20, wdh: 12 }]), k([{ kg: 20, wdh: 12 }])), { text: 'gleich', richtung: 0 });
  assert.deepEqual(vergleich(k([{ sek: 30 }, { sek: 30 }]), k([{ sek: 40 }, { sek: 40 }])), { text: '+20 Sek.', richtung: 1 });
  assert.deepEqual(vergleich(k([{ kg: 0, wdh: 10 }]), k([{ kg: 0, wdh: 15 }])), { text: '+5 Wdh.', richtung: 1 });
});
