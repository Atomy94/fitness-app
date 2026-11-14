// Wochen-Check-in: berechnet die Werte einer Woche (Mo–So) und baut den Text für Claude.

import { plusTage, wochenTage, de, kw } from './datum.js';
import { fmt, runde } from './zahl.js';
import { wochenWertung, schnitt, fussballGespielt, GRUEN } from './bewertung.js';
import { planTag } from './ziele.js';

export function wochenWerte(state, mo, heuteIso) {
  const tage = wochenTage(mo);
  const so = tage[6];
  const feld = (f, liste = tage) => schnitt(liste.map((d) => (state.tage[d] ? state.tage[d][f] : null)));
  const vorwoche = wochenTage(plusTage(mo, -7));
  const gewicht = feld('gewicht_kg');
  const gewichtVor = feld('gewicht_kg', vorwoche);

  const bauchListe = state.messungen
    .filter((m) => typeof m.bauch_cm === 'number' && !m.ungueltig && m.datum <= so)
    .sort((a, b) => (a.datum < b.datum ? 1 : -1));
  const bauch = bauchListe[0] || null;

  const kraftSoll = tage.filter((d) => { const p = planTag(state.einstellungen, d); return p && p.typ === 'kraft'; }).length;
  const kraftIst = new Set(state.trainings.filter((t) => t.typ === 'kraft' && t.datum >= mo && t.datum <= so).map((t) => t.datum)).size;

  let fussball = 'kein Fußballtag';
  const wertung = wochenWertung(state, mo, heuteIso);
  const ft = wertung.tage.find((t) => t.plan && t.plan.typ === 'fussball');
  if (ft) {
    if (ft.datum > heuteIso) fussball = 'steht noch an';
    else if (fussballGespielt(state, ft.datum, heuteIso) && (ft.training === GRUEN)) fussball = 'gespielt';
    else if (ft.training === GRUEN) fussball = 'ausgefallen, Spaziergang als Ersatz';
    else if (ft.datum === heuteIso) fussball = 'heute, noch offen';
    else fussball = 'ausgefallen';
  }

  return {
    montag: mo, sonntag: so, kw: kw(mo),
    gewicht, gewichtVor, gewichtDiff: gewicht !== null && gewichtVor !== null ? gewicht - gewichtVor : null,
    bauch: bauch ? { cm: bauch.bauch_cm, datum: bauch.datum, inWoche: bauch.datum >= mo } : null,
    kraftIst, kraftSoll, fussball,
    schritte: feld('schritte'), kcal: feld('kcal'), eiweiss: feld('eiweiss_g'),
    ballaststoffe: feld('ballaststoffe_g'), gesFett: feld('ges_fett_g'),
    schlaf: feld('schlaf_h'), schlafQualitaet: feld('schlaf_qualitaet'), stress: feld('stress'),
    wertung,
    minimal: wertung.tage.some((t) => t.minimal),
    ungenau: tage.some((d) => state.tage[d] && state.tage[d].ungenau),
  };
}

const vz = (n, stellen = 1) => (n === null ? '–' : (n > 0 ? '+' : '') + fmt(n, stellen, true));

/** Zeilen für Anzeige und Text: [Bezeichnung, Wert]. */
export function checkinZeilen(w) {
  const wt = w.wertung;
  return [
    ['Gewicht Ø', w.gewicht === null ? '–' : `${fmt(w.gewicht, 1, true)} kg (${w.gewichtDiff === null ? 'keine Vorwoche' : vz(w.gewichtDiff) + ' kg zur Vorwoche'})`],
    ['Bauchumfang', w.bauch ? `${fmt(w.bauch.cm, 1)} cm (${de(w.bauch.datum)}${w.bauch.inWoche ? '' : ', ältere Messung'})` : '–'],
    ['Krafteinheiten', `${w.kraftIst} von ${w.kraftSoll}`],
    ['Fußball', w.fussball],
    ['Schritte Ø', fmt(w.schritte)],
    ['Kalorien Ø', w.kcal === null ? '–' : `${fmt(w.kcal)} kcal`],
    ['Eiweiß Ø', w.eiweiss === null ? '–' : `${fmt(w.eiweiss)} g${w.ungenau ? ' (teils ungenau, eher 5–15 g mehr)' : ''}`],
    ['Ballaststoffe Ø', w.ballaststoffe === null ? '–' : `${fmt(w.ballaststoffe, 1)} g`],
    ['Gesättigte Fette Ø', w.gesFett === null ? '–' : `${fmt(w.gesFett, 1)} g`],
    ['Schlaf Ø', w.schlaf === null ? '–' : `${fmt(w.schlaf, 1)} Std.${w.schlafQualitaet === null ? '' : ', Qualität ' + fmt(w.schlafQualitaet, 1) + ' von 5'}`],
    ['Stress Ø', w.stress === null ? '–' : `${fmt(w.stress, 1)} von 10`],
    ['Wertung Ernährung', `${wt.ernaehrung.x} von 7 Tagen`],
    ['Wertung Training', `${wt.training.x} von ${wt.training.von} Plantagen`],
    ['Wertung Schritte', `${wt.schritte.x} von 7 Tagen`],
  ];
}

export function checkinJson(w, frei = {}) {
  const wt = w.wertung;
  return {
    woche: { von: w.montag, bis: w.sonntag, kw: w.kw },
    minimalversion: w.minimal,
    gewicht_schnitt_kg: runde(w.gewicht, 2), gewicht_diff_vorwoche_kg: runde(w.gewichtDiff, 2),
    bauch_cm: w.bauch ? w.bauch.cm : null, bauch_datum: w.bauch ? w.bauch.datum : null,
    kraft_ist: w.kraftIst, kraft_soll: w.kraftSoll, fussball: w.fussball,
    schritte_schnitt: runde(w.schritte, 0), kcal_schnitt: runde(w.kcal, 0), eiweiss_schnitt_g: runde(w.eiweiss, 0),
    ballaststoffe_schnitt_g: runde(w.ballaststoffe, 1), ges_fett_schnitt_g: runde(w.gesFett, 1),
    schlaf_schnitt_h: runde(w.schlaf, 1), schlaf_qualitaet_schnitt: runde(w.schlafQualitaet, 1), stress_schnitt: runde(w.stress, 1),
    wertung: {
      ernaehrung: `${wt.ernaehrung.x}/7`, training: `${wt.training.x}/${wt.training.von}`, schritte: `${wt.schritte.x}/7`,
      kcal_wochenschnitt: wt.kcalSchnittStatus,
    },
    tage: wt.tage.map((t) => ({
      datum: t.datum, kcal: t.tag.kcal ?? null, eiweiss_g: t.tag.eiweiss_g ?? null, schritte: t.tag.schritte ?? null,
      gewicht_kg: t.tag.gewicht_kg ?? null, ernaehrung: t.ernaehrung, training: t.training, schritte_status: t.schritte,
      einheiten: t.einheiten.map((e) => (e.typ === 'kraft' ? e.einheit : `${e.art}${e.dauer_min ? ' ' + e.dauer_min + ' Min.' : ''}`)),
    })),
    verdauung_saettigung: frei.verdauung || '', besonderheiten: frei.besonderheiten || '',
  };
}

export function checkinText(w, frei = {}) {
  const zeilen = checkinZeilen(w).map(([a, b]) => `${a}: ${b}`);
  return [
    `WOCHEN-CHECK-IN KW ${w.kw} (${de(w.montag)}–${de(w.sonntag)})${w.minimal ? ' – Minimalversion aktiv (Ziel: Gewicht und Bauchumfang halten)' : ''}`,
    '',
    ...zeilen,
    `Verdauung/Sättigung: ${frei.verdauung || '–'}`,
    `Besonderheiten: ${frei.besonderheiten || '–'}`,
    '',
    'JSON:',
    JSON.stringify(checkinJson(w, frei)),
  ].join('\n');
}
