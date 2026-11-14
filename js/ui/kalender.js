// Bildschirm "Kalender": Monatsansicht mit den drei getrennten Bereichen, Wochenwertung, Verlauf.

import { S, heuteIso, neu } from '../store.js';
import { h, karte, punkt, marke, diagramm, STATUS_ZEICHEN } from './dom.js';
import { tagBewertung, wochenWertung } from '../core/bewertung.js';
import { fmt } from '../core/zahl.js';
import { MONATE, WT_KURZ, monatsRaster, montag, plusTage, deKurz, kw } from '../core/datum.js';

const BEREICHE = [['alle', 'Alle'], ['ernaehrung', 'Ernährung'], ['training', 'Training'], ['schritte', 'Schritte']];
const sicht = { jahr: null, monat: null, filter: 'alle' };

function tagZelle(datum, imMonat, heuteD) {
  const b = tagBewertung(S.state, datum, heuteD);
  const nr = Number(datum.slice(8));
  const klassen = ['tagz', imMonat ? '' : 'fremd', datum === heuteD ? 'heute' : ''];
  if (sicht.filter === 'alle') {
    return h('a', { class: klassen.join(' '), href: `#tag/${datum}` },
      h('span', { class: 'nr' }, nr),
      h('span', { class: 'dreier' }, punkt(b.ernaehrung, 'E'), punkt(b.training, 'T', b.zusatz), punkt(b.schritte, 'S')),
    );
  }
  const status = b[sicht.filter];
  const stern = sicht.filter === 'training' && b.zusatz;
  return h('a', { class: [...klassen, 'voll', `s-${status}`].join(' '), href: `#tag/${datum}` },
    h('span', { class: 'nr' }, nr),
    h('span', { class: 'zeichen' }, stern ? '★' : STATUS_ZEICHEN[status]),
  );
}

function wochenTabelle(wochen, heuteD) {
  const zeilen = wochen.map((w) => {
    const leer = !w.hatDaten;
    return h('tr', null,
      h('td', null, h('b', null, `KW ${kw(w.montag)}`), h('div', { class: 'klein' }, `${deKurz(w.montag)}–${deKurz(plusTage(w.montag, 6))}`)),
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
  const start = S.state.einstellungen.start || heuteD;
  const serien = { ernaehrung: [], training: [], schritte: [] };
  for (let mo = montag(start); mo <= heuteD; mo = plusTage(mo, 7)) {
    const w = wochenWertung(S.state, mo, heuteD);
    if (!w.hatDaten) continue;
    serien.ernaehrung.push({ x: mo, y: (w.ernaehrung.x / 7) * 100 });
    serien.training.push({ x: mo, y: w.training.von ? (w.training.x / w.training.von) * 100 : null });
    serien.schritte.push({ x: mo, y: (w.schritte.x / 7) * 100 });
  }
  return diagramm({
    yMin: 0, yMax: 100, einheit: '% der Tage im grünen Bereich (je Woche)',
    serien: [
      { name: 'Ernährung', klasse: 'c1', punkte: serien.ernaehrung },
      { name: 'Training', klasse: 'c2', punkte: serien.training, strich: '7 4' },
      { name: 'Schritte', klasse: 'c3', punkte: serien.schritte, strich: '2 4' },
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
  const raster = monatsRaster(sicht.jahr, sicht.monat);
  const praefix = `${sicht.jahr}-${String(sicht.monat).padStart(2, '0')}`;
  const wochen = raster.map((w) => wochenWertung(S.state, w[0], heuteD));
  const diese = wochenWertung(S.state, montag(heuteD), heuteD);

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
        h('span', null, punkt('grau', '–'), 'trifft nicht zu'), h('span', null, punkt('leer', ''), 'keine Daten'), h('span', null, '★ Zusatztraining'),
        sicht.filter === 'alle' ? h('span', null, 'E = Ernährung · T = Training · S = Schritte') : null,
      ),
    ),
    karte('Diese Woche',
      h('ul', { class: 'liste' },
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
