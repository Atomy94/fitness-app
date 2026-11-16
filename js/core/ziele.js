// Ziele und Grenzwerte.
// Jedes Ziel ist eine Zeile { id, schluessel, gueltig_ab, wert } in den DATEN (state.ziele).
// Hier steht nur, welche Schlüssel es gibt, wie sie heißen und mit welchem Startwert
// eine neue Installation beginnt. Bewertet wird immer mit dem Wert, der am jeweiligen Tag galt.

import { wochentag } from './datum.js';

// schluessel: [Gruppe, Bezeichnung, Einheit, Startwert]
const LISTE = {
  kcal_mo_sa_ziel: ['Kalorien Mo–Sa', 'Tagesziel (Ring)', 'kcal', 2200],
  kcal_mo_sa_min: ['Kalorien Mo–Sa', 'Grün ab', 'kcal', 2100],
  kcal_mo_sa_max: ['Kalorien Mo–Sa', 'Grün bis', 'kcal', 2450],
  kcal_mo_sa_gelb_min: ['Kalorien Mo–Sa', 'Gelb ab (darunter rot)', 'kcal', 1950],
  kcal_mo_sa_gelb_max: ['Kalorien Mo–Sa', 'Gelb bis (darüber rot)', 'kcal', 2650],

  kcal_so_ziel: ['Kalorien Fußballtag', 'Tagesziel (Ring)', 'kcal', 2500],
  kcal_so_min: ['Kalorien Fußballtag', 'Grün ab', 'kcal', 2400],
  kcal_so_max: ['Kalorien Fußballtag', 'Grün bis', 'kcal', 2750],
  kcal_so_gelb_min: ['Kalorien Fußballtag', 'Gelb ab (darunter rot)', 'kcal', 2250],
  kcal_so_gelb_max: ['Kalorien Fußballtag', 'Gelb bis (darüber rot)', 'kcal', 2950],

  kcal_minimal_min: ['Kalorien Minimalversion', 'Grün ab', 'kcal', 2100],
  kcal_minimal_max: ['Kalorien Minimalversion', 'Grün bis', 'kcal', 2500],
  kcal_minimal_gelb_min: ['Kalorien Minimalversion', 'Gelb ab (darunter rot)', 'kcal', 1950],
  kcal_minimal_gelb_max: ['Kalorien Minimalversion', 'Gelb bis (darüber rot)', 'kcal', 2650],

  kcal_woche_min: ['Kalorien-Wochenschnitt', 'Grün ab', 'kcal', 2150],
  kcal_woche_max: ['Kalorien-Wochenschnitt', 'Grün bis', 'kcal', 2450],
  kcal_woche_gelb_min: ['Kalorien-Wochenschnitt', 'Gelb ab (darunter rot)', 'kcal', 2000],
  kcal_woche_gelb_max: ['Kalorien-Wochenschnitt', 'Gelb bis (darüber rot)', 'kcal', 2600],

  eiweiss_ziel: ['Eiweiß', 'Tagesziel (Ring)', 'g', 160],
  eiweiss_min: ['Eiweiß', 'Grün ab', 'g', 150],
  eiweiss_gelb_min: ['Eiweiß', 'Gelb ab (darunter rot)', 'g', 135],

  schritte_ziel: ['Schritte', 'Tagesziel (Phase)', 'Schritte', 8000],
  schritte_minimal: ['Schritte', 'Tagesziel in der Minimalversion', 'Schritte', 6000],
  schritte_gelb_pct: ['Schritte', 'Gelb ab … % des Ziels', '%', 90],
  schritte_pflicht_grenze: ['Schritte', 'Laufband-Pflicht, wenn um 15 Uhr unter', 'Schritte', 2000],

  laufband_min: ['Training', 'Laufband grün ab', 'Min.', 25],
  laufband_gelb_min: ['Training', 'Laufband gelb ab', 'Min.', 15],
  spaziergang_min: ['Training', 'Spaziergang als Fußball-Ersatz ab', 'Min.', 45],

  ballaststoffe_min: ['Weitere Werte', 'Ballaststoffe grün ab', 'g', 30],
  ballaststoffe_gelb_min: ['Weitere Werte', 'Ballaststoffe gelb ab', 'g', 25],
  ges_fett_max: ['Weitere Werte', 'Gesättigte Fette grün bis', 'g', 25],
  ges_fett_gelb_max: ['Weitere Werte', 'Gesättigte Fette gelb bis', 'g', 30],

  bauch_start: ['Bauchumfang', 'Startwert', 'cm', 102],
  bauch_ziel: ['Bauchumfang', 'Zielwert', 'cm', 92],
};

export const ZIEL_INFO = Object.fromEntries(
  Object.entries(LISTE).map(([k, [gruppe, name, einheit, standard]]) => [k, { gruppe, name, einheit, standard }]),
);

/** Startwerte als Datenzeilen. schritte: [[gueltig_ab, wert], …] für die Phasen. */
export function standardZiele(start, schritte) {
  const ziele = [];
  for (const [schluessel, info] of Object.entries(ZIEL_INFO)) {
    if (schluessel === 'schritte_ziel' && schritte) continue;
    ziele.push({ id: `${schluessel}|${start}`, schluessel, gueltig_ab: start, wert: info.standard });
  }
  for (const [ab, wert] of schritte || []) {
    ziele.push({ id: `schritte_ziel|${ab}`, schluessel: 'schritte_ziel', gueltig_ab: ab, wert });
  }
  return ziele;
}

/** Wert eines Ziels, wie er am Datum galt (letzter Eintrag mit gueltig_ab <= datum). */
export function zielWert(ziele, schluessel, datum) {
  let treffer = null;
  let fruehester = null;
  for (const z of ziele) {
    if (z.schluessel !== schluessel) continue;
    if (!fruehester || z.gueltig_ab < fruehester.gueltig_ab) fruehester = z;
    if (z.gueltig_ab <= datum && (!treffer || z.gueltig_ab > treffer.gueltig_ab)) treffer = z;
  }
  if (treffer) return treffer.wert;
  if (fruehester) return fruehester.wert; // Tage vor dem ersten Eintrag
  return ZIEL_INFO[schluessel] ? ZIEL_INFO[schluessel].standard : null;
}

/** Alle Einträge eines Ziels, ältester zuerst. */
export function zielVerlauf(ziele, schluessel) {
  return ziele.filter((z) => z.schluessel === schluessel).sort((a, b) => (a.gueltig_ab < b.gueltig_ab ? -1 : 1));
}

/** Setzt ein Ziel ab einem Datum (ersetzt einen Eintrag mit demselben Datum). */
export function setzeZiel(ziele, schluessel, gueltig_ab, wert) {
  const id = `${schluessel}|${gueltig_ab}`;
  const vorhanden = ziele.find((z) => z.schluessel === schluessel && z.gueltig_ab === gueltig_ab);
  if (vorhanden) vorhanden.wert = wert;
  else ziele.push({ id, schluessel, gueltig_ab, wert });
}

/** Ist die Minimalversion an diesem Tag aktiv? */
export function minimalAktiv(einstellungen, datum) {
  const zr = (einstellungen.minimal && einstellungen.minimal.zeitraeume) || [];
  return zr.some((z) => z.von <= datum && (!z.bis || datum <= z.bis));
}

/** Planeintrag des Wochentags (oder null). */
export function planTag(einstellungen, datum) {
  const plan = einstellungen.plan || {};
  // Frühere Wochenpläne gelten für Tage bis zu ihrem "bis"-Datum weiter.
  const frueher = (plan.wochenplanAlt || []).filter((a) => datum <= a.bis).sort((a, b) => (a.bis < b.bis ? -1 : 1))[0];
  const wp = (frueher ? frueher.wochenplan : plan.wochenplan) || {};
  const e = wp[wochentag(datum)];
  return e && e.typ && e.typ !== 'frei' ? e : null;
}

/**
 * Einheiten, die an einem Plantag zur Auswahl stehen: [{ text, einheit }].
 * Normal genau eine; mit "wahl" (z. B. Samstag: alleine oder im Studio) mehrere.
 */
export function planAuswahl(planEintrag) {
  if (!planEintrag || (planEintrag.typ !== 'kraft' && planEintrag.typ !== 'bonus')) return [];
  const wahl = (planEintrag.wahl || []).filter((w) => w && w.einheit);
  if (wahl.length >= 2) return wahl.map((w) => ({ text: w.text || w.einheit, einheit: w.einheit }));
  return planEintrag.einheit ? [{ text: planEintrag.einheit, einheit: planEintrag.einheit }] : [];
}

/**
 * Alle Grenzwerte, die an einem Tag gelten.
 * fussball: Hat an diesem Tag Fußball stattgefunden (bzw. ist er geplant)?
 */
export function tagesZiele(state, datum, fussball) {
  const z = (k) => zielWert(state.ziele, k, datum);
  const minimal = minimalAktiv(state.einstellungen, datum);
  const plan = planTag(state.einstellungen, datum);
  const fussballtag = !!plan && plan.typ === 'fussball' && !!fussball;

  let kcal;
  if (fussballtag) {
    kcal = { art: 'fussball', ziel: z('kcal_so_ziel'), min: z('kcal_so_min'), max: z('kcal_so_max'), gelbMin: z('kcal_so_gelb_min'), gelbMax: z('kcal_so_gelb_max') };
  } else if (minimal) {
    kcal = { art: 'minimal', ziel: z('kcal_mo_sa_ziel'), min: z('kcal_minimal_min'), max: z('kcal_minimal_max'), gelbMin: z('kcal_minimal_gelb_min'), gelbMax: z('kcal_minimal_gelb_max') };
  } else {
    kcal = { art: 'normal', ziel: z('kcal_mo_sa_ziel'), min: z('kcal_mo_sa_min'), max: z('kcal_mo_sa_max'), gelbMin: z('kcal_mo_sa_gelb_min'), gelbMax: z('kcal_mo_sa_gelb_max') };
  }

  return {
    minimal,
    kcal,
    eiweiss: { ziel: z('eiweiss_ziel'), min: z('eiweiss_min'), gelbMin: z('eiweiss_gelb_min') },
    schritte: { ziel: minimal ? z('schritte_minimal') : z('schritte_ziel'), gelbPct: z('schritte_gelb_pct'), pflichtGrenze: z('schritte_pflicht_grenze') },
    ballaststoffe: { min: z('ballaststoffe_min'), gelbMin: z('ballaststoffe_gelb_min') },
    gesFett: { max: z('ges_fett_max'), gelbMax: z('ges_fett_gelb_max') },
    laufband: { min: z('laufband_min'), gelbMin: z('laufband_gelb_min') },
    spaziergangMin: z('spaziergang_min'),
    kcalWoche: { min: z('kcal_woche_min'), max: z('kcal_woche_max'), gelbMin: z('kcal_woche_gelb_min'), gelbMax: z('kcal_woche_gelb_max') },
  };
}
