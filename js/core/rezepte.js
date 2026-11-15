// Rezepte: gängige Mahlzeiten mit Mengen und Nährwerten, sortiert nach Kategorie.
// Ein Rezept: { id, name, kategorie, bezug: 'portion' | '100g', portion (Text), zutaten: [{ name, menge }],
//               kcal, eiweiss_g, kh_g, fett_g, ges_fett_g, zucker_g, ballaststoffe_g, salz_g, notiz }

export const KATEGORIEN = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snacks'];

// [Feld, Bezeichnung, Einheit, Nachkommastellen]
export const NAEHRWERTE = [
  ['kcal', 'Kalorien', 'kcal', 0],
  ['eiweiss_g', 'Eiweiß', 'g', 1],
  ['kh_g', 'Kohlenhydrate', 'g', 1],
  ['zucker_g', 'davon Zucker', 'g', 1],
  ['fett_g', 'Fett', 'g', 1],
  ['ges_fett_g', 'davon gesättigt', 'g', 1],
  ['ballaststoffe_g', 'Ballaststoffe', 'g', 1],
  ['salz_g', 'Salz', 'g', 2],
];

let zaehler = 0;
const id = () => `r-${Date.now().toString(36)}-${++zaehler}-${Math.random().toString(36).slice(2, 7)}`;

export function neuesRezept(kategorie = KATEGORIEN[0]) {
  return { id: id(), name: '', kategorie, bezug: 'portion', portion: '', zutaten: [], notiz: '' };
}

/** Nährwerte eines Rezepts "pro 100 g" für eine Menge in Gramm. */
export function fuerMenge(rezept, gramm) {
  const aus = {};
  for (const [feld] of NAEHRWERTE) if (typeof rezept[feld] === 'number') aus[feld] = (rezept[feld] * gramm) / 100;
  return aus;
}

const nimm = (ziel, quelle, zuordnung) => {
  for (const [von, nach] of Object.entries(zuordnung)) if (typeof quelle[von] === 'number') ziel[nach] = quelle[von];
};
const FELDER_ALT = { kcal: 'kcal', protein: 'eiweiss_g', carbs: 'kh_g', fat: 'fett_g', sat_fat: 'ges_fett_g', sugar: 'zucker_g', fiber: 'ballaststoffe_g', salt: 'salz_g' };

/**
 * Baut die Rezeptliste aus den Rohdaten der health-data.json
 * (standard_meals = Mahlzeiten pro Portion, foods_per_100g = Gerichte/Produkte pro 100 g).
 * Die Kategorie wird geschätzt und lässt sich in der App ändern.
 */
export function rezepteAusArchiv(archiv) {
  const liste = [];
  for (const m of (archiv && archiv.standard_meals) || []) {
    const r = neuesRezept(/frühstück/i.test(m.name) ? 'Frühstück' : /(^|\s)mittag/i.test(m.name) ? 'Mittagessen' : /(^|\s)abend/i.test(m.name) ? 'Abendessen' : 'Snacks');
    r.name = m.name;
    r.portion = '1 Portion';
    r.zutaten = Object.entries(m.ingredients || {}).map(([name, menge]) => {
      const ml = /_ml$/.test(name);
      return { name: name.replace(/_ml$/, '').replace(/_/g, ' '), menge: typeof menge === 'number' ? `${String(menge).replace('.', ',')} ${ml ? 'ml' : 'g'}` : String(menge) };
    });
    nimm(r, m, FELDER_ALT);
    r.notiz = [m.days ? `Tage: ${m.days}` : null, m.note].filter(Boolean).join(' · ');
    liste.push(r);
  }
  for (const f of (archiv && archiv.foods_per_100g) || []) {
    const r = neuesRezept(/edamame|käse|riegel|nuss|shake|snack/i.test(f.name) ? 'Snacks' : 'Abendessen');
    r.name = f.name;
    r.bezug = '100g';
    nimm(r, f, FELDER_ALT);
    liste.push(r);
  }
  return liste;
}
