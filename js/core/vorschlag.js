// Abend-Vorschläge "Für heute noch": rein rechnerisch, ohne KI.
// Aus den Tageswerten und den Grenzen des Tages wird berechnet, was fehlt und was noch frei ist.
// Aus der Snack-Liste (liegt in den Daten: einstellungen.snacks) werden 1–2 passende Vorschläge gewählt.

/** Startwerte der Snack-Liste; in den Einstellungen bearbeitbar. */
export function standardSnacks() {
  return [
    { id: 'snack-skyr', name: 'Skyr 150 g + Beeren 100 g', kcal: 135, eiweiss_g: 17, fett_g: 0.5 },
    { id: 'snack-quark', name: 'Magerquark 250 g', kcal: 170, eiweiss_g: 30, fett_g: 0.5 },
    { id: 'snack-handkaese', name: 'Handkäse 100 g', kcal: 125, eiweiss_g: 30, fett_g: 0.5 },
    { id: 'snack-shake', name: 'Proteinshake 30 g Whey mit Wasser', kcal: 120, eiweiss_g: 24, fett_g: 2 },
  ];
}

/**
 * Hängt eine Tagesgrenze für Quark als Hinweis an die passenden Snacks.
 * Durchsetzen kann die App sie nicht: Was heute schon gegessen wurde, steht nur in Yazio.
 */
export function quarkHinweis(snacks, gramm) {
  if (typeof gramm !== 'number') return;
  for (const s of snacks || []) if (/quark/i.test(s.name || '') && !s.hinweis) s.hinweis = `Quark höchstens ${gramm} g pro Tag – nur, wenn heute noch keiner dabei war`;
}

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * tag:    Tageswerte (kcal, eiweiss_g, fett_g)
 * ziele:  Grenzen des Tages aus tagesZiele(): kcal.min / kcal.max (grüner Korridor), eiweiss.min, fettMax
 * snacks: [{ name, kcal, eiweiss_g, fett_g, hinweis }]
 *
 * Ergebnis:
 *   status: 'keine_daten' | 'erreicht' | 'vorschlag' | 'nichts_passt'
 *   fehlt:  { kcal, eiweiss }   bis zum unteren Rand des Korridors bzw. bis zum Eiweiß-Mindestwert
 *   frei:   { kcal, fett }      bis zur Obergrenze (fett = null, wenn kein Fettwert für heute vorliegt)
 *   liste:  höchstens 2 Vorschläge [{ snacks, kcal, eiweiss, fett, danach: { kcal, eiweiss, fett }, erreicht: { kcal, eiweiss } }]
 */
export function abendVorschlag(tag, ziele, snacks) {
  if (!tag || typeof tag.kcal !== 'number') return { status: 'keine_daten', fehlt: null, frei: null, liste: [] };
  const eiweiss = zahl(tag.eiweiss_g);
  const hatFett = typeof tag.fett_g === 'number' && typeof ziele.fettMax === 'number';
  const fehlt = { kcal: Math.max(0, ziele.kcal.min - tag.kcal), eiweiss: Math.max(0, ziele.eiweiss.min - eiweiss) };
  const frei = { kcal: Math.max(0, ziele.kcal.max - tag.kcal), fett: hatFett ? Math.max(0, ziele.fettMax - tag.fett_g) : null };
  if (fehlt.kcal === 0 && fehlt.eiweiss === 0) return { status: 'erreicht', fehlt, frei, liste: [] };

  // Kandidaten: jeder Snack einzeln und jede Kombination aus zwei verschiedenen Snacks.
  const gueltige = (snacks || []).filter((s) => s && s.name && typeof s.kcal === 'number');
  const kandidaten = gueltige.map((s) => [s]);
  for (let i = 0; i < gueltige.length; i++) for (let j = i + 1; j < gueltige.length; j++) kandidaten.push([gueltige[i], gueltige[j]]);

  const bewertet = kandidaten.map((satz) => {
    const kcal = satz.reduce((a, s) => a + zahl(s.kcal), 0);
    const ew = satz.reduce((a, s) => a + zahl(s.eiweiss_g), 0);
    const fett = satz.reduce((a, s) => a + zahl(s.fett_g), 0);
    return { snacks: satz, kcal, eiweiss: ew, fett, restE: Math.max(0, fehlt.eiweiss - ew), restK: Math.max(0, fehlt.kcal - kcal) };
  })
    // Ein Vorschlag darf nie über die Obergrenze des Korridors führen (und nicht über die Fettgrenze).
    .filter((k) => k.kcal <= frei.kcal && (frei.fett === null || k.fett <= frei.fett));

  if (!bewertet.length) return { status: 'nichts_passt', fehlt, frei, liste: [] };

  // Fehlt Eiweiß: zuerst das, was die Eiweißlücke am besten schließt. Fehlen nur Kalorien: die kalorienreicheren.
  // Bei Gleichstand: lieber ein Snack als zwei, und nicht mehr essen als nötig.
  const eiweissZuerst = fehlt.eiweiss > 0;
  bewertet.sort((a, b) => (eiweissZuerst
    ? a.restE - b.restE || a.restK - b.restK || a.snacks.length - b.snacks.length || a.kcal - b.kcal
    : a.restK - b.restK || a.snacks.length - b.snacks.length || b.kcal - a.kcal));

  // Zwei Vorschläge, die sich nicht nur in der Reihenfolge unterscheiden und möglichst verschiedene Snacks nutzen.
  const liste = [bewertet[0]];
  const zweiter = bewertet.find((k) => !k.snacks.some((s) => bewertet[0].snacks.includes(s))) || bewertet[1];
  if (zweiter && zweiter !== bewertet[0]) liste.push(zweiter);

  return {
    status: 'vorschlag', fehlt, frei,
    liste: liste.map((k) => ({
      snacks: k.snacks, kcal: k.kcal, eiweiss: k.eiweiss, fett: k.fett,
      danach: { kcal: tag.kcal + k.kcal, eiweiss: eiweiss + k.eiweiss, fett: hatFett ? tag.fett_g + k.fett : null },
      erreicht: { kcal: k.restK === 0, eiweiss: k.restE === 0 },
    })),
  };
}
