// Einstieg: lädt die Daten, verbindet Navigation und Bildschirme, registriert den Service Worker.
// Adressen: #heute, #kalender, #training/…, #schlaf, #fortschritt, #mehr/…, #tag/JJJJ-MM-TT

import { S, laden, verbinde, raeumeAuf } from './store.js';
import { h, toast } from './ui/dom.js';
import { heuteScreen } from './ui/heute.js';
import { kalenderScreen } from './ui/kalender.js';
import { tagScreen } from './ui/tag.js';
import { trainingScreen } from './ui/training.js';
import { fortschrittScreen } from './ui/fortschritt.js';
import { schlafScreen } from './ui/schlaf.js';
import { fotosScreen } from './ui/fotos.js';
import { mehrScreen } from './ui/mehr.js';
import { rezepteScreen } from './ui/rezepte.js';
import { cloudScreen } from './ui/cloud.js';
import { starteAutomatik } from './cloud.js';

// Neuer Bildschirm (z. B. Rezeptrechner)? Modul in js/ui/ anlegen und hier eintragen.
const SCREENS = {
  heute: heuteScreen,
  kalender: kalenderScreen,
  tag: tagScreen,
  training: trainingScreen,
  schlaf: schlafScreen,
  fortschritt: fortschrittScreen,
  mehr: mehrScreen,
  rezepte: rezepteScreen,
  cloud: cloudScreen,
  fotos: fotosScreen,
};
const NAV = { tag: 'kalender', rezepte: 'mehr', cloud: 'mehr', fotos: 'fortschritt' };

const inhalt = document.getElementById('inhalt');
const titel = document.getElementById('titel');
const zurueck = document.getElementById('zurueck');
let letzteRoute = null;
let zurueckZiel = null;

function zeichne() {
  const route = location.hash.slice(1) || 'heute';
  const [name, ...arg] = route.split('/').map((teil) => { try { return decodeURIComponent(teil); } catch { return teil; } });
  const screen = SCREENS[name] || SCREENS.heute;
  raeumeAuf();
  let ergebnis;
  try {
    ergebnis = screen(arg);
  } catch (e) {
    console.error(e);
    ergebnis = { titel: 'Fehler', knoten: h('div', { class: 'hinweis warn' }, 'Dieser Bildschirm konnte nicht angezeigt werden.', h('small', null, String(e.message || e))) };
  }
  titel.textContent = ergebnis.titel;
  zurueckZiel = ergebnis.zurueck || null;
  zurueck.hidden = !zurueckZiel;
  const y = route === letzteRoute ? window.scrollY : 0;
  inhalt.replaceChildren(ergebnis.knoten);
  window.scrollTo(0, y);
  letzteRoute = route;
  const aktiv = NAV[name] || (SCREENS[name] ? name : 'heute');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('aktiv', a.dataset.nav === aktiv));
}

zurueck.addEventListener('click', () => { if (zurueckZiel) location.hash = zurueckZiel; });
window.addEventListener('hashchange', zeichne);
// Kommt die App aus dem Hintergrund zurück, kann ein neuer Tag begonnen haben.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.state && !document.querySelector('[data-laeuft]')) zeichne();
});

verbinde({ zeichne, meldung: toast });

laden().then(() => { zeichne(); starteAutomatik(); }).catch((e) => {
  console.error(e);
  inhalt.replaceChildren(h('div', { class: 'hinweis warn' }, 'Die Daten konnten nicht geladen werden.', h('small', null, `${e && e.message ? e.message : e} – In Safari darf „Privates Surfen“ nicht aktiv sein.`)));
});

// Offline-Fähigkeit. Nach einem Update lädt die App einmal neu, damit alle Dateien zusammenpassen.
// Auf dem eigenen Rechner (localhost) bleibt er aus, damit Änderungen sofort sichtbar sind;
// zum Testen der Offline-Funktion dort "?offline=1" an die Adresse hängen.
const lokal = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('offline=1');
if ('serviceWorker' in navigator && !lokal) {
  const hatteSteuerung = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service Worker:', e));
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteSteuerung || neuGeladen) return;
    neuGeladen = true;
    location.reload();
  });
}
