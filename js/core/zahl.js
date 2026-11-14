// Zahlen im deutschen Format lesen und ausgeben.

/**
 * Liest eine Eingabe wie "93,4", "93.4", "2.100" oder "2.100,5".
 * Gibt null zurück, wenn das Feld leer oder keine Zahl ist.
 */
export function parseZahl(eingabe) {
  if (typeof eingabe === 'number') return Number.isFinite(eingabe) ? eingabe : null;
  if (typeof eingabe !== 'string') return null;
  let s = eingabe.trim().replace(/\s/g, '');
  if (s === '') return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.'); // Punkt = Tausender, Komma = Dezimal
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // "2.100" = zweitausendeinhundert
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Zahl mit festen/maximalen Nachkommastellen im deutschen Format, "–" bei fehlendem Wert. */
export function fmt(n, stellen = 0, fest = false) {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: fest ? stellen : 0,
    maximumFractionDigits: stellen,
  }).format(n);
}

/** Für Eingabefelder: Komma als Dezimaltrenner, kein Tausenderpunkt, leer bei fehlendem Wert. */
export function fmtEingabe(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return String(n).replace('.', ',');
}

export function runde(n, stellen = 1) {
  if (n === null || n === undefined) return null;
  const f = 10 ** stellen;
  return Math.round(n * f) / f;
}
