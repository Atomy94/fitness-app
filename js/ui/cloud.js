// Bildschirm "Claude-Verbindung": Dropbox einrichten, abgleichen, Eingang von Claude bestätigen.

import { S, neu, setzeState, meldung } from '../store.js';
import { h, karte, textFeld, kopiere } from './dom.js';
import { vorschauKarte } from './vorschau.js';
import { istVerbunden, anmeldungVorbereiten, anmeldungAbschliessen, anmeldungVerwerfen, offeneAnmeldung, trennen, abgleichen, erledige } from '../cloud.js';

const form = { appKey: '', code: '', url: '', beschaeftigt: false };
const blur = () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); };
const zeit = (iso) => (iso ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '–');

const SATZ_FUER_CLAUDE = 'Lies in meiner Dropbox die Datei „LIESMICH-fuer-Claude.md“ im Ordner „Apps“ → Ordner meiner Fitness-App und arbeite ab jetzt danach.';

function einrichten() {
  const c = S.cloud || {};
  if (!form.appKey && c.appKey) form.appKey = c.appKey;
  // Begonnene Anmeldung fortsetzen (z. B. nach Neuladen): gleicher Link, damit ein geholter Code noch passt.
  if (!form.url && offeneAnmeldung() && c.appKey === form.appKey) form.url = offeneAnmeldung();
  const schritt = (nr, titel, ...inhalt) => h('section', { class: 'karte' }, h('h2', null, `Schritt ${nr}: ${titel}`), ...inhalt);
  return [
    h('div', { class: 'hinweis ruhig' }, h('b', null, 'So funktioniert es'),
      h('small', null, 'Die App legt deinen aktuellen Stand in einen eigenen Ordner deiner Dropbox. Claude liest ihn dort und legt neue Einträge ab. Die App holt sie ab und zeigt dir vor dem Speichern eine Vorschau.'),
      h('small', null, 'Deine Daten liegen dann zusätzlich in deiner Dropbox. Die App sieht dort nur ihren eigenen Ordner.')),
    schritt(1, 'Dropbox-App anlegen (einmalig, am Computer)',
      h('ol', { style: 'margin:0;padding-left:20px;line-height:1.6' },
        h('li', null, 'dropbox.com/developers/apps öffnen und „Create app“ wählen.'),
        h('li', null, '„Scoped access“ und „App folder“ auswählen, einen Namen vergeben (z. B. FitnessApp-DeinName) und anlegen.'),
        h('li', null, 'Reiter „Permissions“: files.metadata.read, files.content.read und files.content.write ankreuzen, unten „Submit“.'),
        h('li', null, 'Reiter „Settings“: den „App key“ kopieren.'),
      )),
    schritt(2, 'App key eintragen',
      textFeld({ platzhalter: 'App key (ca. 15 Zeichen)', wert: form.appKey, onChange: async (v) => {
        if (v === form.appKey) return;
        form.appKey = v; form.url = ''; form.code = '';
        await anmeldungVerwerfen(); // anderer Schlüssel: alter Link gilt nicht mehr
        neu();
      } }),
      h('button', { type: 'button', class: 'knopf haupt breit abstand', disabled: !form.appKey, onclick: async () => {
        blur();
        try { form.url = await anmeldungVorbereiten(form.appKey); neu(); } catch (e) { meldung(e.message || String(e)); }
      } }, 'Weiter'),
    ),
    form.url ? schritt(3, 'Bei Dropbox anmelden und Code einfügen',
      h('p', { class: 'klein' }, 'Tippe auf den Knopf, erlaube den Zugriff und kopiere den angezeigten Code. Komm dann hierher zurück und füge ihn gleich ein: Ein Code gilt nur wenige Minuten und nur ein einziges Mal.'),
      h('a', { class: 'knopf breit abstand', href: form.url, target: '_blank', rel: 'noopener' }, 'Bei Dropbox anmelden ↗'),
      h('div', { class: 'abstand' }, textFeld({ platzhalter: 'Code von Dropbox einfügen', wert: form.code, onChange: (v) => { form.code = v; } })),
      h('button', { type: 'button', class: 'knopf haupt breit abstand', disabled: form.beschaeftigt, onclick: async () => {
        blur();
        if (form.beschaeftigt) return; // doppeltes Tippen würde den Code zweimal einlösen
        if (!form.code) { meldung('Bitte den Code von Dropbox einfügen.'); return; }
        form.beschaeftigt = true;
        let fehler = null;
        try {
          await anmeldungAbschliessen(form.code);
          form.url = '';
          meldung('Mit Dropbox verbunden');
          await abgleichen({ stumm: false });
        } catch (e) { fehler = e.message || String(e); }
        form.code = ''; // ein Code ist nach einem Versuch verbraucht
        form.beschaeftigt = false;
        neu();
        if (fehler) setTimeout(() => alert(fehler), 50);
      } }, 'Verbinden'),
      h('button', { type: 'button', class: 'knopf schmal breit abstand', onclick: async () => {
        await anmeldungVerwerfen(); form.url = ''; form.code = '';
        try { form.url = await anmeldungVorbereiten(form.appKey); } catch (e) { meldung(e.message || String(e)); }
        neu();
      } }, 'Neuen Anmeldelink erzeugen'),
    ) : null,
  ];
}

function eingangKarten() {
  if (!S.eingang.length) return [karte('Eingang von Claude', h('p', { class: 'leer' }, 'Keine neuen Einträge'))];
  return S.eingang.map((e) => {
    const weg = async (text) => {
      try { await erledige(e); meldung(text); } catch (f) { meldung(f.message || String(f)); }
      neu();
    };
    return vorschauKarte({
      ergebnis: e.ergebnis, ersetzen: e.ersetzen, state: S.state, titel: e.name,
      abbrechenText: 'Verwerfen',
      onWahl: neu,
      onAbbrechen: () => { if (confirm(`„${e.name}“ verwerfen? Die Datei wird in den Ordner „erledigt“ verschoben, nichts wird gespeichert.`)) weg('Verworfen'); },
      onUebernehmen: async (neuerStand, anzahl) => {
        await setzeState(neuerStand);
        await weg(`${anzahl} ${anzahl === 1 ? 'Eintrag' : 'Einträge'} übernommen`);
      },
    });
  });
}

function verbunden() {
  const c = S.cloud;
  const demo = S.modus === 'demo';
  return [
    demo ? h('div', { class: 'hinweis info' }, 'Testdaten-Modus', h('small', null, 'Der Abgleich ist ausgeschaltet, solange du Testdaten ansiehst.')) : null,
    c.fehler ? h('div', { class: 'hinweis warn' }, 'Letzter Abgleich fehlgeschlagen', h('small', null, c.fehler)) : null,
    karte('Verbindung',
      h('ul', { class: 'liste' },
        h('li', null, h('span', { class: 'wachs' }, 'Dropbox-Konto'), h('b', null, (c.konto && (c.konto.email || c.konto.name)) || 'verbunden')),
        h('li', null, h('span', { class: 'wachs' }, 'Letzter Abgleich'), h('b', null, zeit(c.letzterAbgleich))),
      ),
      h('button', { type: 'button', class: 'knopf haupt breit abstand', disabled: demo || form.beschaeftigt, onclick: async () => {
        form.beschaeftigt = true; neu();
        await abgleichen({ stumm: false });
        form.beschaeftigt = false; neu();
      } }, form.beschaeftigt ? 'Gleiche ab …' : 'Jetzt abgleichen'),
      h('p', { class: 'klein abstand' }, 'Automatisch beim Öffnen der App und kurz nach jeder Änderung. Die Sicherung in der Dropbox zählt als Sicherung.'),
    ),
    ...(demo ? [] : eingangKarten()),
    karte('So sagst du es Claude',
      h('p', { class: 'klein' }, 'In Claude muss der Dropbox-Connector aktiviert sein. Schreibe einmal zu Beginn eines Chats (oder dauerhaft in die Projekt-Anweisungen):'),
      h('pre', { class: 'block abstand' }, SATZ_FUER_CLAUDE),
      h('button', { type: 'button', class: 'knopf breit abstand', onclick: async () => meldung((await kopiere(SATZ_FUER_CLAUDE)) ? 'Kopiert' : 'Kopieren nicht möglich') }, 'Satz kopieren'),
    ),
    h('button', { type: 'button', class: 'knopf gefahr breit', onclick: async () => {
      if (!confirm('Verbindung zur Dropbox trennen? Die Dateien in der Dropbox bleiben erhalten, deine Daten in der App auch.')) return;
      await trennen(); meldung('Verbindung getrennt'); neu();
    } }, 'Verbindung trennen'),
  ];
}

export function cloudScreen() {
  return { titel: 'Claude-Verbindung', zurueck: 'mehr', knoten: h('div', null, istVerbunden() ? verbunden() : einrichten()) };
}
