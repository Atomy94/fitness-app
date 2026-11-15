// Bildschirm "Rezepte": gängige Mahlzeiten nach Kategorie, mit Mengen und Nährwerten.
// Adressen: #rezepte · #rezepte/ID (ansehen) · #rezepte/ID/bearbeiten

import { S, neu, speichern, meldung } from '../store.js';
import { h, karte, zahlFeld, textFeld } from './dom.js';
import { KATEGORIEN, NAEHRWERTE, neuesRezept, fuerMenge } from '../core/rezepte.js';
import { fmt } from '../core/zahl.js';

const sicht = { kategorie: KATEGORIEN[0] };
const sichere = () => speichern('rezepte');
const kurz = (r) => [
  typeof r.kcal === 'number' ? `${fmt(r.kcal)} kcal` : null,
  typeof r.eiweiss_g === 'number' ? `${fmt(r.eiweiss_g, 1)} g Eiweiß` : null,
].filter(Boolean).join(' · ') || 'noch keine Nährwerte';
const bezugText = (r) => (r.bezug === '100g' ? 'pro 100 g' : `pro Portion${r.portion ? ` (${r.portion})` : ''}`);

function liste() {
  const alle = S.state.rezepte;
  const inKat = alle.filter((r) => r.kategorie === sicht.kategorie).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const knoten = h('div', null,
    h('div', { class: 'filter' }, KATEGORIEN.map((k) => h('button', { type: 'button', class: sicht.kategorie === k ? 'an' : '', onclick: () => { sicht.kategorie = k; neu(); } },
      k === 'Mittagessen' ? 'Mittag' : k === 'Abendessen' ? 'Abend' : k, h('div', { class: 'klein', style: 'color:inherit;opacity:.75' }, alle.filter((r) => r.kategorie === k).length)))),
    karte(sicht.kategorie,
      inKat.length
        ? h('div', { class: 'liste' }, inKat.map((r) => h('a', { href: `#rezepte/${r.id}` },
          h('span', { class: 'wachs' }, h('b', null, r.name || 'Ohne Namen'), h('div', { class: 'klein' }, `${kurz(r)} · ${bezugText(r)}`)),
          h('span', { class: 'pfeil' }, '›'))))
        : h('p', { class: 'leer' }, `Noch kein Rezept in „${sicht.kategorie}“`),
      h('button', { type: 'button', class: 'knopf haupt breit abstand', onclick: () => {
        const r = neuesRezept(sicht.kategorie);
        S.state.rezepte.push(r); sichere();
        location.hash = `#rezepte/${r.id}/bearbeiten`;
      } }, '+ Neues Rezept'),
    ),
    h('p', { class: 'klein', style: 'text-align:center' }, 'Rezepte dienen zum Nachschlagen. Gegessenes trägst du weiter in Yazio ein.'),
  );
  return { titel: 'Rezepte', zurueck: 'mehr', knoten };
}

function naehrTabelle(werte, titel) {
  const zeilen = NAEHRWERTE.filter(([f]) => typeof werte[f] === 'number');
  if (!zeilen.length) return h('p', { class: 'leer' }, 'Noch keine Nährwerte eingetragen');
  return h('table', { class: 'tabelle' },
    h('thead', null, h('tr', null, h('th', null, 'Nährwerte'), h('th', { class: 'r' }, titel))),
    h('tbody', null, zeilen.map(([f, name, einheit, stellen]) => h('tr', null,
      h('td', { style: f === 'zucker_g' || f === 'ges_fett_g' ? 'padding-left:16px;color:var(--text2)' : 'font-weight:600' }, name),
      h('td', { class: 'r' }, `${fmt(werte[f], stellen)} ${einheit}`)))));
}

function ansicht(r) {
  const rechner = h('div');
  const rechne = (gramm) => rechner.replaceChildren(gramm ? naehrTabelle(fuerMenge(r, gramm), `für ${fmt(gramm)} g`) : h('p', { class: 'klein' }, 'Gewicht deiner Portion eintragen.'));
  rechne(null);
  const knoten = h('div', null,
    h('section', { class: 'karte' },
      h('span', { class: 'marke neutral' }, r.kategorie),
      h('p', { style: 'font-size:22px;font-weight:700;margin-top:8px' }, r.name || 'Ohne Namen'),
      r.notiz ? h('p', { class: 'klein abstand' }, r.notiz) : null,
    ),
    r.zutaten && r.zutaten.length ? karte(`Zutaten${r.bezug === '100g' ? '' : r.portion ? ` für ${r.portion}` : ''}`,
      h('ul', { class: 'liste' }, r.zutaten.map((z) => h('li', null, h('span', { class: 'wachs' }, z.name), h('b', null, z.menge || ''))))) : null,
    h('section', { class: 'karte' }, naehrTabelle(r, bezugText(r))),
    r.bezug === '100g' ? karte('Portion berechnen',
      zahlFeld({ label: 'Menge auf dem Teller', einheit: 'g', wert: null, min: 0, max: 5000, onChange: rechne }), rechner) : null,
    h('a', { class: 'knopf breit', href: `#rezepte/${r.id}/bearbeiten` }, 'Bearbeiten'),
  );
  return { titel: 'Rezept', zurueck: 'rezepte', knoten };
}

function bearbeiten(r) {
  const kat = h('select', { onchange: () => { r.kategorie = kat.value; sicht.kategorie = r.kategorie; sichere(); } }, KATEGORIEN.map((k) => h('option', { value: k }, k)));
  kat.value = r.kategorie;
  const bezug = h('select', { onchange: () => { r.bezug = bezug.value; sichere(); neu(); } }, h('option', { value: 'portion' }, 'pro Portion'), h('option', { value: '100g' }, 'pro 100 g'));
  bezug.value = r.bezug || 'portion';
  const zutatZeile = (z, i) => h('div', { class: 'zeile', style: 'margin-bottom:6px' },
    h('div', { class: 'wachs' }, textFeld({ platzhalter: 'Zutat', wert: z.name, onChange: (v) => { z.name = v; sichere(); } })),
    h('div', { style: 'width:104px;flex:none' }, textFeld({ platzhalter: 'Menge', wert: z.menge, onChange: (v) => { z.menge = v; sichere(); } })),
    h('button', { type: 'button', class: 'knopf schmal gefahr', 'aria-label': 'Zutat löschen', onclick: () => { r.zutaten.splice(i, 1); sichere(); neu(); } }, '✕'),
  );
  const knoten = h('div', null,
    karte('Rezept',
      textFeld({ label: 'Name', wert: r.name, onChange: (v) => { r.name = v; sichere(); } }),
      h('label', { class: 'feld' }, h('span', null, 'Kategorie'), kat),
      textFeld({ label: 'Notiz (Zubereitung, Tage …)', wert: r.notiz, mehrzeilig: true, onChange: (v) => { r.notiz = v; sichere(); } }),
    ),
    karte('Zutaten und Mengen',
      (r.zutaten || []).map(zutatZeile),
      h('button', { type: 'button', class: 'knopf schmal breit', onclick: () => { r.zutaten = r.zutaten || []; r.zutaten.push({ name: '', menge: '' }); sichere(); neu(); } }, '+ Zutat'),
    ),
    karte('Nährwerte',
      h('label', { class: 'feld' }, h('span', null, 'Die Angaben gelten'), bezug),
      r.bezug !== '100g' ? textFeld({ label: 'Portion (z. B. „1 Schale“, „350 g“)', wert: r.portion, onChange: (v) => { r.portion = v; sichere(); } }) : null,
      h('div', { class: 'raster2' }, NAEHRWERTE.map(([f, name, einheit]) => zahlFeld({ label: name, einheit, wert: r[f] ?? null, min: 0, max: 15000, onChange: (v) => { if (v === null) delete r[f]; else r[f] = v; sichere(); } }))),
    ),
    h('a', { class: 'knopf haupt breit', href: `#rezepte/${r.id}`, onclick: () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } }, 'Fertig'),
    h('button', { type: 'button', class: 'knopf gefahr breit abstand', onclick: () => {
      if (!confirm(`Rezept „${r.name || 'Ohne Namen'}“ löschen?`)) return;
      S.state.rezepte = S.state.rezepte.filter((x) => x !== r); sichere(); meldung('Rezept gelöscht'); location.hash = '#rezepte';
    } }, 'Rezept löschen'),
  );
  return { titel: 'Rezept bearbeiten', zurueck: `rezepte/${r.id}`, knoten };
}

export function rezepteScreen([id, modus]) {
  if (!id) return liste();
  const r = S.state.rezepte.find((x) => x.id === id);
  if (!r) return { titel: 'Rezept', zurueck: 'rezepte', knoten: h('p', { class: 'leer' }, 'Dieses Rezept gibt es nicht mehr.') };
  sicht.kategorie = r.kategorie;
  return modus === 'bearbeiten' ? bearbeiten(r) : ansicht(r);
}
