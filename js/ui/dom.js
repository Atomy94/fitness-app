// Bausteine für die Oberfläche: Elemente erzeugen, Eingabefelder, Statuspunkte, Diagramme.
// Texte werden immer als Text eingefügt (nie als HTML) – Notizen können nichts kaputt machen.

import { parseZahl, fmt, fmtEingabe } from '../core/zahl.js';
import { deKurz, diffTage, plusTage } from '../core/datum.js';

function setze(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
}

function haenge(el, kinder) {
  for (const k of kinder.flat(Infinity)) {
    if (k === null || k === undefined || k === false || k === '') continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

/** HTML-Element: h('div', { class: 'karte' }, 'Text', kind) */
export function h(tag, attrs, ...kinder) {
  const el = document.createElement(tag);
  setze(el, attrs);
  return haenge(el, kinder);
}

/** SVG-Element */
export function s(tag, attrs, ...kinder) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  setze(el, attrs);
  return haenge(el, kinder);
}

export const karte = (titel, ...kinder) => h('section', { class: 'karte' }, titel ? h('h2', null, titel) : null, ...kinder);

export const STATUS_TEXT = { gruen: 'geschafft', gelb: 'knapp daneben', rot: 'verfehlt', grau: 'trifft nicht zu', leer: 'keine Daten', offen: 'noch offen' };
export const STATUS_ZEICHEN = { gruen: '✓', gelb: '≈', rot: '✕', grau: '–', leer: '', offen: '○' };

/** Farbiger Punkt mit Buchstabe (E, T, S); Stern = Zusatztraining. */
export function punkt(status, buchstabe, stern = false) {
  return h('span', { class: `punkt s-${status}`, title: STATUS_TEXT[status] }, buchstabe, stern ? h('span', { class: 'stern' }, '★') : null);
}

export const marke = (status, text) => h('span', { class: `marke s-${status}` }, text || STATUS_TEXT[status]);

/** Fortschrittsring. */
export function ring({ wert, ziel, status, titel, einheit, stellen = 0 }) {
  const r = 52;
  const umfang = 2 * Math.PI * r;
  const anteil = wert === null || wert === undefined || !ziel ? 0 : Math.min(1, wert / ziel);
  return h('div', { class: `ring s-${status}` },
    s('svg', { viewBox: '0 0 130 130', role: 'img', 'aria-label': `${titel}: ${fmt(wert, stellen)} von ${fmt(ziel)} ${einheit}` },
      s('circle', { class: 'bahn', cx: 65, cy: 65, r, fill: 'none', 'stroke-width': 12 }),
      s('circle', { class: 'bogen', cx: 65, cy: 65, r, fill: 'none', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': umfang, 'stroke-dashoffset': umfang * (1 - anteil), transform: 'rotate(-90 65 65)' }),
      s('text', { class: 'zahl', x: 65, y: 66, 'text-anchor': 'middle' }, fmt(wert, stellen)),
      s('text', { class: 'unter', x: 65, y: 85, 'text-anchor': 'middle' }, `von ${fmt(ziel)} ${einheit}`.trim()),
    ),
    h('div', { class: 'fett' }, titel),
  );
}

export function balken(wert, ziel, status) {
  const anteil = !wert || !ziel ? 0 : Math.min(1, wert / ziel);
  return h('div', { class: `balken s-${status}` }, h('i', { style: `width:${Math.round(anteil * 100)}%` }));
}

/**
 * Zahlenfeld mit Komma-Eingabe. onChange(zahl | null) wird nur bei gültiger Eingabe aufgerufen.
 */
export function zahlFeld({ label, wert, einheit, onChange, platzhalter = '', ganz = false, min = null, max = null }) {
  const input = h('input', {
    type: 'text', inputmode: ganz ? 'numeric' : 'decimal', autocomplete: 'off', enterkeyhint: 'done',
    placeholder: platzhalter, value: fmtEingabe(wert),
    onchange: () => {
      const text = input.value.trim();
      const n = text === '' ? null : parseZahl(text);
      const ungueltig = (text !== '' && n === null) || (n !== null && ((ganz && !Number.isInteger(n)) || (min !== null && n < min) || (max !== null && n > max)));
      input.classList.toggle('falsch', ungueltig);
      if (ungueltig) return;
      input.value = fmtEingabe(n);
      onChange(n);
    },
    onkeydown: (e) => { if (e.key === 'Enter') input.blur(); },
  });
  if (!label) return input;
  return h('label', { class: 'feld' }, h('span', null, label), einheit ? h('div', { class: 'mit-einheit' }, input, h('em', null, einheit)) : input);
}

export function textFeld({ label, wert, onChange, mehrzeilig = false, platzhalter = '' }) {
  const input = h(mehrzeilig ? 'textarea' : 'input', {
    type: mehrzeilig ? null : 'text', placeholder: platzhalter, value: wert || '', rows: mehrzeilig ? 2 : null,
    onchange: () => onChange(input.value.trim()),
  });
  if (!label) return input;
  return h('label', { class: 'feld' }, h('span', null, label), input);
}

export function datumFeld({ label, wert, onChange }) {
  const input = h('input', { type: 'date', value: wert || '', onchange: () => { if (input.value) onChange(input.value); } });
  if (!label) return input;
  return h('label', { class: 'feld' }, h('span', null, label), input);
}

/** Auswahlknöpfe (z. B. 1–5). Erneutes Tippen auf den gewählten Wert löscht ihn. */
export function wahl({ label, werte, wert, onChange, texte = null }) {
  const reihe = h('div', { class: 'wahl', style: `grid-template-columns: repeat(${Math.min(werte.length, 5)}, 1fr)` });
  let aktuell = wert;
  const knoepfe = werte.map((w, i) => h('button', {
    type: 'button', class: w === aktuell ? 'an' : '',
    onclick: () => {
      aktuell = aktuell === w ? null : w;
      knoepfe.forEach((k, j) => k.classList.toggle('an', werte[j] === aktuell));
      onChange(aktuell);
    },
  }, texte ? texte[i] : String(w)));
  reihe.append(...knoepfe);
  return h('div', { class: 'feld' }, h('span', null, label), reihe);
}

let toastZeit = null;
export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('an');
  clearTimeout(toastZeit);
  toastZeit = setTimeout(() => el.classList.remove('an'), 2600);
}

export async function kopiere(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = h('textarea', { style: 'position:fixed;opacity:0' });
    t.value = text;
    document.body.append(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}

/**
 * Liniendiagramm über die Zeit.
 * serien: [{ name, klasse: 'c1'|'c2'|'c3'|'cg'|'ct', punkte: [{ x: 'JJJJ-MM-TT', y }], linie, punkteZeigen, strich, dick, hohl }]
 * hLinien: [{ y, text }] (Ziellinien)
 */
export function diagramm({ serien, hLinien = [], hoehe = 190, yMin = null, yMax = null, stellen = 0, einheit = '' }) {
  const alle = serien.flatMap((se) => se.punkte).filter((p) => p.y !== null && p.y !== undefined);
  if (!alle.length) return h('p', { class: 'leer' }, 'Noch keine Daten');
  const B = 340, L = 36, R = 10, O = 10, U = 22;
  let x0 = alle.reduce((m, p) => (p.x < m ? p.x : m), alle[0].x);
  let x1 = alle.reduce((m, p) => (p.x > m ? p.x : m), alle[0].x);
  if (x0 === x1) { x0 = plusTage(x0, -1); x1 = plusTage(x1, 1); }
  const tage = diffTage(x0, x1);
  const ys = [...alle.map((p) => p.y), ...hLinien.map((l) => l.y)];
  let lo = yMin !== null ? yMin : Math.min(...ys);
  let hi = yMax !== null ? yMax : Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  if (yMin === null) lo -= (hi - lo) * 0.08;
  if (yMax === null) hi += (hi - lo) * 0.08;
  const px = (x) => L + (diffTage(x0, x) / tage) * (B - L - R);
  const py = (y) => O + (1 - (y - lo) / (hi - lo)) * (hoehe - O - U);

  const svg = s('svg', { viewBox: `0 0 ${B} ${hoehe}`, role: 'img' });
  for (let i = 0; i <= 4; i++) {
    const y = lo + ((hi - lo) * i) / 4;
    svg.append(s('line', { class: 'gitter', x1: L, x2: B - R, y1: py(y), y2: py(y) }), s('text', { x: L - 5, y: py(y) + 3, 'text-anchor': 'end' }, fmt(y, stellen)));
  }
  const marken = tage >= 4 ? [x0, plusTage(x0, Math.round(tage / 2)), x1] : [x0, x1];
  marken.forEach((x, i) => svg.append(s('text', { x: px(x), y: hoehe - 6, 'text-anchor': i === 0 ? 'start' : i === marken.length - 1 ? 'end' : 'middle' }, deKurz(x))));
  for (const l of hLinien) {
    svg.append(s('line', { class: 'ziel', x1: L, x2: B - R, y1: py(l.y), y2: py(l.y) }), s('text', { class: 'ziel-t', x: B - R, y: py(l.y) - 4, 'text-anchor': 'end' }, l.text));
  }
  for (const se of serien) {
    const p = se.punkte.filter((q) => q.y !== null && q.y !== undefined).sort((a, b) => (a.x < b.x ? -1 : 1));
    if (!p.length) continue;
    if (se.linie !== false && p.length > 1) {
      svg.append(s('path', { class: se.klasse, d: p.map((q, i) => `${i ? 'L' : 'M'}${px(q.x).toFixed(1)} ${py(q.y).toFixed(1)}`).join(' '), 'stroke-width': se.dick || 2, 'stroke-dasharray': se.strich || null }));
    }
    if (se.punkteZeigen !== false) {
      for (const q of p) {
        svg.append(s('circle', { class: q.aus ? 'cg' : se.klasse, cx: px(q.x), cy: py(q.y), r: se.radius || 3, 'fill-opacity': se.hohl ? 0.35 : 1, 'stroke-width': 0 }));
      }
    }
  }
  const legende = h('div', { class: 'dlegende' },
    serien.filter((se) => se.name).map((se) => h('span', null, h('i', { class: `${se.klasse} ${se.strich ? 'strich' : ''} ${se.linie === false ? 'punkte' : ''}` }), se.name)),
    hLinien.filter((l) => l.name).map((l) => h('span', null, h('i', { class: 'ziel' }), l.name)),
    einheit ? h('span', null, `Angaben in ${einheit}`) : null,
  );
  return h('div', { class: 'diagramm' }, svg, legende);
}
