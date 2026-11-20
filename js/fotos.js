// Fortschrittsfotos speichern: verkleinern, in IndexedDB ablegen, mit der Dropbox abgleichen.
// Die Fotos gehören NICHT zum Datenstand (S.state), weil sie groß sind: Sie stehen weder in der
// Sicherungsdatei noch in stand.md. Gesichert werden sie als einzelne JPG-Dateien im Dropbox-Ordner "fotos/".
// IndexedDB: "fotos" = Liste der Metadaten, "foto:<id>" = { typ, daten, mini } (Bytes),
// "fotos-geloescht" = Dateinamen, die beim nächsten Abgleich auch in der Dropbox gelöscht werden.

import * as db from './db.js';
import { aktuelleDb, meldeAenderung } from './store.js';
import { zielMasse, fotoDateiname, FOTO_ORDNER, MAX_SEITE, fotoAbgleichPlan } from './core/fotos.js';

const MINI_SEITE = 400;
const QUALITAET = 0.82;
const schluessel = (id) => `foto:${id}`;

/** Alle Fotos (Metadaten) des aktuellen Modus. */
export async function fotos() {
  return (await db.lies(aktuelleDb(), ['fotos'])).fotos || [];
}

async function geloeschtListe() {
  return (await db.lies(aktuelleDb(), ['fotos-geloescht']))['fotos-geloescht'] || [];
}

function neueFotoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function bildLaden(datei) {
  if (globalThis.createImageBitmap) {
    try { return await createImageBitmap(datei, { imageOrientation: 'from-image' }); } catch { /* weiter mit <img> */ }
  }
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Das Bild konnte nicht gelesen werden.')); };
    img.src = url;
  });
}

/** Zeichnet das Bild verkleinert neu und liefert JPG-Bytes. */
async function verkleinere(bild, max) {
  const b = bild.naturalWidth || bild.width;
  const hoe = bild.naturalHeight || bild.height;
  const z = zielMasse(b, hoe, max);
  const canvas = document.createElement('canvas');
  canvas.width = z.breite;
  canvas.height = z.hoehe;
  canvas.getContext('2d').drawImage(bild, 0, 0, z.breite, z.hoehe);
  const blob = await new Promise((ok, fehler) => canvas.toBlob((x) => (x ? ok(x) : fehler(new Error('Das Bild konnte nicht gespeichert werden.'))), 'image/jpeg', QUALITAET));
  return blob.arrayBuffer();
}

async function bytesUndMini(datei) {
  const bild = await bildLaden(datei);
  const daten = await verkleinere(bild, MAX_SEITE);
  const mini = await verkleinere(bild, MINI_SEITE);
  if (bild.close) bild.close();
  return { typ: 'image/jpeg', daten, mini };
}

/** Speichert ein neues Foto (Datei aus der Kamera oder der Mediathek). */
export async function fotoHinzufuegen(datei, datum, ansicht) {
  const inhalt = await bytesUndMini(datei);
  const foto = { id: neueFotoId(), datum, ansicht, hochgeladen: false, erstellt: new Date().toISOString() };
  const liste = [...(await fotos()), foto];
  await db.schreibe(aktuelleDb(), { [schluessel(foto.id)]: inhalt, fotos: liste });
  meldeAenderung();
  return foto;
}

/** Löscht ein Foto auf dem Gerät; war es schon in der Dropbox, dort beim nächsten Abgleich ebenfalls. */
export async function fotoLoeschen(id) {
  const liste = await fotos();
  const foto = liste.find((f) => f.id === id);
  if (!foto) return;
  const geloescht = await geloeschtListe();
  await db.schreibe(aktuelleDb(), {
    [schluessel(id)]: undefined,
    fotos: liste.filter((f) => f.id !== id),
    'fotos-geloescht': [...geloescht, fotoDateiname(foto)],
  });
  meldeAenderung();
}

// Adressen der Bilder zur Anzeige; werden beim Verlassen des Bildschirms freigegeben.
const urls = new Map();

/** Adresse eines Fotos zur Anzeige (mini = kleines Vorschaubild) oder null. */
export async function fotoUrl(id, mini = false) {
  const k = `${id}/${mini ? 'm' : 'g'}`;
  if (urls.has(k)) return urls.get(k);
  const inhalt = (await db.lies(aktuelleDb(), [schluessel(id)]))[schluessel(id)];
  if (!inhalt) return null;
  const url = URL.createObjectURL(new Blob([mini && inhalt.mini ? inhalt.mini : inhalt.daten], { type: inhalt.typ || 'image/jpeg' }));
  urls.set(k, url);
  return url;
}

export function urlsFreigeben() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
}

/**
 * Abgleich mit dem Dropbox-Ordner "fotos/" (nur echte Daten, aus js/cloud.js).
 * Lädt neue Fotos hoch, löscht dort, was auf dem Gerät gelöscht wurde, und holt Fotos, die nur in der
 * Dropbox liegen (z. B. nach einem Gerätewechsel), höchstens `maxRunter` pro Abgleich.
 */
export async function fotosAbgleichen(box, { maxRunter = 20 } = {}) {
  const name = aktuelleDb();
  const geloescht = await geloeschtListe();
  const entfernt = (await box.liste(FOTO_ORDNER)).map((x) => x.name);
  const p = fotoAbgleichPlan(await fotos(), entfernt, geloescht);
  // Immer den JETZT gespeicherten Stand ändern: Fotos, die während des Abgleichs dazukommen, bleiben erhalten.
  const markiere = async (ids) => {
    const liste = (await fotos()).map((x) => (ids.has(x.id) ? { ...x, hochgeladen: true } : x));
    await db.schreibe(name, { fotos: liste });
  };

  for (const f of p.hoch) {
    const inhalt = (await db.lies(name, [schluessel(f.id)]))[schluessel(f.id)];
    if (!inhalt) continue;
    await box.hochladen(`${FOTO_ORDNER}/${fotoDateiname(f)}`, new Uint8Array(inhalt.daten));
    await markiere(new Set([f.id]));
  }
  if (p.schonOben.length) await markiere(new Set(p.schonOben.map((f) => f.id)));
  for (const n of p.loeschen) await box.loesche(`${FOTO_ORDNER}/${n}`);
  if (geloescht.length) {
    // Nur die bearbeiteten Namen entfernen (inzwischen neu gelöschte bleiben für den nächsten Abgleich).
    const erledigt = new Set(geloescht);
    await db.schreibe(name, { 'fotos-geloescht': (await geloeschtListe()).filter((n) => !erledigt.has(n)) });
  }

  let geholt = 0;
  for (const r of p.runter.slice(0, maxRunter)) {
    const daten = await box.herunterladenDaten(`${FOTO_ORDNER}/${r.name}`);
    const inhalt = await bytesUndMini(new Blob([daten], { type: 'image/jpeg' }));
    // Das Original aus der Dropbox bleibt unverändert (kein zweites Verkleinern).
    inhalt.daten = daten;
    const liste = [...(await fotos()), { id: r.id, datum: r.datum, ansicht: r.ansicht, hochgeladen: true, erstellt: new Date().toISOString() }];
    await db.schreibe(name, { [schluessel(r.id)]: inhalt, fotos: liste });
    geholt++;
  }
  return { hoch: p.hoch.length, runter: geholt, geloescht: p.loeschen.length };
}
