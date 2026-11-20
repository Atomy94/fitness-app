// Schlaf und Erholung: Werte je Nacht, Wochenschnitt, Vorbelegung für den Check vor dem Training.
// Reine Logik ohne Bildschirm-Code. Schlaf wird angezeigt, aber nicht bewertet.
//
// Zuordnung: Die Nacht, die am Morgen des Tages D endet, steht beim Tag D ("Schlaf letzte Nacht").
// Felder am Tag: schlaf_h (Gesamtschlaf), schlaf_tief_min, schlaf_rem_min, schlaf_leicht_min,
// schlaf_wach_min, einschlafen, aufwachen ("HH:MM"), ruhepuls (Schläge/Min.), hrv_ms, stress (1–10, selbst).

import { plusTage, wochenTage } from './datum.js';
import { zielWert } from './ziele.js';

export const PHASEN = [
  { feld: 'schlaf_tief_min', name: 'Tief', klasse: 'p-tief' },
  { feld: 'schlaf_rem_min', name: 'REM', klasse: 'p-rem' },
  { feld: 'schlaf_leicht_min', name: 'Leicht', klasse: 'p-leicht' },
  { feld: 'schlaf_wach_min', name: 'Wach', klasse: 'p-wach' },
];

const zahl = (v) => typeof v === 'number' && Number.isFinite(v);

/** Alle Schlafwerte einer Nacht (Tag D) oder null, wenn nichts vorliegt. */
export function nacht(state, datum) {
  const t = state.tage[datum];
  if (!t) return null;
  const phasen = PHASEN.filter((p) => zahl(t[p.feld])).map((p) => ({ ...p, min: t[p.feld] }));
  const n = {
    datum,
    stunden: zahl(t.schlaf_h) ? t.schlaf_h : null,
    phasen,
    einschlafen: t.einschlafen || null,
    aufwachen: t.aufwachen || null,
    ruhepuls: zahl(t.ruhepuls) ? t.ruhepuls : null,
    hrv: zahl(t.hrv_ms) ? t.hrv_ms : null,
    stress: zahl(t.stress) ? t.stress : null,
    qualitaet: zahl(t.schlaf_qualitaet) ? t.schlaf_qualitaet : null,
  };
  // Ohne Gesamtdauer, aber mit Phasen: Summe der Schlafphasen (ohne Wachzeit)
  if (n.stunden === null) {
    const schlaf = phasen.filter((p) => p.feld !== 'schlaf_wach_min');
    if (schlaf.length) n.stunden = schlaf.reduce((a, p) => a + p.min, 0) / 60;
  }
  const hatWas = n.stunden !== null || n.phasen.length || n.einschlafen || n.aufwachen || n.ruhepuls !== null || n.hrv !== null;
  return hatWas ? n : null;
}

/** Anteile der Phasen in Prozent (für den Balken). Leere Liste ohne Phasen. */
export function phasenAnteile(n) {
  if (!n || !n.phasen.length) return [];
  const summe = n.phasen.reduce((a, p) => a + p.min, 0);
  if (summe <= 0) return [];
  return n.phasen.map((p) => ({ ...p, pct: (p.min / summe) * 100 }));
}

const schnitt = (werte) => {
  const w = werte.filter(zahl);
  return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null;
};

/** Durchschnittswerte über die Tage [von, bis]. */
export function schlafSchnitt(state, von, bis) {
  const naechte = [];
  for (let d = von; d <= bis; d = plusTage(d, 1)) { const n = nacht(state, d); if (n) naechte.push(n); }
  const tage = [];
  for (let d = von; d <= bis; d = plusTage(d, 1)) if (state.tage[d]) tage.push(state.tage[d]);
  return {
    naechte: naechte.filter((n) => n.stunden !== null).length,
    stunden: schnitt(naechte.map((n) => n.stunden)),
    ruhepuls: schnitt(naechte.map((n) => n.ruhepuls)),
    hrv: schnitt(naechte.map((n) => n.hrv)),
    stress: schnitt(tage.map((t) => t.stress)),
  };
}

/** Diese Woche (Mo bis heute) und die Vorwoche zum Vergleich. */
export function schlafWoche(state, mo, heuteIso) {
  const tage = wochenTage(mo);
  const bis = tage[6] < heuteIso ? tage[6] : heuteIso;
  return { diese: schlafSchnitt(state, mo, bis), vorher: schlafSchnitt(state, plusTage(mo, -7), plusTage(mo, -1)) };
}

/** Verlauf der letzten `anzahl` Tage bis einschließlich `bis`: Punkte je Feld und 7-Tage-Schnitt der Dauer. */
export function schlafVerlauf(state, bis, anzahl = 30) {
  const von = plusTage(bis, -(anzahl - 1));
  const punkte = [];
  for (let d = von; d <= bis; d = plusTage(d, 1)) {
    const n = nacht(state, d);
    const t = state.tage[d] || {};
    punkte.push({ datum: d, stunden: n ? n.stunden : null, ruhepuls: n ? n.ruhepuls : null, hrv: n ? n.hrv : null, stress: zahl(t.stress) ? t.stress : null, qualitaet: zahl(t.schlaf_qualitaet) ? t.schlaf_qualitaet : null });
  }
  // 7-Tage-Schnitt der Schlafdauer (nur Nächte mit Wert im Fenster)
  const schnitt7 = punkte.map((p) => {
    if (p.stunden === null) return { datum: p.datum, wert: null };
    const ab = plusTage(p.datum, -6);
    const fenster = [];
    for (let d = ab; d <= p.datum; d = plusTage(d, 1)) { const n = nacht(state, d); if (n && n.stunden !== null) fenster.push(n.stunden); }
    return { datum: p.datum, wert: schnitt(fenster) };
  });
  return { punkte, schnitt7 };
}

/** Schlafbedarf aus den Zielen (Startwert 7,5 Std.). */
export const schlafBedarf = (state, datum) => zielWert(state.ziele, 'schlaf_bedarf_h', datum);

/**
 * Vorbelegung der Frage „Schlaf letzte Nacht“ (1–5, 5 = sehr gut) aus der gemessenen Dauer:
 * ab Bedarf 5, ab Bedarf − 1 Std. 4, − 2 Std. 3, − 3 Std. 2, darunter 1. Ohne Messung null.
 */
export function schlafNote(stunden, bedarf) {
  if (!zahl(stunden) || !zahl(bedarf)) return null;
  const fehlt = bedarf - stunden;
  if (fehlt <= 0) return 5;
  if (fehlt <= 1) return 4;
  if (fehlt <= 2) return 3;
  if (fehlt <= 3) return 2;
  return 1;
}

/** Dauer als "7:25 Std." */
export function dauerText(stunden) {
  if (!zahl(stunden)) return '–';
  const min = Math.round(stunden * 60);
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Std.`;
}

/** Minuten als "1:05 Std." bzw. "45 Min." */
export function minText(min) {
  if (!zahl(min)) return '–';
  return min >= 60 ? `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')} Std.` : `${Math.round(min)} Min.`;
}
