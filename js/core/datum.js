// Datumsfunktionen. Ein Datum ist überall ein Text "JJJJ-MM-TT" (ISO).
// "Heute" richtet sich immer nach der Zeitzone Europe/Berlin.

export const TZ = 'Europe/Berlin';
export const WT_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WT_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const teileFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function teile(jetzt) {
  const t = {};
  for (const p of teileFmt.formatToParts(jetzt)) t[p.type] = p.value;
  return t;
}

/** Heutiges Datum in Berlin als "JJJJ-MM-TT". */
export function heute(jetzt = new Date()) {
  const t = teile(jetzt);
  return `${t.year}-${t.month}-${t.day}`;
}

/** Aktuelle Stunde in Berlin (0–23). */
export function stundeBerlin(jetzt = new Date()) {
  return Number(teile(jetzt).hour) % 24;
}

function utc(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  return Date.UTC(j, m - 1, t);
}

export function istDatum(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(utc(s));
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function plusTage(iso, n) {
  return new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);
}

/** Anzahl Tage von a bis b (b später = positiv). */
export function diffTage(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

/** 1 = Montag … 7 = Sonntag. */
export function wochentag(iso) {
  const d = new Date(utc(iso)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Montag der Woche, in der das Datum liegt. */
export function montag(iso) {
  return plusTage(iso, 1 - wochentag(iso));
}

export function wochenTage(mo) {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => plusTage(mo, i));
}

/** TT.MM.JJJJ */
export function de(iso) {
  if (!iso) return '';
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

/** TT.MM. */
export function deKurz(iso) {
  if (!iso) return '';
  const [, m, t] = iso.split('-');
  return `${t}.${m}.`;
}

/** "Sa, 14.11.2026" */
export function deMitTag(iso) {
  return `${WT_KURZ[wochentag(iso) - 1]}, ${de(iso)}`;
}

/** Kalenderwoche nach ISO 8601 (Woche beginnt am Montag). */
export function kw(iso) {
  const do_ = plusTage(montag(iso), 3); // Donnerstag bestimmt das Jahr
  const jahr = Number(do_.slice(0, 4));
  const ersterDo = plusTage(montag(`${jahr}-01-04`), 3);
  return 1 + Math.round(diffTage(ersterDo, do_) / 7);
}

/** Wochen (je 7 ISO-Daten, Mo–So), die den Monat abdecken. monat: 1–12 */
export function monatsRaster(jahr, monat) {
  const erster = `${jahr}-${String(monat).padStart(2, '0')}-01`;
  const naechster = monat === 12 ? `${jahr + 1}-01-01` : `${jahr}-${String(monat + 1).padStart(2, '0')}-01`;
  const letzter = plusTage(naechster, -1);
  const wochen = [];
  for (let mo = montag(erster); mo <= letzter; mo = plusTage(mo, 7)) wochen.push(wochenTage(mo));
  return wochen;
}
