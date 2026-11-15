// Abgleich mit dem Dropbox-Ordner (Schnittstelle zu Claude).
// Hochladen: stand.md, rezepte.md, Sicherung, Anleitung. Abholen: Dateien aus "eingang/".
// Übernommen wird nichts automatisch – der Nutzer bestätigt jede Datei nach der Vorschau.

import { S, heuteIso, speichernStill, speichereCloud, beiAenderung, meldung, neu } from './store.js';
import { pkce, anmeldeUrl, tauscheCode, erneuereToken, dropbox, DropboxFehler } from './core/dropbox.js';
import { DATEI, ORDNER, LIESMICH_VERSION, standDatei, rezepteDatei, liesmichDatei, sicherungText } from './core/claude-dateien.js';
import { leseImport } from './core/import.js';
import { VERSION } from './version.js';

const f = (...a) => fetch(...a);
const MAX_DATEI = 1024 * 1024;

export const istVerbunden = () => !!(S.cloud && S.cloud.refreshToken && S.cloud.appKey);
export const aktiv = () => istVerbunden() && S.modus === 'echt';

async function holeToken() {
  const c = S.cloud;
  if (c.accessToken && c.ablauf && c.ablauf - Date.now() > 60000) return c.accessToken;
  const t = await erneuereToken(f, { appKey: c.appKey, refreshToken: c.refreshToken });
  Object.assign(c, t);
  await speichereCloud();
  return c.accessToken;
}
const box = () => dropbox(f, holeToken);

/** Schritt 1: liefert die Adresse der Dropbox-Anmeldeseite und merkt sich das Geheimnis. */
export async function anmeldungVorbereiten(appKey) {
  const key = appKey.trim();
  // Eine begonnene Anmeldung wird fortgesetzt (z. B. nach einem Neuladen der App). Würde hier ein
  // neues Geheimnis erzeugt, passte ein schon geholter Code nicht mehr dazu.
  const offen = offeneAnmeldung();
  if (offen && S.cloud.appKey === key) return offen;
  const { verifier, challenge } = await pkce();
  S.cloud = { appKey: key, verifier, anmeldeUrl: anmeldeUrl(key, challenge), refreshToken: null, accessToken: null };
  await speichereCloud();
  return S.cloud.anmeldeUrl;
}

/** Adresse einer begonnenen, noch nicht abgeschlossenen Anmeldung (oder null). */
export function offeneAnmeldung() {
  const c = S.cloud;
  return c && !c.refreshToken && c.verifier && c.anmeldeUrl ? c.anmeldeUrl : null;
}

/** Verwirft eine begonnene Anmeldung (neuer Link, neues Geheimnis). */
export async function anmeldungVerwerfen() {
  if (S.cloud) { S.cloud = { appKey: S.cloud.appKey }; await speichereCloud(); }
}

/** Schritt 2: Code von der Dropbox-Seite einlösen. */
export async function anmeldungAbschliessen(code) {
  if (!S.cloud || !S.cloud.verifier) throw new DropboxFehler('Bitte zuerst „Bei Dropbox anmelden“ antippen.');
  const t = await tauscheCode(f, { appKey: S.cloud.appKey, code, verifier: S.cloud.verifier });
  S.cloud = { appKey: S.cloud.appKey, ...t, verbundenAm: new Date().toISOString(), letzterAbgleich: null, liesmichVersion: 0, konto: null, fehler: null };
  await speichereCloud();
  try { S.cloud.konto = await box().konto(); await speichereCloud(); } catch { /* nur Anzeige */ }
}

export async function trennen() {
  try { if (istVerbunden()) await box().widerrufe(); } catch { /* Verbindung lokal trotzdem entfernen */ }
  S.cloud = S.cloud && S.cloud.appKey ? { appKey: S.cloud.appKey } : null;
  S.eingang = [];
  await speichereCloud();
}

let laeuft = null;
let geaendert = false;

/**
 * Gleicht den Ordner ab. stumm = keine Meldungen (automatischer Abgleich).
 * Ergebnis: { ok, neu: Anzahl neuer Dateien im Eingang, fehler }.
 */
export function abgleichen({ stumm = true } = {}) {
  if (!aktiv()) return Promise.resolve({ ok: false, neu: 0, fehler: 'nicht verbunden' });
  if (laeuft) return laeuft;
  laeuft = (async () => {
    const c = S.cloud;
    try {
      geaendert = false;
      const d = box();
      const jetzt = new Date();
      const zeit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(jetzt);
      await d.hochladen(DATEI.stand, standDatei(S.state, heuteIso(), zeit, VERSION));
      await d.hochladen(DATEI.rezepte, rezepteDatei(S.state, heuteIso()));
      await d.hochladen(DATEI.sicherung, sicherungText(S.state, jetzt.toISOString()));
      if (c.liesmichVersion !== `${VERSION}/${LIESMICH_VERSION}`) {
        await d.hochladen(DATEI.liesmich, liesmichDatei());
        c.liesmichVersion = `${VERSION}/${LIESMICH_VERSION}`;
      }

      const dateien = (await d.liste(ORDNER.eingang)).sort((a, b) => (a.name < b.name ? -1 : 1));
      const bekannt = new Map(S.eingang.map((e) => [`${e.pfad}|${e.geaendert}`, e]));
      const eingang = [];
      let neue = 0;
      for (const datei of dateien.slice(0, 30)) {
        const alt = bekannt.get(`${datei.pfad}|${datei.geaendert}`);
        if (alt) { eingang.push(alt); continue; }
        const text = datei.groesse > MAX_DATEI ? '' : await d.herunterladen(datei.pfad);
        const ergebnis = datei.groesse > MAX_DATEI ? { ok: false, fehler: ['Die Datei ist zu groß (über 1 MB).'], eintraege: [], hinweise: [] } : leseImport(text);
        eingang.push({ ...datei, text, ergebnis, ersetzen: {} });
        neue++;
      }
      S.eingang = eingang;

      c.letzterAbgleich = jetzt.toISOString();
      c.fehler = null;
      await speichereCloud();
      // Die Sicherung in der Dropbox zählt als Sicherung.
      S.state.einstellungen.letzteSicherung = heuteIso();
      await speichernStill('einstellungen');
      if (!stumm) meldung(neue ? `Abgeglichen – ${neue} neue ${neue === 1 ? 'Datei' : 'Dateien'} von Claude` : 'Abgeglichen');
      else if (neue) meldung(`Claude hat ${neue} neue ${neue === 1 ? 'Datei' : 'Dateien'} abgelegt`);
      return { ok: true, neu: neue, fehler: null };
    } catch (e) {
      const text = e instanceof DropboxFehler ? e.message : `Abgleich fehlgeschlagen: ${e && e.message ? e.message : e}`;
      if (!(e instanceof DropboxFehler && e.offline)) { c.fehler = text; await speichereCloud(); }
      if (e instanceof DropboxFehler && e.status === 401) { c.refreshToken = null; c.accessToken = null; await speichereCloud(); }
      if (!stumm) meldung(text);
      return { ok: false, neu: 0, fehler: text };
    } finally {
      laeuft = null;
    }
  })();
  return laeuft;
}

/** Verschiebt eine verarbeitete (oder verworfene) Datei nach "erledigt/". */
export async function erledige(eintrag) {
  await box().ordner(ORDNER.erledigt);
  await box().verschiebe(eintrag.pfad, `${ORDNER.erledigt}/${eintrag.name}`);
  S.eingang = S.eingang.filter((e) => e !== eintrag);
}

// ---------- automatischer Abgleich ----------

let wartet = null;
const ruhig = () => !document.querySelector('[data-laeuft]') && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));

async function automatisch() {
  if (!aktiv() || !navigator.onLine) return;
  const r = await abgleichen({ stumm: true });
  if (r.ok && r.neu && ruhig()) neu();
}

/** Beim Start aufrufen: gleicht ab beim Öffnen, beim Zurückkehren und kurz nach Änderungen. */
export function starteAutomatik() {
  beiAenderung(() => {
    if (!aktiv()) return;
    geaendert = true;
    clearTimeout(wartet);
    wartet = setTimeout(automatisch, 15000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (geaendert) { clearTimeout(wartet); automatisch(); } // letzter Versuch vor dem Schließen
      return;
    }
    const letzter = S.cloud && S.cloud.letzterAbgleich ? Date.parse(S.cloud.letzterAbgleich) : 0;
    if (Date.now() - letzter > 120000) automatisch();
  });
  setTimeout(automatisch, 1500);
}
