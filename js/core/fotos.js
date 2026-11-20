// Fortschrittsfotos: reine Logik ohne Bildschirm und ohne Speicher (in Node testbar).
// Die Bilder selbst liegen in IndexedDB (js/fotos.js) und in der Dropbox unter "fotos/".
// Ein Foto: { id, datum, ansicht, hochgeladen }. Der Dateiname trägt Datum, Ansicht und id,
// damit sich die Galerie auf einem neuen Gerät allein aus der Dropbox wiederherstellen lässt.

export const ANSICHTEN = [
  { key: 'vorne', name: 'Vorne' },
  { key: 'seite', name: 'Seite' },
  { key: 'hinten', name: 'Hinten' },
];
const ANSICHT_KEYS = ANSICHTEN.map((a) => a.key);
export const ansichtName = (key) => (ANSICHTEN.find((a) => a.key === key) || { name: key }).name;

export const FOTO_ORDNER = '/fotos';

/** Längste Seite eines gespeicherten Fotos in Pixeln. */
export const MAX_SEITE = 1280;

/** Dateiname in der Dropbox, z. B. "2026-11-22_vorne_k3x9.jpg". */
export const fotoDateiname = (foto) => `${foto.datum}_${foto.ansicht}_${foto.id}.jpg`;

/** Liest Datum, Ansicht und id aus einem Dateinamen; unbekannte Namen ergeben null. */
export function leseFotoName(name) {
  const m = /^(\d{4}-\d{2}-\d{2})_([a-z]+)_([A-Za-z0-9-]+)\.jpe?g$/i.exec(String(name || ''));
  if (!m || !ANSICHT_KEYS.includes(m[2].toLowerCase())) return null;
  return { datum: m[1], ansicht: m[2].toLowerCase(), id: m[3] };
}

/** Neue Bildgröße: längste Seite höchstens max, Seitenverhältnis bleibt, nie vergrößern. */
export function zielMasse(breite, hoehe, max = MAX_SEITE) {
  const f = Math.min(1, max / Math.max(breite, hoehe));
  return { breite: Math.max(1, Math.round(breite * f)), hoehe: Math.max(1, Math.round(hoehe * f)) };
}

/**
 * Fotos nach Termin gruppiert, neuester zuerst:
 * [{ datum, fotos: { vorne: [..], seite: [..], hinten: [..] }, anzahl }]
 */
export function fotoTermine(liste) {
  const nachDatum = new Map();
  for (const f of liste || []) {
    if (!nachDatum.has(f.datum)) nachDatum.set(f.datum, { datum: f.datum, fotos: Object.fromEntries(ANSICHT_KEYS.map((k) => [k, []])), anzahl: 0 });
    const t = nachDatum.get(f.datum);
    (t.fotos[f.ansicht] || (t.fotos[f.ansicht] = [])).push(f);
    t.anzahl++;
  }
  return [...nachDatum.values()].sort((a, b) => (a.datum < b.datum ? 1 : -1));
}

/** Termine (aufsteigend), an denen es ein Foto dieser Ansicht gibt. */
export function termineMitAnsicht(liste, ansicht) {
  return [...new Set((liste || []).filter((f) => f.ansicht === ansicht).map((f) => f.datum))].sort();
}

/** Vorbelegung für den Vergleich: ältester und neuester Termin dieser Ansicht. */
export function vergleichStart(liste, ansicht) {
  const t = termineMitAnsicht(liste, ansicht);
  if (t.length < 2) return null;
  return { vorher: t[0], nachher: t.at(-1) };
}

/** Erstes Foto (zuletzt aufgenommen) eines Termins in einer Ansicht. */
export function fotoAm(liste, datum, ansicht) {
  const treffer = (liste || []).filter((f) => f.datum === datum && f.ansicht === ansicht);
  return treffer.at(-1) || null;
}

/** Gewicht und Bauchumfang zu einem Fototermin (nur zur Anzeige). */
export function messwerteAm(state, datum) {
  const tag = state.tage[datum] || {};
  const bauch = (state.messungen || []).filter((m) => m.datum === datum && typeof m.bauch_cm === 'number' && !m.ungueltig).at(-1);
  const gewichtMessung = (state.messungen || []).filter((m) => m.datum === datum && typeof m.gewicht_kg === 'number' && !m.ungueltig).at(-1);
  const gewicht = typeof tag.gewicht_kg === 'number' ? tag.gewicht_kg : gewichtMessung ? gewichtMessung.gewicht_kg : null;
  return { gewicht, bauch: bauch ? bauch.bauch_cm : null };
}

/**
 * Was beim Dropbox-Abgleich zu tun ist.
 * lokal: Fotos auf dem Gerät · entfernt: Dateinamen in "fotos/" · geloescht: Dateinamen, die auf dem
 * Gerät gelöscht wurden und auch in der Dropbox weg sollen.
 * Ergebnis: { hoch: [foto], runter: [{ name, datum, ansicht, id }], loeschen: [name], erledigtGeloescht: [name], schonOben: [foto] }
 */
export function fotoAbgleichPlan(lokal, entfernt, geloescht = []) {
  const oben = new Set((entfernt || []).map((n) => n.toLowerCase()));
  const weg = new Set((geloescht || []).map((n) => n.toLowerCase()));
  const lokaleIds = new Set((lokal || []).map((f) => String(f.id).toLowerCase()));
  const hoch = [];
  const schonOben = [];
  for (const f of lokal || []) {
    if (oben.has(fotoDateiname(f).toLowerCase())) { if (!f.hochgeladen) schonOben.push(f); } else hoch.push(f);
  }
  const runter = [];
  for (const name of entfernt || []) {
    const info = leseFotoName(name);
    if (!info || weg.has(name.toLowerCase()) || lokaleIds.has(info.id.toLowerCase())) continue;
    runter.push({ name, ...info });
  }
  const loeschen = (geloescht || []).filter((n) => oben.has(n.toLowerCase()));
  const erledigtGeloescht = (geloescht || []).filter((n) => !oben.has(n.toLowerCase()));
  return { hoch, runter, loeschen, erledigtGeloescht, schonOben };
}
