import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istAutoDatei, autoDatum, erledigtName, verarbeiteEingang, verschiebeNachErledigt, erledigtNamen } from '../js/core/eingang.js';
import { leseImport, verarbeite, KOPF } from '../js/core/import.js';
import { stand } from './hilfe.mjs';

const block = (eintraege) => `${KOPF}\n${JSON.stringify({ eintraege })}`;
const tag = (datum, werte) => block([{ typ: 'tag', datum, ...werte }]);
const JETZT = new Date('2026-11-16T19:46:30Z'); // 20:46:30 Uhr in Berlin

// Nachgebaute Dropbox: Dateien im Speicher. Verschieben auf einen vorhandenen Namen schlägt fehl,
// damit ein Namenskonflikt im Test auffällt.
function falscheBox(eingang = {}, erledigt = {}) {
  const dateien = {};
  for (const [name, d] of Object.entries(eingang)) dateien[`/eingang/${name}`] = d;
  for (const [name, d] of Object.entries(erledigt)) dateien[`/erledigt/${name}`] = d;
  const geladen = [];
  return {
    dateien, geladen,
    namen: (ordner) => Object.keys(dateien).filter((p) => p.startsWith(`/${ordner}/`)).map((p) => p.split('/').pop()).sort(),
    async liste(ordner) {
      return Object.keys(dateien).filter((p) => p.startsWith(`${ordner}/`)).map((p) => ({ name: p.split('/').pop(), pfad: p, groesse: dateien[p].text.length, geaendert: dateien[p].zeit }));
    },
    async herunterladen(pfad) { geladen.push(pfad); return dateien[pfad].text; },
    async verschiebe(von, nach) {
      if (Object.keys(dateien).some((p) => p.toLowerCase() === nach.toLowerCase())) throw new Error(`Namenskonflikt: ${nach}`);
      dateien[nach] = dateien[von];
      delete dateien[von];
    },
  };
}

const NORMAL = 'import-auto-2026-11-16.txt';
const ZWEI = 'import-auto-2026-11-16-2.txt';
const KONFLIKT = "import-auto-2026-11-16 (Max Mustermann's conflicted copy).txt";
const KONFLIKT1 = "import-auto-2026-11-16 (Max Mustermann's conflicted copy) (1).txt";

test('Auto-Dateien werden am Namen erkannt, auch mit -2, „conflicted copy“ und (1)', () => {
  for (const n of [NORMAL, ZWEI, KONFLIKT, KONFLIKT1, 'import-auto-2026-11-16.md', 'IMPORT-AUTO-2026-11-16.TXT']) assert.equal(istAutoDatei(n), true, n);
  for (const n of ['import-2026-11-16-1936-rezept.md', 'import-auto-2026-11-16.json', 'mein-import-auto-2026-11-16.txt', 'import-automatisch.txt', '']) assert.equal(istAutoDatei(n), false, n);
  const e = (name, text) => ({ name, ergebnis: leseImport(text) });
  assert.equal(autoDatum(e(NORMAL, tag('2026-11-16', { kcal: 2000 }))), '2026-11-16');
  assert.equal(autoDatum(e('import-2026-11-16-claude.md', tag('2026-11-16', { kcal: 2000 }))), null); // kein Auto-Name
  assert.equal(autoDatum(e(NORMAL, 'kaputt')), null); // nicht lesbar
  assert.equal(autoDatum(e(NORMAL, block([{ typ: 'cardio', datum: '2026-11-16', art: 'Laufband' }]))), null); // kein tag-Eintrag
  assert.equal(autoDatum(e(NORMAL, block([{ typ: 'tag', datum: '2026-11-16' }, { typ: 'tag', datum: '2026-11-15' }]))), null); // nicht genau ein Eintrag
});

test('Drei Auto-Dateien für dasselbe Datum: nur die neueste erscheint, die anderen landen in erledigt/', async () => {
  const box = falscheBox({
    [NORMAL]: { text: tag('2026-11-16', { kcal: 1500 }), zeit: '2026-11-16T12:00:00Z' },
    [ZWEI]: { text: tag('2026-11-16', { kcal: 2180 }), zeit: '2026-11-16T19:40:00Z' }, // die neueste
    [KONFLIKT]: { text: tag('2026-11-16', { kcal: 1900 }), zeit: '2026-11-16T17:00:00Z' },
  });
  const s = stand();
  const r = await verarbeiteEingang({ box, state: s, jetzt: JETZT });
  assert.deepEqual(r.eingang.map((e) => e.name), [ZWEI]);
  assert.equal(r.eingang[0].ergebnis.eintraege[0].kcal, 2180);
  assert.deepEqual(box.namen('eingang'), [ZWEI]);
  assert.deepEqual(box.namen('erledigt'), [KONFLIKT, NORMAL].sort());
  assert.deepEqual(r.protokoll, [{ art: 'uebersprungen', datum: '2026-11-16', anzahl: 2, dateien: [KONFLIKT, NORMAL] }]);
  assert.equal(r.neue, 1);
  assert.equal(r.geaendert, false); // ohne die Einstellung wird nichts übernommen
  assert.equal(r.state, s);
  assert.deepEqual(s.tage, {});
});

test('Gruppiert wird nach dem Datum im Inhalt, nicht nach dem Dateinamen', async () => {
  const box = falscheBox({
    'import-auto-2026-11-15.txt': { text: tag('2026-11-16', { kcal: 2000 }), zeit: '2026-11-16T10:00:00Z' }, // Name sagt 15., Inhalt 16.
    [NORMAL]: { text: tag('2026-11-16', { kcal: 2100 }), zeit: '2026-11-16T11:00:00Z' },
  });
  const r = await verarbeiteEingang({ box, state: stand(), jetzt: JETZT });
  assert.deepEqual(r.eingang.map((e) => e.name), [NORMAL]);
  assert.equal(r.protokoll[0].anzahl, 1);
});

test('Auto-Dateien für zwei verschiedene Daten: je eine Vorschau pro Datum', async () => {
  const box = falscheBox({
    'import-auto-2026-11-15.txt': { text: tag('2026-11-15', { kcal: 2400 }), zeit: '2026-11-15T21:00:00Z' },
    'import-auto-2026-11-15-2.txt': { text: tag('2026-11-15', { kcal: 2450 }), zeit: '2026-11-15T22:00:00Z' },
    [NORMAL]: { text: tag('2026-11-16', { kcal: 2100 }), zeit: '2026-11-16T19:00:00Z' },
  });
  const r = await verarbeiteEingang({ box, state: stand(), jetzt: JETZT });
  assert.deepEqual(r.eingang.map((e) => e.name), ['import-auto-2026-11-15-2.txt', NORMAL]);
  assert.deepEqual(r.eingang.map((e) => e.ergebnis.eintraege[0].datum), ['2026-11-15', '2026-11-16']);
  assert.deepEqual(box.namen('erledigt'), ['import-auto-2026-11-15.txt']);
});

test('Ungültige Auto-Datei zählt nicht als neueste und wird als abgelehnt angezeigt', async () => {
  const box = falscheBox({
    [NORMAL]: { text: tag('2026-11-16', { kcal: 2100 }), zeit: '2026-11-16T12:00:00Z' },
    [ZWEI]: { text: 'FITNESS-IMPORT v1\n{ "eintraege": [ { "typ": "tag", "dat', zeit: '2026-11-16T19:00:00Z' }, // neuer, aber abgeschnitten
  });
  const r = await verarbeiteEingang({ box, state: stand(), jetzt: JETZT });
  assert.deepEqual(r.eingang.map((e) => [e.name, e.ergebnis.ok]), [[ZWEI, false], [NORMAL, true]]);
  assert.deepEqual(box.namen('erledigt'), []);
  assert.deepEqual(r.protokoll, []);
});

test('Claude-Importe (rezept, training) im selben Abgleich bleiben unverändert mit eigener Vorschau', async () => {
  const rezept = 'import-2026-11-16-1936-rezept.md';
  const training = 'import-2026-11-16-training.md';
  const box = falscheBox({
    [NORMAL]: { text: tag('2026-11-16', { kcal: 1500 }), zeit: '2026-11-16T12:00:00Z' },
    [ZWEI]: { text: tag('2026-11-16', { kcal: 2180 }), zeit: '2026-11-16T19:40:00Z' },
    [rezept]: { text: block([{ typ: 'rezept', name: 'Linsensuppe', kategorie: 'Mittagessen', kcal: 85 }]), zeit: '2026-11-16T18:36:00Z' },
    [training]: { text: block([{ typ: 'training', datum: '2026-11-16', einheit: 'Kraft A', uebungen: [{ name: 'Liegestütze', saetze: [{ wdh: 10, kg: 0 }] }] }, { typ: 'tag', datum: '2026-11-16', schritte: 9000 }]), zeit: '2026-11-16T18:00:00Z' },
  });
  for (const autoOhneVorschau of [false, true]) {
    const r = await verarbeiteEingang({ box: falscheBox(Object.fromEntries(box.namen('eingang').map((n) => [n, box.dateien[`/eingang/${n}`]]))), state: stand(), autoOhneVorschau, jetzt: JETZT });
    const namen = r.eingang.map((e) => e.name);
    assert.ok(namen.includes(rezept) && namen.includes(training), 'Claude-Dateien bleiben im Eingang');
    assert.ok(r.eingang.filter((e) => !istAutoDatei(e.name)).every((e) => e.ergebnis.ok));
    assert.equal(namen.includes(ZWEI), !autoOhneVorschau);
    // Auch mit der Einstellung: Training und Rezept werden NICHT automatisch übernommen
    assert.equal(r.state.trainings.length, 0);
    assert.equal((r.state.rezepte || []).length, 0);
    assert.equal(r.state.tage['2026-11-16']?.schritte, undefined);
  }
});

test('Verschieben ohne Namenskonflikt: gleicher Name in erledigt/ bekommt einen Zeitstempel', async () => {
  const vorhandene = new Set(['import-auto-2026-11-16.txt']);
  assert.equal(erledigtName('import-neu.md', vorhandene, JETZT), 'import-neu.md'); // frei: Name bleibt
  assert.equal(erledigtName('Import-Auto-2026-11-16.txt', vorhandene, JETZT), 'Import-Auto-2026-11-16__2026-11-16T2046.txt'); // Dropbox unterscheidet Groß/Klein nicht
  assert.equal(erledigtName(NORMAL, vorhandene, JETZT), 'import-auto-2026-11-16__2026-11-16T204630.txt'); // auch der schon vergeben: Sekunden
  assert.equal(erledigtName(NORMAL, vorhandene, JETZT), 'import-auto-2026-11-16__2026-11-16T204630-2.txt');
  assert.equal(erledigtName('ohne-endung', new Set(['ohne-endung']), JETZT), 'ohne-endung__2026-11-16T2046');

  const alt = { text: 'ALT – darf nicht überschrieben werden', zeit: '2026-11-16T08:00:00Z' };
  const box = falscheBox(
    { [NORMAL]: { text: tag('2026-11-16', { kcal: 1500 }), zeit: '2026-11-16T12:00:00Z' }, [ZWEI]: { text: tag('2026-11-16', { kcal: 2180 }), zeit: '2026-11-16T19:40:00Z' } },
    { [NORMAL]: alt },
  );
  const r = await verarbeiteEingang({ box, state: stand(), jetzt: JETZT });
  assert.deepEqual(box.namen('erledigt'), ['import-auto-2026-11-16.txt', 'import-auto-2026-11-16__2026-11-16T2046.txt']);
  assert.equal(box.dateien[`/erledigt/${NORMAL}`], alt); // unverändert
  // Übernehmen/Verwerfen von Hand benutzt denselben Weg
  box.dateien[`/erledigt/${ZWEI}`] = alt;
  const ziel = await verschiebeNachErledigt(box, r.eingang[0], await erledigtNamen(box), JETZT);
  assert.equal(ziel, 'import-auto-2026-11-16-2__2026-11-16T2046.txt');
  assert.deepEqual(box.namen('eingang'), []);
});

test('Auto-Datei mit "gewicht_kg": null lässt ein von Hand eingetragenes Gewicht stehen', async () => {
  const s = stand();
  s.tage['2026-11-16'] = { datum: '2026-11-16', gewicht_kg: 93.1, schritte: 4000, notiz: 'von Hand' };
  const text = tag('2026-11-16', { kcal: 2180, eiweiss_g: 165, schritte: 8200, gewicht_kg: null });
  // mit Vorschau
  let box = falscheBox({ [NORMAL]: { text, zeit: '2026-11-16T19:00:00Z' } });
  let r = await verarbeiteEingang({ box, state: s, jetzt: JETZT });
  const vorschau = verarbeite(s, r.eingang[0].ergebnis.eintraege);
  assert.equal(vorschau.state.tage['2026-11-16'].gewicht_kg, 93.1);
  assert.ok(vorschau.posten[0].felder.every((f) => f.feld !== 'gewicht_kg'));
  // ohne Vorschau
  box = falscheBox({ [NORMAL]: { text, zeit: '2026-11-16T19:00:00Z' } });
  r = await verarbeiteEingang({ box, state: s, autoOhneVorschau: true, jetzt: JETZT });
  assert.deepEqual(r.state.tage['2026-11-16'], { datum: '2026-11-16', gewicht_kg: 93.1, schritte: 8200, notiz: 'von Hand', kcal: 2180, eiweiss_g: 165 });
  assert.equal(s.tage['2026-11-16'].schritte, 4000); // der übergebene Stand bleibt unberührt
});

test('Ohne Vorschau: neueste Auto-Datei wird übernommen und protokolliert (alter → neuer Wert)', async () => {
  const s = stand();
  s.tage['2026-11-16'] = { datum: '2026-11-16', kcal: 1500, schritte: 4000 };
  const box = falscheBox({
    [NORMAL]: { text: tag('2026-11-16', { kcal: 1500, schritte: 4000 }), zeit: '2026-11-16T12:00:00Z' },
    [KONFLIKT]: { text: tag('2026-11-16', { kcal: 2180, schritte: 8200 }), zeit: '2026-11-16T19:40:00Z' },
    'import-auto-2026-11-15.txt': { text: tag('2026-11-15', { kcal: 2400 }), zeit: '2026-11-15T22:00:00Z' },
  });
  const r = await verarbeiteEingang({ box, state: s, autoOhneVorschau: true, jetzt: JETZT });
  assert.deepEqual(r.eingang, []);
  assert.deepEqual(box.namen('eingang'), []);
  assert.equal(box.namen('erledigt').length, 3);
  assert.equal(r.geaendert, true);
  assert.equal(r.state.tage['2026-11-16'].kcal, 2180);
  assert.equal(r.state.tage['2026-11-15'].kcal, 2400);
  assert.deepEqual(r.protokoll.map((p) => [p.art, p.datum]), [['uebernommen', '2026-11-15'], ['uebersprungen', '2026-11-16'], ['uebernommen', '2026-11-16']]);
  assert.deepEqual(r.protokoll[2].felder, [{ feld: 'kcal', alt: 1500, neu: 2180 }, { feld: 'schritte', alt: 4000, neu: 8200 }]);
  assert.equal(r.protokoll[2].datei, KONFLIKT);
  // dieselben Werte noch einmal: nichts ändert sich, die Datei wird trotzdem weggeräumt
  const box2 = falscheBox({ [NORMAL]: { text: tag('2026-11-16', { kcal: 2180 }), zeit: '2026-11-16T20:00:00Z' } });
  const r2 = await verarbeiteEingang({ box: box2, state: r.state, autoOhneVorschau: true, jetzt: JETZT });
  assert.equal(r2.geaendert, false);
  assert.equal(r2.protokoll[0].art, 'unveraendert');
  assert.deepEqual(box2.namen('eingang'), []);
});

test('Ohne Vorschau gilt nur für gültige Auto-Dateien; eine ungültige speichert nichts', async () => {
  const s = stand();
  const box = falscheBox({
    [NORMAL]: { text: tag('2026-11-16', { kcal: -5 }), zeit: '2026-11-16T19:00:00Z' }, // Wert außerhalb des Bereichs
    'import-2026-11-16-claude.md': { text: tag('2026-11-16', { kcal: 2000 }), zeit: '2026-11-16T19:10:00Z' }, // tag-Eintrag, aber nicht vom Kurzbefehl
  });
  const r = await verarbeiteEingang({ box, state: s, autoOhneVorschau: true, jetzt: JETZT });
  assert.equal(r.geaendert, false);
  assert.deepEqual(r.state.tage, {});
  assert.deepEqual(r.eingang.map((e) => [e.name, e.ergebnis.ok]), [['import-2026-11-16-claude.md', true], [NORMAL, false]]);
  assert.deepEqual(box.namen('erledigt'), []);
});

test('Bekannte Dateien werden beim nächsten Abgleich nicht erneut heruntergeladen', async () => {
  const box = falscheBox({ [NORMAL]: { text: tag('2026-11-16', { kcal: 2100 }), zeit: '2026-11-16T12:00:00Z' } });
  const r1 = await verarbeiteEingang({ box, state: stand(), jetzt: JETZT });
  assert.equal(r1.neue, 1);
  r1.eingang[0].ersetzen[0] = false; // Auswahl des Nutzers in der Vorschau
  const r2 = await verarbeiteEingang({ box, state: stand(), bekannt: r1.eingang, jetzt: JETZT });
  assert.equal(box.geladen.length, 1);
  assert.equal(r2.neue, 0);
  assert.equal(r2.eingang[0], r1.eingang[0]); // dasselbe Objekt, die Auswahl bleibt
  // geänderte Datei (neue Änderungszeit) wird neu gelesen
  box.dateien[`/eingang/${NORMAL}`] = { text: tag('2026-11-16', { kcal: 2300 }), zeit: '2026-11-16T13:00:00Z' };
  const r3 = await verarbeiteEingang({ box, state: stand(), bekannt: r2.eingang, jetzt: JETZT });
  assert.equal(r3.neue, 1);
  assert.equal(r3.eingang[0].ergebnis.eintraege[0].kcal, 2300);
});
