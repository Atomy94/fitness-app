// Dropbox-Anbindung ohne eigenen Server und ohne fremde Bibliothek.
// Anmeldung: OAuth 2 mit PKCE und OHNE Weiterleitung – Dropbox zeigt einen Code an,
// den der Nutzer in die App einfügt (funktioniert auch in einer Homescreen-App auf dem iPhone).
// Die App nutzt eine Dropbox-App vom Typ "App folder": Sie sieht nur ihren eigenen Ordner.
// Alle Funktionen bekommen "f" (fetch) übergeben, damit sie in Tests ohne Internet laufen.

const AUTH = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2';
const INHALT = 'https://content.dropboxapi.com/2';

export class DropboxFehler extends Error {
  constructor(text, info = {}) {
    super(text);
    this.name = 'DropboxFehler';
    this.status = info.status || 0;
    this.code = info.code || '';
    this.offline = !!info.offline;
  }
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Erzeugt das Geheimnis für die Anmeldung (verifier) und dessen Prüfwert (challenge). */
export async function pkce(krypto = globalThis.crypto) {
  const verifier = b64url(krypto.getRandomValues(new Uint8Array(48)));
  const hash = await krypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(hash)) };
}

/** Adresse der Dropbox-Seite, auf der der Nutzer zustimmt und den Code erhält. */
export function anmeldeUrl(appKey, challenge) {
  const p = new URLSearchParams({
    client_id: appKey, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256',
    token_access_type: 'offline', // liefert ein dauerhaftes Erneuerungs-Token
  });
  return `${AUTH}?${p}`;
}

async function sende(f, url, optionen) {
  let antwort;
  try {
    antwort = await f(url, optionen);
  } catch {
    throw new DropboxFehler('Keine Verbindung zu Dropbox (offline?).', { offline: true });
  }
  if (antwort.ok) return antwort;
  let text = '';
  try { text = await antwort.text(); } catch { /* leer */ }
  let code = '';
  try {
    const j = JSON.parse(text);
    code = j.error_summary || (typeof j.error === 'string' ? j.error : (j.error && j.error['.tag'])) || '';
    if (j.error_description) code += ` – ${j.error_description}`; // Klartext von Dropbox mit anzeigen
  } catch { code = text.slice(0, 120); }
  if (antwort.status === 401) throw new DropboxFehler('Die Dropbox-Anmeldung ist abgelaufen. Bitte neu verbinden.', { status: 401, code });
  if (antwort.status === 429) throw new DropboxFehler('Dropbox ist gerade überlastet. Bitte später erneut versuchen.', { status: 429, code });
  throw new DropboxFehler(`Dropbox meldet einen Fehler (${antwort.status}${code ? ': ' + code : ''}).`, { status: antwort.status, code });
}

const formular = (werte) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(werte).toString() });

/** Tauscht den angezeigten Code gegen Zugangsdaten. */
export async function tauscheCode(f, { appKey, code, verifier }) {
  let antwort;
  try {
    antwort = await sende(f, TOKEN, formular({ grant_type: 'authorization_code', code: code.trim(), code_verifier: verifier, client_id: appKey }));
  } catch (e) {
    if (e.status === 400) {
      // Dropbox nennt den Grund im Klartext; ein Code gilt nur wenige Minuten und nur einmal.
      const grund = /verifier/i.test(e.code) ? 'Der Code passt nicht zu diesem Anmeldelink.'
        : /expired|doesn't exist/i.test(e.code) ? 'Der Code ist abgelaufen oder wurde schon einmal benutzt.'
          : /client/i.test(e.code) ? 'Der App key wird von Dropbox nicht erkannt.'
            : 'Dropbox hat den Code abgelehnt.';
      throw new DropboxFehler(`${grund} Bitte „Bei Dropbox anmelden“ erneut antippen, den NEUEN Code kopieren und gleich einfügen.\n\n(Antwort von Dropbox: ${e.code || 'keine Angabe'})`, { status: 400, code: e.code });
    }
    throw e;
  }
  const j = await antwort.json();
  if (!j.refresh_token) throw new DropboxFehler('Dropbox hat keine dauerhafte Anmeldung geliefert.');
  return { refreshToken: j.refresh_token, accessToken: j.access_token, ablauf: Date.now() + (j.expires_in || 14400) * 1000 };
}

/** Holt mit dem Erneuerungs-Token ein frisches Zugangs-Token (gilt einige Stunden). */
export async function erneuereToken(f, { appKey, refreshToken }) {
  let antwort;
  try {
    antwort = await sende(f, TOKEN, formular({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: appKey }));
  } catch (e) {
    if (e.status === 400) throw new DropboxFehler('Die Dropbox-Anmeldung ist abgelaufen. Bitte neu verbinden.', { status: 401, code: e.code });
    throw e;
  }
  const j = await antwort.json();
  return { accessToken: j.access_token, ablauf: Date.now() + (j.expires_in || 14400) * 1000 };
}

// Dropbox erwartet Argumente im Kopf der Anfrage; dort sind nur ASCII-Zeichen erlaubt.
const kopfArg = (arg) => JSON.stringify(arg).replace(/[\u007f-￿]/g, (c) => `\\u${`000${c.charCodeAt(0).toString(16)}`.slice(-4)}`);

/**
 * Dateizugriff. holeToken() liefert ein gültiges Zugangs-Token.
 * Pfade beginnen mit "/" und beziehen sich auf den App-Ordner.
 */
export function dropbox(f, holeToken) {
  const kopf = async (extra = {}) => ({ Authorization: `Bearer ${await holeToken()}`, ...extra });
  const rpc = async (pfad, arg) => (await sende(f, `${API}${pfad}`, { method: 'POST', headers: await kopf({ 'Content-Type': 'application/json' }), body: arg === null ? 'null' : JSON.stringify(arg) })).json();
  const fehlt = (e) => e instanceof DropboxFehler && e.status === 409 && /not_found/.test(e.code);

  return {
    /** Schreibt eine Datei (ersetzt eine vorhandene). inhalt: Text oder Bytes (Uint8Array/ArrayBuffer). */
    async hochladen(pfad, inhalt) {
      await sende(f, `${INHALT}/files/upload`, {
        method: 'POST',
        headers: await kopf({ 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': kopfArg({ path: pfad, mode: 'overwrite', mute: true }) }),
        body: typeof inhalt === 'string' ? new TextEncoder().encode(inhalt) : inhalt,
      });
    },
    /** Dateien eines Ordners: [{ name, pfad, groesse, geaendert }]. Fehlt der Ordner, wird er angelegt. */
    async liste(pfad) {
      let j;
      try {
        j = await rpc('/files/list_folder', { path: pfad, limit: 200 });
      } catch (e) {
        if (!fehlt(e)) throw e;
        await this.ordner(pfad);
        return [];
      }
      const eintraege = [...(j.entries || [])];
      // Mehr als 200 Dateien kommen in weiteren Teilen.
      for (let runde = 0; j.has_more && j.cursor && runde < 50; runde++) {
        j = await rpc('/files/list_folder/continue', { cursor: j.cursor });
        eintraege.push(...(j.entries || []));
      }
      return eintraege.filter((x) => x['.tag'] === 'file').map((x) => ({ name: x.name, pfad: x.path_lower || x.path_display, groesse: x.size || 0, geaendert: x.server_modified || '' }));
    },
    async herunterladen(pfad) {
      const antwort = await sende(f, `${INHALT}/files/download`, { method: 'POST', headers: await kopf({ 'Dropbox-API-Arg': kopfArg({ path: pfad }) }) });
      return antwort.text();
    },
    /** Lädt eine Datei als Bytes (ArrayBuffer), z. B. ein Foto. */
    async herunterladenDaten(pfad) {
      const antwort = await sende(f, `${INHALT}/files/download`, { method: 'POST', headers: await kopf({ 'Dropbox-API-Arg': kopfArg({ path: pfad }) }) });
      return antwort.arrayBuffer();
    },
    /** Löscht eine Datei; fehlt sie schon, ist das kein Fehler. */
    async loesche(pfad) {
      try { await rpc('/files/delete_v2', { path: pfad }); } catch (e) { if (!fehlt(e)) throw e; }
    },
    async verschiebe(von, nach) {
      await rpc('/files/move_v2', { from_path: von, to_path: nach, autorename: true });
    },
    async ordner(pfad) {
      try { await rpc('/files/create_folder_v2', { path: pfad, autorename: false }); } catch (e) { if (!(e.status === 409)) throw e; }
    },
    /** Name und E-Mail des verbundenen Kontos (zur Anzeige). */
    async konto() {
      const j = await rpc('/users/get_current_account', null);
      return { name: (j.name && j.name.display_name) || '', email: j.email || '' };
    },
    async widerrufe() {
      await rpc('/auth/token/revoke', null);
    },
  };
}
