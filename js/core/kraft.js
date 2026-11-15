// Kraft-Verlauf: Gewicht × Wiederholungen je Übung über alle Einheiten, mit Vergleich zur Vorgänger-Einheit.

import { uebungsSchluessel } from './state.js';

/** Kennzahlen einer Übung in einer Einheit. */
export function kennzahlen(saetze) {
  const s = saetze || [];
  const mitWdh = s.filter((x) => typeof x.wdh === 'number');
  return {
    anzahl: s.length,
    maxKg: Math.max(0, ...s.map((x) => x.kg || 0)),
    wdhSumme: mitWdh.reduce((a, x) => a + x.wdh, 0),
    volumen: mitWdh.reduce((a, x) => a + (x.kg || 0) * x.wdh, 0), // Summe kg × Wdh.
    sekSumme: s.reduce((a, x) => a + (x.sek || 0), 0),
  };
}

/** Alle Übungen mit ihren Einträgen (älteste zuerst), nach Name sortiert. */
export function uebungsVerlaeufe(state) {
  const map = new Map();
  const einheiten = state.trainings.filter((t) => t.typ === 'kraft').sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  for (const t of einheiten) {
    for (const u of t.uebungen || []) {
      if (!u.saetze || !u.saetze.length) continue;
      const key = uebungsSchluessel(u.name);
      if (!map.has(key)) map.set(key, { key, name: u.name.split(/[,(]/)[0].trim(), eintraege: [] });
      map.get(key).eintraege.push({ datum: t.datum, id: t.id, einheit: t.einheit, saetze: u.saetze, notiz: u.notiz || '', ...kennzahlen(u.saetze) });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

const vz = (n) => `${n > 0 ? '+' : '−'}${String(Math.abs(Math.round(n * 10) / 10)).replace('.', ',')}`;

/**
 * Vergleich zweier Einträge derselben Übung.
 * Ergebnis: { text, richtung } – richtung 1 = gesteigert, 0 = gleich, -1 = weniger.
 * Mehr Gewicht zählt als Steigerung, auch wenn die Wiederholungen dabei sinken.
 */
export function vergleich(alt, neu) {
  const teile = [];
  let richtung = 0;
  const pruefe = (diff, einheit) => {
    if (!diff) return;
    teile.push(`${vz(diff)} ${einheit}`);
    if (!richtung) richtung = diff > 0 ? 1 : -1;
  };
  pruefe(neu.maxKg - alt.maxKg, 'kg');
  pruefe(neu.wdhSumme - alt.wdhSumme, 'Wdh.');
  pruefe(neu.sekSumme - alt.sekSumme, 'Sek.');
  return { text: teile.length ? teile.join(', ') : 'gleich', richtung };
}
