// Hält den aktuellen Datenstand im Speicher und schreibt Änderungen in IndexedDB.

import * as db from './db.js';
import { heute } from './core/datum.js';
import { SAMMLUNGEN, leererState, ergaenze } from './core/state.js';
import { demoState } from './core/demo.js';

const DB_ECHT = 'fitness-app';
const DB_DEMO = 'fitness-app-demo';

export const S = {
  state: null,
  modus: 'echt', // 'echt' | 'demo'
  entwurf: null, // laufendes Training
};

let neuZeichnen = () => {};
let melde = () => {};
export function verbinde({ zeichne, meldung }) { neuZeichnen = zeichne; melde = meldung; }
export const neu = () => neuZeichnen();
export const meldung = (text) => melde(text);
export const heuteIso = () => heute();

// Bildschirme melden hier Timer an, die beim Verlassen gestoppt werden.
let aufraeumListe = [];
export function beiVerlassen(fn) { aufraeumListe.push(fn); }
export function raeumeAuf() { aufraeumListe.forEach((fn) => fn()); aufraeumListe = []; }

const dbName = () => (S.modus === 'demo' ? DB_DEMO : DB_ECHT);

function modusLesen() {
  try { return localStorage.getItem('fitness-modus') === 'demo' ? 'demo' : 'echt'; } catch { return 'echt'; }
}

export async function laden() {
  S.modus = modusLesen();
  const roh = await db.lies(dbName(), [...SAMMLUNGEN, 'entwurf']);
  const vorhanden = SAMMLUNGEN.some((s) => roh[s] !== undefined);
  if (!vorhanden) {
    S.state = S.modus === 'demo' ? demoState(heuteIso()) : leererState(heuteIso());
    await speichern(...SAMMLUNGEN);
  } else {
    const state = {};
    for (const s of SAMMLUNGEN) state[s] = roh[s];
    S.state = ergaenze(state, heuteIso());
  }
  S.entwurf = roh.entwurf || null;
  // Bittet den Browser, die Daten nicht von sich aus zu löschen.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/** Speichert die genannten Sammlungen (ohne Angabe: alle). */
export function speichern(...namen) {
  const liste = namen.length ? namen : SAMMLUNGEN;
  const werte = {};
  for (const n of liste) werte[n] = S.state[n];
  return db.schreibe(dbName(), werte).catch((e) => {
    console.error(e);
    melde('Speichern fehlgeschlagen – bitte App neu öffnen.');
  });
}

export function speichereEntwurf() {
  return db.schreibe(dbName(), { entwurf: S.entwurf || undefined }).catch((e) => console.error(e));
}

/** Ersetzt den gesamten Stand (Import, Wiederherstellung). */
export async function setzeState(state) {
  S.state = ergaenze(state, heuteIso());
  await speichern(...SAMMLUNGEN);
}

export async function wechsleModus(modus) {
  try { localStorage.setItem('fitness-modus', modus); } catch { /* privates Fenster */ }
  await laden();
}

/** Testdaten neu erzeugen (nur im Testdaten-Modus). */
export async function demoZuruecksetzen() {
  if (S.modus !== 'demo') return;
  S.entwurf = null;
  await db.leere(DB_DEMO);
  await laden();
}

export async function allesLoeschen() {
  S.entwurf = null;
  await db.leere(dbName());
  await laden();
}
