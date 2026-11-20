// Inhalte der Dateien, die die App für Claude in den Dropbox-Ordner legt:
//   stand.md                 aktueller Stand (letzte 8 Wochen im Detail, alle Wochen als Übersicht)
//   rezepte.md               alle Rezepte
//   LIESMICH-fuer-Claude.md  Anleitung: wie lesen, wie Einträge ablegen (Importformat)
//   sicherung/fitness-sicherung.json   vollständige Sicherung
// Claude legt neue Einträge als Datei in "eingang/" ab; die App holt sie ab.

import { ZIEL_INFO, zielWert, minimalAktiv } from './ziele.js';
import { wochenWertung, tagBewertung } from './bewertung.js';
import { tagWertung, wochenProzent } from './wertung.js';
import { SAMMLUNGEN } from './state.js';
import { KATEGORIEN, NAEHRWERTE } from './rezepte.js';
import { fmt } from './zahl.js';
import { de, montag, plusTage, kw, WT_LANG } from './datum.js';

export const ORDNER = { eingang: '/eingang', erledigt: '/erledigt', sicherung: '/sicherung' };
export const DATEI = { stand: '/stand.md', rezepte: '/rezepte.md', liesmich: '/LIESMICH-fuer-Claude.md', sicherung: '/sicherung/fitness-sicherung.json' };
export const LIESMICH_VERSION = 7;

const ohneId = ({ id, ...rest }) => rest;
const nachDatum = (a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0);

function wochenUebersicht(state, heuteIso, maxWochen) {
  const wochen = [];
  const start = state.einstellungen.start || heuteIso;
  for (let mo = montag(heuteIso), i = 0; mo >= montag(start) && i < maxWochen; mo = plusTage(mo, -7), i++) {
    const w = wochenWertung(state, mo, heuteIso);
    if (!w.hatDaten) continue;
    const gewichte = w.tage.map((t) => t.tag.gewicht_kg).filter((v) => typeof v === 'number');
    wochen.push({
      kw: kw(mo), montag: mo, ernaehrung: `${w.ernaehrung.x}/7`, training: `${w.training.x}/${w.training.von}`, schritte: `${w.schritte.x}/7`,
      schritte_schnitt: w.schritteSchnitt === null ? null : Math.round(w.schritteSchnitt),
      kcal_schnitt: w.kcalSchnitt === null ? null : Math.round(w.kcalSchnitt), kcal_schnitt_status: w.kcalSchnittStatus,
      wertung_pct: (() => { const p = wochenProzent(state, mo, heuteIso); return p.prozent === null ? null : Math.round(p.prozent); })(),
      gewicht_schnitt_kg: gewichte.length ? Math.round((gewichte.reduce((a, b) => a + b, 0) / gewichte.length) * 100) / 100 : null,
    });
  }
  return wochen;
}

/** Daten für Claude. tageZahl = 0 bedeutet: alle Tage und Trainings. */
export function exportDaten(state, heuteIso, tageZahl) {
  const ab = tageZahl ? plusTage(heuteIso, -(tageZahl - 1)) : '0000-00-00';
  const e = state.einstellungen;
  return {
    erstellt: heuteIso, zeitraum: { von: tageZahl ? ab : 'alles', bis: heuteIso },
    minimalversion_heute: minimalAktiv(e, heuteIso),
    minimalversion_zeitraeume: e.minimal.zeitraeume,
    ziele_heute: Object.fromEntries(Object.keys(ZIEL_INFO).map((k) => [k, zielWert(state.ziele, k, heuteIso)])),
    ziel_aenderungen: state.ziele.filter((z) => z.gueltig_ab !== e.start).map(({ schluessel, gueltig_ab, wert }) => ({ schluessel, gueltig_ab, wert })),
    wochenplan: Object.fromEntries(Object.entries(e.plan.wochenplan).map(([wt, p]) => [WT_LANG[wt - 1], p.text || p.typ])),
    einheiten_plan: e.plan.einheiten,
    wochenwertungen: wochenUebersicht(state, heuteIso, tageZahl ? 60 : 500),
    tage: Object.values(state.tage).filter((t) => t.datum >= ab).sort(nachDatum).map((t) => {
      const b = tagBewertung(state, t.datum, heuteIso);
      const w = tagWertung(state, t.datum, heuteIso);
      return { ...t, status: { ernaehrung: b.ernaehrung, training: b.training, schritte: b.schritte }, wertung_pct: w.prozent === null ? null : Math.round(w.prozent) };
    }),
    trainings: state.trainings.filter((t) => t.datum >= ab).sort(nachDatum).map(ohneId),
    messungen: [...state.messungen].sort(nachDatum).map(ohneId),
    blutwerte: [...state.blutwerte].sort(nachDatum).map(ohneId),
    supplements: e.supplements || [],
    snacks: e.snacks || [],
  };
}

/** Block für die Zwischenablage (Mehr → Daten → Export). */
export function exportText(state, heuteIso, tageZahl) {
  const daten = exportDaten(state, heuteIso, tageZahl);
  daten.rezepte = (state.rezepte || []).map(ohneId);
  return `FITNESS-EXPORT v1 (aus der Fitness-App, ${de(heuteIso)})\n${JSON.stringify(daten)}`;
}

export function standDatei(state, heuteIso, zeitText, version) {
  const b = tagBewertung(state, heuteIso, heuteIso);
  const w = wochenWertung(state, montag(heuteIso), heuteIso);
  const t = b.tag;
  const z = (v, einheit = '') => (v === undefined || v === null ? '–' : `${fmt(v, 1)}${einheit}`);
  return [
    '# Fitness-App: aktueller Stand',
    '',
    `Erzeugt am ${de(heuteIso)} um ${zeitText} Uhr von der App (Version ${version}). Diese Datei wird bei jedem Abgleich überschrieben.`,
    'Regeln und das Format zum Hinzufügen von Daten stehen in `LIESMICH-fuer-Claude.md`.',
    '',
    `## Heute (${de(heuteIso)})`,
    '',
    `- Kalorien: ${z(t.kcal, ' kcal')} (Ziel ${fmt(b.ziele.kcal.ziel)}, grün ${fmt(b.ziele.kcal.min)}–${fmt(b.ziele.kcal.max)}) → ${b.kcal}`,
    `- Eiweiß: ${z(t.eiweiss_g, ' g')} (grün ab ${fmt(b.ziele.eiweiss.min)}) → ${b.eiweiss}`,
    `- Schritte: ${z(t.schritte)} (Ziel ${fmt(b.ziele.schritte.ziel)}) → ${b.schritte}`,
    `- Training: ${b.plan ? b.plan.text || b.plan.typ : 'kein Trainingsziel'} → ${b.training}${b.einheiten.length ? ` (${b.einheiten.map((e) => (e.typ === 'kraft' ? e.einheit : `${e.art} ${e.dauer_min || ''} Min.`)).join(', ')})` : ''}`,
    `- Gewicht: ${z(t.gewicht_kg, ' kg')} · Minimalversion: ${b.minimal ? 'aktiv' : 'nicht aktiv'}`,
    `- Schlaf letzte Nacht: ${z(t.schlaf_h, ' Std.')}${t.ruhepuls ? ` · Ruhepuls ${t.ruhepuls}` : ''}${t.hrv_ms ? ` · HRV ${fmt(t.hrv_ms)} ms` : ''} · Stress: ${t.stress ? `${t.stress}/10` : '–'}`,
    '',
    `## Laufende Woche (KW ${kw(heuteIso)})`,
    '',
    `- Ernährung ${w.ernaehrung.x} von 7 Tagen · Training ${w.training.x} von ${w.training.von} Plantagen · Schritte ${w.schritte.x} von 7 Tagen`,
    `- Schritte Ø ${z(w.schritteSchnitt === null ? null : Math.round(w.schritteSchnitt))} · Kalorien Ø ${z(w.kcalSchnitt === null ? null : Math.round(w.kcalSchnitt))} (${w.kcalSchnittStatus})`,
    '',
    '## Daten',
    '',
    'Tage und Trainings der letzten 8 Wochen im Detail, alle Wochen als Übersicht (`wochenwertungen`), dazu alle Messungen und Blutwerte.',
    'Statuswerte: gruen = geschafft, gelb = knapp daneben, rot = verfehlt, grau = trifft nicht zu, leer = keine Daten, offen = heute noch nicht erledigt.',
    'Ältere Einzeltage stehen in `sicherung/fitness-sicherung.json`.',
    '',
    '```json',
    JSON.stringify(exportDaten(state, heuteIso, 56)),
    '```',
    '',
  ].join('\n');
}

export function rezepteDatei(state, heuteIso) {
  const zeilen = ['# Fitness-App: Rezepte', '', `Stand ${de(heuteIso)}. Wird bei jedem Abgleich überschrieben. Neue oder geänderte Rezepte bitte als Import-Eintrag vom Typ \`rezept\` ablegen (siehe LIESMICH).`, ''];
  for (const k of KATEGORIEN) {
    const liste = (state.rezepte || []).filter((r) => r.kategorie === k).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    zeilen.push(`## ${k}`, '');
    if (!liste.length) zeilen.push('(keine)', '');
    for (const r of liste) {
      zeilen.push(`### ${r.name}`, '');
      const werte = NAEHRWERTE.filter(([f]) => typeof r[f] === 'number').map(([f, name, einheit, st]) => `${name} ${fmt(r[f], st)} ${einheit}`);
      zeilen.push(`Nährwerte ${r.bezug === '100g' ? 'pro 100 g' : `pro Portion${r.portion ? ` (${r.portion})` : ''}`}: ${werte.join(' · ') || 'keine Angaben'}`);
      if (r.zutaten && r.zutaten.length) zeilen.push('', ...r.zutaten.map((z) => `- ${z.menge ? z.menge + ' ' : ''}${z.name}`));
      if (r.notiz) zeilen.push('', `Notiz: ${r.notiz}`);
      zeilen.push('');
    }
  }
  return zeilen.join('\n');
}

export function sicherungText(state, erstelltIso) {
  const daten = {};
  for (const s of SAMMLUNGEN) daten[s] = state[s];
  return JSON.stringify({ format: 'fitness-sicherung', version: 1, erstellt: erstelltIso, daten }, null, 1);
}

/** Anleitung für Claude. Ändert sich der Text, LIESMICH_VERSION erhöhen (dann lädt die App ihn neu hoch). */
export function liesmichDatei() {
  const ziele = Object.entries(ZIEL_INFO).map(([k, i]) => `- \`${k}\` – ${i.gruppe}: ${i.name} (${i.einheit})`).join('\n');
  return `# Anleitung für Claude: Fitness-App

Dieser Ordner ist die Schnittstelle zwischen dir (Claude) und der Fitness-App des Nutzers.
Die App läuft auf seinem iPhone und gleicht diesen Ordner ab, sobald sie geöffnet wird.

## Dateien

| Datei | Inhalt | Wer schreibt |
|---|---|---|
| \`stand.md\` | Aktueller Stand: heute, laufende Woche, Daten der letzten 8 Wochen als JSON | App (überschreibt) |
| \`rezepte.md\` | Alle Rezepte mit Mengen und Nährwerten | App (überschreibt) |
| \`sicherung/fitness-sicherung.json\` | Vollständige Sicherung aller Daten | App (überschreibt) |
| \`eingang/\` | Neue Einträge von dir | **Du** (neue Datei anlegen) |
| \`erledigt/\` | Von der App verarbeitete Einträge | App (verschiebt) |
| \`fotos/\` | Private Fortschrittsfotos (JPG). **Nur öffnen, wenn der Nutzer ausdrücklich darum bittet; nie verändern, verschieben oder löschen.** | App |

## Daten lesen

Lies \`stand.md\`. Die Zeile „Erzeugt am …“ zeigt, wie aktuell der Stand ist. Ist er älter als erwartet, bitte den Nutzer, die App kurz zu öffnen.
Für Rezepte lies \`rezepte.md\`. Die Sicherung brauchst du nur für Fragen zu Tagen, die länger als 8 Wochen zurückliegen.

## Daten hinzufügen oder ändern

Ändere **nie** \`stand.md\`, \`rezepte.md\` oder die Sicherung – die App überschreibt sie.
Lege stattdessen **eine neue Textdatei** im Ordner \`eingang/\` an, z. B. \`eingang/import-2026-11-15-1930.md\`.
Der Dateiinhalt ist genau ein Block in diesem Format (kein weiterer Text davor oder danach):

\`\`\`
FITNESS-IMPORT v1
{
  "eintraege": [
    { "typ": "tag", "datum": "2026-11-14", "kcal": 2078, "eiweiss_g": 172, "kh_g": 206, "fett_g": 54, "ballaststoffe_g": 28.5, "ges_fett_g": 22.1, "salz_g": 6.2, "schritte": 6900, "gewicht_kg": 93.4, "schlaf_h": 7.5, "schlaf_qualitaet": 4, "stress": 5, "kreatin": true, "fussball": null, "notiz": "..." },
    { "typ": "training", "datum": "2026-11-14", "einheit": "Kraft C", "dauer_min": 35, "verkuerzt": false, "uebungen": [ { "name": "Liegestütze", "saetze": [ { "wdh": 10, "kg": 0 }, { "wdh": 10, "kg": 0 } ], "notiz": "..." } ] },
    { "typ": "cardio", "datum": "2026-11-14", "art": "Laufband", "dauer_min": 26, "km": 2.85 },
    { "typ": "messung", "datum": "2026-11-15", "bauch_cm": 101, "quelle": "Maßband" },
    { "typ": "ziel", "gueltig_ab": "2026-12-07", "schluessel": "kcal_mo_sa_min", "wert": 2350 },
    { "typ": "blutwert", "datum": "2026-11-12", "name": "Ferritin", "wert": 250, "einheit": "ng/ml", "norm_min": 30, "norm_max": 400 },
    { "typ": "rezept", "name": "Linsensuppe", "kategorie": "Mittagessen", "bezug": "100g", "kcal": 85, "eiweiss_g": 5.2, "zutaten": [ { "name": "Rote Linsen", "menge": "300 g" } ] },
    { "typ": "einheit", "name": "Kraft A", "uebungen": [ { "name": "Liegestütze", "saetze": 3, "wdh": "8-12", "kg": 0, "pause_sek": 60, "notiz": "2 Wdh. Reserve", "schwer": { "name": "Liegestütze Füße erhöht", "wdh": "6-10", "notiz": "Füße auf einem Stuhl" } }, { "name": "Seitstütz", "saetze": 2, "sek": 40, "pause_sek": 30 } ] },
    { "typ": "plantag", "wochentag": "Sa", "art": "bonus", "einheit": "Kraft C", "text": "Kraft C oder Studio (Bonus)", "wahl": [ { "text": "Alleine", "einheit": "Kraft C" }, { "text": "Im Studio", "einheit": "Studio" } ], "gueltig_ab": "2026-11-21" }
  ]
}
\`\`\`

Der Nutzer sieht beim nächsten Öffnen der App eine Vorschau (alter Wert → neuer Wert) und bestätigt mit „Übernehmen“. Erst dann sind die Daten gespeichert und erscheinen nach dem nächsten Abgleich in \`stand.md\`. Sag ihm das, nachdem du eine Datei abgelegt hast.

### Regeln

- Pflicht sind nur \`typ\` und \`datum\` (JJJJ-MM-TT). Ausnahmen: \`ziel\` braucht \`gueltig_ab\`, \`schluessel\`, \`wert\`; \`rezept\` und \`einheit\` brauchen \`name\` und haben kein Datum; \`plantag\` braucht \`wochentag\` und hat kein Datum; \`training\` braucht \`einheit\`, \`cardio\` braucht \`art\`, \`blutwert\` braucht \`name\`.
- Nur Felder angeben, die du wirklich kennst. Fehlende Felder und \`null\` lassen vorhandene Werte unverändert. Nichts schätzen oder erfinden.
- Zahlen mit Punkt (93.4). Ein einziger ungültiger Eintrag führt dazu, dass die App die ganze Datei ablehnt.
- Unbekannte Felder werden ignoriert. Unbekannte Typen sind ein Fehler.

### Felder je Typ

- **tag**: kcal, eiweiss_g, kh_g, fett_g, ballaststoffe_g, ges_fett_g, zucker_g, salz_g, schritte (ganze Zahl), gewicht_kg, bauch_cm, schlaf_h (Gesamtschlaf der Nacht, die am Morgen dieses Tages endet), schlaf_qualitaet (1–5, alt), stress (1–10), ab 1.17 optional: schlaf_tief_min, schlaf_rem_min, schlaf_leicht_min, schlaf_wach_min (Minuten je Schlafphase), einschlafen, aufwachen ("HH:MM"), ruhepuls (Schläge/Min.), hrv_ms, kreatin (true/false), fussball (true/false: hat am Fußballtag Fußball stattgefunden), ungenau (true/false), notiz
- **training** (Krafteinheit): einheit (z. B. „Kraft A“, „Kraft B“, „Kraft C“), dauer_min, verkuerzt (true/false), uebungen [ { name, saetze [ { wdh, kg, sek } ], notiz } ], notiz. Optional (ab 1.16, Check vor dem Training, je 1–5, 5 = gut): check_muskelkater, check_schlaf, check_energie, check_regionen (Liste aus „Oberkörper“, „Beine“, „Rumpf“), check_vorschlag (normal, leicht, reduziert, ersatz), check_angenommen (true/false), ersetzt (true = Kraft durch Spaziergang/Laufband ersetzt, zählt wie verkürzt). Gleiches Datum und gleiche Einheit **ersetzt** die vorhandene Einheit (der Nutzer wird gefragt).
- **cardio**: art („Laufband“, „Hallenfußball“, „Spaziergang“ werden ausgewertet), dauer_min, km, notiz
- **messung**: bauch_cm, koerperfett_pct, gewicht_kg, muskelmasse_kg, fettmasse_kg, fettfrei_kg, viszeral, grundumsatz_kcal, liegestuetze_max, kniebeugen_max, quelle („Maßband“, „Tanita“, „Krafttest“), ungueltig, grund
- **blutwert**: name, wert, wert_text, einheit, norm_min, norm_max
- **rezept**: name, kategorie (${KATEGORIEN.join(' / ')}), bezug („portion“ oder „100g“), portion, zutaten [ { name, menge } ], kcal, eiweiss_g, kh_g, fett_g, ges_fett_g, zucker_g, ballaststoffe_g, salz_g, notiz. Gleicher Name ergänzt das vorhandene Rezept.
- **einheit** (Trainingsplan, kein Datum): name (z. B. „Kraft A“) und uebungen [ { name, saetze, wdh (Zahl oder Text wie „8-12“), kg (Startgewicht), sek (bei Halteübungen statt wdh), pause_sek (vorgeschriebene Pause nach jedem Satz), notiz, schwer } ]. \`schwer\` ist optional die anspruchsvollere Version derselben Übung: { name (Pflicht), wdh, kg, sek, saetze, pause_sek, notiz }; was dort fehlt, übernimmt die App von der einfachen Version. Der Nutzer wählt vor dem Training per Knopf zwischen einfacher und anspruchsvoller Version. **Ersetzt die komplette Übungsliste** dieser Einheit; die Reihenfolge zählt (in der Minimalversion werden nur die ersten Übungen gemacht). Den aktuellen Plan findest du in \`stand.md\` unter \`einheiten_plan\`. Nur auf ausdrücklichen Wunsch des Nutzers ändern.
- **plantag** (Wochenplan, kein Datum): wochentag (Pflicht: 1–7 oder Mo…So), art (kraft = Pflicht, bonus, laufband, fussball, frei), einheit (bei kraft/bonus), minuten (bei laufband), text (Anzeigetext), wahl [ { text, einheit } ] (2–4 Möglichkeiten: die App fragt beim Start, welche Einheit es wird; leere Liste entfernt die Auswahl), gueltig_ab (ab diesem Datum; frühere Tage werden weiter nach dem alten Plan bewertet). Nur gelieferte Felder ändern sich. Einheiten, auf die verwiesen wird, müssen im Plan vorhanden sein oder im selben Block als \`einheit\` davor stehen. Nur auf ausdrücklichen Wunsch des Nutzers ändern.
- **ziel**: gilt ab \`gueltig_ab\`; frühere Tage behalten den alten Wert. Erlaubte Schlüssel:

${ziele}

## Bewertung in der App (zum Verständnis)

Drei Bereiche werden getrennt bewertet: Ernährung (Kalorien-Korridor und Eiweiß), Training (nur an Plantagen), Schritte. Es gibt bewusst keinen Gesamtwert. Hauptkennzahl ist der Bauchumfang, beim Gewicht zählt der 7-Tage-Schnitt. Essen wird nicht in der App geloggt, die Tageswerte stammen aus Yazio.
`;
}
