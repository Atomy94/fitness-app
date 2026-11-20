// Bildschirm "Schlaf": letzte Nacht mit Phasen, Wochenschnitt, Verläufe (Dauer, Ruhepuls, HRV, Stress), Liste der Nächte.
// Außerdem die kompakte Schlaf-Karte für "Heute". Schlaf wird nur angezeigt, nicht bewertet.

import { S, heuteIso } from '../store.js';
import { h, karte, diagramm } from './dom.js';
import { symbol } from './symbole.js';
import { fmt } from '../core/zahl.js';
import { plusTage, montag, deMitTag, de } from '../core/datum.js';
import { nacht, phasenAnteile, schlafWoche, schlafVerlauf, schlafBedarf, dauerText, minText } from '../core/schlaf.js';

// Vorzeichen; was gerundet 0 ergibt, heißt „gleich“
const vz = (n, stellen = 1) => { const r = Math.round(n * 10 ** stellen) / 10 ** stellen; return r === 0 ? '±0' : (r > 0 ? '+' : '') + fmt(r, stellen, true); };

/** Jüngste Nacht mit Werten, höchstens `tageZurueck` Tage vor `d`. */
function letzteMitWerten(d, tageZurueck = 14) {
  for (let i = 0; i <= tageZurueck; i++) { const n = nacht(S.state, plusTage(d, -i)); if (n) return n; }
  return null;
}

/** Waagerechter Balken der Schlafphasen mit Legende. */
function phasenBalken(n) {
  const anteile = phasenAnteile(n);
  if (!anteile.length) return null;
  return h('div', { class: 'phasen-wrap' },
    h('div', { class: 'phasen', role: 'img', 'aria-label': anteile.map((p) => `${p.name} ${minText(p.min)}`).join(', ') },
      anteile.map((p) => h('span', { class: p.klasse, style: `width:${p.pct.toFixed(1)}%` }))),
    h('div', { class: 'phasen-legende' }, anteile.map((p) => h('span', null, h('i', { class: p.klasse }), `${p.name} ${minText(p.min)}`))),
  );
}

const zeiten = (n) => (n.einschlafen || n.aufwachen ? `${n.einschlafen || '?'} – ${n.aufwachen || '?'} Uhr` : '');

function nachtKopf(n) {
  const extra = [n.ruhepuls !== null ? `Ruhepuls ${fmt(n.ruhepuls)}` : null, n.hrv !== null ? `HRV ${fmt(n.hrv)} ms` : null].filter(Boolean).join(' · ');
  return [
    h('div', { class: 'zeile' },
      h('span', { class: 'kachel k-schlaf gross' }, symbol('ruhe')),
      h('div', { class: 'wachs' },
        h('div', { class: 'schlaf-zahl' }, dauerText(n.stunden)),
        zeiten(n) ? h('div', { class: 'klein' }, zeiten(n)) : null,
        extra ? h('div', { class: 'klein' }, extra) : null),
    ),
    phasenBalken(n),
  ];
}

/** Diagramm der Schlafdauer: Nächte als Punkte, 7-Tage-Schnitt als Linie, Schlafbedarf als Bezugslinie. */
function dauerDiagramm(bis, anzahl, hoehe) {
  const v = schlafVerlauf(S.state, bis, anzahl);
  const bedarf = schlafBedarf(S.state, bis);
  return diagramm({ hoehe, stellen: 1, einheit: 'Std.', hLinien: bedarf ? [{ y: bedarf, text: `Bedarf ${fmt(bedarf, 1)}` }] : [], serien: [
    { name: 'Nächte', klasse: 'cg', punkte: v.punkte.map((p) => ({ x: p.datum, y: p.stunden })), linie: false, radius: 3 },
    { name: '7-Tage-Schnitt', klasse: 'c1', punkte: v.schnitt7.map((p) => ({ x: p.datum, y: p.wert })), punkteZeigen: false, dick: 3 },
  ] });
}

/** Kompakte Karte auf "Heute": letzte Nacht und die letzten 7 Nächte. */
export function schlafKarte(d) {
  const n = nacht(S.state, d);
  const link = h('a', { class: 'knopf schmal breit abstand', href: '#schlaf' }, 'Alles zum Schlaf ›');
  if (!n) {
    return karte('Schlaf letzte Nacht',
      h('p', { class: 'klein' }, 'Noch keine Werte für letzte Nacht. Sie kommen über den Kurzbefehl aus Apple Health (später vom Xiaomi Band über Mi Fitness).'),
      link);
  }
  const hatWoche = schlafVerlauf(S.state, d, 7).punkte.filter((p) => p.stunden !== null).length > 1;
  return karte('Schlaf letzte Nacht', nachtKopf(n), hatWoche ? h('div', { class: 'abstand' }, dauerDiagramm(d, 7, 130)) : null, link);
}

function wocheKarte(d) {
  const { diese, vorher } = schlafWoche(S.state, montag(d), d);
  const zeile = (name, wert, vergleich) => h('li', null, h('span', { class: 'wachs' }, name, vergleich ? h('div', { class: 'klein' }, vergleich) : null), h('span', { class: 'fett' }, wert));
  const diff = (a, b, stellen, einheit) => (a !== null && b !== null ? `${vz(a - b, stellen)} ${einheit} zur Vorwoche` : 'noch kein Vergleich');
  const zeilen = [
    zeile('Schlaf Ø', diese.stunden === null ? '–' : dauerText(diese.stunden), diese.stunden === null ? `${diese.naechte} Nächte mit Werten` : `${diese.naechte} ${diese.naechte === 1 ? 'Nacht' : 'Nächte'} · ${diese.stunden !== null && vorher.stunden !== null ? `${vz((diese.stunden - vorher.stunden) * 60, 0)} Min. zur Vorwoche` : 'noch kein Vergleich'}`),
    diese.ruhepuls !== null ? zeile('Ruhepuls Ø', fmt(diese.ruhepuls), diff(diese.ruhepuls, vorher.ruhepuls, 0, 'Schläge')) : null,
    diese.hrv !== null ? zeile('HRV Ø', `${fmt(diese.hrv)} ms`, diff(diese.hrv, vorher.hrv, 0, 'ms')) : null,
    zeile('Stress Ø (selbst eingetragen)', diese.stress === null ? '–' : `${fmt(diese.stress, 1)} / 10`, diff(diese.stress, vorher.stress, 1, '')),
  ];
  return karte('Diese Woche', h('ul', { class: 'liste' }, zeilen));
}

function erholungKarten(d) {
  const v = schlafVerlauf(S.state, d, 30).punkte;
  const karten = [];
  if (v.some((p) => p.ruhepuls !== null)) {
    karten.push(karte('Ruhepuls · 30 Tage', diagramm({ einheit: 'Schläge/Min.', serien: [{ name: 'Ruhepuls', klasse: 'c2', radius: 3, punkte: v.map((p) => ({ x: p.datum, y: p.ruhepuls })) }] }),
      h('p', { class: 'klein abstand' }, 'Ein über Tage erhöhter Ruhepuls kann auf zu wenig Erholung, Stress oder einen beginnenden Infekt hindeuten.')));
  }
  if (v.some((p) => p.hrv !== null)) {
    karten.push(karte('HRV · 30 Tage', diagramm({ einheit: 'ms', serien: [{ name: 'HRV', klasse: 'c3', radius: 3, punkte: v.map((p) => ({ x: p.datum, y: p.hrv })) }] }),
      h('p', { class: 'klein abstand' }, 'Herzfrequenzvariabilität: höher heißt meist erholter. Aussagekräftig ist nur dein eigener Verlauf, nicht der Vergleich mit anderen.')));
  }
  if (v.some((p) => p.stress !== null || p.qualitaet !== null)) {
    const serien = [{ name: 'Stress (1–10)', klasse: 'c2', radius: 3, punkte: v.map((p) => ({ x: p.datum, y: p.stress })) }];
    if (v.some((p) => p.qualitaet !== null)) serien.push({ name: 'Schlafqualität (1–5, früher eingetragen)', klasse: 'c1', radius: 3, form: 'quadrat', punkte: v.map((p) => ({ x: p.datum, y: p.qualitaet })) });
    karten.push(karte('Stress · 30 Tage', diagramm({ yMin: 1, yMax: 10, serien })));
  }
  return karten;
}

function naechteListe(d) {
  const zeilen = [];
  for (let i = 0; i < 30 && zeilen.length < 14; i++) {
    const tag = plusTage(d, -i);
    const n = nacht(S.state, tag);
    if (!n) continue;
    const tief = n.phasen.find((p) => p.feld === 'schlaf_tief_min');
    const rem = n.phasen.find((p) => p.feld === 'schlaf_rem_min');
    const info = [zeiten(n), tief ? `Tief ${minText(tief.min)}` : null, rem ? `REM ${minText(rem.min)}` : null, n.ruhepuls !== null ? `Puls ${fmt(n.ruhepuls)}` : null].filter(Boolean).join(' · ');
    zeilen.push(h('a', { href: `#tag/${tag}` },
      h('span', { class: 'wachs' }, h('b', null, deMitTag(tag)), info ? h('div', { class: 'klein' }, info) : null),
      h('span', { class: 'fett' }, dauerText(n.stunden)), h('span', { class: 'pfeil' }, '›')));
  }
  return karte('Nächte', zeilen.length ? h('div', { class: 'liste' }, zeilen) : h('p', { class: 'leer' }, 'Noch keine Nächte eingetragen.'));
}

export function schlafScreen() {
  const d = heuteIso();
  const n = letzteMitWerten(d);
  const hatVerlauf = schlafVerlauf(S.state, d, 30).punkte.some((p) => p.stunden !== null);
  const knoten = h('div', null,
    n ? karte(n.datum === d ? 'Letzte Nacht' : `Zuletzt: Nacht zum ${de(n.datum)}`, nachtKopf(n),
      n.phasen.length ? null : h('p', { class: 'klein abstand' }, 'Schlafphasen erscheinen, sobald das Band sie über Mi Fitness an Apple Health gibt.'))
      : karte('Letzte Nacht', h('p', { class: 'leer' }, 'Noch keine Schlafwerte')),
    wocheKarte(d),
    hatVerlauf ? karte('Schlafdauer · 30 Tage', dauerDiagramm(d, 30, 190), h('p', { class: 'klein abstand' }, 'Einzelne Nächte schwanken. Aussagekräftig ist die Linie des Schnitts.')) : null,
    erholungKarten(d),
    naechteListe(d),
    karte('So kommen die Werte in die App',
      h('p', { class: 'klein' }, 'Xiaomi Band → Mi Fitness → Apple Health → dein Kurzbefehl → Dropbox → App. Gezählt wird die Nacht, die am Morgen des Tages endet.'),
      h('p', { class: 'klein abstand' }, 'Schlaf, Ruhepuls und HRV werden nur angezeigt, nicht bewertet. Den Schlafbedarf stellst du unter Mehr → Einstellungen → Schlaf ein.')),
  );
  return { titel: 'Schlaf', knoten };
}
