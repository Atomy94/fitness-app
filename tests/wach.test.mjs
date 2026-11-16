import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wachhalter } from '../js/core/wach.js';

// Nachgebautes Gerät: zählt Anforderungen und Freigaben.
function geraet({ unterstuetzt = true, lehntAb = false } = {}) {
  const hoerer = [];
  const doc = { visibilityState: 'visible', addEventListener: (typ, fn) => { if (typ === 'visibilitychange') hoerer.push(fn); } };
  const zaehler = { angefordert: 0, freigegeben: 0 };
  const sperren = [];
  const nav = unterstuetzt ? { wakeLock: { request: async (art) => {
    assert.equal(art, 'screen');
    zaehler.angefordert++;
    if (lehntAb) throw new Error('NotAllowedError');
    const s = { hoerer: [], addEventListener(typ, fn) { this.hoerer.push(fn); }, async release() { zaehler.freigegeben++; this.hoerer.forEach((fn) => fn()); } };
    sperren.push(s);
    return s;
  } } } : {};
  const sichtbar = (v) => { doc.visibilityState = v ? 'visible' : 'hidden'; hoerer.forEach((fn) => fn()); };
  return { nav, doc, zaehler, sperren, sichtbar };
}
const kurz = () => new Promise((r) => setTimeout(r, 5));

test('Bildschirm bleibt an: Sperre beim Training anfordern, danach freigeben', async () => {
  const g = geraet();
  const w = wachhalter(g.nav, g.doc);
  assert.equal(w.aktiv, false);
  await w.an();
  assert.equal(w.aktiv, true);
  assert.equal(g.zaehler.angefordert, 1);
  await w.an(); // doppelt anfordern schadet nicht
  assert.equal(g.zaehler.angefordert, 1);
  await w.aus();
  assert.equal(w.aktiv, false);
  assert.equal(g.zaehler.freigegeben, 1);
  await w.aus(); // doppelt freigeben auch nicht
  assert.equal(g.zaehler.freigegeben, 1);
});

test('Gerät ohne Unterstützung: still ignorieren, kein Fehler', async () => {
  const g = geraet({ unterstuetzt: false });
  const w = wachhalter(g.nav, g.doc);
  await w.an();
  assert.equal(w.aktiv, false);
  await w.aus();
  // ganz ohne navigator und document
  const leer = wachhalter(undefined, undefined);
  await leer.an();
  await leer.aus();
  assert.equal(leer.aktiv, false);
});

test('Gerät lehnt ab (z. B. Stromsparmodus): still ignorieren, später erneut möglich', async () => {
  const g = geraet({ lehntAb: true });
  const w = wachhalter(g.nav, g.doc);
  await w.an();
  assert.equal(w.aktiv, false);
  assert.equal(g.zaehler.angefordert, 1);
  await w.an(); // neuer Versuch ist erlaubt
  assert.equal(g.zaehler.angefordert, 2);
});

test('App im Hintergrund: System gibt frei; bei Rückkehr wird neu angefordert, solange das Training läuft', async () => {
  const g = geraet();
  const w = wachhalter(g.nav, g.doc);
  await w.an();
  // Das System gibt die Sperre frei, wenn die App verdeckt wird
  g.doc.visibilityState = 'hidden';
  await g.sperren[0].release();
  assert.equal(w.aktiv, false);
  g.sichtbar(true);
  await kurz();
  assert.equal(w.aktiv, true);
  assert.equal(g.zaehler.angefordert, 2);
  // Training beendet: nach der Rückkehr wird NICHT mehr angefordert
  await w.aus();
  g.sichtbar(false); g.sichtbar(true);
  await kurz();
  assert.equal(w.aktiv, false);
  assert.equal(g.zaehler.angefordert, 2);
});

test('Im Hintergrund wird nicht angefordert; beendet man während der Anforderung, bleibt nichts hängen', async () => {
  const g = geraet();
  g.doc.visibilityState = 'hidden';
  const w = wachhalter(g.nav, g.doc);
  await w.an();
  assert.equal(g.zaehler.angefordert, 0);
  g.sichtbar(true);
  await kurz();
  assert.equal(w.aktiv, true);
  await w.aus();
  // an() und sofort aus(): die spät eintreffende Sperre wird gleich wieder freigegeben
  const g2 = geraet();
  const w2 = wachhalter(g2.nav, g2.doc);
  const p = w2.an();
  await w2.aus();
  await p;
  assert.equal(w2.aktiv, false);
  assert.equal(g2.zaehler.freigegeben, 1);
});
