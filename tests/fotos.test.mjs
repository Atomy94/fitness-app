import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fotoDateiname, leseFotoName, zielMasse, fotoTermine, termineMitAnsicht, vergleichStart, fotoAm, messwerteAm, fotoAbgleichPlan, ansichtName, fotosNeuesDatum } from '../js/core/fotos.js';
import { stand, MO, DI, SO } from './hilfe.mjs';

// Erfundene Fotos (nur Metadaten)
const f1 = { id: 'a1', datum: '2026-11-01', ansicht: 'vorne' };
const f2 = { id: 'a2', datum: '2026-11-01', ansicht: 'seite' };
const f3 = { id: 'b1', datum: '2026-11-22', ansicht: 'vorne' };
const f4 = { id: 'c1', datum: '2026-11-08', ansicht: 'vorne' };

test('Dateiname enthält Datum, Ansicht und id und lässt sich zurücklesen', () => {
  assert.equal(fotoDateiname(f1), '2026-11-01_vorne_a1.jpg');
  assert.deepEqual(leseFotoName('2026-11-01_vorne_a1.jpg'), { datum: '2026-11-01', ansicht: 'vorne', id: 'a1' });
  assert.deepEqual(leseFotoName('2026-11-01_Seite_x-2.JPG'), { datum: '2026-11-01', ansicht: 'seite', id: 'x-2' });
  assert.equal(leseFotoName('urlaub.jpg'), null);
  assert.equal(leseFotoName('2026-11-01_oben_a1.jpg'), null);
  assert.equal(ansichtName('hinten'), 'Hinten');
});

test('Verkleinern: längste Seite höchstens 1280, nie vergrößern', () => {
  assert.deepEqual(zielMasse(3024, 4032), { breite: 960, hoehe: 1280 });
  assert.deepEqual(zielMasse(4032, 3024), { breite: 1280, hoehe: 960 });
  assert.deepEqual(zielMasse(800, 600), { breite: 800, hoehe: 600 });
});

test('Termine: nach Datum gruppiert, neuester zuerst, je Ansicht', () => {
  const t = fotoTermine([f1, f2, f3, f4]);
  assert.deepEqual(t.map((x) => x.datum), ['2026-11-22', '2026-11-08', '2026-11-01']);
  assert.equal(t[2].anzahl, 2);
  assert.equal(t[2].fotos.seite[0].id, 'a2');
  assert.deepEqual(t[0].fotos.hinten, []);
  assert.deepEqual(fotoTermine([]), []);
});

test('Vergleich: ältester gegen neuesten Termin der gewählten Ansicht', () => {
  const liste = [f1, f2, f3, f4];
  assert.deepEqual(termineMitAnsicht(liste, 'vorne'), ['2026-11-01', '2026-11-08', '2026-11-22']);
  assert.deepEqual(vergleichStart(liste, 'vorne'), { vorher: '2026-11-01', nachher: '2026-11-22' });
  assert.equal(vergleichStart(liste, 'seite'), null); // nur ein Termin
  assert.equal(fotoAm(liste, '2026-11-08', 'vorne').id, 'c1');
  assert.equal(fotoAm(liste, '2026-11-08', 'hinten'), null);
});

test('Messwerte zum Fototermin: Gewicht des Tages, Bauchumfang der Messung', () => {
  const s = stand();
  s.tage[SO] = { datum: SO, gewicht_kg: 80.4 };
  s.messungen.push({ id: 'm1', datum: SO, bauch_cm: 91.5, quelle: 'Maßband' });
  s.messungen.push({ id: 'm2', datum: MO, bauch_cm: 99, quelle: 'Tanita', ungueltig: true, gewicht_kg: 81 });
  assert.deepEqual(messwerteAm(s, SO), { gewicht: 80.4, bauch: 91.5 });
  assert.deepEqual(messwerteAm(s, MO), { gewicht: null, bauch: null });
  assert.deepEqual(messwerteAm(s, DI), { gewicht: null, bauch: null });
});

test('Dropbox-Abgleich: hochladen, wiederherstellen, löschen', () => {
  const lokal = [{ ...f1, hochgeladen: true }, { ...f3, hochgeladen: false }, { ...f4, hochgeladen: false }];
  const entfernt = ['2026-11-01_vorne_a1.jpg', '2026-11-08_vorne_c1.jpg', '2026-10-25_seite_z9.jpg', '2026-10-18_hinten_y1.jpg', 'notiz.txt'];
  const geloescht = ['2026-10-18_hinten_y1.jpg', '2026-09-01_vorne_q1.jpg'];
  const p = fotoAbgleichPlan(lokal, entfernt, geloescht);
  assert.deepEqual(p.hoch.map((f) => f.id), ['b1']); // noch nicht oben
  assert.deepEqual(p.schonOben.map((f) => f.id), ['c1']); // oben, aber lokal nicht markiert
  assert.deepEqual(p.runter.map((f) => f.id), ['z9']); // neues Gerät: aus der Dropbox holen
  assert.deepEqual(p.loeschen, ['2026-10-18_hinten_y1.jpg']); // auf dem Gerät gelöscht
  assert.deepEqual(p.erledigtGeloescht, ['2026-09-01_vorne_q1.jpg']); // dort schon weg
});

test('Dropbox-Abgleich ohne Fotos tut nichts', () => {
  const p = fotoAbgleichPlan([], [], []);
  assert.deepEqual([p.hoch, p.runter, p.loeschen, p.erledigtGeloescht, p.schonOben], [[], [], [], [], []]);
});

test('Datum ändern: Foto wird verschoben, in der Dropbox umbenannt (neu hochladen, alten Namen löschen)', () => {
  // Erfundene Fotos: zwei am falschen Datum (eins schon in der Dropbox), eins an einem anderen Tag
  const liste = [
    { id: 'a1', datum: '2026-11-25', ansicht: 'vorne', hochgeladen: true },
    { id: 'b2', datum: '2026-11-25', ansicht: 'seite', hochgeladen: false },
    { id: 'c3', datum: '2026-11-15', ansicht: 'vorne', hochgeladen: true },
  ];
  const r = fotosNeuesDatum(liste, ['a1', 'b2'], '2026-10-04');
  assert.equal(r.anzahl, 2);
  assert.deepEqual(r.liste.map((f) => [f.id, f.datum, f.hochgeladen]), [['a1', '2026-10-04', false], ['b2', '2026-10-04', false], ['c3', '2026-11-15', true]]);
  assert.deepEqual(r.alteNamen, ['2026-11-25_vorne_a1.jpg']);
  assert.deepEqual(fotoTermine(r.liste).map((t) => t.datum), ['2026-11-15', '2026-10-04']);

  // Nächster Abgleich: in der Dropbox liegen noch die alten Namen
  const oben = ['2026-11-25_vorne_a1.jpg', '2026-11-15_vorne_c3.jpg'];
  const p = fotoAbgleichPlan(r.liste, oben, r.alteNamen);
  assert.deepEqual(p.hoch.map(fotoDateiname), ['2026-10-04_vorne_a1.jpg', '2026-10-04_seite_b2.jpg']);
  assert.deepEqual(p.loeschen, ['2026-11-25_vorne_a1.jpg']);
  assert.deepEqual(p.runter, []); // das alte Foto wird nicht doppelt zurückgeholt

  // Gleiches Datum ändert nichts
  assert.equal(fotosNeuesDatum(liste, ['c3'], '2026-11-15').anzahl, 0);
});
