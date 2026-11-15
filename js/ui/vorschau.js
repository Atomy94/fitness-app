// Vorschau eines Claude-Imports (alter Wert → neuer Wert) mit "Übernehmen".
// Wird vom Einfüge-Import (Mehr → Von Claude importieren) und vom Dropbox-Eingang benutzt.

import { h } from './dom.js';
import { verarbeite, FELD_NAMEN } from '../core/import.js';
import { fmt } from '../core/zahl.js';

const ART_TEXT = { neu: 'neu', aenderung: 'wird geändert', ersetzt: 'wird ersetzt', gleich: 'unverändert', uebersprungen: 'wird übersprungen' };
const ART_STATUS = { neu: 'gruen', aenderung: 'gelb', ersetzt: 'gelb', gleich: 'grau', uebersprungen: 'grau' };
const wertText = (v) => (v === null || v === undefined ? '–' : v === true ? 'ja' : v === false ? 'nein' : typeof v === 'number' ? fmt(v, 2) : String(v));

/**
 * ergebnis: Rückgabe von leseImport(). ersetzen: { [index]: false } für abgewählte Trainings.
 * onWahl(): neu zeichnen · onUebernehmen(neuerStand, anzahl) · onAbbrechen()
 */
export function vorschauKarte({ ergebnis: r, ersetzen, state, titel = '', abbrechenText = 'Abbrechen', onWahl, onUebernehmen, onAbbrechen }) {
  if (!r.ok) {
    return h('section', { class: 'karte' }, h('h2', null, `${titel ? titel + ': ' : ''}abgelehnt – nichts wurde gespeichert`),
      h('ul', { style: 'margin:0;padding-left:20px' }, r.fehler.map((t) => h('li', { style: 'margin-bottom:6px' }, t))),
      h('button', { type: 'button', class: 'knopf breit abstand', onclick: onAbbrechen }, abbrechenText));
  }
  const { state: neuerStand, posten } = verarbeite(state, r.eintraege, { ersetzen });
  const wirksam = posten.filter((p) => p.art !== 'gleich' && p.art !== 'uebersprungen').length;
  return h('section', { class: 'karte' }, h('h2', null, `${titel ? titel + ' · ' : 'Vorschau: '}${posten.length} ${posten.length === 1 ? 'Eintrag' : 'Einträge'}, ${wirksam} mit Änderungen`),
    posten.map((p) => h('div', { class: 'vorschau-posten' },
      h('div', { class: 'zeile' }, h('b', { class: 'wachs' }, p.titel), h('span', { class: `marke s-${ART_STATUS[p.art]}` }, ART_TEXT[p.art])),
      p.felder.map((x) => h('div', { class: 'diff' }, `${FELD_NAMEN[x.feld] || x.feld}: `, x.alt === null || x.alt === undefined ? null : [h('s', null, wertText(x.alt)), ' → '], h('b', null, wertText(x.neu)))),
      p.rueckfrage ? (() => {
        const haken = h('input', { type: 'checkbox', style: 'width:24px;height:24px', onchange: () => { ersetzen[p.index] = haken.checked; onWahl(); } });
        haken.checked = ersetzen[p.index] !== false;
        return h('label', { class: 'zeile', style: 'min-height:44px;margin-top:4px' }, haken, h('span', { class: 'wachs' }, 'Vorhandene Einheit ersetzen'));
      })() : null,
    )),
    r.hinweise.length ? h('div', { class: 'hinweis ruhig abstand' }, h('b', null, 'Hinweise'), r.hinweise.map((t) => h('small', null, t))) : null,
    h('div', { class: 'knopfreihe abstand' },
      h('button', { type: 'button', class: 'knopf', onclick: onAbbrechen }, abbrechenText),
      h('button', { type: 'button', class: 'knopf haupt', disabled: wirksam === 0, onclick: () => onUebernehmen(neuerStand, wirksam) }, 'Übernehmen'),
    ),
  );
}
