// Eigene Symbole (einfache Strichzeichnungen als SVG, keine fremde Bibliothek)
// und die Zuordnung von Übungs- und Sportnamen zu Symbol und Farbe.

import { h, s } from './dom.js';

// Jedes Symbol: Liste von [Element, Attribute]. Zeichenfläche 24 × 24, Linien mit runden Enden.
const kopf = (cx, cy) => ['circle', { cx, cy, r: 1.9 }];
const SYMBOLE = {
  hantel: [['path', { d: 'M2.5 9.5v5M5.5 7v10M5.5 12h13M18.5 7v10M21.5 9.5v5' }]],
  // Liegestütz: schräger Körper auf gestreckten Armen, Doppelpfeil für die Bewegung
  liegestuetz: [kopf(4.8, 10), ['path', { d: 'M6.8 11.6l13.7 5.2M8.6 12.3v5.5M2.5 18.5h19M16.5 3.5v7M14.3 5.7l2.2-2.2 2.2 2.2M14.3 8.3l2.2 2.2 2.2-2.2' }]],
  // Dead Bug: Rückenlage, ein Arm und das Gegenbein in der Luft
  deadbug: [kopf(4.6, 15.6), ['path', { d: 'M6.6 16.2h8M8.8 16.2V9M14.6 16.2l2.4-6 3.6 1.2M14.6 16.2h6.4M2.5 18.7h19' }]],
  // Hollow Hold: Körper als flache Schale, Arme und Beine angehoben
  hollow: [kopf(5.4, 11.2), ['path', { d: 'M7 12.6c3.2 4.6 8 4.6 12.8.2M5 9L2.8 6.8M2.5 19h19' }]],
  // Seitstütz: Körper diagonal, Stützarm senkrecht, freier Arm nach oben
  seitstuetz: [kopf(6.6, 8), ['path', { d: 'M8.3 9.7l12.2 8M9.4 10.5v7.5M9.6 10.2l1.2-6.2M2.5 18.5h19' }]],
  // Glute Bridge: Schultern am Boden, Hüfte oben, Füße aufgestellt
  bruecke: [kopf(4.4, 16.2), ['path', { d: 'M6.2 15.8l7.2-5.2M13.4 10.6l4.2.6M17.6 11.2v7.2M2.5 18.5h19' }]],
  druecken: [kopf(12, 8.2), ['path', { d: 'M12 10.5v5.5M12 16l-3 5M12 16l3 5M12 11.8l-4.5-2.8V4.5M12 11.8l4.5-2.8V4.5M4.5 4h15' }]],
  // Hantel, die nach oben gezogen wird
  rudern: [['path', { d: 'M3 15.5v4M5.5 14v7M5.5 17.5h13M18.5 14v7M21 15.5v4M12 11V3.5M8.5 7L12 3.5 15.5 7' }]],
  klimmzug: [['path', { d: 'M3.5 3.5h17M8.5 3.5l2 5.5M15.5 3.5l-2 5.5M12 11v5.5M12 16.5l-2.2 4.5M12 16.5l2.2 4.5' }], kopf(12, 7.3)],
  kniebeuge: [kopf(9.5, 5), ['path', { d: 'M9.8 7.3l1.2 6.2M11 13.5h5.5M16.5 13.5l-1.3 6.5M12.5 20h5M10.2 9.5l5.8.6' }]],
  ausfallschritt: [kopf(11.5, 4.5), ['path', { d: 'M11.5 6.8v6.2M11.5 13l5 2.2V20M11.5 13l-4 3.2-2.5 3.8M14.5 20h4.5M3.5 20h3.5' }]],
  kreuzheben: [kopf(17.3, 7.3), ['path', { d: 'M15.6 8.9L8.5 12M8.5 12v8.5M13.3 9.9V15M10.3 16.3h6M6 20.5h5' }]],
  // Unterarmstütz: gerader Körper waagerecht, Unterarme und Zehen am Boden
  rumpf: [kopf(4.6, 11.6), ['path', { d: 'M6.6 13.2h14M8.2 13.6v4.6h3.4M20.6 13.2v5M2.5 18.5h19' }]],
  laufen: [kopf(14.5, 4.5), ['path', { d: 'M13.5 7l-2.3 5.2M11.2 12.2l3.3 2.6-1 4.4M11.2 12.2l-4 .8-2 3.2M12.8 8.6l3.4 1.9M12.8 8.6l-3.6.6M3.5 21h17' }]],
  gehen: [kopf(12, 4.5), ['path', { d: 'M12 6.8v6.4M12 13.2l3 6.8M12 13.2l-3 6.8M12 8.8l3.2 2.4M12 8.8l-3.2 2.4' }]],
  ball: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M12 8l3.6 2.6-1.4 4.2H9.8L8.4 10.6zM12 3.5V8M15.6 10.6l4.4-1.6M14.2 14.8l2.7 3.9M9.8 14.8l-2.7 3.9M8.4 10.6L4 9' }]],
  rad: [['circle', { cx: 6, cy: 16, r: 3.5 }], ['circle', { cx: 18, cy: 16, r: 3.5 }], ['path', { d: 'M6 16l4-7h5l3 7M10 9l3.5 7M9 6.5h2.5M15 9l-1-2.5h2.5' }]],
  ruhe: [['path', { d: 'M19 14.5A8 8 0 019.5 5a8 8 0 109.5 9.5z' }]],
  uhr: [['circle', { cx: 12, cy: 13, r: 7.5 }], ['path', { d: 'M12 9v4l2.5 2M9.5 2.5h5' }]],
  wdh: [['path', { d: 'M4 12a8 8 0 0113.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 01-13.7 5.7L4 15.5M4 20v-4.5h4.5' }]],
  gewicht: [['path', { d: 'M9 6.5a3 3 0 116 0M6.5 8.5h11l2 11.5h-15z' }]],
  pfeilHoch: [['path', { d: 'M12 20V5M6 11l6-6 6 6' }]],
  pfeilRunter: [['path', { d: 'M12 4v15M6 13l6 6 6-6' }]],
  start: [['path', { d: 'M7 4.5l12 7.5-12 7.5z' }]],
  haken: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  pokal: [['path', { d: 'M8 4h8v5a4 4 0 01-8 0zM8 5.5H4.5V7A3 3 0 008 10M16 5.5h3.5V7A3 3 0 0116 10M12 13v4M8.5 20h7M10 17h4' }]],
  flamme: [['path', { d: 'M12 2.8c.8 3.6 5.2 5.6 5.2 10.4a5.2 5.2 0 01-10.4 0c0-2 .9-3.6 2-4.6.3 1.6 1 2.4 2 2.6-.7-2.9-.2-6 1.2-8.4z' }]],
  // Joker: vierzackiger Stern
  joker: [['path', { d: 'M12 3l2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3z' }]],
};

/** SVG-Element eines Symbols (Farbe über CSS: currentColor). */
export function symbol(name) {
  const teile = SYMBOLE[name] || SYMBOLE.hantel;
  return s('svg', { class: 'sym', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, teile.map(([tag, attrs]) => s(tag, attrs)));
}

export const SYMBOL_NAMEN = Object.keys(SYMBOLE);

// Reihenfolge zählt: der erste Treffer gewinnt. Farbe = Gruppe (CSS-Klasse k-…).
const ARTEN = [
  [/liegest|dips|bankdr|push/i, 'liegestuetz', 'druecken'],
  [/klimmz|latz|pull.?up/i, 'klimmzug', 'ziehen'],
  [/ruder/i, 'rudern', 'ziehen'],
  [/schulterdr|überkopf|press(?!e)/i, 'druecken', 'schulter'],
  [/bridge|brücke|hip thrust|hüftheben/i, 'bruecke', 'rueckseite'],
  [/kreuzheben|deadlift/i, 'kreuzheben', 'rueckseite'],
  [/dead bug/i, 'deadbug', 'rumpf'],
  [/hollow/i, 'hollow', 'rumpf'],
  [/seitst|side plank/i, 'seitstuetz', 'rumpf'],
  [/ausfallschritt|split squat|lunge/i, 'ausfallschritt', 'beine'],
  [/squat|kniebeug|beinpresse/i, 'kniebeuge', 'beine'],
  [/stütz|plank|rumpf|crunch|bauch/i, 'rumpf', 'rumpf'],
  [/fu(ß|ss)ball/i, 'ball', 'cardio'],
  [/spazier|wander|gehen/i, 'gehen', 'cardio'],
  [/rad/i, 'rad', 'cardio'],
  [/laufband|lauf|jogg|hampelm|seil/i, 'laufen', 'cardio'],
];

/** Symbol und Farbgruppe zu einem Übungs- oder Sportnamen. */
export function uebungsArt(name) {
  const text = String(name || '');
  for (const [muster, sym, farbe] of ARTEN) if (muster.test(text)) return { symbol: sym, farbe };
  return { symbol: 'hantel', farbe: 'kraft' };
}

/** Farbige Kachel mit dem Symbol einer Übung oder Sportart. */
export function kachel(name, groesse = '') {
  const a = uebungsArt(name);
  return h('span', { class: `kachel k-${a.farbe} ${groesse}`.trim() }, symbol(a.symbol));
}
