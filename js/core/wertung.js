// Tages- und Wochenwertung in Prozent (0–100, nie mehr).
// Die drei Bereiche bleiben einzeln sichtbar; die Gesamtzahl fasst sie nur zusammen.
// Gewichte, der Abstand bis 0 % bei den Kalorien und die Grenze für einen "guten Tag"
// stehen als Ziele in den Daten (Schlüssel wertung_…), nicht fest im Code.

import { tagBewertung, GRUEN, GELB, ROT, OFFEN } from './bewertung.js';
import { zielWert } from './ziele.js';
import { wochenTage, plusTage } from './datum.js';

const begrenze = (x) => Math.min(1, Math.max(0, x));
const istZahl = (v) => typeof v === 'number' && Number.isFinite(v);

/** Gewichteter Schnitt der Teile mit Wert; Teile ohne Wert (null) geben ihr Gewicht anteilig ab. */
function gewichtet(teile) {
  const mit = teile.filter((t) => t.anteil !== null && t.gewicht > 0);
  const summe = mit.reduce((a, t) => a + t.gewicht, 0);
  if (!summe) return null;
  return mit.reduce((a, t) => a + t.anteil * t.gewicht, 0) / summe;
}

/** Kalorien: 100 % im grünen Korridor, außerhalb linear fallend bis 0 % beim Abstand "bisNull" (zu wenig UND zu viel). */
export function kcalAnteil(kcal, korridor, bisNull) {
  if (!istZahl(kcal)) return null;
  const abstand = kcal < korridor.min ? korridor.min - kcal : kcal > korridor.max ? kcal - korridor.max : 0;
  return bisNull > 0 ? begrenze(1 - abstand / bisNull) : abstand === 0 ? 1 : 0;
}

/** Training: erledigt 100 %, verkürzt/knapp 50 %, ausgefallen 0 %; ohne Wertung (kein Plantag, Bonus ausgefallen) null. */
export function trainingAnteil(status) {
  if (status === GRUEN) return 1;
  if (status === GELB) return 0.5;
  if (status === ROT || status === OFFEN) return 0; // "offen" = heute noch nicht erledigt (Tag ist vorläufig)
  return null;
}

/**
 * Wertung eines Tages.
 *   gewertet:   false ohne Ernährungsdaten oder in der Zukunft (der Tag bleibt grau)
 *   prozent:    0–100 oder null
 *   vorlaeufig: der heutige Tag, bis er vorbei ist
 *   bereiche:   { ernaehrung, training, schritte }, je { prozent | null, gewicht }
 *   teile:      { kcal, eiweiss } in Prozent (oder null)
 *   gut:        prozent >= Grenze für einen guten Tag
 */
export function tagWertung(state, datum, heuteIso) {
  const b = tagBewertung(state, datum, heuteIso);
  const z = (k) => zielWert(state.ziele, k, datum);
  const gewicht = { kcal: z('wertung_kcal_pct'), eiweiss: z('wertung_eiweiss_pct'), training: z('wertung_training_pct'), schritte: z('wertung_schritte_pct') };

  const kcal = kcalAnteil(b.tag.kcal, b.ziele.kcal, z('wertung_kcal_null_abstand'));
  const eiweiss = istZahl(b.tag.eiweiss_g) && b.ziele.eiweiss.min > 0 ? begrenze(b.tag.eiweiss_g / b.ziele.eiweiss.min) : null;
  const ernaehrung = gewichtet([{ anteil: kcal, gewicht: gewicht.kcal }, { anteil: eiweiss, gewicht: gewicht.eiweiss }]);
  const training = trainingAnteil(b.training);
  const schritte = istZahl(b.tag.schritte) && b.ziele.schritte.ziel > 0 ? begrenze(b.tag.schritte / b.ziele.schritte.ziel) : null;

  const pct = (a) => (a === null ? null : a * 100);
  const bereiche = {
    ernaehrung: { prozent: pct(ernaehrung), gewicht: gewicht.kcal + gewicht.eiweiss },
    training: { prozent: pct(training), gewicht: gewicht.training },
    schritte: { prozent: pct(schritte), gewicht: gewicht.schritte },
  };
  const schwelle = z('wertung_guter_tag');
  const gewertet = ernaehrung !== null && datum <= heuteIso;
  const gesamt = gewertet ? gewichtet(Object.values(bereiche).map((x) => ({ anteil: x.prozent === null ? null : x.prozent / 100, gewicht: x.gewicht }))) : null;
  const prozent = gesamt === null ? null : Math.min(100, gesamt * 100);
  return {
    datum, gewertet, prozent, vorlaeufig: datum === heuteIso, bereiche,
    teile: { kcal: pct(kcal), eiweiss: pct(eiweiss) },
    schwelle, gut: prozent !== null && prozent >= schwelle,
  };
}

const schnitt = (werte) => { const w = werte.filter((v) => v !== null); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; };

/**
 * Wochenwertung (Mo–So) = Durchschnitt der gewerteten Tage.
 *   vorlaeufig: die Woche ist noch nicht vorbei (heute liegt in ihr)
 *   bereiche:   Durchschnitt je Bereich über die gewerteten Tage, an denen der Bereich gewertet wurde
 */
export function wochenProzent(state, mo, heuteIso) {
  const tage = wochenTage(mo).map((d) => tagWertung(state, d, heuteIso));
  const gewertete = tage.filter((t) => t.gewertet);
  const bereich = (name) => schnitt(gewertete.map((t) => t.bereiche[name].prozent));
  return {
    montag: mo, tage,
    prozent: schnitt(gewertete.map((t) => t.prozent)),
    anzahl: gewertete.length,
    guteTage: gewertete.filter((t) => t.gut).length,
    vorlaeufig: heuteIso <= plusTage(mo, 6) && heuteIso >= mo,
    bereiche: { ernaehrung: bereich('ernaehrung'), training: bereich('training'), schritte: bereich('schritte') },
    schwelle: tage[0].schwelle,
  };
}
