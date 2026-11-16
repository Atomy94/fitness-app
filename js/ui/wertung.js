// Anzeige der Tages- oder Wochenwertung: groß die Prozentzahl, darunter IMMER die drei Bereiche
// als einzelne Balken, damit ein schwacher Bereich nicht in der Gesamtzahl untergeht.

import { h, punkt } from './dom.js';
import { fmt } from '../core/zahl.js';

/** Farbe zu einer Prozentzahl: grün ab der Grenze für einen guten Tag, gelb ab 50 %, sonst rot. */
export function wertungStatus(prozent, schwelle) {
  if (prozent === null || prozent === undefined) return 'grau';
  return prozent >= schwelle ? 'gruen' : prozent >= 50 ? 'gelb' : 'rot';
}

const BEREICHE = [['ernaehrung', 'E', 'Ernährung'], ['training', 'T', 'Training'], ['schritte', 'S', 'Schritte']];

/**
 * prozent:   Gesamtwertung oder null (nicht gewertet)
 * bereiche:  { ernaehrung, training, schritte } – je eine Zahl, null oder { prozent }
 * status:    optional die Farbstatus der Bereiche für die Punkte (Tagesansicht)
 * unter:     Text unter der großen Zahl (z. B. "vorläufig", "3 gewertete Tage")
 */
export function wertungBlock({ prozent, bereiche, schwelle, vorlaeufig = false, unter = '', status = null, leerText = 'nicht gewertet', href = null }) {
  const gesamt = wertungStatus(prozent, schwelle);
  const zeile = ([name, buchstabe, titel]) => {
    const roh = bereiche[name];
    const wert = roh && typeof roh === 'object' ? roh.prozent : roh;
    const st = wertungStatus(wert, schwelle);
    return h('div', { class: 'wzeile' },
      punkt(status ? status[name] : st, buchstabe),
      h('span', { class: 'wname' }, titel),
      // Mit Status-Punkt daneben bleibt der Balken neutral: Der Punkt zeigt die Farbregel des Bereichs,
      // der Balken den Prozentwert. Zwei verschiedene Ampelfarben in einer Zeile wären verwirrend.
      h('div', { class: `balken ${status ? 'neutral' : `s-${st}`}` }, h('i', { style: `width:${wert === null || wert === undefined ? 0 : Math.round(wert)}%` })),
      h('span', { class: 'wzahl' }, wert === null || wert === undefined ? '–' : `${fmt(wert)} %`),
    );
  };
  const inhalt = [
    h('div', { class: 'wgross' },
      h('div', { class: `wprozent s-${gesamt}` }, prozent === null || prozent === undefined ? '–' : fmt(prozent), prozent === null || prozent === undefined ? null : h('small', null, ' %')),
      h('div', { class: 'klein' }, prozent === null || prozent === undefined ? leerText : vorlaeufig ? 'vorläufig' : unter || (prozent >= schwelle ? 'guter Tag' : '')),
      vorlaeufig && unter ? h('div', { class: 'klein' }, unter) : null,
    ),
    h('div', { class: 'wbalken' }, BEREICHE.map(zeile)),
  ];
  return href ? h('a', { class: 'wertung', href }, inhalt) : h('div', { class: 'wertung' }, inhalt);
}
