import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leseImport, verarbeite, KOPF } from '../js/core/import.js';
import { zielWert } from '../js/core/ziele.js';
import { stand, kraft } from './hilfe.mjs';

const block = (eintraege) => `${KOPF}\n${JSON.stringify({ eintraege }, null, 2)}`;

// Das Beispiel aus der Vorgabe, unverändert.
const BEISPIEL = `FITNESS-IMPORT v1
{
  "eintraege": [
    { "typ": "tag", "datum": "2026-11-14", "kcal": 2078, "eiweiss_g": 172, "kh_g": 206, "fett_g": 54, "ballaststoffe_g": 28.5, "ges_fett_g": 22.1, "salz_g": 6.2, "schritte": 6900, "gewicht_kg": 93.4, "bauch_cm": null, "schlaf_h": 7.5, "schlaf_qualitaet": 4, "stress": 5, "kreatin": true, "fussball": null, "notiz": "..." },
    { "typ": "training", "datum": "2026-11-14", "einheit": "Kraft C", "dauer_min": 35, "verkuerzt": false, "uebungen": [ { "name": "Liegestütze", "saetze": [ { "wdh": 10, "kg": 0 }, { "wdh": 10, "kg": 0 } ], "notiz": "..." } ], "notiz": "..." },
    { "typ": "cardio", "datum": "2026-11-14", "art": "Laufband", "dauer_min": 26, "km": 2.85 },
    { "typ": "messung", "datum": "2026-11-15", "bauch_cm": 101, "koerperfett_pct": null, "quelle": "Maßband" },
    { "typ": "ziel", "gueltig_ab": "2026-12-07", "schluessel": "kcal_mo_sa_min", "wert": 2350 },
    { "typ": "blutwert", "datum": "2026-11-12", "name": "Ferritin", "wert": 250, "einheit": "ng/ml", "norm_min": 30, "norm_max": 400 }
  ]
}`;

test('gültig: das Beispiel aus der Vorgabe wird vollständig übernommen', () => {
  const r = leseImport(BEISPIEL);
  assert.equal(r.ok, true, r.fehler.join('\n'));
  assert.equal(r.eintraege.length, 6);
  const alt = stand();
  const { state, posten } = verarbeite(alt, r.eintraege);
  assert.ok(posten.every((p) => p.art === 'neu'));
  const t = state.tage['2026-11-14'];
  assert.equal(t.kcal, 2078);
  assert.equal(t.ballaststoffe_g, 28.5);
  assert.equal(t.kreatin, true);
  assert.equal(Object.hasOwn(t, 'fussball'), false); // null = nicht ändern
  assert.equal(Object.hasOwn(t, 'bauch_cm'), false);
  const tr = state.trainings.find((x) => x.typ === 'kraft');
  assert.equal(tr.einheit, 'Kraft C');
  assert.deepEqual(tr.uebungen[0].saetze, [{ wdh: 10, kg: 0 }, { wdh: 10, kg: 0 }]);
  const c = state.trainings.find((x) => x.typ === 'cardio');
  assert.equal(c.km, 2.85);
  assert.equal(state.messungen[0].bauch_cm, 101);
  assert.equal(state.messungen[0].quelle, 'Maßband');
  assert.equal(zielWert(state.ziele, 'kcal_mo_sa_min', '2026-12-06'), 2100);
  assert.equal(zielWert(state.ziele, 'kcal_mo_sa_min', '2026-12-07'), 2350);
  assert.equal(state.blutwerte[0].norm_max, 400);
  // Der ursprüngliche Stand bleibt unberührt (gespeichert wird erst nach "Übernehmen").
  assert.deepEqual(alt.tage, {});
  assert.equal(alt.trainings.length, 0);
});

test('gültig: Block in Code-Zäunen und mit Leerzeilen davor', () => {
  const r = leseImport('\n\n```\n' + BEISPIEL + '\n```\n');
  assert.equal(r.ok, true, r.fehler.join('\n'));
});

test('unvollständig: nur vorhandene Felder werden übernommen, der Rest bleibt', () => {
  const s = stand();
  s.tage['2026-11-14'] = { datum: '2026-11-14', kcal: 2000, eiweiss_g: 150, schritte: 5000, notiz: 'alt' };
  const r = leseImport(block([{ typ: 'tag', datum: '2026-11-14', kcal: 2078, schritte: null }]));
  assert.equal(r.ok, true);
  const { state, posten } = verarbeite(s, r.eintraege);
  assert.deepEqual(state.tage['2026-11-14'], { datum: '2026-11-14', kcal: 2078, eiweiss_g: 150, schritte: 5000, notiz: 'alt' });
  assert.equal(posten[0].art, 'aenderung');
  assert.deepEqual(posten[0].felder, [{ feld: 'kcal', alt: 2000, neu: 2078 }]); // Vorschau: alt → neu
});

test('unvollständig: Eintrag nur mit typ und datum ist erlaubt und ändert nichts', () => {
  const s = stand();
  s.tage['2026-11-14'] = { datum: '2026-11-14', kcal: 2000 };
  const r = leseImport(block([{ typ: 'tag', datum: '2026-11-14' }]));
  assert.equal(r.ok, true);
  const { state, posten } = verarbeite(s, r.eintraege);
  assert.equal(posten[0].art, 'gleich');
  assert.deepEqual(state.tage, s.tage);
});

test('Vorschau unterscheidet neu, geändert und unverändert', () => {
  const s = stand();
  s.tage['2026-11-13'] = { datum: '2026-11-13', kcal: 2101 };
  const r = leseImport(block([
    { typ: 'tag', datum: '2026-11-12', kcal: 2163 },
    { typ: 'tag', datum: '2026-11-13', kcal: 2101 },
    { typ: 'tag', datum: '2026-11-13', kcal: 2150 },
  ]));
  const { posten } = verarbeite(s, r.eintraege);
  assert.deepEqual(posten.map((p) => p.art), ['neu', 'gleich', 'aenderung']);
  assert.deepEqual(posten[0].felder, [{ feld: 'kcal', alt: null, neu: 2163 }]);
});

test('bauch_cm im Tag landet bei den Messungen', () => {
  const r = leseImport(block([{ typ: 'tag', datum: '2026-11-15', bauch_cm: 101.5 }]));
  const { state } = verarbeite(stand(), r.eintraege);
  assert.equal(state.messungen.length, 1);
  assert.equal(state.messungen[0].bauch_cm, 101.5);
  assert.equal(state.tage['2026-11-15'].bauch_cm, undefined);
});

test('Training mit gleichem Datum und gleicher Einheit: Rückfrage, dann ersetzen oder überspringen', () => {
  const s = stand();
  s.trainings.push(kraft('2026-11-14', 'Kraft C', { id: 'alt', uebungen: [{ name: 'Alt', saetze: [] }] }));
  const r = leseImport(block([{ typ: 'training', datum: '2026-11-14', einheit: 'Kraft C', uebungen: [{ name: 'Neu', saetze: [{ wdh: 8, kg: 10 }] }] }]));
  let e = verarbeite(s, r.eintraege);
  assert.equal(e.posten[0].rueckfrage, true);
  assert.equal(e.posten[0].art, 'ersetzt');
  assert.equal(e.state.trainings.length, 1);
  assert.equal(e.state.trainings[0].uebungen[0].name, 'Neu');
  assert.equal(e.state.trainings[0].id, 'alt');
  e = verarbeite(s, r.eintraege, { ersetzen: { 0: false } });
  assert.equal(e.posten[0].art, 'uebersprungen');
  assert.equal(e.state.trainings[0].uebungen[0].name, 'Alt');
  // andere Einheit am selben Tag ist ein neuer Eintrag
  const r2 = leseImport(block([{ typ: 'training', datum: '2026-11-14', einheit: 'Kraft A' }]));
  e = verarbeite(s, r2.eintraege);
  assert.equal(e.posten[0].rueckfrage, false);
  assert.equal(e.state.trainings.length, 2);
});

test('Cardio und Blutwert mit gleichem Schlüssel werden ergänzt statt verdoppelt', () => {
  let s = stand();
  s = verarbeite(s, leseImport(block([{ typ: 'cardio', datum: '2026-11-14', art: 'Laufband', dauer_min: 26 }, { typ: 'blutwert', datum: '2026-11-12', name: 'Ferritin', wert: 250 }])).eintraege).state;
  const e = verarbeite(s, leseImport(block([{ typ: 'cardio', datum: '2026-11-14', art: 'Laufband', km: 2.85 }, { typ: 'blutwert', datum: '2026-11-12', name: 'Ferritin', einheit: 'ng/ml' }])).eintraege);
  assert.equal(e.state.trainings.length, 1);
  assert.equal(e.state.trainings[0].dauer_min, 26);
  assert.equal(e.state.trainings[0].km, 2.85);
  assert.equal(e.state.blutwerte.length, 1);
  assert.equal(e.state.blutwerte[0].wert, 250);
  assert.equal(e.state.blutwerte[0].einheit, 'ng/ml');
});

test('unbekannte Felder werden ignoriert und als Hinweis gemeldet', () => {
  const r = leseImport(block([{ typ: 'tag', datum: '2026-11-14', kcal: 2078, laune: 'gut', wasser_l: 3 }]));
  assert.equal(r.ok, true);
  assert.equal(r.hinweise.length, 1);
  assert.match(r.hinweise[0], /laune, wasser_l/);
  const { state } = verarbeite(stand(), r.eintraege);
  assert.deepEqual(state.tage['2026-11-14'], { datum: '2026-11-14', kcal: 2078 });
});

test('Zahlen als Text mit Komma werden akzeptiert', () => {
  const r = leseImport(block([{ typ: 'tag', datum: '2026-11-14', gewicht_kg: '93,4' }]));
  assert.equal(r.ok, true);
  assert.equal(r.eintraege[0].gewicht_kg, 93.4);
});

test('als ungenau markierter Tag: neuer Eiweißwert entfernt die Markierung', () => {
  const s = stand();
  s.tage['2026-11-12'] = { datum: '2026-11-12', eiweiss_g: 184, ungenau: true };
  let e = verarbeite(s, leseImport(block([{ typ: 'tag', datum: '2026-11-12', kcal: 2163 }])).eintraege);
  assert.equal(e.state.tage['2026-11-12'].ungenau, true);
  e = verarbeite(s, leseImport(block([{ typ: 'tag', datum: '2026-11-12', eiweiss_g: 195 }])).eintraege);
  assert.equal(e.state.tage['2026-11-12'].ungenau, false);
});

const fehlerhaft = [
  ['leerer Text', '', /leer/],
  ['falsche Kopfzeile', '{"eintraege": []}', /FITNESS-IMPORT v1/],
  ['falsche Version', 'FITNESS-IMPORT v2\n{"eintraege": []}', /FITNESS-IMPORT v1/],
  ['abgeschnittenes JSON', 'FITNESS-IMPORT v1\n{ "eintraege": [ { "typ": "tag", "datum": "2026-11-14", "kcal": 20', /nicht lesbar/],
  ['eintraege fehlt', 'FITNESS-IMPORT v1\n{ "tage": [] }', /eintraege/],
  ['eintraege leer', block([]), /leer/],
  ['unbekannter Typ', block([{ typ: 'essen', datum: '2026-11-14' }]), /unbekannter Typ/],
  ['Typ fehlt', block([{ datum: '2026-11-14', kcal: 2000 }]), /unbekannter Typ/],
  ['Datum fehlt', block([{ typ: 'tag', kcal: 2000 }]), /Datum/],
  ['Datum im deutschen Format', block([{ typ: 'tag', datum: '14.11.2026', kcal: 2000 }]), /Datum/],
  ['Datum gibt es nicht', block([{ typ: 'tag', datum: '2026-02-30', kcal: 2000 }]), /Datum/],
  ['Text statt Zahl', block([{ typ: 'tag', datum: '2026-11-14', kcal: 'viel' }]), /Zahl/],
  ['Wert außerhalb des Bereichs', block([{ typ: 'tag', datum: '2026-11-14', stress: 11 }]), /außerhalb/],
  ['Kommazahl bei ganzer Zahl', block([{ typ: 'tag', datum: '2026-11-14', schlaf_qualitaet: 3.5 }]), /ganze Zahl/],
  ['Text statt ja/nein', block([{ typ: 'tag', datum: '2026-11-14', kreatin: 'ja' }]), /true oder false/],
  ['Training ohne Einheit', block([{ typ: 'training', datum: '2026-11-14' }]), /Pflichtfeld "einheit"/],
  ['Übung ohne Name', block([{ typ: 'training', datum: '2026-11-14', einheit: 'Kraft A', uebungen: [{ saetze: [] }] }]), /name/],
  ['Satz mit Text', block([{ typ: 'training', datum: '2026-11-14', einheit: 'Kraft A', uebungen: [{ name: 'X', saetze: [{ wdh: 'zehn' }] }] }]), /Zahl/],
  ['Cardio ohne Art', block([{ typ: 'cardio', datum: '2026-11-14', dauer_min: 20 }]), /Pflichtfeld "art"/],
  ['Ziel mit unbekanntem Schlüssel', block([{ typ: 'ziel', gueltig_ab: '2026-12-07', schluessel: 'kcal_irgendwas', wert: 1 }]), /unbekannter Ziel-Schlüssel/],
  ['Ziel ohne Wert', block([{ typ: 'ziel', gueltig_ab: '2026-12-07', schluessel: 'kcal_mo_sa_min' }]), /Pflichtfeld "wert"/],
  ['Ziel ohne Datum', block([{ typ: 'ziel', schluessel: 'kcal_mo_sa_min', wert: 2300 }]), /gueltig_ab/],
  ['Blutwert ohne Name', block([{ typ: 'blutwert', datum: '2026-11-12', wert: 5 }]), /Pflichtfeld "name"/],
];

for (const [name, text, muster] of fehlerhaft) {
  test(`fehlerhaft: ${name} → abgelehnt mit verständlicher Meldung`, () => {
    const r = leseImport(text);
    assert.equal(r.ok, false);
    assert.equal(r.eintraege.length, 0); // nichts wird übernommen
    assert.ok(r.fehler.length >= 1);
    assert.match(r.fehler.join(' | '), muster);
  });
}

test('fehlerhaft: ein einziger falscher Eintrag verwirft den ganzen Block', () => {
  const r = leseImport(block([{ typ: 'tag', datum: '2026-11-14', kcal: 2078 }, { typ: 'tag', datum: '2026-11-15', kcal: -5 }]));
  assert.equal(r.ok, false);
  assert.equal(r.eintraege.length, 0);
  assert.match(r.fehler[0], /Eintrag 2/);
});

test('Plan-Einheit: ersetzt die Übungsliste, mit Pause je Übung, Vorschau zeigt alt → neu', () => {
  const s = stand();
  const r = leseImport(block([{ typ: 'einheit', name: 'Kraft A', uebungen: [
    { name: 'Liegestütze', saetze: 3, wdh: '8-12', kg: 0, pause_sek: 15, notiz: 'Supersatz 1a' },
    { name: 'Einarmiges Rudern', saetze: 3, wdh: 10, kg: '16,5', pause_sek: 75 },
    { name: 'Seitstütz', sek: 40 },
  ] }]));
  assert.equal(r.ok, true, r.fehler.join(' | '));
  let e = verarbeite(s, r.eintraege);
  assert.equal(e.posten[0].art, 'ersetzt');
  assert.match(e.posten[0].felder[0].alt, /Schulterdrücken/);
  assert.ok(e.posten[0].felder[0].neu.includes('Einarmiges Rudern (3 × 10, 16,5 kg, Pause 75 Sek.)'));
  assert.deepEqual(e.state.einstellungen.plan.einheiten['Kraft A'], [
    { name: 'Liegestütze', saetze: 3, wdh: '8-12', kg: 0, pause_sek: 15, notiz: 'Supersatz 1a' },
    { name: 'Einarmiges Rudern', saetze: 3, wdh: '10', kg: 16.5, pause_sek: 75 },
    { name: 'Seitstütz', saetze: 3, wdh: '', kg: null, sek: 40 },
  ]);
  assert.equal(s.einstellungen.plan.einheiten['Kraft A'].length, 5); // Original unberührt
  assert.ok(e.state.einstellungen.plan.einheiten['Kraft B']); // andere Einheiten bleiben
  // gleicher Inhalt noch einmal: unverändert
  assert.equal(verarbeite(e.state, r.eintraege).posten[0].art, 'gleich');
  // neue Einheit anlegen
  e = verarbeite(s, leseImport(block([{ typ: 'einheit', name: 'Kraft D', uebungen: [{ name: 'Kniebeuge', wdh: 15 }] }])).eintraege);
  assert.equal(e.posten[0].art, 'neu');
  assert.equal(e.state.einstellungen.plan.einheiten['Kraft D'][0].saetze, 3);
});

for (const [name, eintrag, muster] of [
  ['ohne Name', { typ: 'einheit', uebungen: [{ name: 'X' }] }, /Pflichtfeld "name"/],
  ['ohne Übungen', { typ: 'einheit', name: 'Kraft A' }, /Pflichtfeld "uebungen"/],
  ['leere Übungsliste', { typ: 'einheit', name: 'Kraft A', uebungen: [] }, /mindestens einer Übung/],
  ['Übung ohne Name', { typ: 'einheit', name: 'Kraft A', uebungen: [{ saetze: 3 }] }, /braucht einen "name"/],
  ['Pause zu lang', { typ: 'einheit', name: 'Kraft A', uebungen: [{ name: 'X', pause_sek: 5000 }] }, /außerhalb/],
  ['Sätze als Text', { typ: 'einheit', name: 'Kraft A', uebungen: [{ name: 'X', saetze: 'drei' }] }, /Zahl/],
]) {
  test(`fehlerhaft: Plan-Einheit ${name} → abgelehnt`, () => {
    const r = leseImport(block([eintrag]));
    assert.equal(r.ok, false);
    assert.match(r.fehler.join(' | '), muster);
  });
}
