// Verarbeitung des Dropbox-Ordners "eingang/".
// Besonderheit Auto-Import: Ein iOS-Kurzbefehl legt bei jedem Schließen von Yazio eine Datei
// "import-auto-JJJJ-MM-TT.txt" mit genau einem tag-Eintrag ab. Weil die Dropbox auf dem iPhone nicht
// sauber überschreibt, entstehen Varianten ("-2", "conflicted copy", "(1)"). Pro Datum zählt nur die
// neueste Datei; ältere wandern ohne Rückfrage nach "erledigt/".
// "box" ist der Dateizugriff aus dropbox.js (liste, herunterladen, verschiebe) – in Tests nachgebaut.

import { leseImport, verarbeite } from './import.js';
import { TZ } from './datum.js';

export const ORDNER_EINGANG = '/eingang';
export const ORDNER_ERLEDIGT = '/erledigt';
const MAX_DATEI = 1024 * 1024;
const MAX_DATEIEN = 80;

/** Stammt die Datei vom Kurzbefehl? Erkannt wird nur am Anfang des Namens und an der Endung. */
export const istAutoDatei = (name) => /^import-auto-.*\.(txt|md)$/i.test(String(name || ''));

/** Datum des Eintrags, wenn die Datei ein gültiger Auto-Import ist (genau ein tag-Eintrag), sonst null. */
export function autoDatum(eintrag) {
  const r = eintrag.ergebnis;
  if (!istAutoDatei(eintrag.name) || !r || !r.ok || r.eintraege.length !== 1 || r.eintraege[0].typ !== 'tag') return null;
  return r.eintraege[0].datum;
}

function zeitstempel(jetzt) {
  const t = {};
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (const p of fmt.formatToParts(jetzt)) t[p.type] = p.value;
  return { kurz: `${t.year}-${t.month}-${t.day}T${t.hour}${t.minute}`, sek: t.second };
}

/**
 * Name, unter dem eine Datei in "erledigt/" abgelegt wird. Gibt es den Namen dort schon, kommt ein
 * Zeitstempel dazu (import-auto-2026-11-16__2026-11-16T2046.txt) – nichts wird überschrieben.
 * vorhandene: Set der dort vorhandenen Namen in Kleinbuchstaben; der neue Name wird eingetragen.
 */
export function erledigtName(name, vorhandene, jetzt = new Date()) {
  const frei = (n) => !vorhandene.has(n.toLowerCase());
  let ziel = name;
  if (!frei(ziel)) {
    const punkt = name.lastIndexOf('.');
    const basis = punkt > 0 ? name.slice(0, punkt) : name;
    const endung = punkt > 0 ? name.slice(punkt) : '';
    const z = zeitstempel(jetzt);
    ziel = `${basis}__${z.kurz}${endung}`;
    if (!frei(ziel)) ziel = `${basis}__${z.kurz}${z.sek}${endung}`;
    for (let i = 2; !frei(ziel); i++) ziel = `${basis}__${z.kurz}${z.sek}-${i}${endung}`;
  }
  vorhandene.add(ziel.toLowerCase());
  return ziel;
}

/** Namen, die schon in "erledigt/" liegen (Kleinbuchstaben). Legt den Ordner an, falls er fehlt. */
export async function erledigtNamen(box) {
  return new Set((await box.liste(ORDNER_ERLEDIGT)).map((d) => d.name.toLowerCase()));
}

/** Verschiebt eine Eingangsdatei nach "erledigt/", ohne dort etwas zu überschreiben. Liefert den Zielnamen. */
export async function verschiebeNachErledigt(box, eintrag, vorhandene, jetzt = new Date()) {
  const ziel = erledigtName(eintrag.name, vorhandene, jetzt);
  await box.verschiebe(eintrag.pfad, `${ORDNER_ERLEDIGT}/${ziel}`);
  return ziel;
}

/**
 * Liest den Eingang und räumt die Auto-Importe auf.
 *   bekannt:  Einträge aus dem letzten Abgleich (werden nicht erneut heruntergeladen)
 *   autoOhneVorschau: gültige Auto-Importe sofort übernehmen (Einstellung, Standard aus)
 * Ergebnis:
 *   eingang:   Dateien, die auf eine Entscheidung des Nutzers warten (mit Vorschau)
 *   state:     der Datenstand – ein neuer, wenn Auto-Importe übernommen wurden
 *   geaendert: true, wenn state neu ist
 *   neue:      Anzahl erstmals gesehener Dateien, die im Eingang bleiben
 *   protokoll: [{ art: 'uebersprungen', datum, anzahl, dateien } | { art: 'uebernommen' | 'unveraendert', datum, datei, felder, eintraege }]
 * Hinweis für die App: Zwischen Aufruf und Rückkehr vergeht Zeit (Netzwerk). Wer inzwischen weiter
 * Daten eingibt, darf sie nicht verlieren – deshalb wendet js/cloud.js die übernommenen "eintraege"
 * am Ende noch einmal auf den dann aktuellen Stand an, statt "state" blind zu übernehmen.
 */
export async function verarbeiteEingang({ box, state, bekannt = [], autoOhneVorschau = false, jetzt = new Date() }) {
  const dateien = (await box.liste(ORDNER_EINGANG)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).slice(0, MAX_DATEIEN);
  const alt = new Map(bekannt.map((e) => [`${e.pfad}|${e.geaendert}`, e]));
  const neuGesehen = new Set();
  const alle = [];
  for (const datei of dateien) {
    const schon = alt.get(`${datei.pfad}|${datei.geaendert}`);
    if (schon) { alle.push(schon); continue; }
    const zuGross = datei.groesse > MAX_DATEI;
    const text = zuGross ? '' : await box.herunterladen(datei.pfad);
    const ergebnis = zuGross ? { ok: false, fehler: ['Die Datei ist zu groß (über 1 MB).'], eintraege: [], hinweise: [] } : leseImport(text);
    const eintrag = { ...datei, text, ergebnis, ersetzen: {} };
    alle.push(eintrag);
    neuGesehen.add(eintrag);
  }

  // Auto-Importe nach dem Datum IM Inhalt gruppieren (nicht nach dem Dateinamen).
  const gruppen = new Map();
  for (const e of alle) {
    const datum = autoDatum(e);
    if (!datum) continue;
    if (!gruppen.has(datum)) gruppen.set(datum, []);
    gruppen.get(datum).push(e);
  }

  const protokoll = [];
  const weg = new Set();
  let vorhandene = null;
  const verschiebe = async (e) => {
    if (!vorhandene) vorhandene = await erledigtNamen(box);
    await verschiebeNachErledigt(box, e, vorhandene, jetzt);
    weg.add(e);
  };

  let stand = state;
  let geaendert = false;
  for (const datum of [...gruppen.keys()].sort()) {
    // neueste zuerst: maßgeblich ist die Änderungszeit der Dropbox, bei Gleichstand der Name
    const liste = gruppen.get(datum).sort((a, b) => (a.geaendert > b.geaendert ? -1 : a.geaendert < b.geaendert ? 1 : a.name > b.name ? -1 : 1));
    const [neueste, ...aeltere] = liste;
    for (const e of aeltere) await verschiebe(e);
    if (aeltere.length) protokoll.push({ art: 'uebersprungen', datum, anzahl: aeltere.length, dateien: aeltere.map((e) => e.name) });

    if (autoOhneVorschau) {
      const ergebnis = verarbeite(stand, neueste.ergebnis.eintraege);
      const felder = ergebnis.posten.flatMap((p) => p.felder);
      if (felder.length) { stand = ergebnis.state; geaendert = true; }
      await verschiebe(neueste);
      protokoll.push({ art: felder.length ? 'uebernommen' : 'unveraendert', datum, datei: neueste.name, felder, eintraege: neueste.ergebnis.eintraege });
    }
  }

  const eingang = alle.filter((e) => !weg.has(e));
  return { eingang, state: stand, geaendert, neue: eingang.filter((e) => neuGesehen.has(e)).length, protokoll };
}
