// Pausen-Signal: Zeitplan der Töne am Ende einer Satzpause (reine Rechnung, ohne Audio).
// Bei 3 und 2 Sekunden Restzeit je ein kurzer Ton, bei 1 Sekunde ein langer Ton bis zum Pausenende.

export const KURZ_SEK = 0.14;

/**
 * restSek: verbleibende Pausenzeit in Sekunden.
 * Ergebnis: Töne ab jetzt gerechnet, [{ in: Sekunden bis zum Start, dauer: Sekunden, lang: boolean }].
 * Töne, deren Zeitpunkt schon vorbei ist, entfallen. Läuft die letzte Sekunde bereits, erklingt der
 * lange Ton für den Rest.
 */
export function pausenSignal(restSek) {
  if (!(restSek > 0.05)) return [];
  const toene = [];
  for (const vorEnde of [3, 2]) {
    const start = restSek - vorEnde;
    if (start >= -0.05) toene.push({ in: Math.max(0, start), dauer: KURZ_SEK, lang: false });
  }
  const langStart = Math.max(0, restSek - 1);
  toene.push({ in: langStart, dauer: restSek - langStart, lang: true });
  return toene;
}
