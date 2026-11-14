// Gemeinsamer Teststand: Plan beginnt am Montag, 09.11.2026 (erfundene Werte).
import { standardZiele } from '../js/core/ziele.js';
import { standardEinstellungen } from '../js/core/state.js';

export const START = '2026-11-09'; // Montag
export const MO = '2026-11-09', DI = '2026-11-10', MI = '2026-11-11', DO = '2026-11-12', FR = '2026-11-13', SA = '2026-11-14', SO = '2026-11-15';
export const SPAETER = '2027-06-01'; // "heute" weit in der Zukunft: alle Testtage sind vergangen

export function stand() {
  return {
    tage: {},
    trainings: [],
    messungen: [],
    blutwerte: [],
    ziele: standardZiele(START, [[START, 5000], ['2026-11-23', 7000], ['2026-12-07', 8000]]),
    einstellungen: standardEinstellungen(START),
    checkins: {},
  };
}

let nr = 0;
export const kraft = (datum, einheit = 'Kraft A', extra = {}) => ({ id: `t${++nr}`, typ: 'kraft', datum, einheit, verkuerzt: false, uebungen: [], ...extra });
export const cardio = (datum, art, dauer_min, extra = {}) => ({ id: `t${++nr}`, typ: 'cardio', datum, art, dauer_min, ...extra });
