// Tagesformular (Schnelleingabe auf "Heute", vollständig in der Tagesansicht) und Tagesdetail.

import { S, speichern, heuteIso } from '../store.js';
import { h, karte, zahlFeld, textFeld, wahl, punkt, marke, STATUS_TEXT } from './dom.js';
import { tagBewertung } from '../core/bewertung.js';
import { tagWertung, streak } from '../core/wertung.js';
import { wertungBlock } from './wertung.js';
import { tagVon, neueId } from '../core/state.js';
import { fmt } from '../core/zahl.js';
import { deMitTag, plusTage, WT_LANG, wochentag, istDatum } from '../core/datum.js';

function setzeFeld(datum, feld, wert) {
  const tag = tagVon(S.state, datum, true);
  if (wert === null || wert === undefined || wert === '') delete tag[feld];
  else tag[feld] = wert;
  speichern('tage');
}

function bauchAm(datum) {
  return S.state.messungen.find((m) => m.datum === datum && (m.quelle || '') === 'Maßband') || null;
}

function setzeBauch(datum, wert) {
  let m = bauchAm(datum);
  if (wert === null) {
    if (m) { delete m.bauch_cm; if (Object.keys(m).length <= 3) S.state.messungen = S.state.messungen.filter((x) => x !== m); }
  } else {
    if (!m) { m = { id: neueId(), datum, quelle: 'Maßband' }; S.state.messungen.push(m); }
    m.bauch_cm = wert;
  }
  speichern('messungen');
}

/**
 * Eingabefelder für einen Tag. voll = auch Ernährungswerte (zum Nachtragen).
 * Jede Änderung wird sofort gespeichert; onChange aktualisiert die Anzeige darüber.
 */
export function tagFormular(datum, { voll = false, onChange = () => {} } = {}) {
  const tag = S.state.tage[datum] || {};
  const b = tagBewertung(S.state, datum, heuteIso());
  const feld = (name) => (wert) => { setzeFeld(datum, name, wert); onChange(); };
  const z = (label, name, einheit, extra = {}) => zahlFeld({ label, wert: tag[name], einheit, onChange: feld(name), ...extra });
  const istFussballtag = b.plan && b.plan.typ === 'fussball';

  const teile = [];
  if (voll) {
    teile.push(karte('Ernährung (aus Yazio)',
      h('div', { class: 'raster2' },
        z('Kalorien', 'kcal', 'kcal', { min: 0, max: 15000 }),
        z('Eiweiß', 'eiweiss_g', 'g', { min: 0, max: 1000 }),
        z('Kohlenhydrate', 'kh_g', 'g', { min: 0, max: 2000 }),
        z('Fett', 'fett_g', 'g', { min: 0, max: 1000 }),
        z('Ballaststoffe', 'ballaststoffe_g', 'g', { min: 0, max: 500 }),
        z('Gesättigte Fette', 'ges_fett_g', 'g', { min: 0, max: 500 }),
        z('Salz', 'salz_g', 'g', { min: 0, max: 100 }),
        z('Zucker', 'zucker_g', 'g', { min: 0, max: 1000 }),
      ),
      tag.ungenau ? h('button', { type: 'button', class: 'knopf schmal', onclick: () => { setzeFeld(datum, 'ungenau', null); onChange(true); } }, 'Markierung „Werte ungenau“ entfernen') : null,
    ));
  }
  teile.push(karte(voll ? 'Tageswerte' : 'Schnelleingabe',
    h('div', { class: 'raster2' },
      z('Gewicht', 'gewicht_kg', 'kg', { min: 20, max: 400, stellen: 1 }),
      z('Schritte', 'schritte', null, { ganz: true, min: 0, max: 200000 }),
      z('Schlaf', 'schlaf_h', 'Std.', { min: 0, max: 24 }),
      voll ? zahlFeld({ label: 'Bauchumfang', wert: bauchAm(datum) ? bauchAm(datum).bauch_cm : null, einheit: 'cm', min: 30, max: 250, onChange: (w) => { setzeBauch(datum, w); onChange(); } }) : null,
    ),
    wahl({ label: 'Schlafqualität (1 = schlecht, 5 = sehr gut)', werte: [1, 2, 3, 4, 5], wert: tag.schlaf_qualitaet, onChange: feld('schlaf_qualitaet') }),
    wahl({ label: 'Stress (1 = entspannt, 10 = sehr hoch)', werte: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], wert: tag.stress, onChange: feld('stress') }),
    wahl({ label: 'Kreatin genommen', werte: [true, false], texte: ['Ja', 'Nein'], wert: tag.kreatin, onChange: feld('kreatin') }),
    istFussballtag ? wahl({ label: 'Fußball hat stattgefunden', werte: [true, false], texte: ['Ja', 'Nein, ausgefallen'], wert: tag.fussball, onChange: feld('fussball') }) : null,
    textFeld({ label: 'Notiz', wert: tag.notiz, mehrzeilig: true, onChange: feld('notiz') }),
  ));
  return h('div', null, teile);
}

const wertZeile = (name, wert, status, zusatz) => h('li', null,
  h('span', { class: 'wachs' }, name, zusatz ? h('div', { class: 'klein' }, zusatz) : null),
  h('span', { class: status ? `wert-s s-${status}` : 'fett' }, wert),
);

export function einheitText(t) {
  if (t.typ === 'kraft') return `${t.einheit}${t.ersetzt ? ' (durch Bewegung ersetzt)' : t.verkuerzt ? ' (verkürzt)' : ''}${t.dauer_min ? ` · ${t.dauer_min} Min.` : ''}`;
  return `${t.art}${t.dauer_min ? ` · ${t.dauer_min} Min.` : ''}${t.km ? ` · ${fmt(t.km, 2)} km` : ''}`;
}

/** Die drei Bereiche eines Tages mit allen Einzelwerten. */
export function bereicheDetail(datum) {
  const b = tagBewertung(S.state, datum, heuteIso());
  const t = b.tag;
  const k = b.ziele.kcal;
  const kopf = (buchstabe, name, status, stern) => h('h2', null, h('span', { class: 'zeile' }, punkt(status, buchstabe, stern), h('span', { class: 'wachs' }, name), marke(status)));
  const g = (v, einheit, stellen = 0) => (v === null || v === undefined ? '–' : `${fmt(v, stellen)} ${einheit}`);

  const ernaehrung = h('section', { class: 'karte' }, kopf('E', 'Ernährung', b.ernaehrung),
    h('ul', { class: 'liste' },
      wertZeile('Kalorien', g(t.kcal, 'kcal'), b.kcal, `grün ${fmt(k.min)}–${fmt(k.max)} · Ziel ${fmt(k.ziel)}${k.art === 'fussball' ? ' (Fußballtag)' : k.art === 'minimal' ? ' (Minimalversion)' : ''}`),
      wertZeile('Eiweiß', g(t.eiweiss_g, 'g'), b.eiweiss, `grün ab ${fmt(b.ziele.eiweiss.min)} g · Ziel ${fmt(b.ziele.eiweiss.ziel)} g${t.ungenau ? ' · Werte ungenau (eher 5–15 g mehr)' : ''}`),
      wertZeile('Ballaststoffe', g(t.ballaststoffe_g, 'g', 1), b.ballaststoffe, `grün ab ${fmt(b.ziele.ballaststoffe.min)} g · ohne Einfluss auf den Bereich`),
      wertZeile('Gesättigte Fette', g(t.ges_fett_g, 'g', 1), b.gesFett, `grün bis ${fmt(b.ziele.gesFett.max)} g · ohne Einfluss auf den Bereich`),
      wertZeile('Kreatin', t.kreatin === true ? 'ja' : t.kreatin === false ? 'nein' : '–', b.kreatin, 'ohne Einfluss auf den Bereich'),
      wertZeile('Kohlenhydrate / Fett', `${g(t.kh_g, 'g')} / ${g(t.fett_g, 'g')}`),
      t.salz_g !== undefined || t.zucker_g !== undefined ? wertZeile('Salz / Zucker', `${g(t.salz_g, 'g', 1)} / ${g(t.zucker_g, 'g', 1)}`) : null,
    ),
  );

  const planText = b.plan ? b.plan.text || b.plan.einheit || '' : 'Kein Trainingsziel';
  const training = h('section', { class: 'karte' }, kopf('T', 'Training', b.training, b.zusatz),
    h('p', { class: 'klein' }, `Plan: ${planText}${b.minimal && b.plan && b.plan.typ === 'laufband' ? ' (Minimalversion: ohne Wertung)' : ''}`),
    b.einheiten.length
      ? h('div', { class: 'liste abstand' }, b.einheiten.map((e) => h('a', { href: `#training/einheit/${e.id}` }, h('span', { class: 'wachs' }, einheitText(e)), b.zusatz ? h('span', { class: 'klein' }, '★ Zusatz') : null, h('span', { class: 'pfeil' }, '›'))))
      : h('p', { class: 'klein abstand' }, 'Keine Einheit eingetragen.'),
    h('div', { class: 'knopfreihe abstand' },
      h('a', { class: 'knopf schmal', href: `#training/cardio/Laufband/${datum}` }, '+ Cardio'),
      h('a', { class: 'knopf schmal', href: `#training/nachtrag/${datum}` }, '+ Kraft'),
    ),
  );

  const sz = b.ziele.schritte;
  const schritte = h('section', { class: 'karte' }, kopf('S', 'Schritte', b.schritte),
    h('ul', { class: 'liste' }, wertZeile('Schritte', fmt(t.schritte), b.schritte, `Ziel ${fmt(sz.ziel)}${b.minimal ? ' (Minimalversion)' : ''} · gelb ab ${fmt((sz.ziel * sz.gelbPct) / 100)}`)),
  );

  const sonstiges = h('section', { class: 'karte' }, h('h2', null, 'Ohne Wertung'),
    h('ul', { class: 'liste' },
      wertZeile('Gewicht', g(t.gewicht_kg, 'kg', 1)),
      wertZeile('Schlaf', t.schlaf_h === undefined ? '–' : `${fmt(t.schlaf_h, 1)} Std.${t.schlaf_qualitaet ? ` · Qualität ${t.schlaf_qualitaet}/5` : ''}`),
      wertZeile('Stress', t.stress === undefined ? '–' : `${t.stress}/10`),
      t.notiz ? h('li', null, h('span', { class: 'wachs' }, t.notiz)) : null,
    ),
  );
  return [ernaehrung, training, schritte, sonstiges];
}

export function tagScreen([datum]) {
  if (!istDatum(datum)) datum = heuteIso();
  const oben = h('div');
  const formular = h('div');
  const zeichneOben = () => {
    const w = tagWertung(S.state, datum, heuteIso());
    const bw = tagBewertung(S.state, datum, heuteIso());
    oben.replaceChildren(
      karte('Tageswertung', wertungBlock({ prozent: w.prozent, bereiche: w.bereiche, schwelle: w.schwelle, vorlaeufig: w.vorlaeufig && w.gewertet, status: { ernaehrung: bw.ernaehrung, training: bw.training, schritte: bw.schritte }, leerText: datum > heuteIso() ? 'liegt in der Zukunft' : 'ohne Ernährungsdaten nicht gewertet' })),
      streak(S.state, heuteIso()).joker.includes(datum) ? h('div', { class: 'hinweis ruhig' }, h('b', null, 'Joker-Tag'), h('small', null, 'Kein guter Tag, aber der eine Joker der Woche hat den Streak gehalten. Der Tag zählt nicht mit.')) : null,
      ...bereicheDetail(datum),
    );
  };
  const zeichneFormular = () => formular.replaceChildren(tagFormular(datum, { voll: true, onChange: (allesNeu) => { zeichneOben(); if (allesNeu) zeichneFormular(); } }));
  zeichneOben();
  zeichneFormular();
  const b = tagBewertung(S.state, datum, heuteIso());
  const knoten = h('div', null,
    h('div', { class: 'knopfreihe', style: 'margin-bottom:12px' },
      h('a', { class: 'knopf schmal', href: `#tag/${plusTage(datum, -1)}` }, '‹ Vortag'),
      h('a', { class: 'knopf schmal', href: `#tag/${plusTage(datum, 1)}` }, 'Folgetag ›'),
    ),
    b.minimal ? h('div', { class: 'hinweis ruhig' }, 'Minimalversion aktiv') : null,
    oben,
    h('h2', { class: 'klein', style: 'margin:16px 4px 8px' }, `${WT_LANG[wochentag(datum) - 1]} – Werte nachtragen oder ändern`),
    formular,
  );
  return { titel: deMitTag(datum), zurueck: 'kalender', knoten };
}

export { STATUS_TEXT };
