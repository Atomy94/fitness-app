// Erstbefüllung: wandelt die Datei health-data.json in den App-Stand um.
// Die Datei selbst liegt nie im Repository; hier steht nur die Übersetzung der Struktur.

import { istDatum, plusTage } from './datum.js';
import { parseZahl } from './zahl.js';
import { standardZiele, setzeZiel } from './ziele.js';
import { standardEinstellungen, standardWochenplan, neueId } from './state.js';
import { rezepteAusArchiv } from './rezepte.js';

// Laborwerte: Schlüssel aus der Datei → [deutscher Name, Einheit]
const BLUT = {
  iron_ug_dl: ['Eisen', 'µg/dl'], uric_acid_mg_dl: ['Harnsäure', 'mg/dl'], glucose_mg_dl: ['Glukose', 'mg/dl'],
  hba1c_pct: ['HbA1c', '%'], hba1c_mmol_mol: ['HbA1c (IFCC)', 'mmol/mol'], hdl_mg_dl: ['HDL-Cholesterin', 'mg/dl'],
  ldl_mg_dl: ['LDL-Cholesterin', 'mg/dl'], ldl_hdl_ratio: ['LDL/HDL-Quotient', ''], tsh_uiu_ml: ['TSH', 'µIU/ml'],
  crp_mg_l: ['CRP', 'mg/l'], esr_mm_h: ['Blutsenkung', 'mm/h'], ggt_u_l: ['GGT', 'U/l'], got_u_l: ['GOT', 'U/l'],
  gpt_u_l: ['GPT', 'U/l'], ap_u_l: ['Alkalische Phosphatase', 'U/l'], ck_u_l: ['CK', 'U/l'],
  creatinine_mg_dl: ['Kreatinin', 'mg/dl'], egfr: ['eGFR', 'ml/min'], urea_mg_dl: ['Harnstoff', 'mg/dl'],
  bilirubin_mg_dl: ['Bilirubin', 'mg/dl'], sodium_mmol_l: ['Natrium', 'mmol/l'], potassium_mmol_l: ['Kalium', 'mmol/l'],
  calcium_mmol_l: ['Calcium', 'mmol/l'], leukocytes: ['Leukozyten', '/nl'], erythrocytes: ['Erythrozyten', '/pl'],
  hemoglobin_g_dl: ['Hämoglobin', 'g/dl'], hematocrit_pct: ['Hämatokrit', '%'], mcv_fl: ['MCV', 'fl'],
  mch_pg: ['MCH', 'pg'], rdw_pct: ['RDW', '%'],
};

/** "2 × 10" → 20 · "2 × 6-8" → 12 · 16 → 16 */
export function gewichtAusText(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = v.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)/);
  if (m) return Number(m[1]) * parseZahl(m[2]);
  return parseZahl(v);
}

function uebung(u) {
  const aus = { name: u.exercise, saetze: u.sets || 3, wdh: u.reps === undefined ? '' : String(u.reps), kg: gewichtAusText(u.load_kg) };
  if (typeof u.load_kg === 'string') aus.kg_text = u.load_kg;
  if (u.duration_s) aus.sek = u.duration_s;
  const notizen = [u.note, u.superset ? `Supersatz ${u.superset}` : null].filter(Boolean);
  if (notizen.length) aus.notiz = notizen.join(' · ');
  return aus;
}

function trainingAusLog(w) {
  const uebungen = (w.sets || []).map((s) => {
    const u = { name: s.exercise, saetze: [] };
    const notizen = [];
    if (Array.isArray(s.reps)) u.saetze = s.reps.map((wdh) => ({ wdh, kg: s.load_kg ?? 0 }));
    else if (typeof s.reps === 'string') notizen.push(s.reps);
    if (Array.isArray(s.duration_s)) u.saetze = s.duration_s.map((sek) => ({ sek }));
    if (s.duration_min) notizen.push(`${s.duration_min} Min.${s.level ? ', Stufe ' + s.level : ''}`);
    if (s.note) notizen.push(s.note);
    if (notizen.length) u.notiz = notizen.join(' · ');
    return u;
  });
  return { id: neueId(), typ: 'kraft', datum: w.date, einheit: w.workout, dauer_min: w.duration_min ?? null, verkuerzt: false, uebungen, notiz: '' };
}

/**
 * Ergebnis: { state, bericht: [Text] }. Wirft einen Fehler mit verständlicher Meldung,
 * wenn die Datei nicht wie eine health-data.json aussieht.
 */
export function ausHealthData(d, heuteIso) {
  if (!d || typeof d !== 'object' || (!d.daily_log && !d.goals && !d.training_plan)) {
    throw new Error('Das ist keine health-data.json (es fehlen die Bereiche goals, training_plan oder daily_log).');
  }
  const start = (d.goals && istDatum(d.goals.start_date) && d.goals.start_date) || heuteIso;

  // Schritte-Phasen: "weeks 1-2" beginnt am Starttag, "3-4" zwei Wochen später usw.
  const schritte = ((d.movement_targets && d.movement_targets.steps_per_day) || []).map((p) => {
    const ersteWoche = parseInt(String(p.weeks), 10) || 1;
    return [plusTage(start, (ersteWoche - 1) * 7), p.target];
  });
  const ziele = standardZiele(start, schritte.length ? schritte : null);
  const setze = (k, v) => { if (typeof v === 'number') setzeZiel(ziele, k, start, v); };
  const nt = d.nutrition_targets || {};
  if (nt.kcal) { setze('kcal_mo_sa_ziel', nt.kcal.mon_sat); setze('kcal_so_ziel', nt.kcal.sunday_with_football); }
  if (nt.protein_g) { setze('eiweiss_ziel', nt.protein_g.target); setze('eiweiss_min', nt.protein_g.min); }
  setze('ballaststoffe_min', nt.fiber_g_min);
  if (nt.fat_g) setze('ges_fett_max', nt.fat_g.saturated_max);
  const bauch = d.goals && d.goals.targets && d.goals.targets.waist_cm;
  if (bauch) { setze('bauch_start', bauch.start); setze('bauch_ziel', bauch.target); }

  const e = standardEinstellungen(start);
  e.eingerichtet = true;
  e.profil = d.profile || {};
  e.phasen = (d.goals && d.goals.phases) || [];
  e.supplements = (d.supplements || []).map((s) => ({
    name: s.name,
    info: [s.product, s.dose_g ? `${s.dose_g} g` : null, s.timing, s.status].filter(Boolean).join(' · '),
  }));
  e.eiweissUngenauBis = '2026-11-13';
  e.archiv = {
    meta: d.meta, nutrition_targets: nt, foods_per_100g: d.foods_per_100g, standard_meals: d.standard_meals,
    tools: d.tools, movement_targets: d.movement_targets, health_notizen: d.health && { doctor: d.health.doctor_visit_2026_11_12, observations: d.health.observations },
    fotos: d.measurements && d.measurements.photos, supplements: d.supplements,
  };

  // Minimalversion: beginnt automatisch mit Phase 2 und läuft, bis sie ausgeschaltet wird.
  const phase2 = e.phasen.find((p) => p.phase === 2 && istDatum(p.from));
  if (phase2) e.minimal.zeitraeume.push({ von: phase2.from, bis: istDatum(phase2.to) ? phase2.to : null });

  // Trainingsplan
  const tp = d.training_plan || {};
  const wp = standardWochenplan();
  const texte = tp.weekly_schedule || {};
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach((k, i) => { if (texte[k]) wp[i + 1].text = texte[k]; });
  e.plan.wochenplan = wp;
  if (tp.max_duration_min) e.plan.maxMinuten = tp.max_duration_min;
  e.plan.progression = tp.progression || '';
  if (tp.workouts) {
    const w = tp.workouts;
    const einheiten = {};
    if (w.A) einheiten['Kraft A'] = w.A.map(uebung);
    if (w.B) einheiten['Kraft B'] = w.B.map(uebung);
    const c = w.C || w.C_home_alternative;
    if (c) einheiten['Kraft C'] = c.map(uebung);
    if (Object.keys(einheiten).length) e.plan.einheiten = einheiten;
  }

  // Tageslog
  const tage = {};
  const trainings = [];
  const tag = (datum) => tage[datum] || (tage[datum] = { datum });
  for (const l of d.daily_log || []) {
    if (!istDatum(l.date)) continue;
    const t = tag(l.date);
    const nimm = (ziel, v) => { if (typeof v === 'number') t[ziel] = v; };
    nimm('kcal', l.kcal); nimm('eiweiss_g', l.protein); nimm('kh_g', l.carbs); nimm('fett_g', l.fat);
    nimm('ballaststoffe_g', l.fiber); nimm('ges_fett_g', l.sat_fat); nimm('zucker_g', l.sugar); nimm('salz_g', l.salt);
    nimm('schritte', l.steps);
    // Hinweis aus der Datei: Eiweißwerte bis 13.11.2026 sind 5–15 g zu niedrig.
    if (l.date <= e.eiweissUngenauBis && typeof l.protein === 'number') t.ungenau = true;
    if (l.treadmill && (l.treadmill.min || l.treadmill.km)) {
      trainings.push({ id: neueId(), typ: 'cardio', datum: l.date, art: 'Laufband', dauer_min: l.treadmill.min ?? null, km: l.treadmill.km ?? null });
    }
  }
  const mess = d.measurements || {};
  for (const g of mess.weight_daily || []) if (istDatum(g.date) && typeof g.kg === 'number') tag(g.date).gewicht_kg = g.kg;

  const geloggt = new Set();
  for (const w of d.workout_log || []) {
    if (!istDatum(w.date)) continue;
    trainings.push(trainingAusLog(w));
    geloggt.add(`${w.date}|${w.workout}`);
  }
  for (const l of d.daily_log || []) {
    if (l.training && istDatum(l.date) && !geloggt.has(`${l.date}|${l.training}`)) {
      trainings.push({ id: neueId(), typ: 'kraft', datum: l.date, einheit: l.training, dauer_min: null, verkuerzt: false, uebungen: [], notiz: '' });
    }
  }

  // Messwerte
  const messungen = [];
  for (const b of mess.waist || []) if (istDatum(b.date)) messungen.push({ id: neueId(), datum: b.date, quelle: 'Maßband', bauch_cm: b.cm });
  for (const t of mess.body_composition_tanita || []) {
    if (!istDatum(t.date)) continue;
    const m = { id: neueId(), datum: t.date, quelle: 'Tanita' };
    const map = { weight: 'gewicht_kg', fat_pct: 'koerperfett_pct', fat_mass: 'fettmasse_kg', fat_free_mass: 'fettfrei_kg', muscle_mass: 'muskelmasse_kg', visceral: 'viszeral', bmr: 'grundumsatz_kcal', trunk_fat_pct: 'rumpffett_pct' };
    for (const [von, nach] of Object.entries(map)) if (typeof t[von] === 'number') m[nach] = t[von];
    if (t.invalid) { m.ungueltig = true; m.grund = t.reason || ''; }
    messungen.push(m);
  }
  for (const k of mess.strength_tests || []) {
    if (!istDatum(k.date)) continue;
    let m = messungen.find((x) => x.datum === k.date && x.quelle === 'Krafttest');
    if (!m) { m = { id: neueId(), datum: k.date, quelle: 'Krafttest' }; messungen.push(m); }
    const wert = typeof k.value === 'number' ? k.value : parseInt(String(k.value), 10); // "15 / 5 / 4" → 15
    if (/liegest/i.test(k.test)) m.liegestuetze_max = wert;
    else if (/kniebeug/i.test(k.test)) m.kniebeugen_max = wert;
    if (typeof k.value === 'string') m.grund = `${k.test}: ${k.value}`;
  }

  // Blutwerte: Schlüssel wie "blood_test_2025_11_05"
  const blutwerte = [];
  for (const [key, werte] of Object.entries(d.health || {})) {
    const m = key.match(/^blood_test_(\d{4})_(\d{2})_(\d{2})$/);
    if (!m || !werte || typeof werte !== 'object') continue;
    const datum = `${m[1]}-${m[2]}-${m[3]}`;
    for (const [k, v] of Object.entries(werte)) {
      const [name, einheit] = BLUT[k] || [k, ''];
      const b = { id: neueId(), datum, name, einheit };
      const roh = v && typeof v === 'object' ? v.value : v;
      if (typeof roh === 'number') b.wert = roh;
      else if (typeof roh === 'string') { const n = parseZahl(roh); if (n !== null) b.wert = n; else b.wert_text = roh; }
      if (v && typeof v === 'object' && typeof v.range === 'string') {
        const r = v.range.match(/^\s*([\d.,]+)\s*-\s*([\d.,]+)\s*$/);
        if (r) { b.norm_min = parseZahl(r[1]); b.norm_max = parseZahl(r[2]); }
      }
      blutwerte.push(b);
    }
  }

  const rezepte = rezepteAusArchiv(e.archiv);
  const state = { tage, trainings, messungen, blutwerte, ziele, einstellungen: e, checkins: {}, rezepte };
  const ungenau = Object.values(tage).filter((t) => t.ungenau).length;
  const bericht = [
    `${Object.keys(tage).length} Tage`,
    `${trainings.filter((t) => t.typ === 'kraft').length} Krafteinheiten, ${trainings.filter((t) => t.typ === 'cardio').length} Cardio-Einheiten`,
    `${messungen.length} Messungen, ${blutwerte.length} Blutwerte`,
    `Trainingsplan mit ${Object.keys(e.plan.einheiten).length} Einheiten, ${ziele.length} Zielwerte`,
    `${rezepte.length} Rezepte`,
    ungenau ? `${ungenau} Tage als „Werte ungenau“ markiert (Eiweiß 5–15 g zu niedrig)` : null,
  ].filter(Boolean);
  return { state, bericht };
}
