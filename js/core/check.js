// Check vor dem Training: drei Fragen (je 1–5, 5 = gut), daraus ein Vorschlag für die Krafteinheit.
// Reine Logik ohne Bildschirm-Code. Grenzwerte stehen als Ziele in den Daten (check_*_ab).

import { zielWert } from './ziele.js';

export const REGIONEN = ['Oberkörper', 'Beine', 'Rumpf'];

export const FRAGEN = [
  { feld: 'muskelkater', titel: 'Muskelkater', eins: 'stark', fuenf: 'keiner' },
  { feld: 'schlaf', titel: 'Schlaf letzte Nacht', eins: 'sehr schlecht', fuenf: 'sehr gut' },
  { feld: 'energie', titel: 'Energie', eins: 'platt', fuenf: 'voll da' },
];

/** Region einer Übung (für „ein Satz weniger bei Muskelkater“). null = keiner Region zugeordnet. */
export function uebungsRegion(name) {
  const t = String(name || '');
  if (/liegest/i.test(t)) return 'Oberkörper';
  if (/dead bug|hollow|seitst|side plank|stütz|plank|rumpf|crunch|bauch|pallof|bird.?dog/i.test(t)) return 'Rumpf';
  if (/squat|kniebeug|beinpresse|ausfallschritt|lunge|bridge|brücke|hip thrust|hüftheben|kreuzheben|deadlift|wade|step.?up|bein/i.test(t)) return 'Beine';
  if (/liegest|dips|bankdr|push|klimmz|latz|pull|ruder|schulter|überkopf|press|curl|bizeps|trizeps|brust|rücken/i.test(t)) return 'Oberkörper';
  return null;
}

/** Grenzwerte zum Datum (Startwerte 11 / 7 / 4). */
export function checkGrenzen(ziele, datum) {
  return {
    normal: zielWert(ziele, 'check_normal_ab', datum),
    leicht: zielWert(ziele, 'check_leicht_ab', datum),
    reduziert: zielWert(ziele, 'check_reduziert_ab', datum),
  };
}

const gueltig = (v) => Number.isInteger(v) && v >= 1 && v <= 5;

/**
 * Stufe aus den Antworten.
 * normal (ab 11) · leicht (7–10) · reduziert (4–6 oder ein Wert = 1) · ersatz (darunter, also 3).
 * Liefert null, solange nicht alle drei Fragen beantwortet sind.
 */
export function checkStufe(check, grenzen) {
  if (!check || !FRAGEN.every((f) => gueltig(check[f.feld]))) return null;
  const summe = check.muskelkater + check.schlaf + check.energie;
  const eins = FRAGEN.some((f) => check[f.feld] === 1);
  let stufe;
  if (summe < grenzen.reduziert) stufe = 'ersatz';
  else if (summe < grenzen.leicht || eins) stufe = 'reduziert';
  else if (summe < grenzen.normal) stufe = 'leicht';
  else stufe = 'normal';
  return { stufe, summe, eins };
}

/** Bei Muskelkater 2 oder schlechter wird nach den Regionen gefragt. */
export const fragtRegionen = (check) => !!check && gueltig(check.muskelkater) && check.muskelkater <= 2;

/** Kurze Begründung und Überschrift für den Vorschlag. */
export function checkText(ergebnis, check) {
  const { stufe, summe } = ergebnis;
  const schwach = FRAGEN.filter((f) => check[f.feld] === 1).map((f) => f.titel);
  const regionen = fragtRegionen(check) ? (check.regionen || []) : [];
  if (stufe === 'normal') return { titel: 'Plan wie vorgesehen', grund: `Summe ${summe} von 15 – du bist gut erholt. Wenn du magst, nimm die anspruchsvollere Version.` };
  if (stufe === 'leicht') {
    return {
      titel: 'Einfache Version',
      grund: `Summe ${summe} von 15 – etwas angeschlagen. Alle Übungen in der einfachen Version${regionen.length ? `, bei ${regionen.join(', ')} je ein Satz weniger` : ''}.`,
    };
  }
  if (stufe === 'reduziert') {
    return {
      titel: 'Reduzierte Einheit',
      grund: `${schwach.length ? `${schwach.join(' und ')} auf 1` : `Summe ${summe} von 15`} – alle Übungen einfach, höchstens 2 Sätze.`,
      hinweis: 'Heute kurz halten – Bewegung zählt mehr als Leistung.',
    };
  }
  return { titel: 'Heute lieber Spaziergang oder Laufband', grund: `Summe ${summe} von 15 – alles auf dem Tiefpunkt. Heute lieber 20–30 Min. Spaziergang oder Laufband statt Kraft.` };
}

/**
 * Wendet den Vorschlag auf die Übungsliste an.
 * plan: Liste der Plan-Übungen (mit saetze), wahl: anspruchsvolle Version je Übung (true/false).
 * Liefert { wahl, saetze } mit der neuen Auswahl und der Satzzahl je Übung (null = wie im Plan).
 */
export function wendeVorschlagAn(plan, wahl, ergebnis, check) {
  const n = plan.length;
  if (!ergebnis || ergebnis.stufe === 'normal') {
    // Plan bleibt; die anspruchsvollere Version wird nur angeboten (Knopf je Übung), nicht erzwungen.
    return { wahl: plan.map((_, i) => !!wahl[i]), saetze: Array(n).fill(null) };
  }
  const einfach = Array(n).fill(false);
  if (ergebnis.stufe === 'leicht') {
    const regionen = fragtRegionen(check) ? (check.regionen || []) : [];
    return {
      wahl: einfach,
      saetze: plan.map((u) => (regionen.includes(uebungsRegion(u.name)) ? Math.max(1, (u.saetze || 3) - 1) : null)),
    };
  }
  if (ergebnis.stufe === 'reduziert') return { wahl: einfach, saetze: plan.map((u) => Math.min(2, u.saetze || 3)) };
  return { wahl: einfach, saetze: Array(n).fill(null) }; // ersatz: keine Krafteinheit
}

/** Felder, die mit der Einheit gespeichert werden (nur beantwortete). */
export function checkFelder(check, ergebnis, angenommen) {
  if (!ergebnis) return {};
  const aus = { check_muskelkater: check.muskelkater, check_schlaf: check.schlaf, check_energie: check.energie };
  if (fragtRegionen(check) && check.regionen && check.regionen.length) aus.check_regionen = [...check.regionen];
  aus.check_vorschlag = ergebnis.stufe;
  aus.check_angenommen = !!angenommen;
  return aus;
}

/** Kurzer Anzeigetext für den Verlauf, z. B. „Check 4 · 3 · 5 (Beine) – Vorschlag angenommen“. */
export function checkZeile(t) {
  if (!gueltig(t.check_muskelkater) || !gueltig(t.check_schlaf) || !gueltig(t.check_energie)) return '';
  const r = t.check_regionen && t.check_regionen.length ? ` (Muskelkater: ${t.check_regionen.join(', ')})` : '';
  const STUFEN = { normal: 'Plan normal', leicht: 'einfache Version', reduziert: 'reduzierte Einheit', ersatz: 'Spaziergang/Laufband statt Kraft' };
  const v = t.check_vorschlag ? ` – ${STUFEN[t.check_vorschlag] || t.check_vorschlag}${t.check_angenommen === false ? ' vorgeschlagen, normal trainiert' : ''}` : '';
  return `Check: Muskelkater ${t.check_muskelkater} · Schlaf ${t.check_schlaf} · Energie ${t.check_energie}${r}${v}`;
}
