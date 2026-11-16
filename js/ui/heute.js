// Bildschirm "Heute": Ringe, Schritte, Plan, die drei Bereiche und die Schnelleingabe.

import { S, heuteIso, neu, setzeState, wechsleModus, speichern, meldung } from '../store.js';
import { h, karte, ring, STATUS_TEXT } from './dom.js';
import { tagFormular, einheitText } from './tag.js';
import { symbol, kachel } from './symbole.js';
import { tagBewertung } from '../core/bewertung.js';
import { ausHealthData } from '../core/erstimport.js';
import { fmt } from '../core/zahl.js';
import { planAuswahl } from '../core/ziele.js';
import { abendVorschlag } from '../core/vorschlag.js';
import { tagWertung } from '../core/wertung.js';
import { wertungBlock } from './wertung.js';
import { kcalStatus, eiweissStatus } from '../core/bewertung.js';
import { deMitTag, stundeBerlin, diffTage } from '../core/datum.js';

/** Liest eine gewählte health-data.json ein und ersetzt den Stand. */
export async function importiereHealthData(datei) {
  let daten;
  try {
    daten = JSON.parse(await datei.text());
  } catch {
    meldung('Die Datei ist kein gültiges JSON.');
    return false;
  }
  try {
    const { state, bericht } = ausHealthData(daten, heuteIso());
    await setzeState(state);
    alert(`Import abgeschlossen:\n\n• ${bericht.join('\n• ')}`);
    return true;
  } catch (e) {
    alert(`Import nicht möglich: ${e.message}`);
    return false;
  }
}

export function dateiKnopf(text, onDatei, klasse = 'knopf haupt breit') {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => { if (input.files[0]) await onDatei(input.files[0]); input.value = ''; } });
  return h('label', { class: klasse }, text, input);
}

function willkommen() {
  return karte('Willkommen',
    h('p', null, 'Die App ist noch leer. Übernimm deine bisherigen Daten aus der Datei health-data.json (sie bleibt nur auf diesem Gerät).'),
    h('div', { class: 'abstand' }, dateiKnopf('health-data.json auswählen', async (d) => { if (await importiereHealthData(d)) neu(); })),
    h('div', { class: 'knopfreihe abstand' },
      h('button', { type: 'button', class: 'knopf schmal', onclick: async () => { await wechsleModus('demo'); neu(); } }, 'Testdaten ansehen'),
      h('button', { type: 'button', class: 'knopf schmal', onclick: () => { S.state.einstellungen.eingerichtet = true; speichern('einstellungen'); neu(); } }, 'Ohne Import starten'),
    ),
  );
}

/** Ab dem Abend: was heute noch fehlt und 1–2 passende Snacks aus der Liste in den Einstellungen. */
function vorschlagKarte(b) {
  const e = S.state.einstellungen;
  if (stundeBerlin() < (e.vorschlagAbStunde ?? 20)) return null;
  const v = abendVorschlag(b.tag, b.ziele, e.snacks);
  if (v.status === 'keine_daten') return karte('Für heute noch', h('p', { class: 'klein' }, 'Noch keine Tageswerte aus Yazio. Sobald Kalorien und Eiweiß eingetragen sind, rechnet die App hier aus, was fehlt.'));
  if (v.status === 'erreicht') return karte('Für heute noch', h('p', { class: 'fett', style: 'color:var(--gruen)' }, 'Ziele erreicht – heute nichts mehr nötig.'));
  const zeile = (name, wert) => h('li', null, h('span', { class: 'wachs' }, name), h('b', null, wert));
  return karte('Für heute noch',
    h('ul', { class: 'liste' },
      v.fehlt.kcal > 0 ? zeile('Fehlt bis zum grünen Bereich', `${fmt(v.fehlt.kcal)} kcal`) : null,
      v.fehlt.eiweiss > 0 ? zeile(`Fehlt bis ${fmt(b.ziele.eiweiss.min)} g Eiweiß`, `${fmt(v.fehlt.eiweiss)} g`) : null,
      zeile('Noch frei bis zur Obergrenze', `${fmt(v.frei.kcal)} kcal${v.frei.fett === null ? '' : ` · ${fmt(v.frei.fett, 1)} g Fett`}`),
    ),
    v.status === 'nichts_passt'
      ? h('p', { class: 'klein abstand' }, 'Kein Snack aus deiner Liste passt mehr unter die Obergrenze.')
      : v.liste.map((x, i) => h('div', { class: 'vorschlag' },
        h('div', { class: 'unr' }, `Vorschlag ${i + 1}`),
        h('b', null, x.snacks.map((s) => s.name).join(' + ')),
        h('div', { class: 'klein' }, `+${fmt(x.kcal)} kcal · +${fmt(x.eiweiss)} g Eiweiß · +${fmt(x.fett, 1)} g Fett`),
        h('div', { class: 'chips' },
          h('span', { class: `chip marke s-${kcalStatus(x.danach.kcal, b.ziele.kcal)}` }, `danach ${fmt(x.danach.kcal)} kcal`),
          h('span', { class: `chip marke s-${eiweissStatus(x.danach.eiweiss, b.ziele.eiweiss)}` }, `${fmt(x.danach.eiweiss)} g Eiweiß`)),
        x.snacks.filter((s) => s.hinweis).map((s) => h('div', { class: 'klein', style: 'margin-top:4px' }, s.hinweis)),
      )),
    h('p', { class: 'klein abstand' }, 'Rein gerechnet aus deiner Snack-Liste (Mehr → Einstellungen). Gegessenes trägst du in Yazio ein.'),
  );
}

function planKarte(b, d) {
  const p = b.plan;
  const mk = S.state.einstellungen.minimalKraft || { minuten: 20, uebungen: 3 };
  let text = 'Ruhetag – kein Trainingsziel';
  let knopf = null;
  if (p) {
    text = p.text || p.einheit || '';
    if (p.typ === 'kraft' || p.typ === 'bonus') {
      if (b.minimal && p.typ === 'kraft') text += ` – Minimalversion: ${mk.minuten} Min., die ersten ${mk.uebungen} Übungen`;
      const auswahl = planAuswahl(p);
      if (S.entwurf) knopf = h('a', { class: 'knopf haupt breit', href: `#training/start/${encodeURIComponent(S.entwurf.einheit)}/${S.entwurf.datum}` }, 'Training fortsetzen');
      else if (auswahl.length > 1) {
        // Mehrere Einheiten zur Auswahl (z. B. Samstag: alleine oder im Studio): erst fragen
        knopf = h('div', null, h('p', { class: 'klein', style: 'margin-bottom:6px' }, 'Wie trainierst du heute?'),
          h('div', { class: 'knopfreihe' }, auswahl.map((w) => h('a', { class: 'knopf haupt', href: `#training/start/${encodeURIComponent(w.einheit)}` }, w.text))));
      } else knopf = h('a', { class: 'knopf haupt breit', href: `#training/start/${encodeURIComponent(p.einheit)}` }, `${p.einheit} öffnen`);
    } else if (p.typ === 'laufband') {
      if (b.minimal) text += ' (Minimalversion: ohne Wertung)';
      knopf = h('a', { class: 'knopf haupt breit', href: `#training/cardio/Laufband/${d}` }, 'Laufband eintragen');
    } else if (p.typ === 'fussball') {
      if (b.tag.fussball === false) text += ` – ausgefallen: Spaziergang ab ${b.ziele.spaziergangMin} Min. zählt als Ersatz`;
      knopf = b.tag.fussball === false
        ? h('a', { class: 'knopf haupt breit', href: `#training/cardio/Spaziergang/${d}` }, 'Spaziergang eintragen')
        : h('a', { class: 'knopf haupt breit', href: `#training/cardio/${encodeURIComponent('Hallenfußball')}/${d}` }, 'Fußball eintragen');
    }
  }
  const erledigt = b.training === 'gruen' || b.training === 'gelb';
  const bild = !p ? 'ruhe' : p.typ === 'laufband' ? 'Laufband' : p.typ === 'fussball' ? (b.tag.fussball === false ? 'Spaziergang' : 'Fußball') : 'Krafttraining';
  return karte('Heute laut Plan',
    h('div', { class: 'ukopf' }, bild === 'ruhe' ? h('span', { class: 'kachel k-kraft' }, symbol('ruhe')) : kachel(bild), h('p', { class: 'fett wachs' }, text)),
    b.einheiten.length ? h('div', { class: 'liste' }, b.einheiten.map((e) => h('a', { href: `#training/einheit/${e.id}` }, h('span', { class: 'wachs' }, `✓ ${einheitText(e)}`), h('span', { class: 'pfeil' }, '›')))) : null,
    knopf && !erledigt ? h('div', { class: 'abstand' }, knopf) : null,
  );
}

function kopfTeil(d) {
  const st = S.state;
  const b = tagBewertung(st, d, heuteIso());
  const t = b.tag;
  const teile = [];

  if (S.modus === 'demo') {
    teile.push(h('a', { class: 'hinweis info', href: '#mehr/daten' }, 'Testdaten-Modus', h('small', null, 'Du siehst erfundene Werte. Deine echten Daten sind unberührt. Beenden unter Mehr → Daten.')));
  } else if (!st.einstellungen.eingerichtet) {
    teile.push(willkommen());
  }

  // Regel: nach 15 Uhr und unter 2.000 Schritten → Laufband am Abend ist Pflicht.
  const hatLaufband = b.einheiten.some((e) => e.typ === 'cardio' && /laufband/i.test(e.art || ''));
  const bereit = S.modus === 'demo' || st.einstellungen.eingerichtet;
  if (bereit && stundeBerlin() >= 15 && (t.schritte ?? 0) < b.ziele.schritte.pflichtGrenze && !hatLaufband) {
    teile.push(h('div', { class: 'hinweis warn' }, 'Laufband heute Abend: Pflicht',
      h('small', null, t.schritte === undefined ? `Noch keine Schritte eingetragen (Grenze: ${fmt(b.ziele.schritte.pflichtGrenze)} bis 15 Uhr).` : `Erst ${fmt(t.schritte)} Schritte (Grenze: ${fmt(b.ziele.schritte.pflichtGrenze)} bis 15 Uhr).`)));
  }
  if (S.modus === 'echt' && S.eingang.length) {
    teile.push(h('a', { class: 'hinweis info', href: '#cloud' }, `Claude hat ${S.eingang.length} ${S.eingang.length === 1 ? 'Datei' : 'Dateien'} abgelegt`, h('small', null, 'Tippe hier, um die Vorschau zu sehen und zu übernehmen.')));
  }
  if (b.minimal) {
    teile.push(h('div', { class: 'hinweis ruhig' }, h('b', null, 'Minimalversion aktiv'), h('small', null, 'Erfolg heißt jetzt: Gewicht und Bauchumfang halten.')));
  }
  const ls = st.einstellungen.letzteSicherung;
  const hatDaten = Object.keys(st.tage).length > 0;
  if (S.modus === 'echt' && hatDaten && (!ls || diffTage(ls, d) > 7)) {
    teile.push(h('a', { class: 'hinweis info', href: '#mehr/daten' }, ls ? `Letzte Sicherung vor ${diffTage(ls, d)} Tagen` : 'Noch keine Sicherung erstellt', h('small', null, 'Tippe hier, um jetzt eine Sicherung zu erstellen.')));
  }

  const k = b.ziele.kcal;
  const sz = b.ziele.schritte;
  teile.push(h('section', { class: 'karte' },
    h('div', { class: 'ringe' },
      ring({ wert: t.kcal ?? null, ziel: k.ziel, status: b.kcal, titel: 'Kalorien', einheit: 'kcal' }),
      ring({ wert: t.eiweiss_g ?? null, ziel: b.ziele.eiweiss.ziel, status: b.eiweiss, titel: 'Eiweiß', einheit: 'g' }),
      ring({ wert: t.schritte ?? null, ziel: sz.ziel, status: b.schritte, titel: 'Schritte', einheit: '' }),
    ),
    h('p', { class: 'klein abstand', style: 'text-align:center' },
      t.kcal === undefined ? 'Werte kommen aus Yazio (Claude-Import). ' : `Grüner Bereich: ${fmt(k.min)}–${fmt(k.max)} kcal${k.art === 'fussball' ? ' (Fußballtag)' : ''}. `,
      t.ungenau ? 'Eiweiß ungenau. ' : null,
      h('a', { href: `#tag/${d}` }, 'Nachtragen'),
    ),
  ));

  // Tageswertung: groß die Prozentzahl, darunter immer die drei Bereiche einzeln (Punkt = Farbstatus des Bereichs)
  const w = tagWertung(st, d, heuteIso());
  teile.push(karte('Tageswertung',
    wertungBlock({ prozent: w.prozent, bereiche: w.bereiche, schwelle: w.schwelle, vorlaeufig: w.vorlaeufig && w.gewertet, status: { ernaehrung: b.ernaehrung, training: b.training, schritte: b.schritte }, leerText: 'noch keine Ernährungsdaten', href: `#tag/${d}` }),
    h('p', { class: 'klein abstand' }, `${STATUS_TEXT[b.ernaehrung] === 'keine Daten' ? 'Ernährung: noch keine Daten' : `Ernährung ${STATUS_TEXT[b.ernaehrung]}`} · Training ${STATUS_TEXT[b.training]}${b.zusatz ? ' ★' : ''} · Schritte ${STATUS_TEXT[b.schritte]}`),
  ));

  const vorschlag = bereit ? vorschlagKarte(b) : null;
  if (vorschlag) teile.push(vorschlag);
  teile.push(planKarte(b, d));
  return teile;
}

export function heuteScreen() {
  const d = heuteIso();
  const kopf = h('div');
  const formular = h('div');
  const zeichneKopf = () => kopf.replaceChildren(...kopfTeil(d));
  zeichneKopf();
  formular.replaceChildren(tagFormular(d, { onChange: zeichneKopf }));
  return { titel: `Heute · ${deMitTag(d)}`, knoten: h('div', null, kopf, formular) };
}
