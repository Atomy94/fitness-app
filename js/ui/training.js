// Bildschirm "Training": Wochenplan, Einheit durchführen (mit Timern), Cardio eintragen,
// Liste aller Einheiten, Verlauf und Bestwert pro Übung.

import { S, heuteIso, neu, speichern, speichereEntwurf, beiVerlassen, meldung } from '../store.js';
import { h, karte, zahlFeld, textFeld, datumFeld, diagramm, STATUS_TEXT } from './dom.js';
import { symbol, kachel, uebungsArt } from './symbole.js';
import { tagBewertung } from '../core/bewertung.js';
import { einheitText } from './tag.js';
import { minimalAktiv, planTag, planAuswahl } from '../core/ziele.js';
import { neueId, uebungsSchluessel, tagVon } from '../core/state.js';
import { fmt } from '../core/zahl.js';
import { uebungsVerlaeufe, vergleich, variante, zuletztSchwer, ergaenzePlanUebung } from '../core/kraft.js';
import { WT_LANG, WT_KURZ, wochentag, wochenTage, montag, de, deKurz, deMitTag, istDatum } from '../core/datum.js';

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

/** Vorgeschriebene Pause nach jedem Satz dieser Übung (Sekunden). */
const pauseVon = (u) => (typeof u.pause_sek === 'number' ? u.pause_sek : S.state.einstellungen.pauseSek);

/** "3 × 8-12", "2 × 40 Sek." oder – ohne Vorgabe für Wiederholungen – "4 Sätze". */
const satzZielText = (u) => (u.sek ? `${u.saetze} × ${u.sek} Sek.` : u.wdh ? `${u.saetze} × ${u.wdh}` : `${u.saetze} ${u.saetze === 1 ? 'Satz' : 'Sätze'}`);

function zielText(u) {
  return `${satzZielText(u)}${u.kg ? ` · ${fmt(u.kg, 1)} kg${u.kg_text ? ` (${u.kg_text})` : ''}` : ''}`;
}

// ---------- Bausteine für die Gestaltung ----------

const chip = (sym, text, klasse = '') => h('span', { class: `chip ${klasse}`.trim() }, sym ? symbol(sym) : null, text);

/** Sätze × Wiederholungen, Gewicht und Pause einer Plan-Übung als kleine Marken. */
function zielChips(u) {
  return h('div', { class: 'chips' },
    chip('wdh', satzZielText(u)),
    u.kg ? chip('gewicht', `${fmt(u.kg, 1)} kg${u.kg_text ? ` (${u.kg_text})` : ''}`) : null,
    chip('uhr', `Pause ${pauseVon(u)} s`),
  );
}

const einheitKachel = (t, groesse = '') => kachel(t.typ === 'kraft' ? 'Krafttraining' : t.art, groesse);

// ---------- Steigerung je Übung ----------

const trendMarke = (v) => h('span', { class: `marke s-${v.richtung > 0 ? 'gruen' : v.richtung < 0 ? 'gelb' : 'grau'}` }, `${v.richtung > 0 ? '↑' : v.richtung < 0 ? '↓' : '='} ${v.text}`);

/** Liste aller Übungen: letzter Stand (Gewicht × Wiederholungen) und Veränderung. Auch auf "Fortschritt". */
export function steigerungKarte() {
  const verlaeufe = uebungsVerlaeufe(S.state);
  return karte('Steigerung je Übung',
    verlaeufe.length ? h('div', { class: 'liste' }, verlaeufe.map((v) => {
      const l = v.eintraege.at(-1);
      const vor = v.eintraege.at(-2);
      const erste = v.eintraege[0];
      return h('a', { href: `#training/uebung/${enc(v.key)}` },
        kachel(v.name, 'klein'),
        h('span', { class: 'wachs' }, h('b', null, v.name),
          h('div', { class: 'klein' }, `${satzText(l.saetze)} · ${deKurz(l.datum)}`),
          v.eintraege.length > 2 ? h('div', { class: 'klein' }, `seit ${deKurz(erste.datum)}: ${vergleich(erste, l).text}`) : null),
        vor ? trendMarke(vergleich(vor, l)) : h('span', { class: 'marke neutral' }, 'neu'),
        h('span', { class: 'pfeil' }, '›'));
    })) : h('p', { class: 'leer' }, 'Noch keine Krafteinheiten. Nach dem ersten Training erscheint hier jede Übung mit Gewicht und Wiederholungen.'),
    verlaeufe.length ? h('p', { class: 'klein abstand' }, 'Die Marke zeigt die Veränderung zur vorherigen Einheit. Tippe auf eine Übung für den ganzen Verlauf.') : null,
  );
}

// ---------- Übersicht ----------

/** Die laufende Woche als Leiste: je Tag Symbol des Plans, Farbe = Status des Bereichs Training. */
function wochenLeiste(d) {
  return h('div', { class: 'woche' }, wochenTage(montag(d)).map((tag, i) => {
    const b = tagBewertung(S.state, tag, d);
    const p = b.plan;
    const sym = !p ? 'ruhe' : p.typ === 'laufband' ? 'laufen' : p.typ === 'fussball' ? 'ball' : 'hantel';
    const kurz = !p ? 'frei' : p.typ === 'laufband' ? `${p.minuten || 30}′` : p.typ === 'fussball' ? 'Spiel' : `${(p.einheit || '').replace(/^Kraft\s+/i, '')}${p.typ === 'bonus' ? '+' : ''}`;
    return h('a', { class: `wtag s-${b.training}${tag === d ? ' heute' : ''}`, href: `#tag/${tag}`, 'aria-label': `${WT_LANG[i]}: ${p ? p.text || p.typ : 'kein Trainingsziel'}, ${STATUS_TEXT[b.training]}` },
      h('span', { class: 'wt' }, WT_KURZ[i]),
      symbol(sym),
      h('span', { class: 'wk' }, kurz),
      b.zusatz ? h('span', { class: 'wstern' }, '★') : null,
    );
  }));
}

/** Große Karte einer Kraft-Einheit: Buchstabe, Eckdaten und die Symbole ihrer Übungen. */
function einheitKarte(name, d) {
  const liste = S.state.einstellungen.plan.einheiten[name];
  const p = planTag(S.state.einstellungen, d);
  const dran = planAuswahl(p).some((w) => w.einheit === name);
  const letzte = sortiert().find((t) => t.typ === 'kraft' && t.einheit === name);
  const laeuft = !!S.entwurf && S.entwurf.einheit === name;
  const m = name.match(/^Kraft\s+(\S)/i);
  return h('a', { class: `ekarte${dran ? ' dran' : ''}`, href: `#training/start/${enc(name)}${laeuft ? `/${S.entwurf.datum}` : ''}` },
    h('div', { class: 'zeile' },
      h('span', { class: 'ebuchstabe' }, (m ? m[1] : name.slice(0, 1)).toUpperCase()),
      h('div', { class: 'wachs' }, h('b', null, name), h('div', { class: 'klein' }, `${liste.length} Übungen · ${letzte ? `zuletzt ${deKurz(letzte.datum)}` : 'noch nie trainiert'}`)),
      laeuft ? h('span', { class: 'marke s-gelb' }, 'läuft') : dran ? h('span', { class: 'marke akzent' }, 'heute dran') : null,
      h('span', { class: 'pfeil' }, '›'),
    ),
    h('div', { class: 'esymbole' }, liste.map((u) => kachel(u.name, 'klein'))),
  );
}

function uebersicht() {
  const st = S.state;
  const d = heuteIso();
  const e = st.einstellungen;
  const minimal = minimalAktiv(e, d);
  const einheiten = Object.keys(e.plan.einheiten);
  const letzte = sortiert().slice(0, 6);
  const heutePlan = planTag(e, d);

  const knoten = h('div', null,
    S.entwurf ? h('a', { class: 'hinweis info', href: `#training/start/${enc(S.entwurf.einheit)}/${S.entwurf.datum}` }, `Laufendes Training: ${S.entwurf.einheit}`, h('small', null, 'Tippe hier, um fortzusetzen.')) : null,
    h('section', { class: 'karte' },
      h('h2', null, 'Diese Woche'),
      wochenLeiste(d),
      h('p', { class: 'klein abstand' }, h('b', null, 'Heute: '), heutePlan ? heutePlan.text || heutePlan.einheit || '' : 'kein Trainingsziel'),
      minimal ? h('p', { class: 'klein abstand' }, `Minimalversion aktiv: Kraft an den Pflichttagen je ${e.minimalKraft.minuten} Min. (erste ${e.minimalKraft.uebungen} Übungen), Laufband ohne Wertung.`) : null,
    ),
    !S.entwurf && planAuswahl(heutePlan).length > 1 && !sortiert().some((t) => t.typ === 'kraft' && t.datum === d)
      ? karte('Wie trainierst du heute?', h('div', { class: 'knopfreihe' }, planAuswahl(heutePlan).map((w) => h('a', { class: 'knopf haupt', href: `#training/start/${enc(w.einheit)}` }, w.text))))
      : null,
    h('h2', { class: 'abschnitt' }, 'Krafttraining'),
    einheiten.map((n) => einheitKarte(n, d)),
    h('h2', { class: 'abschnitt' }, 'Cardio eintragen'),
    h('div', { class: 'kacheln3' }, CARDIO_ARTEN.slice(0, 3).map((a) => h('a', { class: 'ckachel', href: `#training/cardio/${enc(a)}/${d}` }, kachel(a), h('span', null, a)))),
    steigerungKarte(),
    karte('Letzte Einheiten',
      letzte.length ? h('div', { class: 'liste' }, letzte.map(einheitZeile)) : h('p', { class: 'leer' }, 'Noch keine Einheiten'),
      st.trainings.length > 6 ? h('a', { class: 'knopf schmal breit abstand', href: '#training/liste' }, `Alle ${st.trainings.length} Einheiten`) : null,
    ),
    karte('Einheiten im Plan',
      einheiten.map((n) => h('details', null, h('summary', null, n),
        h('div', { class: 'liste' }, e.plan.einheiten[n].map((u) => h('li', { class: 'planzeile' },
          kachel(u.name, 'klein'),
          h('span', { class: 'wachs' }, h('b', null, u.name), zielChips(u),
            u.schwer && u.schwer.name ? h('div', { class: 'klein' }, `↑ anspruchsvoller: ${u.schwer.name}`) : null),
        ))),
      )),
      e.plan.progression ? h('p', { class: 'klein abstand' }, `Steigerung: ${e.plan.progression}`) : null,
      h('a', { class: 'knopf schmal breit abstand', href: '#mehr/plan' }, 'Trainingsplan bearbeiten'),
    ),
  );
  return { titel: 'Training', knoten };
}

const einheitZeile = (t) => h('a', { href: `#training/einheit/${t.id}` },
  einheitKachel(t, 'klein'),
  h('span', { class: 'wachs' }, h('b', null, t.typ === 'kraft' ? t.einheit : t.art),
    h('div', { class: 'klein' }, `${WT_LANG[wochentag(t.datum) - 1].slice(0, 2)}, ${deKurz(t.datum)}${t.dauer_min ? ` · ${t.dauer_min} Min.` : ''}${t.km ? ` · ${fmt(t.km, 2)} km` : ''}${t.verkuerzt ? ' · verkürzt' : ''}`)),
  h('span', { class: 'pfeil' }, '›'));

function listeScreen() {
  const alle = sortiert();
  return { titel: 'Alle Einheiten', zurueck: 'training', knoten: karte(null, alle.length ? h('div', { class: 'liste' }, alle.map(einheitZeile)) : h('p', { class: 'leer' }, 'Noch keine Einheiten')) };
}

// ---------- Einheit durchführen ----------

/** Übungen einer Einheit für ein Datum. In der Minimalversion nur die ersten und mit kürzerer Zeit. */
function planListe(einheit, datum) {
  const e = S.state.einstellungen;
  const plan = e.plan.einheiten[einheit] || [];
  const p = planTag(e, datum);
  const gekuerzt = !!(minimalAktiv(e, datum) && p && p.typ === 'kraft');
  return { liste: gekuerzt ? plan.slice(0, e.minimalKraft.uebungen) : plan, gekuerzt, maxMin: gekuerzt ? e.minimalKraft.minuten : e.plan.maxMinuten || 30 };
}

function letzteZeile(name, datum) {
  const l = letzteUebung(name, datum);
  return l ? `Letztes Mal (${deKurz(l.datum)}): ${satzText(l.uebung.saetze)}${l.uebung.notiz ? ` – ${l.uebung.notiz}` : ''}` : 'Noch nie eingetragen – Startwerte aus dem Plan.';
}

/** Eine Übung für das laufende Training: einfache oder anspruchsvollere Version, vorbelegt mit den letzten Werten. */
function entwurfUebung(planUebung, datum, schwer) {
  const u = variante(planUebung, schwer);
  const l = letzteUebung(u.name, datum);
  const b = bereich(u.wdh);
  const zeit = !!u.sek;
  let hinweis = '';
  if (l && b && !zeit && l.uebung.saetze.every((x) => (x.wdh || 0) >= b.max)) {
    hinweis = l.uebung.saetze.some((x) => x.kg > 0) ? 'Obere Grenze erreicht → heute 1–2 kg mehr versuchen.' : 'Obere Grenze erreicht → langsameres Tempo oder schwerere Variante.';
  }
  return {
    name: u.name, zeit, planNotiz: u.notiz || '', ziel: zielText(u),
    satzZiel: satzZielText(u), kgZiel: u.kg ? `${fmt(u.kg, 1)} kg` : '',
    basis: planUebung.name, schwer: u.name !== planUebung.name, hatSchwer: !!(planUebung.schwer && planUebung.schwer.name),
    letzte: letzteZeile(u.name, datum),
    hinweis, notiz: '', pauseSek: pauseVon(u),
    saetze: Array.from({ length: u.saetze || 3 }, (_, i) => {
      const ls = l ? l.uebung.saetze[Math.min(i, l.uebung.saetze.length - 1)] : null;
      return zeit
        ? { sek: (ls && ls.sek) || u.sek, fertig: false }
        : { kg: ls ? ls.kg ?? 0 : u.kg ?? 0, wdh: ls && ls.wdh !== undefined ? ls.wdh : b ? b.min : null, fertig: false };
    }),
  };
}

/** wahl[i] = true: von Übung i die anspruchsvollere Version nehmen. */
function neuerEntwurf(einheit, datum, wahl = []) {
  const { liste, gekuerzt, maxMin } = planListe(einheit, datum);
  return {
    einheit, datum, startMs: Date.now(), pauseBis: null, pauseGemeldet: true, zeitGemeldet: false,
    maxMin, gekuerzt, verkuerzt: false, notiz: '', dauer_min: null,
    uebungen: liste.map((u, i) => entwurfUebung(u, datum, !!wahl[i])),
  };
}

// Auswahl auf der Übersicht vor dem Start (einfach/anspruchsvoll je Übung)
let vorb = { einheit: null, datum: null, wahl: [] };

/** Übersicht einer Einheit VOR dem Start: Übungen ansehen, Version wählen, dann selbst starten. */
function vorbereitung(einheit, datum) {
  const live = datum === heuteIso();
  const { liste, gekuerzt, maxMin } = planListe(einheit, datum);
  if (vorb.einheit !== einheit || vorb.datum !== datum || vorb.wahl.length !== liste.length) {
    vorb = { einheit, datum, wahl: liste.map((u) => zuletztSchwer(S.state, u, datum)) };
  }
  const starte = () => {
    if (live) tonBereit();
    S.entwurf = neuerEntwurf(einheit, datum, vorb.wahl);
    speichereEntwurf();
    vorb = { einheit: null, datum: null, wahl: [] };
    neu();
    window.scrollTo(0, 0);
  };
  const startKnopf = () => h('button', { type: 'button', class: 'knopf haupt breit gross', onclick: starte }, symbol('start'), live ? 'Training starten' : 'Sätze eintragen');
  const saetze = liste.reduce((n, u) => n + (variante(u, false).saetze || 0), 0);
  const knoten = h('div', null,
    h('section', { class: 'karte auftakt' },
      h('div', { class: 'esymbole' }, liste.map((u, i) => kachel(variante(u, vorb.wahl[i]).name, 'klein'))),
      h('p', { class: 'auftakt-titel' }, live ? 'Noch läuft keine Zeit' : `Nachtrag für ${deMitTag(datum)}`),
      h('p', { class: 'klein' }, live ? 'Sieh dir die Übungen an und wähle die Version. Die Zeit beginnt erst mit „Training starten“.' : 'Wähle die Versionen, die du gemacht hast.'),
      h('div', { class: 'chips', style: 'justify-content:center' }, chip('hantel', `${liste.length} Übungen`), chip('wdh', `${saetze} Sätze`), live ? chip('uhr', `max. ${maxMin} Min.`) : null),
      gekuerzt ? h('p', { class: 'klein' }, `Minimalversion: nur die ersten ${liste.length} Übungen.`) : null,
      h('div', { class: 'abstand' }, startKnopf()),
    ),
    liste.map((planUebung, i) => {
      const u = variante(planUebung, vorb.wahl[i]);
      const hat = !!(planUebung.schwer && planUebung.schwer.name);
      return h('section', { class: `karte ukarte k-${uebungsArt(u.name).farbe}` },
        h('div', { class: 'ukopf' },
          kachel(u.name, 'gross'),
          h('div', { class: 'wachs' },
            h('div', { class: 'unr' }, `Übung ${i + 1} von ${liste.length}${hat ? (vorb.wahl[i] ? ' · anspruchsvoll' : ' · einfach') : ''}`),
            h('h3', null, u.name)),
        ),
        zielChips(u),
        u.notiz ? h('p', { class: 'klein abstand' }, u.notiz) : null,
        h('p', { class: 'klein abstand' }, letzteZeile(u.name, datum)),
        hat ? h('button', { type: 'button', class: 'knopf schmal breit abstand', onclick: () => { vorb.wahl[i] = !vorb.wahl[i]; neu(); } },
          symbol(vorb.wahl[i] ? 'pfeilRunter' : 'pfeilHoch'), vorb.wahl[i] ? `Einfacher: ${planUebung.name}` : `Anspruchsvoller: ${planUebung.schwer.name}`) : null,
      );
    }),
    startKnopf(),
  );
  return { titel: einheit, zurueck: live ? 'training' : `tag/${datum}`, knoten };
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

/** Reine Trainingszeit: angehaltene Zeit zählt nicht mit. */
const laufzeit = (en) => (en.angehaltenSeit || Date.now()) - en.startMs - (en.angehaltenMs || 0);

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
    dauer_min: live ? Math.max(1, Math.round(laufzeit(en) / 60000)) : en.dauer_min,
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
  if (!S.entwurf) return vorbereitung(einheit, datum);
  const en = S.entwurf;
  const live = datum === heuteIso();
  const sichern = () => speichereEntwurf();

  const abschliessen = () => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const bestaetigt = en.uebungen.some((u) => u.saetze.some((x) => x.fertig));
    if (bestaetigt) {
      const offen = en.uebungen.reduce((n, u) => n + u.saetze.filter((x) => !x.fertig).length, 0);
      if (offen && !confirm(`Training jetzt beenden? ${offen} ${offen === 1 ? 'Satz ist' : 'Sätze sind'} noch nicht bestätigt und ${offen === 1 ? 'wird' : 'werden'} nicht gespeichert.`)) return;
      beende(true);
    } else if (confirm('Du hast keinen Satz mit ✓ bestätigt. Alle Sätze so speichern, wie sie eingetragen sind?')) {
      beende(false);
    }
  };

  // Timer: oben die ganze Einheit (anhalten/fortsetzen/beenden), darunter die Satzpause.
  const zeitEl = h('span', { class: 'gross zeit' }, '0:00');
  const pauseEl = h('span', { class: 'gross pause' }, '');
  const pauseTitel = h('div', { class: 'klein' }, 'Satzpause');
  const standardPause = () => S.state.einstellungen.pauseSek;
  const startePause = (sek) => { en.pauseSoll = sek; en.pauseBis = Date.now() + sek * 1000; en.pauseGemeldet = false; };
  const haltKnopf = h('button', { type: 'button', class: 'knopf schmal', onclick: () => {
    if (en.angehaltenSeit) {
      en.angehaltenMs = (en.angehaltenMs || 0) + (Date.now() - en.angehaltenSeit);
      en.angehaltenSeit = null;
    } else {
      en.angehaltenSeit = Date.now();
      en.pauseBis = null; en.pauseGemeldet = true; // Satzpause endet mit dem Anhalten
    }
    sichern(); tick();
  } }, 'Anhalten');
  const zeitBalken = h('i');
  const satzStand = h('span');
  const zaehleSaetze = () => {
    const alle = en.uebungen.flatMap((u) => u.saetze);
    satzStand.textContent = `${alle.filter((x) => x.fertig).length} von ${alle.length} Sätzen`;
  };
  zaehleSaetze();
  const timer = h('div', { class: 'timer', 'data-laeuft': '1' },
    h('div', { class: 'zeile' },
      h('div', { class: 'wachs' }, h('div', { class: 'klein' }, `Einheit (max. ${en.maxMin} Min.)`), zeitEl),
      h('div', { class: 'rechtsb' }, pauseTitel, pauseEl),
    ),
    h('div', { class: 'tbalken' }, zeitBalken),
    h('div', { class: 'klein', style: 'text-align:right' }, satzStand),
    h('div', { class: 'knopfreihe', style: 'margin-top:6px' },
      haltKnopf,
      h('button', { type: 'button', class: 'knopf schmal', onclick: abschliessen }, 'Beenden'),
    ),
    h('div', { class: 'knopfreihe', style: 'margin-top:6px' },
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { if (en.angehaltenSeit) return; tonBereit(); startePause(en.pauseSoll || standardPause()); sichern(); tick(); } }, 'Pause neu'),
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { if (en.pauseBis) { en.pauseBis += 15000; en.pauseGemeldet = false; sichern(); tick(); } } }, '+15 s'),
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { en.pauseBis = null; en.pauseGemeldet = true; sichern(); tick(); } }, 'Pause aus'),
    ),
  );
  function tick() {
    const jetzt = Date.now();
    const lauf = laufzeit(en);
    const haelt = !!en.angehaltenSeit;
    zeitEl.textContent = `${mmss(lauf)} / ${en.maxMin}:00${haelt ? ' ⏸' : ''}`;
    haltKnopf.textContent = haelt ? 'Fortsetzen' : 'Anhalten';
    haltKnopf.classList.toggle('haupt', haelt);
    timer.classList.toggle('angehalten', haelt);
    timer.classList.toggle('ueber', lauf >= en.maxMin * 60000);
    zeitBalken.style.width = `${Math.min(100, (lauf / (en.maxMin * 60000)) * 100)}%`;
    if (lauf >= en.maxMin * 60000 && !en.zeitGemeldet) { en.zeitGemeldet = true; sichern(); ton(3); }
    if (en.pauseBis) {
      const rest = en.pauseBis - jetzt;
      pauseEl.textContent = rest > 0 ? mmss(rest) : 'Weiter!';
      pauseTitel.textContent = `Satzpause · Soll ${en.pauseSoll || standardPause()} Sek.`;
      pauseEl.classList.toggle('fertig', rest <= 0);
      if (rest <= 0 && !en.pauseGemeldet) { en.pauseGemeldet = true; sichern(); ton(2); }
    } else {
      pauseEl.textContent = '–';
      pauseTitel.textContent = 'Satzpause';
      pauseEl.classList.remove('fertig');
    }
  }
  if (live) {
    tick();
    const takt = setInterval(tick, 500);
    beiVerlassen(() => clearInterval(takt));
  }

  const wechsleVersion = (u) => {
    const planUebung = planListe(einheit, datum).liste.find((x) => x.name === u.basis);
    if (!planUebung) return;
    en.uebungen[en.uebungen.indexOf(u)] = entwurfUebung(planUebung, datum, !u.schwer);
    sichern(); neu();
  };

  const uebungKarte = (u) => {
    const zeilen = h('div');
    const pips = h('div', { class: 'pips' });
    const zeichnePips = () => { pips.replaceChildren(...u.saetze.map((x) => h('i', { class: x.fertig ? 'an' : '' }))); zaehleSaetze(); };
    const zeichne = () => zeilen.replaceChildren(
      h('div', { class: `satz ${u.zeit ? 'zeit' : ''}` }, h('span'), u.zeit ? h('span', { class: 'satzkopf' }, 'Sekunden') : [h('span', { class: 'satzkopf' }, 'kg'), h('span'), h('span', { class: 'satzkopf' }, 'Wdh.')], h('span')),
      ...u.saetze.map((x, i) => {
        const zeile = h('div', { class: `satz ${u.zeit ? 'zeit' : ''} ${x.fertig ? 'fertig' : ''}` },
          h('span', { class: 'nr' }, i + 1),
          u.zeit
            ? zahlFeld({ wert: x.sek, min: 0, max: 36000, onChange: (v) => { x.sek = v; sichern(); } })
            : [zahlFeld({ wert: x.kg, min: 0, max: 1000, onChange: (v) => { x.kg = v ?? 0; sichern(); } }), h('span', { class: 'nr' }, '×'), zahlFeld({ wert: x.wdh, ganz: true, min: 0, max: 10000, onChange: (v) => { x.wdh = v; sichern(); } })],
          h('button', { type: 'button', class: 'ok', 'aria-label': `Satz ${i + 1} bestätigen`, onclick: () => {
            if (!x.fertig && !u.zeit && (x.wdh === null || x.wdh === undefined)) {
              meldung('Bitte zuerst die Wiederholungen eintragen.');
              const feld = zeile.querySelectorAll('input')[1];
              if (feld) feld.focus();
              return;
            }
            x.fertig = !x.fertig;
            zeile.classList.toggle('fertig', x.fertig);
            zeichnePips();
            if (x.fertig && live && !en.angehaltenSeit) { tonBereit(); startePause(u.pauseSek ?? standardPause()); tick(); }
            sichern();
          } }, symbol('haken')),
        );
        return zeile;
      }),
    );
    zeichne();
    zeichnePips();
    return h('section', { class: `karte ukarte k-${uebungsArt(u.name).farbe}` },
      h('div', { class: 'ukopf' },
        kachel(u.name, 'gross'),
        h('div', { class: 'wachs' },
          h('div', { class: 'unr' }, `Übung ${en.uebungen.indexOf(u) + 1} von ${en.uebungen.length}${u.hatSchwer ? (u.schwer ? ' · anspruchsvoll' : ' · einfach') : ''}`),
          h('h3', null, u.name)),
        pips,
      ),
      h('div', { class: 'chips' }, chip('wdh', u.satzZiel || u.ziel), u.kgZiel ? chip('gewicht', u.kgZiel) : null, chip('uhr', `Pause ${u.pauseSek ?? standardPause()} s`)),
      u.planNotiz ? h('p', { class: 'klein abstand' }, u.planNotiz) : null,
      h('p', { class: 'klein abstand' }, u.letzte),
      u.hinweis ? h('p', { class: 'klein', style: 'color:var(--gruen);font-weight:600' }, u.hinweis) : null,
      h('div', { class: 'abstand' }, zeilen),
      h('div', { class: 'knopfreihe', style: 'margin-bottom:8px' },
        h('button', { type: 'button', class: 'knopf schmal', onclick: () => { const l = u.saetze.at(-1) || {}; u.saetze.push({ ...l, fertig: false }); sichern(); zeichne(); zeichnePips(); } }, '+ Satz'),
        h('button', { type: 'button', class: 'knopf schmal', onclick: () => { if (u.saetze.length > 1) { u.saetze.pop(); sichern(); zeichne(); zeichnePips(); } } }, '− Satz'),
      ),
      textFeld({ platzhalter: /band/i.test(u.name) ? 'Notiz (z. B. Bandstärke)' : 'Notiz (Tempo, Technik …)', wert: u.notiz, onChange: (v) => { u.notiz = v; sichern(); } }),
      u.hatSchwer ? h('button', { type: 'button', class: 'knopf schmal breit abstand', onclick: () => {
        if (u.saetze.some((x) => x.fertig) && !confirm('Für diese Übung sind schon Sätze bestätigt. Beim Wechsel der Version gehen sie verloren. Trotzdem wechseln?')) return;
        wechsleVersion(u);
      } }, symbol(u.schwer ? 'pfeilRunter' : 'pfeilHoch'), u.schwer ? `Zur einfachen Version: ${u.basis}` : 'Zur anspruchsvolleren Version') : null,
    );
  };

  // Eigene Übung hinzufügen: sofort im Training, auf Wunsch dauerhaft im Plan dieser Einheit
  const eigeneKarte = () => {
    const neuU = { name: '', saetze: 3 };
    const bekannte = uebungsVerlaeufe(S.state).map((v) => v.name);
    const nameFeld = h('input', { type: 'text', list: 'bekannte-uebungen', placeholder: 'Name der Übung', autocomplete: 'off', onchange: () => { neuU.name = nameFeld.value.trim(); } });
    const merken = h('input', { type: 'checkbox', style: 'width:24px;height:24px;flex:none' });
    merken.checked = true;
    return h('section', { class: 'karte' }, h('h2', null, 'Eigene Übung hinzufügen'),
      nameFeld, h('datalist', { id: 'bekannte-uebungen' }, bekannte.map((n) => h('option', { value: n }))),
      h('div', { class: 'abstand' }, zahlFeld({ label: 'Sätze', wert: 3, ganz: true, min: 1, max: 20, onChange: (v) => { neuU.saetze = v || 3; } })),
      h('label', { class: 'zeile', style: 'min-height:48px' }, merken, h('span', { class: 'wachs' }, `Künftig immer in „${einheit}“`)),
      h('button', { type: 'button', class: 'knopf breit', onclick: () => {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        neuU.name = nameFeld.value.trim();
        if (!neuU.name) { meldung('Bitte einen Namen eintragen.'); return; }
        if (en.uebungen.some((u) => uebungsSchluessel(u.name) === uebungsSchluessel(neuU.name))) { meldung('Diese Übung ist schon in der Einheit.'); return; }
        const planUebung = { name: neuU.name, saetze: neuU.saetze, wdh: '', kg: null };
        en.uebungen.push(entwurfUebung(planUebung, datum, false));
        if (merken.checked && ergaenzePlanUebung(S.state.einstellungen.plan.einheiten, einheit, planUebung)) speichern('einstellungen');
        sichern();
        meldung(`${neuU.name} hinzugefügt`);
        neu();
      } }, '+ Übung hinzufügen'),
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
    eigeneKarte(),
    karte('Abschluss',
      live ? h('label', { class: 'feld' }, h('span', null, 'Standard-Pause (für Übungen ohne eigene Vorgabe)'), pauseWahl) : zahlFeld({ label: 'Dauer', einheit: 'Min.', wert: en.dauer_min, min: 0, max: 600, onChange: (v) => { en.dauer_min = v; sichern(); } }),
      h('label', { class: 'zeile', style: 'min-height:48px' }, verkuerztBox, h('span', { class: 'wachs' }, 'Verkürzt trainiert (zählt gelb)')),
      textFeld({ label: 'Notiz zur Einheit', wert: en.notiz, mehrzeilig: true, onChange: (v) => { en.notiz = v; sichern(); } }),
      h('button', { type: 'button', class: 'knopf haupt breit', onclick: abschliessen }, 'Training beenden und speichern'),
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
  const bild = h('div', { style: 'text-align:center;margin-bottom:10px' }, kachel(f.art, 'gross'));
  artWahl.addEventListener('change', () => bild.replaceChildren(kachel(artWahl.value, 'gross')));
  const knoten = karte('Cardio eintragen',
    bild,
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
  const verlaeufe = t.typ === 'kraft' ? uebungsVerlaeufe(S.state) : [];
  const loesche = () => {
    if (!confirm('Diese Einheit endgültig löschen?')) return;
    S.state.trainings = S.state.trainings.filter((x) => x !== t);
    speichern('trainings');
    location.hash = '#training';
  };
  const knoten = h('div', null,
    karte(deMitTag(t.datum),
      h('div', { class: 'ukopf' }, einheitKachel(t, 'gross'), h('h3', { class: 'wachs' }, einheitText(t))),
      t.notiz ? h('p', { class: 'klein abstand' }, t.notiz) : null,
      h('a', { class: 'knopf schmal breit abstand', href: `#tag/${t.datum}` }, 'Zum Tag'),
    ),
    t.typ === 'kraft'
      ? (t.uebungen || []).map((u) => h('section', { class: `karte ukarte k-${uebungsArt(u.name).farbe}` },
        h('a', { class: 'ukopf', style: 'color:inherit;margin-bottom:8px', href: `#training/uebung/${enc(uebungsSchluessel(u.name))}` }, kachel(u.name), h('h3', { class: 'wachs' }, u.name), h('span', { class: 'pfeil', style: 'color:var(--text2);font-size:20px' }, '›')),
        u.saetze && u.saetze.length ? h('p', { class: 'fett' }, satzText(u.saetze)) : null,
        (() => {
          // Vergleich mit der vorherigen Einheit, in der diese Übung vorkam
          const v = verlaeufe.find((x) => x.key === uebungsSchluessel(u.name));
          const i = v ? v.eintraege.findIndex((e) => e.id === t.id) : -1;
          if (i < 1) return null;
          const vor = v.eintraege[i - 1];
          return h('p', { class: 'zeile abstand' }, h('span', { class: 'wachs klein' }, `Davor (${deKurz(vor.datum)}): ${satzText(vor.saetze)}`), trendMarke(vergleich(vor, v.eintraege[i])));
        })(),
        u.notiz ? h('p', { class: 'klein' }, u.notiz) : null))
      : null,
    t.typ === 'kraft' ? h('button', { type: 'button', class: 'knopf breit', style: 'margin-bottom:8px', onclick: () => { t.verkuerzt = !t.verkuerzt; speichern('trainings'); neu(); } }, t.verkuerzt ? 'Als vollständig markieren' : 'Als verkürzt markieren') : null,
    h('button', { type: 'button', class: 'knopf gefahr breit', onclick: loesche }, 'Einheit löschen'),
  );
  return { titel: t.typ === 'kraft' ? t.einheit : t.art, zurueck: 'training', knoten };
}

// ---------- Verlauf einer Übung ----------

function uebungScreen(key) {
  const verlauf = uebungsVerlaeufe(S.state).find((v) => v.key === key);
  if (!verlauf) return { titel: 'Übung', zurueck: 'training', knoten: h('p', { class: 'leer' }, 'Für diese Übung gibt es noch keine Einträge.') };
  const { eintraege, name } = verlauf;
  const alle = eintraege.flatMap((e) => e.saetze);
  const art = alle.some((x) => x.kg > 0) ? 'kg' : alle.some((x) => x.wdh !== undefined) ? 'wdh' : 'sek';
  const wert = (x) => (art === 'kg' ? (x.kg || 0) * (x.wdh || 0) : art === 'wdh' ? x.wdh || 0 : x.sek || 0);
  const besterSatz = (saetze) => saetze.reduce((a, b) => (wert(b) > wert(a) ? b : a), saetze[0]);
  const text = (x) => (art === 'kg' ? `${fmt(x.kg || 0, 1)} kg × ${x.wdh ?? 0}` : art === 'wdh' ? `${x.wdh} Wdh.` : `${x.sek} Sek.`);
  const best = eintraege.map((e) => ({ e, satz: besterSatz(e.saetze) })).reduce((a, b) => (wert(b.satz) > wert(a.satz) ? b : a));
  const einheit = art === 'kg' ? 'kg × Wdh. (bester Satz je Einheit)' : art === 'wdh' ? 'Wiederholungen (bester Satz)' : 'Sekunden (bester Satz)';

  const knoten = h('div', null,
    h('section', { class: `karte ukarte k-${uebungsArt(name).farbe}` }, h('div', { class: 'ukopf' }, kachel(name, 'gross'), h('div', { class: 'wachs' }, h('div', { class: 'unr' }, 'Bestwert'), h('div', { style: 'font-size:26px;font-weight:700;line-height:1.1' }, text(best.satz)), h('div', { class: 'klein' }, `am ${de(best.e.datum)}`)))),
    eintraege.length > 1 ? karte('Seit dem ersten Eintrag', h('p', { class: 'zeile' }, h('span', { class: 'wachs' }, `${satzText(eintraege[0].saetze)} → ${satzText(eintraege.at(-1).saetze)}`), trendMarke(vergleich(eintraege[0], eintraege.at(-1))))) : null,
    art === 'kg' ? karte('Gewicht', diagramm({ einheit: 'kg (schwerster Satz je Einheit)', stellen: 1, serien: [{ klasse: 'c2', radius: 4, punkte: eintraege.map((e) => ({ x: e.datum, y: e.maxKg })) }] })) : null,
    art !== 'sek' ? karte('Wiederholungen', diagramm({ einheit: 'Wiederholungen (alle Sätze zusammen)', yMin: 0, serien: [{ klasse: 'c3', radius: 4, punkte: eintraege.map((e) => ({ x: e.datum, y: e.wdhSumme })) }] })) : null,
    karte(art === 'kg' ? 'Gewicht × Wiederholungen' : 'Verlauf', diagramm({ einheit, yMin: 0, serien: [{ klasse: 'c1', radius: 4, punkte: eintraege.map((e) => ({ x: e.datum, y: wert(besterSatz(e.saetze)) })) }] })),
    karte('Alle Einträge', h('div', { class: 'liste' }, [...eintraege].reverse().map((e, i, liste) => {
      const vor = liste[i + 1];
      return h('a', { href: `#training/einheit/${e.id}` },
        h('span', { style: 'width:52px;flex:none;color:var(--text2);font-size:14px' }, deKurz(e.datum)),
        h('span', { class: 'wachs' }, h('b', null, satzText(e.saetze)), e.notiz ? h('div', { class: 'klein' }, e.notiz) : null),
        vor ? trendMarke(vergleich(vor, e)) : null,
        h('span', { class: 'pfeil' }, '›'));
    }))),
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
