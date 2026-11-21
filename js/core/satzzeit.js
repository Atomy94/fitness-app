// Satz- und Pausenzeiten im Krafttraining (reine Logik, in Node testbar).
//
// Die App kennt das Satzende nur über den Haken (✓). Deshalb gilt:
//   Satzende   = Tipp auf ✓
//   Satzbeginn = Ende der vorigen Pause bzw. Start des Trainings. Die Pause endet, wenn der Pausen-Timer
//                abläuft (Soll-Pause, ggf. mit „+15 s“), mit „Pause aus“ oder mit „Anhalten“.
//                Kommt der ✓, bevor die Pause zu Ende ist (z. B. Supersatz: direkt die nächste Übung),
//                hat der Satz direkt nach dem vorigen begonnen (Pause 0).
// Alle Zeiten im Entwurf zählen auf der Trainingsuhr (ms seit Start ohne angehaltene Zeit), dazu die
// Uhrzeit des ✓ (endeMs) für die ISO-Zeit. Angehaltene Zeit zählt so weder als Satz noch als Pause.

import { TZ } from './datum.js';

/** Satzbeginn auf der Trainingsuhr für einen ✓ zur Zeit endeLauf. */
export function satzBeginn({ endeLauf, bereitLauf, letzteEndeLauf }) {
  const vorher = typeof letzteEndeLauf === 'number' ? letzteEndeLauf : 0;
  if (typeof bereitLauf !== 'number' || bereitLauf > endeLauf) return Math.min(vorher, endeLauf); // ✓ vor Pausenende
  return Math.min(Math.max(bereitLauf, vorher), endeLauf);
}

/** Ende des letzten bestätigten Satzes vor `bis` (Trainingsuhr) oder null. */
export function letztesEnde(uebungen, bis = Infinity) {
  let m = null;
  for (const u of uebungen || []) for (const x of u.saetze || []) {
    if (x.fertig && typeof x.endeLauf === 'number' && x.endeLauf <= bis && (m === null || x.endeLauf > m)) m = x.endeLauf;
  }
  return m;
}

/** Ortszeit Berlin als "JJJJ-MM-TTTHH:MM:SS" (ohne Zeitzonen-Angabe). */
const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function berlinIso(ms) {
  const t = {};
  for (const p of isoFmt.formatToParts(new Date(ms))) t[p.type] = p.value;
  return `${t.year}-${t.month}-${t.day}T${t.hour}:${t.minute}:${t.second}`;
}

const sek = (ms) => Math.max(0, Math.round(ms / 1000));

/**
 * Zeiten je Satz für das Speichern. uebungen: Entwurfs-Übungen mit saetze [{ fertig, startLauf, endeLauf, endeMs }].
 * Liefert je Übung und Satz { start, dauer_sek, pause_sek } (nur bei bestätigten Sätzen mit Zeit), in der
 * Reihenfolge, in der die Sätze gemacht wurden: Pause = bis zum nächsten Satz, egal welcher Übung
 * (Supersätze); beim allerletzten Satz null.
 */
export function satzZeiten(uebungen) {
  const alle = [];
  (uebungen || []).forEach((u, ui) => (u.saetze || []).forEach((x, si) => {
    if (x.fertig && typeof x.startLauf === 'number' && typeof x.endeLauf === 'number') alle.push({ ui, si, x });
  }));
  alle.sort((a, b) => a.x.startLauf - b.x.startLauf || a.x.endeLauf - b.x.endeLauf);
  const aus = (uebungen || []).map((u) => (u.saetze || []).map(() => null));
  alle.forEach((e, i) => {
    const naechster = alle[i + 1];
    const z = { dauer_sek: sek(e.x.endeLauf - e.x.startLauf), pause_sek: naechster ? sek(naechster.x.startLauf - e.x.endeLauf) : null };
    if (typeof e.x.endeMs === 'number') z.start = berlinIso(e.x.endeMs - (e.x.endeLauf - e.x.startLauf));
    aus[e.ui][e.si] = z;
  });
  return aus;
}

/** Gespeicherter Satz: Werte plus Zeiten in fester Reihenfolge (start, dauer_sek, pause_sek). */
export function satzMitZeit(werte, z) {
  if (!z) return werte;
  const s = { ...werte };
  if (z.start) s.start = z.start;
  s.dauer_sek = z.dauer_sek;
  s.pause_sek = z.pause_sek;
  return s;
}

/**
 * Auswertung einer gespeicherten Krafteinheit: reine Satzzeit, Pausenzeit gesamt, je Übung Ø Pause und geplante Pause.
 * null, wenn keine Zeiten aufgezeichnet sind (alte oder nachgetragene Einheiten).
 */
export function zeitAuswertung(t) {
  const uebungen = (t && t.uebungen) || [];
  const saetze = uebungen.flatMap((u) => u.saetze || []);
  if (!saetze.some((s) => typeof s.dauer_sek === 'number')) return null;
  const summe = (liste) => liste.reduce((a, b) => a + b, 0);
  const pausen = saetze.map((s) => s.pause_sek).filter((p) => typeof p === 'number');
  return {
    satzSek: summe(saetze.map((s) => s.dauer_sek).filter((d) => typeof d === 'number')),
    pauseSek: summe(pausen),
    gesamtSek: t.start && t.ende ? sek(Date.parse(`${t.ende}Z`) - Date.parse(`${t.start}Z`)) : null,
    uebungen: uebungen.map((u) => {
      const p = (u.saetze || []).map((s) => s.pause_sek).filter((x) => typeof x === 'number');
      return { name: u.name, pauseSchnitt: p.length ? Math.round(summe(p) / p.length) : null, pauseGeplant: typeof u.pause_geplant_sek === 'number' ? u.pause_geplant_sek : null };
    }),
  };
}

/** "12:05 Min." bzw. "45 Sek." */
export function dauerText(s) {
  if (s === null || s === undefined) return '–';
  if (s < 60) return `${s} Sek.`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} Min.`;
}

// ---------- Aufzeichnung während des Trainings (ändert den Entwurf) ----------

/** ✓ auf einen Satz: Beginn und Ende festhalten. lauf = Trainingsuhr in ms, jetzt = Uhrzeit in ms. */
export function zeitBeiHaken(en, x, lauf, jetzt) {
  zeitZurueck(null, x);
  x.bereitVorher = typeof en.bereitLauf === 'number' ? en.bereitLauf : null;
  x.startLauf = satzBeginn({ endeLauf: lauf, bereitLauf: en.bereitLauf, letzteEndeLauf: letztesEnde(en.uebungen, lauf) });
  x.endeLauf = lauf;
  x.endeMs = jetzt;
}

/** ✓ zurückgenommen: Zeiten des Satzes verwerfen. War es der letzte Satz, gilt wieder die Pause davor. */
export function zeitZurueck(en, x) {
  if (en && typeof x.endeLauf === 'number' && x.endeLauf === letztesEnde(en.uebungen) && x.bereitVorher !== undefined) {
    if (x.bereitVorher === null) delete en.bereitLauf; else en.bereitLauf = x.bereitVorher;
  }
  delete x.startLauf; delete x.endeLauf; delete x.endeMs; delete x.bereitVorher;
}

/** Pausen-Timer startet (nach ✓ oder „Pause neu“): der nächste Satz beginnt frühestens nach der Soll-Pause. */
export function pauseBeginnt(en, lauf, sollSek) { en.bereitLauf = lauf + sollSek * 1000; }

/** „+15 s“ */
export function pauseLaenger(en, ms) { if (typeof en.bereitLauf === 'number') en.bereitLauf += ms; }

/** „Pause aus“ oder „Anhalten“: Die Pause endet jetzt (wenn sie nicht schon vorbei ist). */
export function pauseEndet(en, lauf) { if (typeof en.bereitLauf !== 'number' || en.bereitLauf > lauf) en.bereitLauf = lauf; }

/**
 * Übungen einer beendeten Einheit zum Speichern: Werte je Satz, bei Live-Training mit Zeiten,
 * je Übung die geplante Pause (pause_geplant_sek). nurBestaetigte = nur Sätze mit ✓.
 */
export function uebungenZumSpeichern(en, nurBestaetigte, mitZeiten = true) {
  const zeiten = mitZeiten ? satzZeiten(en.uebungen) : [];
  return en.uebungen.map((u, ui) => {
    const saetze = [];
    u.saetze.forEach((x, si) => {
      if (nurBestaetigte && !x.fertig) return;
      const werte = u.zeit ? { sek: x.sek } : { wdh: x.wdh ?? 0, kg: x.kg ?? 0 };
      saetze.push(satzMitZeit(werte, zeiten[ui] && zeiten[ui][si]));
    });
    const aus = { name: u.name, saetze };
    if (u.notiz) aus.notiz = u.notiz;
    if (mitZeiten && typeof u.pauseSek === 'number' && saetze.some((s) => typeof s.dauer_sek === 'number')) aus.pause_geplant_sek = u.pauseSek;
    return aus;
  }).filter((u) => u.saetze.length);
}
