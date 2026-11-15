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

/**
 * Liefert die Übung so, wie sie trainiert wird: die einfache Version oder (schwer = true) die
 * anspruchsvollere aus `u.schwer`. Die schwere Version erbt Sätze und Pause; Wiederholungen,
 * Haltezeit und Gewicht erbt sie nur, wenn sie selbst nichts angibt.
 */
export function variante(u, schwer) {
  const { schwer: s, ...basis } = u;
  if (!schwer || !s || !s.name) return basis;
  const v = { name: s.name, saetze: s.saetze ?? u.saetze, wdh: '', kg: s.kg ?? u.kg ?? null };
  const hatWdh = (x) => x.wdh !== undefined && x.wdh !== null && x.wdh !== '';
  const quelle = hatWdh(s) || s.sek !== undefined ? s : u;
  if (quelle.sek !== undefined && !hatWdh(quelle)) v.sek = quelle.sek;
  else v.wdh = quelle.wdh ?? '';
  const pause = s.pause_sek ?? u.pause_sek;
  if (typeof pause === 'number') v.pause_sek = pause;
  if (s.notiz) v.notiz = s.notiz;
  return v;
}

/** Wurde von dieser Plan-Übung zuletzt die anspruchsvollere Version trainiert? (Vorbelegung der Auswahl) */
export function zuletztSchwer(state, u, bisDatum) {
  if (!u.schwer || !u.schwer.name) return false;
  const einfach = uebungsSchluessel(u.name);
  const schwer = uebungsSchluessel(u.schwer.name);
  const einheiten = state.trainings.filter((t) => t.typ === 'kraft' && t.datum <= bisDatum).sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
  for (const t of einheiten) {
    const namen = (t.uebungen || []).filter((x) => x.saetze && x.saetze.length).map((x) => uebungsSchluessel(x.name));
    if (namen.includes(schwer)) return true;
    if (namen.includes(einfach)) return false;
  }
  return false;
}
