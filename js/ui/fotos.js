// Bildschirm "Fortschrittsfotos" (#fotos): neue Fotos aufnehmen, Vorher/Nachher vergleichen, alle Termine.
// Die Bilder liegen nur auf dem Gerät und (wenn verbunden) im Dropbox-Ordner "fotos/".

import { S, heuteIso, neu, beiVerlassen } from '../store.js';
import { h, karte, datumFeld, toast } from './dom.js';
import { fmt } from '../core/zahl.js';
import { de, deMitTag } from '../core/datum.js';
import { ANSICHTEN, ansichtName, fotoTermine, termineMitAnsicht, vergleichStart, fotoAm, messwerteAm } from '../core/fotos.js';
import { fotos, fotoHinzufuegen, fotoLoeschen, fotoUrl, urlsFreigeben } from '../fotos.js';
import { istVerbunden } from '../cloud.js';

// Auswahl bleibt beim Neuzeichnen erhalten
const wahlStand = { datum: null, ansicht: 'vorne', vorher: null, nachher: null, modus: 'neben', blende: 50 };

/** <img>, dessen Bild nachgeladen wird. */
function bild(id, { mini = false, klasse = '', alt = '' } = {}) {
  const img = h('img', { class: klasse, alt, decoding: 'async' });
  fotoUrl(id, mini).then((u) => { if (u) img.src = u; });
  return img;
}

function messText(datum) {
  const m = messwerteAm(S.state, datum);
  return [m.gewicht !== null ? `${fmt(m.gewicht, 1)} kg` : null, m.bauch !== null ? `Bauch ${fmt(m.bauch, 1)} cm` : null].filter(Boolean).join(' · ');
}

function segment(werte, aktuell, onWahl) {
  return h('div', { class: 'wahl', style: `grid-template-columns: repeat(${werte.length}, 1fr)` },
    werte.map(([wert, text]) => h('button', { type: 'button', class: wert === aktuell ? 'an' : '', onclick: () => onWahl(wert) }, text)));
}

/** Vollbild eines Fotos mit Löschen. */
function zeigeGross(foto) {
  const schliessen = () => ebene.remove();
  const ebene = h('div', { class: 'foto-gross', onclick: (e) => { if (e.target === ebene) schliessen(); } },
    h('div', { class: 'foto-gross-kopf' },
      h('span', { class: 'wachs' }, h('b', null, `${ansichtName(foto.ansicht)} · ${deMitTag(foto.datum)}`), messText(foto.datum) ? h('div', { class: 'klein' }, messText(foto.datum)) : null),
      h('button', { type: 'button', class: 'knopf schmal', onclick: schliessen }, 'Schließen')),
    bild(foto.id, { alt: `${ansichtName(foto.ansicht)} am ${de(foto.datum)}` }),
    h('button', { type: 'button', class: 'knopf schmal gefahr', onclick: async () => {
      if (!confirm(`Foto „${ansichtName(foto.ansicht)}“ vom ${de(foto.datum)} löschen?${istVerbunden() ? ' Es wird auch aus der Dropbox entfernt.' : ''}`)) return;
      await fotoLoeschen(foto.id);
      schliessen();
      toast('Foto gelöscht');
      neu();
    } }, 'Foto löschen'));
  document.body.append(ebene);
  beiVerlassen(schliessen);
}

function aufnahmeKarte(liste) {
  const datum = wahlStand.datum || heuteIso();
  const vorhanden = (key) => liste.filter((f) => f.datum === datum && f.ansicht === key).length;
  const knopf = (a) => {
    const eingabe = h('input', { type: 'file', accept: 'image/*', class: 'unsichtbar', onchange: async () => {
      const datei = eingabe.files && eingabe.files[0];
      if (!datei) return;
      knopfEl.setAttribute('data-laeuft', '');
      knopfEl.lastChild.textContent = 'wird gespeichert …';
      try {
        await fotoHinzufuegen(datei, datum, a.key);
        toast(`Foto „${a.name}“ gespeichert`);
      } catch (e) {
        toast(e && e.message ? e.message : 'Foto konnte nicht gespeichert werden.');
      }
      neu();
    } });
    const n = vorhanden(a.key);
    const knopfEl = h('label', { class: `knopf foto-knopf${n ? ' erledigt' : ''}` }, eingabe, h('b', null, a.name), h('small', null, n ? '✓ vorhanden – noch eins?' : 'aufnehmen'));
    return knopfEl;
  };
  return karte('Neue Fotos',
    datumFeld({ label: 'Datum', wert: datum, onChange: (d) => { wahlStand.datum = d; neu(); } }),
    h('div', { class: 'foto-knoepfe' }, ANSICHTEN.map(knopf)),
    h('p', { class: 'klein abstand' }, 'Tipp: immer gleicher Ort, gleiches Licht, gleiche Haltung und Kleidung – am besten sonntags morgens vor dem Frühstück. Du kannst die Kamera nutzen oder ein Foto aus der Mediathek wählen.'));
}

function vergleichKarte(liste) {
  const mitZwei = ANSICHTEN.filter((a) => termineMitAnsicht(liste, a.key).length >= 2);
  if (!mitZwei.length) {
    return karte('Vorher / Nachher', h('p', { class: 'klein' }, 'Sobald es von einer Ansicht Fotos an zwei Terminen gibt, kannst du sie hier vergleichen.'));
  }
  if (!mitZwei.some((a) => a.key === wahlStand.ansicht)) { wahlStand.ansicht = mitZwei[0].key; wahlStand.vorher = null; wahlStand.nachher = null; }
  const termine = termineMitAnsicht(liste, wahlStand.ansicht);
  const start = vergleichStart(liste, wahlStand.ansicht);
  if (!termine.includes(wahlStand.vorher)) wahlStand.vorher = start.vorher;
  if (!termine.includes(wahlStand.nachher)) wahlStand.nachher = start.nachher;
  const auswahl = (feld, label) => h('label', { class: 'feld' }, h('span', null, label),
    h('select', { onchange: (e) => { wahlStand[feld] = e.target.value; neu(); } },
      termine.map((t) => h('option', { value: t, selected: t === wahlStand[feld] ? '' : null }, de(t)))));
  const vorher = fotoAm(liste, wahlStand.vorher, wahlStand.ansicht);
  const nachher = fotoAm(liste, wahlStand.nachher, wahlStand.ansicht);
  const unterschrift = (d) => h('div', { class: 'klein foto-unter' }, h('b', null, de(d)), messText(d) ? ` · ${messText(d)}` : '');

  let ansicht;
  if (wahlStand.modus === 'neben') {
    ansicht = h('div', { class: 'foto-neben' },
      h('figure', null, bild(vorher.id, { alt: `Vorher ${de(vorher.datum)}` }), unterschrift(vorher.datum)),
      h('figure', null, bild(nachher.id, { alt: `Nachher ${de(nachher.datum)}` }), unterschrift(nachher.datum)));
  } else {
    const oben = bild(nachher.id, { klasse: 'foto-oben', alt: `Nachher ${de(nachher.datum)}` });
    oben.style.opacity = String(wahlStand.blende / 100);
    const regler = h('input', { type: 'range', min: 0, max: 100, value: wahlStand.blende, 'aria-label': 'Überblenden von vorher zu nachher', oninput: () => { wahlStand.blende = Number(regler.value); oben.style.opacity = String(wahlStand.blende / 100); } });
    ansicht = h('div', null,
      h('div', { class: 'foto-blende' }, bild(vorher.id, { alt: `Vorher ${de(vorher.datum)}` }), oben),
      h('div', { class: 'zeile foto-regler' }, h('span', { class: 'klein' }, de(vorher.datum)), regler, h('span', { class: 'klein' }, de(nachher.datum))),
      h('div', { class: 'raster2' }, unterschrift(vorher.datum), unterschrift(nachher.datum)));
  }
  return karte('Vorher / Nachher',
    segment(mitZwei.map((a) => [a.key, a.name]), wahlStand.ansicht, (w) => { wahlStand.ansicht = w; neu(); }),
    h('div', { class: 'raster2 abstand' }, auswahl('vorher', 'Vorher'), auswahl('nachher', 'Nachher')),
    segment([['neben', 'Nebeneinander'], ['blende', 'Überblenden']], wahlStand.modus, (w) => { wahlStand.modus = w; neu(); }),
    h('div', { class: 'abstand' }, ansicht));
}

function termineKarte(liste) {
  const termine = fotoTermine(liste);
  if (!termine.length) return karte('Alle Termine', h('p', { class: 'leer' }, 'Noch keine Fotos'));
  return karte('Alle Termine', termine.map((t) => h('div', { class: 'foto-termin' },
    h('div', { class: 'zeile' }, h('b', { class: 'wachs' }, deMitTag(t.datum)), h('span', { class: 'klein' }, messText(t.datum))),
    h('div', { class: 'foto-reihe' }, ANSICHTEN.map((a) => {
      const f = t.fotos[a.key].at(-1);
      return f
        ? h('button', { type: 'button', class: 'foto-mini', onclick: () => zeigeGross(f) }, bild(f.id, { mini: true, alt: `${a.name} am ${de(t.datum)}` }), h('span', null, a.name + (t.fotos[a.key].length > 1 ? ` (${t.fotos[a.key].length})` : '')))
        : h('div', { class: 'foto-mini leer-foto' }, h('div', { class: 'foto-platz' }), h('span', null, a.name));
    })),
    // weitere Fotos derselben Ansicht am selben Tag
    ...ANSICHTEN.flatMap((a) => t.fotos[a.key].slice(0, -1)).map((f) => h('button', { type: 'button', class: 'knopf schmal abstand', onclick: () => zeigeGross(f) }, `Weiteres Foto: ${ansichtName(f.ansicht)}`)),
  )));
}

export function fotosScreen() {
  const knoten = h('div', null, h('p', { class: 'leer' }, 'Fotos werden geladen …'));
  beiVerlassen(urlsFreigeben);
  fotos().then((liste) => {
    knoten.replaceChildren(
      aufnahmeKarte(liste),
      vergleichKarte(liste),
      termineKarte(liste),
      karte('Wo liegen die Fotos?',
        h('p', { class: 'klein' }, S.modus === 'demo' ? 'Testdaten-Modus: Fotos liegen getrennt von deinen echten Daten.'
          : istVerbunden() ? 'Auf diesem iPhone und als Sicherung in deiner Dropbox im Ordner „fotos“. Sie stehen nicht in der Sicherungsdatei und nicht in stand.md.'
            : 'Nur auf diesem iPhone. Verbinde die Dropbox (Mehr → Claude-Verbindung), damit sie gesichert werden.'),
        h('p', { class: 'klein abstand' }, 'Die Fotos werden verkleinert gespeichert (längste Seite 1280 Pixel).')),
    );
  }).catch((e) => knoten.replaceChildren(h('div', { class: 'hinweis warn' }, 'Fotos konnten nicht geladen werden.', h('small', null, String(e.message || e)))));
  return { titel: 'Fortschrittsfotos', zurueck: 'fortschritt', knoten };
}
