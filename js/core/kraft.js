// Kraft-Verlauf: Gewicht × Wiederholungen je Übung über alle Einheiten, mit Vergleich zur Vorgänger-Einheit.

import { uebungsSchluessel, uebungsName } from './state.js';

/**
 * Nimmt eine während des Trainings hinzugefügte Übung dauerhaft in den Plan einer Einheit auf.
 * Gibt es die Übung dort schon (auch als anspruchsvolle Version), passiert nichts. Rückgabe: wurde ergänzt?
 */
export function ergaenzePlanUebung(einheiten, einheit, uebung) {
  const liste = einheiten[einheit] || (einheiten[einheit] = []);
  const key = uebungsSchluessel(uebung.name);
  if (!key || liste.some((u) => uebungsSchluessel(u.name) === key || (u.schwer && uebungsSchluessel(u.schwer.name) === key))) return false;
  liste.push(uebung);
  return true;
}

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
      if (!map.has(key)) map.set(key, { key, name: uebungsName(u.name), eintraege: [] });
      map.get(key).eintraege.push({ datum: t.datum, id: t.id, einheit: t.einheit, saetze: u.saetze, notiz: u.notiz || '', ...kennzahlen(u.saetze) });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// ---------- Bestwerte ----------

/** "16 kg × 12", "15 Wdh." oder "40 Sek." */
export function satzAnzeige(satz) {
  if (satz.sek !== undefined && satz.wdh === undefined) return `${satz.sek} Sek.`;
  const kg = satz.kg || 0;
  return kg > 0 ? `${String(kg).replace('.', ',')} kg × ${satz.wdh ?? 0}` : `${satz.wdh ?? 0} Wdh.`;
}

/**
 * Ist dieser Satz ein neuer Bestwert gegenüber allen früheren Sätzen derselben Übung?
 * Mit Gewicht (in dieser Reihenfolge geprüft):
 *   'gewicht'  mehr Gewicht als je zuvor bei mindestens so vielen Wiederholungen
 *   'wdh'      mehr Wiederholungen als je zuvor bei diesem Gewicht
 *   'volumen'  der höchste Satz (kg × Wiederholungen)
 * Ohne Gewicht zählen die Wiederholungen ('wdh') bzw. die Sekunden ('zeit').
 * Ohne frühere Sätze gibt es keinen Rekord (der allererste Satz ist kein "neuer" Bestwert).
 * Ergebnis: null oder { art, text }
 */
export function rekord(satz, fruehere) {
  const alt = (fruehere || []).filter(Boolean);
  if (!satz || !alt.length) return null;
  const aus = (art) => ({ art, text: satzAnzeige(satz) });
  const max = (liste, f) => liste.reduce((m, p) => Math.max(m, f(p)), -Infinity);

  if (satz.sek !== undefined && satz.wdh === undefined) {
    const zeiten = alt.filter((p) => typeof p.sek === 'number');
    return zeiten.length && satz.sek > max(zeiten, (p) => p.sek) ? aus('zeit') : null;
  }
  const wdh = satz.wdh || 0;
  const kg = satz.kg || 0;
  if (wdh <= 0) return null;
  const mitWdh = alt.filter((p) => typeof p.wdh === 'number');
  if (kg > 0) {
    const mindestensSoViele = mitWdh.filter((p) => p.wdh >= wdh);
    if (mindestensSoViele.length && kg > max(mindestensSoViele, (p) => p.kg || 0)) return aus('gewicht');
    const gleichesGewicht = mitWdh.filter((p) => (p.kg || 0) === kg);
    if (gleichesGewicht.length && wdh > max(gleichesGewicht, (p) => p.wdh)) return aus('wdh');
    const mitGewicht = mitWdh.filter((p) => (p.kg || 0) > 0);
    if (mitGewicht.length && kg * wdh > max(mitGewicht, (p) => p.kg * p.wdh)) return aus('volumen');
    return null;
  }
  const ohneGewicht = mitWdh.filter((p) => !(p.kg > 0));
  return ohneGewicht.length && wdh > max(ohneGewicht, (p) => p.wdh) ? aus('wdh') : null;
}

/**
 * Markiert in einem Übungsverlauf (älteste Einheit zuerst) die Sätze, die damals ein neuer Bestwert waren.
 * Ergebnis: je Eintrag { ...eintrag, rekorde: [{ art, text, satz }] }. Die erste Einheit hat nie Rekorde.
 */
export function markiereRekorde(eintraege) {
  const bisher = [];
  return eintraege.map((e, i) => {
    const rekorde = [];
    for (const satz of e.saetze || []) {
      const r = i > 0 ? rekord(satz, bisher) : null;
      if (r) rekorde.push({ ...r, satz });
      bisher.push(satz);
    }
    return { ...e, rekorde };
  });
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
