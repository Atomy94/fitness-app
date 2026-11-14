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
  return { tage, trainings, messungen, blutwerte, ziele, einstellungen: e, checkins: {} };
}
