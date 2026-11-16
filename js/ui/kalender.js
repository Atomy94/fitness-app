// Bildschirm "Kalender": Monatsansicht mit den drei getrennten Bereichen, Wochenwertung, Verlauf.

import { S, heuteIso, neu } from '../store.js';
import { h, karte, punkt, marke, diagramm, STATUS_ZEICHEN } from './dom.js';
import { tagBewertung, wochenWertung } from '../core/bewertung.js';
import { tagWertung, wochenProzent, wochenVerlauf, streak } from '../core/wertung.js';
import { symbol } from './symbole.js';
import { wertungBlock, wertungStatus } from './wertung.js';
import { fmt } from '../core/zahl.js';
import { MONATE, WT_KURZ, monatsRaster, montag, plusTage, deKurz, kw } from '../core/datum.js';

const BEREICHE = [['alle', 'Alle'], ['ernaehrung', 'Ernährung'], ['training', 'Training'], ['schritte', 'Schritte']];
const sicht = { jahr: null, monat: null, filter: 'alle' };
let jokerTage = new Set(); // Tage, an denen der Wochen-Joker den Streak gerettet hat

function tagZelle(datum, imMonat, heuteD) {
  const b = tagBewertung(S.state, datum, heuteD);
  const w = tagWertung(S.state, datum, heuteD);
  const nr = Number(datum.slice(8));
  const klassen = ['tagz', imMonat ? '' : 'fremd', datum === heuteD ? 'heute' : ''];
  const jokerMarke = jokerTage.has(datum) ? h('span', { class: 'tjoker', title: 'Joker-Tag' }, symbol('joker')) : null;
  if (sicht.filter === 'alle') {
    return h('a', { class: klassen.join(' '), href: `#tag/${datum}` },
      h('span', { class: 'nr' }, nr),
      w.gewertet ? h('span', { class: `tpct wert-s s-${wertungStatus(w.prozent, w.schwelle)}` }, `${fmt(w.prozent)}${w.vorlaeufig ? '*' : ''}`) : h('span', { class: 'tpct' }, ''),
      h('span', { class: 'dreier' }, punkt(b.ernaehrung, 'E'), punkt(b.training, 'T', b.zusatz), punkt(b.schritte, 'S')),
      jokerMarke,
    );
  }
  const status = b[sicht.filter];
  const stern = sicht.filter === 'training' && b.zusatz;
  return h('a', { class: [...klassen, 'voll', `s-${status}`].join(' '), href: `#tag/${datum}` },
    h('span', { class: 'nr' }, nr),
    h('span', { class: 'zeichen' }, stern ? '★' : STATUS_ZEICHEN[status]),
    jokerMarke,
  );
}

function wochenTabelle(wochen, heuteD) {
  const zeilen = wochen.map((w) => {
    const leer = !w.hatDaten;
    return h('tr', null,
      h('td', null, h('b', null, `KW ${kw(w.montag)}`), h('div', { class: 'klein' }, `${deKurz(w.montag)}–${deKurz(plusTage(w.montag, 6))}`),
        (() => { const p = wochenProzent(S.state, w.montag, heuteD); return p.prozent === null ? null : h('div', { class: `wert-s s-${wertungStatus(p.prozent, p.schwelle)}` }, `${fmt(p.prozent)} %${p.vorlaeufig ? ' vorläufig' : ''}`); })()),
      h('td', { class: 'r' }, leer ? '–' : `${w.ernaehrung.x}/7`),
      h('td', { class: 'r' }, leer ? '–' : `${w.training.x}/${w.training.von}`),
      h('td', { class: 'r' }, leer ? '–' : `${w.schritte.x}/7`, h('div', { class: 'klein' }, w.schritteSchnitt === null ? '' : `Ø ${fmt(w.schritteSchnitt)}`)),
      h('td', { class: 'r' }, w.kcalSchnitt === null ? '–' : h('span', { class: `wert-s s-${w.kcalSchnittStatus}` }, fmt(w.kcalSchnitt))),
    );
  });
  return h('table', { class: 'tabelle' },
    h('thead', null, h('tr', null, h('th', null, 'Woche'), h('th', { class: 'r' }, 'Ernähr.'), h('th', { class: 'r' }, 'Training'), h('th', { class: 'r' }, 'Schritte'), h('th', { class: 'r' }, 'kcal Ø'))),
    h('tbody', null, zeilen),
  );
}

function verlauf(heuteD) {
  const wochen = wochenVerlauf(S.state, heuteD);
  const punkte = (feld) => wochen.map((w) => ({ x: w.montag, y: w[feld], vorlaeufig: w.vorlaeufig }));
  const laufend = wochen.find((w) => w.vorlaeufig);
  return diagramm({
    yMin: 0, yMax: 100, hoehe: 210,
    xMarken: wochen.map((w) => ({ x: w.montag, text: `KW ${kw(w.montag)}` })),
    einheit: '%: Wochenwertung gesamt; je Bereich der Anteil grüner Tage',
    hinweis: laufend ? `Gestrichelt und hohl: laufende Woche, vorläufig (bisher ${laufend.tage} ${laufend.tage === 1 ? 'Tag' : 'Tage'}).` : '',
    serien: [
      { name: 'Ernährung', klasse: 'c1', form: 'kreis', dick: 1.5, punkte: punkte('ernaehrung') },
      { name: 'Training', klasse: 'c2', form: 'quadrat', dick: 1.5, punkte: punkte('training') },
      { name: 'Schritte', klasse: 'c3', form: 'raute', dick: 1.5, punkte: punkte('schritte') },
      // zuletzt gezeichnet, damit sie obenauf liegt: die Wochenwertung als deutlich stärkere Linie
      { name: 'Wochenwertung gesamt', klasse: 'ch', form: 'kreis', dick: 4, radius: 5, punkte: punkte('gesamt') },
    ],
  });
}

export function kalenderScreen() {
  const heuteD = heuteIso();
  if (!sicht.jahr) { sicht.jahr = Number(heuteD.slice(0, 4)); sicht.monat = Number(heuteD.slice(5, 7)); }
  const blaettern = (n) => {
    let m = sicht.monat + n, j = sicht.jahr;
    if (m < 1) { m = 12; j--; } else if (m > 12) { m = 1; j++; }
    sicht.monat = m; sicht.jahr = j; neu();
  };
  const serie = streak(S.state, heuteD);
  jokerTage = new Set(serie.joker);
  const raster = monatsRaster(sicht.jahr, sicht.monat);
  const praefix = `${sicht.jahr}-${String(sicht.monat).padStart(2, '0')}`;
  const wochen = raster.map((w) => wochenWertung(S.state, w[0], heuteD));
  const diese = wochenWertung(S.state, montag(heuteD), heuteD);
  const dieseProzent = wochenProzent(S.state, montag(heuteD), heuteD);

  const knoten = h('div', null,
    h('div', { class: 'filter' }, BEREICHE.map(([k, name]) => h('button', { type: 'button', class: sicht.filter === k ? 'an' : '', onclick: () => { sicht.filter = k; neu(); } }, name))),
    h('section', { class: 'karte' },
      h('div', { class: 'zeile', style: 'margin-bottom:8px' },
        h('button', { type: 'button', class: 'knopf schmal', 'aria-label': 'Vorheriger Monat', onclick: () => blaettern(-1) }, '‹'),
        h('b', { class: 'wachs', style: 'text-align:center' }, `${MONATE[sicht.monat - 1]} ${sicht.jahr}`),
        h('button', { type: 'button', class: 'knopf schmal', 'aria-label': 'Nächster Monat', onclick: () => blaettern(1) }, '›'),
      ),
      h('div', { class: 'monat' },
        WT_KURZ.map((w) => h('div', { class: 'wt' }, w)),
        raster.flat().map((d) => tagZelle(d, d.startsWith(praefix), heuteD)),
      ),
      h('div', { class: 'legende' },
        h('span', null, punkt('gruen', '✓'), 'geschafft'), h('span', null, punkt('gelb', '≈'), 'knapp'), h('span', null, punkt('rot', '✕'), 'verfehlt'),
        h('span', null, punkt('grau', '–'), 'trifft nicht zu'), h('span', null, punkt('leer', ''), 'keine Daten'), h('span', null, '★ Zusatztraining'), h('span', null, h('span', { class: 'tjoker fest' }, symbol('joker')), 'Joker-Tag'),
        sicht.filter === 'alle' ? h('span', null, 'E = Ernährung · T = Training · S = Schritte · Zahl = Tageswertung in % (* = vorläufig)') : null,
      ),
    ),
    karte('Diese Woche',
      h('p', { class: 'klein', style: 'margin-bottom:10px' }, h('b', null, `Streak: ${serie.aktuell} ${serie.aktuell === 1 ? 'guter Tag' : 'gute Tage'} in Folge`), ` · längster ${serie.laengster} · Joker ${serie.jokerFrei ? 'noch frei' : 'verbraucht'}`),
      wertungBlock({ prozent: dieseProzent.prozent, bereiche: dieseProzent.bereiche, schwelle: dieseProzent.schwelle, vorlaeufig: dieseProzent.vorlaeufig, unter: `${dieseProzent.anzahl} ${dieseProzent.anzahl === 1 ? 'gewerteter Tag' : 'gewertete Tage'}`, leerText: 'noch kein gewerteter Tag' }),
      h('ul', { class: 'liste abstand' },
        h('li', null, punkt('grau', 'E'), h('span', { class: 'wachs' }, 'Ernährung'), h('b', null, `${diese.ernaehrung.x} von 7 Tagen`)),
        h('li', null, punkt('grau', 'T'), h('span', { class: 'wachs' }, 'Training'), h('b', null, `${diese.training.x} von ${diese.training.von} Plantagen`)),
        h('li', null, punkt('grau', 'S'), h('span', { class: 'wachs' }, 'Schritte', h('div', { class: 'klein' }, `Wochenschnitt ${fmt(diese.schritteSchnitt)}`)), h('b', null, `${diese.schritte.x} von 7 Tagen`)),
        h('li', null, h('span', { class: 'wachs' }, 'Kalorien-Wochenschnitt'), h('b', null, diese.kcalSchnitt === null ? '–' : `${fmt(diese.kcalSchnitt)} kcal`), diese.kcalSchnitt === null ? null : marke(diese.kcalSchnittStatus)),
      ),
    ),
    karte(`Wochenwertung ${MONATE[sicht.monat - 1]}`, wochenTabelle(wochen, heuteD)),
    karte('Verlauf der Wochenwertungen', verlauf(heuteD)),
  );
  return { titel: 'Kalender', knoten };
}
