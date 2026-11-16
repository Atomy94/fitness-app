// Bildschirm anlassen (Screen Wake Lock), solange ein Training läuft.
// Unterstützt das Gerät es nicht oder lehnt es ab, passiert einfach nichts – keine Fehlermeldung.
// Das Betriebssystem gibt die Sperre frei, sobald die App in den Hintergrund geht; kommt sie zurück
// und das Training läuft noch, wird sie neu angefordert.
// nav/doc werden übergeben, damit das Verhalten ohne Browser getestet werden kann.

export function wachhalter(nav, doc) {
  let sperre = null;
  let gewuenscht = false;
  let laeuft = null; // laufende Anforderung, damit nicht doppelt angefragt wird

  async function anfordern() {
    if (!gewuenscht || sperre || laeuft) return;
    if (!nav || !nav.wakeLock || typeof nav.wakeLock.request !== 'function') return;
    if (doc && doc.visibilityState && doc.visibilityState !== 'visible') return;
    try {
      laeuft = nav.wakeLock.request('screen');
      const s = await laeuft;
      laeuft = null;
      if (!gewuenscht) { try { await s.release(); } catch { /* egal */ } return; } // inzwischen beendet
      sperre = s;
      if (typeof s.addEventListener === 'function') s.addEventListener('release', () => { if (sperre === s) sperre = null; });
    } catch {
      laeuft = null; // z. B. Stromsparmodus: still ignorieren
    }
  }

  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') anfordern(); });
  }

  return {
    /** Bildschirm anlassen. Mehrfaches Aufrufen schadet nicht. */
    an() { gewuenscht = true; return anfordern(); },
    /** Sperre freigeben (Training beendet oder verlassen). */
    async aus() {
      gewuenscht = false;
      const s = sperre;
      sperre = null;
      if (s) { try { await s.release(); } catch { /* egal */ } }
    },
    get aktiv() { return !!sperre; },
    get gewuenscht() { return gewuenscht; },
  };
}
