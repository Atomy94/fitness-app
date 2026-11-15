// Aufbau der gesamten App-Daten ("state") und Startzustand einer leeren Installation.
// Persönliche Werte stehen NICHT hier, sondern kommen über den Import (health-data.json, Claude-Import).

import { standardZiele } from './ziele.js';
import { plusTage, montag } from './datum.js';

import { rezepteAusArchiv } from './rezepte.js';

export const SAMMLUNGEN = ['tage', 'trainings', 'messungen', 'blutwerte', 'ziele', 'einstellungen', 'checkins', 'rezepte'];

export function neueId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Wochenplan: 1 = Montag … 7 = Sonntag. typ: kraft | laufband | bonus | fussball | frei */
export function standardWochenplan() {
  return {
    1: { typ: 'kraft', einheit: 'Kraft A', text: 'Kraft A' },
    2: { typ: 'laufband', minuten: 30, text: 'Laufband 30 Min.' },
    3: { typ: 'frei', text: 'Kein Trainingsziel' },
    4: { typ: 'kraft', einheit: 'Kraft B', text: 'Kraft B' },
    5: { typ: 'laufband', minuten: 30, text: 'Laufband 30 Min.' },
    6: { typ: 'bonus', einheit: 'Kraft C', text: 'Kraft C / Gym (Bonus)' },
    7: { typ: 'fussball', text: 'Hallenfußball' },
  };
}

/** Allgemeiner Beispielplan – wird beim Import durch den eigenen Plan ersetzt. */
export function standardEinheiten() {
  const u = (name, saetze, wdh, kg = null, extra = {}) => ({ name, saetze, wdh, kg, pause_sek: kg ? 75 : 45, ...extra });
  return {
    'Kraft A': [u('Liegestütze', 3, '10', null, { schwer: { name: 'Liegestütze Füße erhöht', wdh: '6-10', notiz: 'Füße auf einem Stuhl' } }), u('Einarmiges Rudern', 3, '10-12', 14), u('Schulterdrücken', 3, '8-12', 12, { schwer: { name: 'Einarmiges Schulterdrücken', kg: 10 } }), u('Glute Bridge', 3, '12-15', 10), u('Dead Bug', 3, '10')],
    'Kraft B': [u('Goblet Squat', 3, '10-12', 16), u('Ausfallschritt rückwärts', 2, '10', 8), u('Rudern vorgebeugt', 3, '8-12', 20), u('Kreuzheben gestreckt', 3, '12', 20, { schwer: { name: 'Einbeiniges Kreuzheben', wdh: '8-12', kg: 10 } }), u('Seitstütz', 2, '', null, { sek: 40 })],
    'Kraft C': [u('Liegestütze', 3, '10'), u('Einarmiges Rudern', 3, '12', 14), u('Schulterdrücken', 2, '10', 12), u('Unterarmstütz', 2, '', null, { sek: 40 })],
  };
}

export function standardEinstellungen(start) {
  return {
    start, // erster Tag des Plans; davor wird Training nicht bewertet
    profil: {},
    phasen: [],
    minimal: { zeitraeume: [] }, // [{ von, bis|null }]
    minimalKraft: { minuten: 20, uebungen: 3 },
    plan: { maxMinuten: 30, wochenplan: standardWochenplan(), einheiten: standardEinheiten(), progression: '' },
    zielpfad: { von: start, bis: plusTage(start, 203) }, // Bauchumfang: linear von Start- auf Zielwert
    pauseSek: 60,
    supplements: [],
    letzteSicherung: null,
    eingerichtet: false,
    archiv: {}, // Rohdaten für spätere Funktionen (z. B. Rezeptrechner)
  };
}

export function leererState(heuteIso) {
  const start = montag(heuteIso);
  return {
    tage: {},
    trainings: [],
    messungen: [],
    blutwerte: [],
    ziele: standardZiele(start),
    einstellungen: standardEinstellungen(start),
    checkins: {},
    rezepte: [],
  };
}

/** Füllt fehlende Teile auf (z. B. nach dem Wiederherstellen einer älteren Sicherung). */
export function ergaenze(state, heuteIso) {
  const leer = leererState(heuteIso);
  // Stände aus Version 1.0 kennen noch keine Rezepte: aus den aufbewahrten Rohdaten nachziehen.
  if (!Array.isArray(state.rezepte)) state.rezepte = rezepteAusArchiv(state.einstellungen && state.einstellungen.archiv);
  for (const s of SAMMLUNGEN) if (state[s] === undefined || state[s] === null) state[s] = leer[s];
  const e = state.einstellungen;
  for (const [k, v] of Object.entries(leer.einstellungen)) if (e[k] === undefined) e[k] = v;
  if (!e.plan.wochenplan) e.plan.wochenplan = standardWochenplan();
  if (!e.plan.einheiten) e.plan.einheiten = standardEinheiten();
  if (!e.minimal.zeitraeume) e.minimal.zeitraeume = [];
  return state;
}

/** Tageseintrag holen (und bei Bedarf anlegen). */
export function tagVon(state, datum, anlegen = false) {
  let t = state.tage[datum];
  if (!t && anlegen) {
    t = { datum };
    state.tage[datum] = t;
  }
  return t || null;
}

export function trainingsAm(state, datum) {
  return state.trainings.filter((t) => t.datum === datum);
}

/** Vergleichsschlüssel für Übungsnamen ("Goblet Squat, Tempo 3-1-x" = "Goblet Squat (Tempo …)"). */
export function uebungsSchluessel(name) {
  return String(name || '').split(/[,(]/)[0].trim().toLowerCase();
}
