// Testdaten für 3 Wochen (erfunden, keine echten Werte). Laufen in einer eigenen Datenbank.

import { montag, plusTage, wochentag } from './datum.js';
import { standardZiele } from './ziele.js';
import { standardEinstellungen, standardEinheiten } from './state.js';

// Fester Zufall, damit die Testdaten immer gleich aussehen.
function zufall(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function demoState(heuteIso) {
  const r = zufall(42);
  const zw = (a, b) => a + r() * (b - a);
  const start = plusTage(montag(heuteIso), -14);
  const ziele = standardZiele(start, [[start, 5000], [plusTage(start, 14), 7000], [plusTage(start, 28), 8000]]);
  const e = standardEinstellungen(start);
  e.eingerichtet = true;
  e.demo = true;
  e.supplements = [{ name: 'Kreatin', info: '5 g zum Frühstück' }];
  const plan = standardEinheiten();

  const tage = {};
  const trainings = [];
  let id = 0;
  let gewicht = 95;
  for (let d = start; d <= heuteIso; d = plusTage(d, 1)) {
    const wt = wochentag(d);
    const i = Math.round((Date.parse(d) - Date.parse(start)) / 86400000);
    gewicht += zw(-0.35, 0.2);
    const istHeute = d === heuteIso;
    const fussball = wt === 7 && i !== 6; // am ersten Sonntag fällt Fußball aus
    const t = {
      datum: d,
      gewicht_kg: Math.round(gewicht * 10) / 10,
      schlaf_h: Math.round(zw(6, 8.2) * 2) / 2,
      schlaf_qualitaet: 2 + Math.floor(r() * 4),
      stress: 3 + Math.floor(r() * 5),
      kreatin: r() > 0.12,
    };
    // Schlafphasen, Zeiten, Ruhepuls und HRV (erfunden, ohne weitere Zufallszahlen, damit die übrigen Testdaten gleich bleiben)
    const schlafMin = t.schlaf_h * 60;
    t.schlaf_tief_min = Math.round(schlafMin * (0.14 + (i % 3) * 0.02));
    t.schlaf_rem_min = Math.round(schlafMin * 0.22);
    t.schlaf_leicht_min = Math.round(schlafMin) - t.schlaf_tief_min - t.schlaf_rem_min;
    t.schlaf_wach_min = 10 + (i % 4) * 8;
    const zuBett = 23 * 60 + (i % 5) * 10;
    const ende = (zuBett + Math.round(schlafMin) + t.schlaf_wach_min) % (24 * 60);
    const uhr = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    t.einschlafen = uhr(zuBett);
    t.aufwachen = uhr(ende);
    t.ruhepuls = 57 + (i % 5);
    t.hrv_ms = 36 + (i % 7) * 3;
    if (!istHeute) {
      // absichtlich gemischt: ein zu niedriger Tag, ein zu hoher, sonst im Korridor
      t.kcal = i === 3 ? 1820 : i === 9 ? 2720 : Math.round(zw(fussball ? 2380 : 2040, fussball ? 2700 : 2420));
      t.eiweiss_g = i === 5 ? 128 : Math.round(zw(140, 178));
      t.kh_g = Math.round(zw(170, 240));
      t.fett_g = Math.round(zw(50, 78));
      t.ballaststoffe_g = Math.round(zw(20, 36) * 10) / 10;
      t.ges_fett_g = Math.round(zw(17, 33) * 10) / 10;
      t.salz_g = Math.round(zw(4, 8) * 10) / 10;
      t.schritte = Math.round(zw(3800, 9200) / 50) * 50;
    } else {
      t.schritte = 1400;
    }
    if (wt === 7) t.fussball = fussball;
    tage[d] = t;
    if (istHeute) continue;

    const kraft = (einheit, verkuerzt = false) => trainings.push({
      id: `demo-${++id}`, typ: 'kraft', datum: d, einheit, dauer_min: verkuerzt ? 18 : 30, verkuerzt, notiz: '',
      uebungen: plan[einheit].slice(0, verkuerzt ? 3 : 99).map((u) => ({
        name: u.name,
        saetze: Array.from({ length: u.saetze }, () => (u.sek ? { sek: u.sek } : { wdh: (parseInt(u.wdh, 10) || 10) + Math.floor(i / 7), kg: u.kg ? u.kg + Math.floor(i / 7) : 0 })),
      })),
    });
    const cardio = (art, dauer_min, km = null) => trainings.push({ id: `demo-${++id}`, typ: 'cardio', datum: d, art, dauer_min, km });

    if (wt === 1) kraft('Kraft A', i === 7);
    if (wt === 2) cardio('Laufband', i === 8 ? 18 : 30, i === 8 ? 1.8 : 3.1);
    if (wt === 3 && i === 2) cardio('Laufband', 20, 2.0); // Zusatz an einem Nicht-Plantag
    if (wt === 4 && i !== 10) kraft('Kraft B'); // einmal ausgefallen
    if (wt === 5 && i !== 4) cardio('Laufband', 27, 2.8);
    if (wt === 6 && i === 5) kraft('Kraft C');
    if (wt === 7) cardio(fussball ? 'Hallenfußball' : 'Spaziergang', fussball ? 60 : 50);
  }

  const messungen = [
    { id: 'demo-m1', datum: plusTage(start, -1), quelle: 'Maßband', bauch_cm: 102 },
    { id: 'demo-m2', datum: plusTage(start, 6), quelle: 'Maßband', bauch_cm: 101.5 },
    { id: 'demo-m3', datum: plusTage(start, 13), quelle: 'Maßband', bauch_cm: 101 },
    { id: 'demo-m4', datum: start, quelle: 'Krafttest', liegestuetze_max: 15, kniebeugen_max: 50 },
    { id: 'demo-m5', datum: plusTage(start, 13), quelle: 'Krafttest', liegestuetze_max: 17, kniebeugen_max: 55 },
    { id: 'demo-m6', datum: plusTage(start, -300), quelle: 'Tanita', gewicht_kg: 89.4, koerperfett_pct: 17.7, muskelmasse_kg: 70 },
    { id: 'demo-m7', datum: plusTage(start, -150), quelle: 'Tanita', gewicht_kg: 88, koerperfett_pct: 11.5, muskelmasse_kg: 73, ungueltig: true, grund: 'Abendmessung' },
    { id: 'demo-m8', datum: plusTage(start, 1), quelle: 'Tanita', gewicht_kg: 94.5, koerperfett_pct: 22.5, muskelmasse_kg: 69.5 },
  ];
  const blutwerte = [
    { id: 'demo-b1', datum: plusTage(start, -370), name: 'Eisen', wert: 230, einheit: 'µg/dl', norm_min: 70, norm_max: 180 },
    { id: 'demo-b2', datum: plusTage(start, 3), name: 'Eisen', wert: 165, einheit: 'µg/dl', norm_min: 70, norm_max: 180 },
    { id: 'demo-b3', datum: plusTage(start, 3), name: 'Ferritin', wert: 250, einheit: 'ng/ml', norm_min: 30, norm_max: 400 },
    { id: 'demo-b4', datum: plusTage(start, 3), name: 'HDL-Cholesterin', wert: 38, einheit: 'mg/dl', norm_min: 40, norm_max: 80 },
  ];
  const z = (name, menge) => ({ name, menge });
  const rezepte = [
    { id: 'demo-r1', name: 'Overnight Oats', kategorie: 'Frühstück', bezug: 'portion', portion: '1 Schale', kcal: 540, eiweiss_g: 50, kh_g: 58, fett_g: 9, ballaststoffe_g: 9, zutaten: [z('Haferflocken', '60 g'), z('Magerquark', '250 g'), z('Beeren', '100 g'), z('Chiasamen', '10 g')], notiz: 'Abends vorbereiten' },
    { id: 'demo-r2', name: 'Rührei mit Gemüse', kategorie: 'Frühstück', bezug: 'portion', portion: '1 Teller', kcal: 420, eiweiss_g: 30, kh_g: 8, fett_g: 28, zutaten: [z('Eier', '3 Stück'), z('Paprika', '100 g'), z('Spinat', '50 g')], notiz: '' },
    { id: 'demo-r3', name: 'Linsensalat', kategorie: 'Mittagessen', bezug: 'portion', portion: '1 Dose (400 g)', kcal: 480, eiweiss_g: 32, kh_g: 52, fett_g: 12, ballaststoffe_g: 14, zutaten: [z('Linsen gekocht', '250 g'), z('Feta', '50 g'), z('Gurke', '100 g')], notiz: '' },
    { id: 'demo-r4', name: 'Chili sin Carne', kategorie: 'Abendessen', bezug: '100g', portion: '', kcal: 72, eiweiss_g: 7.3, kh_g: 6.6, fett_g: 1.6, ballaststoffe_g: 2.3, salz_g: 0.35, zutaten: [], notiz: 'Ganzer Topf ca. 2 kg' },
    { id: 'demo-r5', name: 'Eiweiß-Shake', kategorie: 'Snacks', bezug: 'portion', portion: '300 ml', kcal: 116, eiweiss_g: 22, kh_g: 2.4, fett_g: 1.8, zutaten: [z('Whey', '30 g'), z('Wasser', '300 ml')], notiz: 'Nachmittags' },
  ];
  return { tage, trainings, messungen, blutwerte, ziele, einstellungen: e, checkins: {}, rezepte };
}
