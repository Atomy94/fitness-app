import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uebungsSchluessel, uebungsName } from '../js/core/state.js';
import { planAuswahl, planTag } from '../js/core/ziele.js';
import { trainingStatus, GRUEN, GRAU } from '../js/core/bewertung.js';
import { uebungsVerlaeufe, ergaenzePlanUebung } from '../js/core/kraft.js';
import { leseImport, verarbeite, KOPF } from '../js/core/import.js';
import { stand, kraft, MO, SA, SPAETER } from './hilfe.mjs';

const block = (eintraege) => `${KOPF}\n${JSON.stringify({ eintraege })}`;

test('Übungsname: Hinweise fallen weg, „(Studio)“ bleibt eine eigene Übung', () => {
  // Ausführungshinweise gehören nicht zum Namen
  assert.equal(uebungsName('Goblet Squat, Tempo 3-1-x'), 'Goblet Squat');
  assert.equal(uebungsName('Goblet Squat (Tempo 3-1-x)'), 'Goblet Squat');
  assert.equal(uebungsName('Liegestütze (nach Dips)'), 'Liegestütze');
  assert.equal(uebungsName('Einarmiges Rudern (je Seite)'), 'Einarmiges Rudern');
  assert.equal(uebungsName('Kreuzheben gestreckt (2 × 10 kg)'), 'Kreuzheben gestreckt');
  // andere Klammern gehören zum Namen
  assert.equal(uebungsName('Liegestütze (Studio)'), 'Liegestütze (Studio)');
  assert.notEqual(uebungsSchluessel('Liegestütze (Studio)'), uebungsSchluessel('Liegestütze'));
  assert.equal(uebungsSchluessel('LIEGESTÜTZE (studio)'), uebungsSchluessel('Liegestütze (Studio)'));
  assert.notEqual(uebungsSchluessel('Curls (Kurzhantel)'), uebungsSchluessel('Curls (SZ-Stange)'));
});

test('Liegestütze im Studio haben einen eigenen Verlauf', () => {
  const s = stand();
  s.trainings.push(
    kraft(MO, 'Kraft A', { uebungen: [{ name: 'Liegestütze', saetze: [{ wdh: 15, kg: 0 }] }] }),
    kraft(SA, 'Studio', { uebungen: [{ name: 'Dips', saetze: [{ wdh: 6, kg: 0 }] }, { name: 'Liegestütze (Studio)', saetze: [{ wdh: 6, kg: 0 }] }] }),
  );
  const v = uebungsVerlaeufe(s);
  assert.deepEqual(v.map((x) => x.name), ['Dips', 'Liegestütze', 'Liegestütze (Studio)']);
  assert.deepEqual(v.map((x) => x.eintraege.length), [1, 1, 1]);
});

test('Samstag mit Auswahl: zwei Einheiten stehen zur Wahl, sonst genau eine', () => {
  const s = stand();
  assert.deepEqual(planAuswahl(planTag(s.einstellungen, SA)), [{ text: 'Alleine', einheit: 'Kraft C' }, { text: 'Im Studio', einheit: 'Studio' }]);
  assert.deepEqual(planAuswahl(planTag(s.einstellungen, MO)), [{ text: 'Kraft A', einheit: 'Kraft A' }]);
  assert.deepEqual(planAuswahl(planTag(s.einstellungen, '2026-11-10')), []); // Laufband
  assert.deepEqual(planAuswahl(null), []);
  assert.deepEqual(planAuswahl({ typ: 'bonus', einheit: 'Kraft C', wahl: [{ text: 'Nur eine', einheit: 'Kraft C' }] }), [{ text: 'Kraft C', einheit: 'Kraft C' }]); // eine Möglichkeit ist keine Auswahl
  assert.ok(s.einstellungen.plan.einheiten.Studio.some((u) => u.name === 'Liegestütze (Studio)'));
});

test('Samstag bleibt Bonus: beide Varianten grün, ausgefallen grau', () => {
  assert.equal(trainingStatus(stand(), SA, SPAETER).status, GRAU);
  for (const einheit of ['Kraft C', 'Studio']) {
    const s = stand();
    s.trainings.push(kraft(SA, einheit));
    assert.equal(trainingStatus(s, SA, SPAETER).status, GRUEN, einheit);
  }
});

test('Eigene Übung wird dauerhaft in die Einheit aufgenommen, aber nicht doppelt', () => {
  const einheiten = { Studio: [{ name: 'Dips', saetze: 4, wdh: '', kg: null }, { name: 'Rudern', saetze: 3, wdh: '10', kg: 16, schwer: { name: 'Rudern mit Halten' } }] };
  assert.equal(ergaenzePlanUebung(einheiten, 'Studio', { name: 'Latzug', saetze: 3, wdh: '', kg: null }), true);
  assert.equal(einheiten.Studio.at(-1).name, 'Latzug');
  assert.equal(ergaenzePlanUebung(einheiten, 'Studio', { name: 'latzug', saetze: 4, wdh: '', kg: null }), false); // schon da
  assert.equal(ergaenzePlanUebung(einheiten, 'Studio', { name: 'Dips (nach Klimmzügen)', saetze: 4, wdh: '', kg: null }), false); // Hinweis-Klammer ändert die Übung nicht
  assert.equal(ergaenzePlanUebung(einheiten, 'Studio', { name: 'Rudern mit Halten', saetze: 3, wdh: '', kg: null }), false); // als anspruchsvolle Version vorhanden
  assert.equal(ergaenzePlanUebung(einheiten, 'Studio', { name: '  ', saetze: 3 }), false);
  assert.equal(einheiten.Studio.length, 3);
  assert.equal(ergaenzePlanUebung(einheiten, 'Neu', { name: 'Kniebeuge', saetze: 3, wdh: '', kg: null }), true); // Einheit wird angelegt
});

test('Import: neue Einheit und Samstag mit Auswahl in einem Block', () => {
  const s = stand();
  delete s.einstellungen.plan.wochenplan[6].wahl;
  const r = leseImport(block([
    { typ: 'einheit', name: 'Studio mit Partner', uebungen: [{ name: 'Klimmzüge mit Band', saetze: 4 }, { name: 'Dips', saetze: 4 }, { name: 'Liegestütze (Studio)', saetze: 4 }] },
    { typ: 'plantag', wochentag: 'Sa', text: 'Kraft C oder Studio (Bonus)', wahl: [{ text: 'Alleine', einheit: 'Kraft C' }, { text: 'Mit Partner', einheit: 'Studio mit Partner' }] },
  ]));
  assert.equal(r.ok, true, r.fehler.join(' | '));
  const e = verarbeite(s, r.eintraege);
  assert.deepEqual(e.posten.map((p) => p.art), ['neu', 'aenderung']);
  assert.equal(e.posten[1].titel, 'Wochenplan: Samstag');
  assert.equal(e.posten[1].felder.length, 1); // kein Warnhinweis: die Einheit steht im selben Block davor
  assert.match(e.posten[1].felder[0].neu, /Auswahl: Alleine → Kraft C \/ Mit Partner → Studio mit Partner/);
  const sa = e.state.einstellungen.plan.wochenplan[6];
  assert.deepEqual(sa, { typ: 'bonus', einheit: 'Kraft C', text: 'Kraft C oder Studio (Bonus)', wahl: [{ text: 'Alleine', einheit: 'Kraft C' }, { text: 'Mit Partner', einheit: 'Studio mit Partner' }] });
  assert.equal(e.state.einstellungen.plan.einheiten['Studio mit Partner'].length, 3);
  assert.equal(s.einstellungen.plan.wochenplan[6].wahl, undefined); // Original unberührt
  assert.equal(verarbeite(e.state, r.eintraege).posten[1].art, 'gleich');
  // Auswahl wieder entfernen
  const ohne = verarbeite(e.state, leseImport(block([{ typ: 'plantag', wochentag: 6, wahl: [] }])).eintraege);
  assert.equal(ohne.state.einstellungen.plan.wochenplan[6].wahl, undefined);
  assert.equal(ohne.state.einstellungen.plan.wochenplan[6].einheit, 'Kraft C');
});

test('Import plantag: Warnung bei unbekannter Einheit, gueltig_ab bewahrt den alten Plan', () => {
  const s = stand();
  let e = verarbeite(s, leseImport(block([{ typ: 'plantag', wochentag: 'Mittwoch', art: 'kraft', einheit: 'Kraft X', text: 'Kraft X', gueltig_ab: '2026-11-23' }])).eintraege);
  assert.match(e.posten[0].felder[1].neu, /„Kraft X“ gibt es im Plan noch nicht/);
  assert.equal(e.posten[0].titel, 'Wochenplan: Mittwoch (ab 23.11.2026)');
  assert.deepEqual(e.state.einstellungen.plan.wochenplanAlt.map((a) => a.bis), ['2026-11-22']);
  assert.equal(planTag(e.state.einstellungen, '2026-11-18'), null); // Mittwoch davor: weiter frei
  assert.equal(planTag(e.state.einstellungen, '2026-11-25').einheit, 'Kraft X');
  // Wechsel zu Laufband entfernt Einheit und Auswahl
  e = verarbeite(s, leseImport(block([{ typ: 'plantag', wochentag: 6, art: 'laufband', minuten: 20 }])).eintraege);
  assert.deepEqual(e.state.einstellungen.plan.wochenplan[6], { typ: 'laufband', text: 'Kraft C oder Studio (Bonus)', minuten: 20 });
});

test('Import plantag: fehlerhafte Angaben werden abgelehnt', () => {
  for (const [eintrag, muster] of [
    [{ typ: 'plantag', art: 'bonus' }, /Pflichtfeld "wochentag"/],
    [{ typ: 'plantag', wochentag: 8 }, /Wochentag/],
    [{ typ: 'plantag', wochentag: 'Samstags' }, /Wochentag/],
    [{ typ: 'plantag', wochentag: 6, art: 'yoga' }, /kraft, laufband, bonus, fussball, frei/],
    [{ typ: 'plantag', wochentag: 6, wahl: [{ text: 'Alleine', einheit: 'Kraft C' }] }, /2 bis 4 Möglichkeiten/],
    [{ typ: 'plantag', wochentag: 6, wahl: [{ text: 'Alleine', einheit: 'Kraft C' }, { text: 'Ohne Einheit' }] }, /"text" und "einheit"/],
    [{ typ: 'plantag', wochentag: 6, gueltig_ab: '21.11.2026' }, /Datum/],
  ]) {
    const r = leseImport(block([eintrag]));
    assert.equal(r.ok, false, JSON.stringify(eintrag));
    assert.match(r.fehler.join(' | '), muster);
  }
});
