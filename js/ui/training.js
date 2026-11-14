// Bildschirm "Training": Wochenplan, Einheit durchführen (mit Timern), Cardio eintragen,
// Liste aller Einheiten, Verlauf und Bestwert pro Übung.

import { S, heuteIso, neu, speichern, speichereEntwurf, beiVerlassen, meldung } from '../store.js';
import { h, karte, zahlFeld, textFeld, datumFeld, diagramm } from './dom.js';
import { einheitText } from './tag.js';
import { minimalAktiv, planTag } from '../core/ziele.js';
import { neueId, uebungsSchluessel, tagVon } from '../core/state.js';
import { fmt } from '../core/zahl.js';
import { WT_LANG, wochentag, de, deKurz, deMitTag, istDatum } from '../core/datum.js';

const enc = encodeURIComponent;
const CARDIO_ARTEN = ['Laufband', 'Hallenfußball', 'Spaziergang', 'Radfahren', 'Sonstiges'];

// ---------- Hilfen ----------

const sortiert = () => [...S.state.trainings].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));

function satzText(saetze) {
  if (!saetze || !saetze.length) return '';
  if (saetze.every((x) => x.sek !== undefined && x.wdh === undefined)) return `${saetze.map((x) => x.sek).join(' / ')} Sek.`;
  const kgs = [...new Set(saetze.map((x) => x.kg || 0))];
  const wdh = saetze.map((x) => x.wdh ?? '–').join(' / ');
  if (kgs.length === 1) return kgs[0] ? `${fmt(kgs[0], 1)} kg × ${wdh}` : `${wdh} Wdh.`;
  return saetze.map((x) => `${fmt(x.kg || 0, 1)} kg × ${x.wdh ?? '–'}`).join(' · ');
}

function letzteUebung(name, bisDatum) {
  const key = uebungsSchluessel(name);
  for (const t of sortiert()) {
    if (t.typ !== 'kraft' || t.datum > bisDatum) continue;
    const u = (t.uebungen || []).find((x) => uebungsSchluessel(x.name) === key && x.saetze && x.saetze.length);
    if (u) return { datum: t.datum, uebung: u };
  }
  return null;
}

function bereich(wdhText) {
  const m = String(wdhText || '').match(/(\d+)(?:\s*-\s*(\d+))?/);
  return m ? { min: Number(m[1]), max: Number(m[2] || m[1]) } : null;
}

function zielText(u) {
  const menge = u.sek ? `${u.sek} Sek.` : u.wdh || '';
  return `${u.saetze} × ${menge}${u.kg ? ` · ${fmt(u.kg, 1)} kg${u.kg_text ? ` (${u.kg_text})` : ''}` : ''}`;
}

// ---------- Übersicht ----------

function uebersicht() {
  const st = S.state;
  const d = heuteIso();
  const e = st.einstellungen;
  const wp = e.plan.wochenplan;
  const heuteWt = wochentag(d);
  const minimal = minimalAktiv(e, d);
  const einheiten = Object.keys(e.plan.einheiten);
  const letzte = sortiert().slice(0, 8);
  const uebungen = new Map();
  for (const t of st.trainings) for (const u of t.uebungen || []) if (u.saetze && u.saetze.length && !uebungen.has(uebungsSchluessel(u.name))) uebungen.set(uebungsSchluessel(u.name), u.name.split(/[,(]/)[0].trim());

  const knoten = h('div', null,
    S.entwurf ? h('a', { class: 'hinweis info', href: `#training/start/${enc(S.entwurf.einheit)}/${S.entwurf.datum}` }, `Laufendes Training: ${S.entwurf.einheit}`, h('small', null, 'Tippe hier, um fortzusetzen.')) : null,
    karte('Wochenplan',
      minimal ? h('p', { class: 'klein', style: 'margin-bottom:6px' }, `Minimalversion aktiv: Kraft an den Pflichttagen je ${e.minimalKraft.minuten} Min. (erste ${e.minimalKraft.uebungen} Übungen), Laufband ohne Wertung.`) : null,
      h('ul', { class: 'liste' }, [1, 2, 3, 4, 5, 6, 7].map((wt) => h('li', { style: wt === heuteWt ? 'font-weight:700' : '' },
        h('span', { style: 'width:34px;flex:none;color:var(--text2)' }, WT_LANG[wt - 1].slice(0, 2)),
        h('span', { class: 'wachs' }, (wp[wt] && wp[wt].text) || 'Kein Trainingsziel'),
        wt === heuteWt ? h('span', { class: 'marke neutral' }, 'heute') : null,
      ))),
    ),
    karte('Krafttraining starten', h('div', { class: 'knopfreihe' }, einheiten.map((n) => h('a', { class: 'knopf haupt', href: `#training/start/${enc(n)}` }, n)))),
    karte('Cardio eintragen', h('div', { class: 'knopfreihe' }, CARDIO_ARTEN.slice(0, 3).map((a) => h('a', { class: 'knopf', href: `#training/cardio/${enc(a)}/${d}` }, a)))),
    karte('Einheiten im Plan',
      einheiten.map((n) => h('details', null, h('summary', null, n),
        h('table', { class: 'tabelle' }, h('tbody', null, e.plan.einheiten[n].map((u) => h('tr', null,
          h('td', null, u.name, u.notiz ? h('div', { class: 'klein' }, u.notiz) : null),
          h('td', { class: 'r', style: 'white-space:nowrap' }, zielText(u)),
        )))),
      )),
      e.plan.progression ? h('p', { class: 'klein abstand' }, `Steigerung: ${e.plan.progression}`) : null,
      h('a', { class: 'knopf schmal breit abstand', href: '#mehr/plan' }, 'Trainingsplan bearbeiten'),
    ),
    karte('Letzte Einheiten',
      letzte.length ? h('div', { class: 'liste' }, letzte.map(einheitZeile)) : h('p', { class: 'leer' }, 'Noch keine Einheiten'),
      st.trainings.length > 8 ? h('a', { class: 'knopf schmal breit abstand', href: '#training/liste' }, `Alle ${st.trainings.length} Einheiten`) : null,
    ),
    karte('Verlauf pro Übung',
      uebungen.size ? h('div', { class: 'liste' }, [...uebungen].sort((a, b) => a[1].localeCompare(b[1], 'de')).map(([key, name]) => h('a', { href: `#training/uebung/${enc(key)}` }, h('span', { class: 'wachs' }, name), h('span', { class: 'pfeil' }, '›')))) : h('p', { class: 'leer' }, 'Noch keine Übungen'),
    ),
  );
  return { titel: 'Training', knoten };
}

const einheitZeile = (t) => h('a', { href: `#training/einheit/${t.id}` },
  h('span', { style: 'width:92px;flex:none;color:var(--text2);font-size:14px' }, `${WT_LANG[wochentag(t.datum) - 1].slice(0, 2)}, ${deKurz(t.datum)}`),
  h('span', { class: 'wachs' }, einheitText(t)), h('span', { class: 'pfeil' }, '›'));

function listeScreen() {
  const alle = sortiert();
  return { titel: 'Alle Einheiten', zurueck: 'training', knoten: karte(null, alle.length ? h('div', { class: 'liste' }, alle.map(einheitZeile)) : h('p', { class: 'leer' }, 'Noch keine Einheiten')) };
}

// ---------- Einheit durchführen ----------

function neuerEntwurf(einheit, datum) {
  const e = S.state.einstellungen;
  const plan = e.plan.einheiten[einheit] || [];
  const p = planTag(e, datum);
  const gekuerzt = minimalAktiv(e, datum) && p && p.typ === 'kraft';
  const liste = gekuerzt ? plan.slice(0, e.minimalKraft.uebungen) : plan;
  return {
    einheit, datum, startMs: Date.now(), pauseBis: null, pauseGemeldet: true, zeitGemeldet: false,
    maxMin: gekuerzt ? e.minimalKraft.minuten : e.plan.maxMinuten || 30, gekuerzt, verkuerzt: false, notiz: '', dauer_min: null,
    uebungen: liste.map((u) => {
      const l = letzteUebung(u.name, datum);
      const b = bereich(u.wdh);
      const zeit = !!u.sek;
      let hinweis = '';
      if (l && b && !zeit && l.uebung.saetze.every((x) => (x.wdh || 0) >= b.max)) {
        hinweis = l.uebung.saetze.some((x) => x.kg > 0) ? 'Obere Grenze erreicht → heute 1–2 kg mehr versuchen.' : 'Obere Grenze erreicht → langsameres Tempo oder schwerere Variante.';
      }
      return {
        name: u.name, zeit, planNotiz: u.notiz || '', ziel: zielText(u),
        letzte: l ? `Letztes Mal (${deKurz(l.datum)}): ${satzText(l.uebung.saetze)}${l.uebung.notiz ? ` – ${l.uebung.notiz}` : ''}` : 'Noch nie eingetragen – Startwerte aus dem Plan.',
        hinweis, notiz: '',
        saetze: Array.from({ length: u.saetze || 3 }, (_, i) => {
          const ls = l ? l.uebung.saetze[Math.min(i, l.uebung.saetze.length - 1)] : null;
          return zeit
            ? { sek: (ls && ls.sek) || u.sek, fertig: false }
            : { kg: ls ? ls.kg ?? 0 : u.kg ?? 0, wdh: ls && ls.wdh !== undefined ? ls.wdh : b ? b.min : null, fertig: false };
        }),
      };
    }),
  };
}

let audio = null;
function tonBereit() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* kein Ton verfügbar */ }
}
function ton(anzahl = 2) {
  if (navigator.vibrate) navigator.vibrate(Array.from({ length: anzahl * 2 - 1 }, () => 200));
  if (!audio) return;
  try {
    for (let i = 0; i < anzahl; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(audio.destination);
      const t = audio.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t); o.stop(t + 0.3);
    }
  } catch { /* ignorieren */ }
}

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function beende(nurBestaetigte) {
  const en = S.entwurf;
  const uebungen = en.uebungen.map((u) => {
    const saetze = u.saetze.filter((x) => !nurBestaetigte || x.fertig).map((x) => (u.zeit ? { sek: x.sek } : { wdh: x.wdh ?? 0, kg: x.kg ?? 0 }));
    const aus = { name: u.name, saetze };
    if (u.notiz) aus.notiz = u.notiz;
    return aus;
  }).filter((u) => u.saetze.length);
  const live = en.datum === heuteIso() && en.dauer_min === null;
  const t = {
    id: neueId(), typ: 'kraft', datum: en.datum, einheit: en.einheit,
    dauer_min: live ? Math.max(1, Math.round((Date.now() - en.startMs) / 60000)) : en.dauer_min,
    verkuerzt: !!en.verkuerzt, uebungen, notiz: en.notiz || '',
  };
  const i = S.state.trainings.findIndex((x) => x.typ === 'kraft' && x.datum === t.datum && x.einheit === t.einheit);
  if (i >= 0) {
    if (!confirm(`Für ${de(t.datum)} gibt es schon eine Einheit „${t.einheit}“. Ersetzen?`)) return;
    t.id = S.state.trainings[i].id;
    S.state.trainings[i] = t;
  } else {
    S.state.trainings.push(t);
  }
  speichern('trainings');
  S.entwurf = null;
  speichereEntwurf();
  meldung('Training gespeichert');
  location.hash = `#training/einheit/${t.id}`;
}

function startScreen(einheit, datumArg) {
  const datum = istDatum(datumArg) ? datumArg : heuteIso();
  const zurueck = 'training';
  if (!S.state.einstellungen.plan.einheiten[einheit]) return { titel: 'Training', zurueck, knoten: h('p', { class: 'leer' }, `Die Einheit „${einheit}“ gibt es im Plan nicht.`) };

  if (S.entwurf && (S.entwurf.einheit !== einheit || S.entwurf.datum !== datum)) {
    return { titel: einheit, zurueck, knoten: karte('Es läuft noch ein Training',
      h('p', null, `${S.entwurf.einheit} vom ${de(S.entwurf.datum)} ist noch nicht abgeschlossen.`),
      h('div', { class: 'knopfreihe abstand' },
        h('a', { class: 'knopf haupt', href: `#training/start/${enc(S.entwurf.einheit)}/${S.entwurf.datum}` }, 'Fortsetzen'),
        h('button', { type: 'button', class: 'knopf gefahr', onclick: () => { if (confirm('Laufendes Training verwerfen?')) { S.entwurf = null; speichereEntwurf(); neu(); } } }, 'Verwerfen'),
      )) };
  }
  if (!S.entwurf) { S.entwurf = neuerEntwurf(einheit, datum); speichereEntwurf(); }
  const en = S.entwurf;
  const live = datum === heuteIso();
  const sichern = () => speichereEntwurf();

  // Timer
  const zeitEl = h('span', { class: 'gross zeit' }, '0:00');
  const pauseEl = h('span', { class: 'gross pause' }, '');
  const timer = h('div', { class: 'timer', 'data-laeuft': '1' },
    h('div', { class: 'zeile' },
      h('div', { class: 'wachs' }, h('div', { class: 'klein' }, `Einheit (max. ${en.maxMin} Min.)`), zeitEl),
      h('div', { class: 'rechtsb' }, h('div', { class: 'klein' }, 'Pause'), pauseEl),
    ),
    h('div', { class: 'knopfreihe', style: 'margin-top:6px' },
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { tonBereit(); en.pauseBis = Date.now() + S.state.einstellungen.pauseSek * 1000; en.pauseGemeldet = false; sichern(); tick(); } }, `Pause ${S.state.einstellungen.pauseSek} Sek.`),
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { if (en.pauseBis) { en.pauseBis += 15000; en.pauseGemeldet = false; sichern(); tick(); } } }, '+15 Sek.'),
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { en.pauseBis = null; en.pauseGemeldet = true; sichern(); tick(); } }, 'Stopp'),
    ),
  );
  function tick() {
    const jetzt = Date.now();
    const lauf = jetzt - en.startMs;
    zeitEl.textContent = `${mmss(lauf)} / ${en.maxMin}:00`;
    timer.classList.toggle('ueber', lauf >= en.maxMin * 60000);
    if (lauf >= en.maxMin * 60000 && !en.zeitGemeldet) { en.zeitGemeldet = true; sichern(); ton(3); }
    if (en.pauseBis) {
      const rest = en.pauseBis - jetzt;
      pauseEl.textContent = rest > 0 ? mmss(rest) : 'Weiter!';
      pauseEl.classList.toggle('fertig', rest <= 0);
      if (rest <= 0 && !en.pauseGemeldet) { en.pauseGemeldet = true; sichern(); ton(2); }
    } else {
      pauseEl.textContent = '–';
      pauseEl.classList.remove('fertig');
    }
  }
  if (live) {
    tick();
    const takt = setInterval(tick, 500);
    beiVerlassen(() => clearInterval(takt));
  }

  const uebungKarte = (u) => {
    const zeilen = h('div');
    const zeichne = () => zeilen.replaceChildren(
      h('div', { class: `satz ${u.zeit ? 'zeit' : ''}` }, h('span'), u.zeit ? h('span', { class: 'satzkopf' }, 'Sekunden') : [h('span', { class: 'satzkopf' }, 'kg'), h('span'), h('span', { class: 'satzkopf' }, 'Wdh.')], h('span')),
      ...u.saetze.map((x, i) => {
        const zeile = h('div', { class: `satz ${u.zeit ? 'zeit' : ''} ${x.fertig ? 'fertig' : ''}` },
          h('span', { class: 'nr' }, i + 1),
          u.zeit
            ? zahlFeld({ wert: x.sek, min: 0, max: 36000, onChange: (v) => { x.sek = v; sichern(); } })
            : [zahlFeld({ wert: x.kg, min: 0, max: 1000, onChange: (v) => { x.kg = v ?? 0; sichern(); } }), h('span', { class: 'nr' }, '×'), zahlFeld({ wert: x.wdh, ganz: true, min: 0, max: 10000, onChange: (v) => { x.wdh = v; sichern(); } })],
          h('button', { type: 'button', class: 'ok', 'aria-label': `Satz ${i + 1} bestätigen`, onclick: () => {
            x.fertig = !x.fertig;
            zeile.classList.toggle('fertig', x.fertig);
            if (x.fertig && live) { tonBereit(); en.pauseBis = Date.now() + S.state.einstellungen.pauseSek * 1000; en.pauseGemeldet = false; tick(); }
            sichern();
          } }, '✓'),
        );
        return zeile;
      }),
    );
    zeichne();
    return h('section', { class: 'karte' },
      h('h2', null, u.name),
      h('p', { class: 'fett' }, `Ziel heute: ${u.ziel}`),
      u.planNotiz ? h('p', { class: 'klein' }, u.planNotiz) : null,
      h('p', { class: 'klein' }, u.letzte),
      u.hinweis ? h('p', { class: 'klein', style: 'color:var(--gruen);font-weight:600' }, u.hinweis) : null,
      h('div', { class: 'abstand' }, zeilen),
      h('div', { class: 'knopfreihe', style: 'margin-bottom:8px' },
        h('button', { type: 'button', class: 'knopf schmal', onclick: () => { const l = u.saetze.at(-1) || {}; u.saetze.push({ ...l, fertig: false }); sichern(); zeichne(); } }, '+ Satz'),
        h('button', { type: 'button', class: 'knopf schmal', onclick: () => { if (u.saetze.length > 1) { u.saetze.pop(); sichern(); zeichne(); } } }, '− Satz'),
      ),
      textFeld({ platzhalter: 'Notiz (Tempo, Technik …)', wert: u.notiz, onChange: (v) => { u.notiz = v; sichern(); } }),
    );
  };

  const pauseWahl = h('select', { onchange: () => { S.state.einstellungen.pauseSek = Number(pauseWahl.value); speichern('einstellungen'); neu(); } },
    [30, 45, 60, 75, 90, 120, 180].map((sek) => h('option', { value: sek }, `${sek} Sekunden`)));
  pauseWahl.value = String(S.state.einstellungen.pauseSek);
  const verkuerztBox = h('input', { type: 'checkbox', style: 'width:24px;height:24px', onchange: () => { en.verkuerzt = verkuerztBox.checked; sichern(); } });
  verkuerztBox.checked = !!en.verkuerzt;

  const knoten = h('div', null,
    live ? timer : h('div', { class: 'hinweis ruhig' }, `Nachtrag für ${deMitTag(datum)}`),
    en.gekuerzt ? h('div', { class: 'hinweis ruhig' }, `Minimalversion: ${en.maxMin} Min., die ersten ${en.uebungen.length} Übungen.`) : null,
    en.uebungen.map(uebungKarte),
    karte('Abschluss',
      live ? h('label', { class: 'feld' }, h('span', null, 'Pausentimer'), pauseWahl) : zahlFeld({ label: 'Dauer', einheit: 'Min.', wert: en.dauer_min, min: 0, max: 600, onChange: (v) => { en.dauer_min = v; sichern(); } }),
      h('label', { class: 'zeile', style: 'min-height:48px' }, verkuerztBox, h('span', { class: 'wachs' }, 'Verkürzt trainiert (zählt gelb)')),
      textFeld({ label: 'Notiz zur Einheit', wert: en.notiz, mehrzeilig: true, onChange: (v) => { en.notiz = v; sichern(); } }),
      h('button', { type: 'button', class: 'knopf haupt breit', onclick: () => {
        const bestaetigt = en.uebungen.some((u) => u.saetze.some((x) => x.fertig));
        if (bestaetigt) return beende(true);
        if (confirm('Du hast keinen Satz mit ✓ bestätigt. Alle Sätze so speichern, wie sie eingetragen sind?')) beende(false);
      } }, 'Training beenden und speichern'),
      h('button', { type: 'button', class: 'knopf gefahr breit abstand', onclick: () => { if (confirm('Training verwerfen? Die Eingaben gehen verloren.')) { S.entwurf = null; speichereEntwurf(); location.hash = '#training'; } } }, 'Verwerfen'),
    ),
  );
  return { titel: einheit, zurueck, knoten };
}

function nachtragScreen(datumArg) {
  const datum = istDatum(datumArg) ? datumArg : heuteIso();
  const einheiten = Object.keys(S.state.einstellungen.plan.einheiten);
  return { titel: 'Kraft nachtragen', zurueck: `tag/${datum}`, knoten: karte(deMitTag(datum),
    h('p', { class: 'klein', style: 'margin-bottom:10px' }, 'Welche Einheit möchtest du eintragen?'),
    h('div', { class: 'knopfreihe' }, einheiten.map((n) => h('a', { class: 'knopf haupt', href: `#training/start/${enc(n)}/${datum}` }, n)))) };
}

// ---------- Cardio ----------

function cardioScreen(artArg, datumArg) {
  const f = { art: CARDIO_ARTEN.includes(artArg) ? artArg : 'Laufband', datum: istDatum(datumArg) ? datumArg : heuteIso(), dauer_min: null, km: null, notiz: '' };
  const artWahl = h('select', { onchange: () => { f.art = artWahl.value; } }, CARDIO_ARTEN.map((a) => h('option', { value: a }, a)));
  artWahl.value = f.art;
  const knoten = karte('Cardio eintragen',
    h('label', { class: 'feld' }, h('span', null, 'Art'), artWahl),
    datumFeld({ label: 'Datum', wert: f.datum, onChange: (v) => { f.datum = v; } }),
    h('div', { class: 'raster2' },
      zahlFeld({ label: 'Dauer', einheit: 'Min.', wert: null, min: 0, max: 1440, onChange: (v) => { f.dauer_min = v; } }),
      zahlFeld({ label: 'Strecke (optional)', einheit: 'km', wert: null, min: 0, max: 500, onChange: (v) => { f.km = v; } }),
    ),
    textFeld({ label: 'Notiz', wert: '', onChange: (v) => { f.notiz = v; } }),
    h('button', { type: 'button', class: 'knopf haupt breit', onclick: () => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (!f.dauer_min) { meldung('Bitte die Dauer in Minuten eintragen.'); return; }
      const t = { id: neueId(), typ: 'cardio', datum: f.datum, art: f.art, dauer_min: f.dauer_min, km: f.km };
      if (f.notiz) t.notiz = f.notiz;
      S.state.trainings.push(t);
      const p = planTag(S.state.einstellungen, f.datum);
      if (/fu(ß|ss)ball/i.test(f.art) && p && p.typ === 'fussball') { tagVon(S.state, f.datum, true).fussball = true; speichern('tage'); }
      speichern('trainings');
      meldung(`${f.art} gespeichert`);
      location.hash = f.datum === heuteIso() ? '#heute' : `#tag/${f.datum}`;
    } }, 'Speichern'),
  );
  return { titel: 'Cardio', zurueck: 'training', knoten };
}

// ---------- Detail einer Einheit ----------

function einheitScreen(id) {
  const t = S.state.trainings.find((x) => x.id === id);
  if (!t) return { titel: 'Einheit', zurueck: 'training', knoten: h('p', { class: 'leer' }, 'Diese Einheit gibt es nicht mehr.') };
  const loesche = () => {
    if (!confirm('Diese Einheit endgültig löschen?')) return;
    S.state.trainings = S.state.trainings.filter((x) => x !== t);
    speichern('trainings');
    location.hash = '#training';
  };
  const knoten = h('div', null,
    karte(deMitTag(t.datum),
      h('p', { class: 'fett' }, einheitText(t)),
      t.notiz ? h('p', { class: 'klein abstand' }, t.notiz) : null,
      h('a', { class: 'knopf schmal breit abstand', href: `#tag/${t.datum}` }, 'Zum Tag'),
    ),
    t.typ === 'kraft'
      ? (t.uebungen || []).map((u) => h('section', { class: 'karte' },
        h('h2', null, h('a', { href: `#training/uebung/${enc(uebungsSchluessel(u.name))}` }, `${u.name} ›`)),
        u.saetze && u.saetze.length ? h('p', { class: 'fett' }, satzText(u.saetze)) : null,
        u.notiz ? h('p', { class: 'klein' }, u.notiz) : null))
      : null,
    t.typ === 'kraft' ? h('button', { type: 'button', class: 'knopf breit', style: 'margin-bottom:8px', onclick: () => { t.verkuerzt = !t.verkuerzt; speichern('trainings'); neu(); } }, t.verkuerzt ? 'Als vollständig markieren' : 'Als verkürzt markieren') : null,
    h('button', { type: 'button', class: 'knopf gefahr breit', onclick: loesche }, 'Einheit löschen'),
  );
  return { titel: t.typ === 'kraft' ? t.einheit : t.art, zurueck: 'training', knoten };
}

// ---------- Verlauf einer Übung ----------

function uebungScreen(key) {
  const eintraege = [];
  let name = key;
  for (const t of [...S.state.trainings].sort((a, b) => (a.datum < b.datum ? -1 : 1))) {
    for (const u of t.uebungen || []) {
      if (uebungsSchluessel(u.name) !== key || !u.saetze || !u.saetze.length) continue;
      name = u.name.split(/[,(]/)[0].trim();
      eintraege.push({ datum: t.datum, id: t.id, saetze: u.saetze, notiz: u.notiz });
    }
  }
  if (!eintraege.length) return { titel: 'Übung', zurueck: 'training', knoten: h('p', { class: 'leer' }, 'Für diese Übung gibt es noch keine Einträge.') };
  const alle = eintraege.flatMap((e) => e.saetze);
  const art = alle.some((x) => x.kg > 0) ? 'kg' : alle.some((x) => x.wdh !== undefined) ? 'wdh' : 'sek';
  const wert = (x) => (art === 'kg' ? (x.kg || 0) * (x.wdh || 0) : art === 'wdh' ? x.wdh || 0 : x.sek || 0);
  const besterSatz = (saetze) => saetze.reduce((a, b) => (wert(b) > wert(a) ? b : a), saetze[0]);
  const text = (x) => (art === 'kg' ? `${fmt(x.kg || 0, 1)} kg × ${x.wdh ?? 0}` : art === 'wdh' ? `${x.wdh} Wdh.` : `${x.sek} Sek.`);
  const best = eintraege.map((e) => ({ e, satz: besterSatz(e.saetze) })).reduce((a, b) => (wert(b.satz) > wert(a.satz) ? b : a));
  const einheit = art === 'kg' ? 'kg × Wdh. (bester Satz je Einheit)' : art === 'wdh' ? 'Wiederholungen (bester Satz)' : 'Sekunden (bester Satz)';

  const knoten = h('div', null,
    karte('Bestwert', h('p', { style: 'font-size:26px;font-weight:700' }, text(best.satz)), h('p', { class: 'klein' }, `am ${de(best.e.datum)}`)),
    karte('Verlauf', diagramm({ einheit, yMin: 0, serien: [{ klasse: 'c1', punkte: eintraege.map((e) => ({ x: e.datum, y: wert(besterSatz(e.saetze)) })) }] })),
    karte('Alle Einträge', h('div', { class: 'liste' }, [...eintraege].reverse().map((e) => h('a', { href: `#training/einheit/${e.id}` },
      h('span', { style: 'width:64px;flex:none;color:var(--text2);font-size:14px' }, deKurz(e.datum)),
      h('span', { class: 'wachs' }, satzText(e.saetze), e.notiz ? h('div', { class: 'klein' }, e.notiz) : null),
      h('span', { class: 'pfeil' }, '›'))))),
  );
  return { titel: name, zurueck: 'training', knoten };
}

export function trainingScreen([sub, a, b]) {
  if (sub === 'start') return startScreen(a, b);
  if (sub === 'cardio') return cardioScreen(a, b);
  if (sub === 'nachtrag') return nachtragScreen(a);
  if (sub === 'einheit') return einheitScreen(a);
  if (sub === 'uebung') return uebungScreen(a);
  if (sub === 'liste') return listeScreen();
  return uebersicht();
}
