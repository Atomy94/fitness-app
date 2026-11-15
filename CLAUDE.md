# Fitness-App – Projektbeschreibung für Claude

Persönliche Fitness-, Ernährungs- und Gesundheits-App für **einen** Nutzer ohne Programmierkenntnisse.
Erkläre jeden Schritt, den der Nutzer selbst machen muss, in einfachen Worten auf Deutsch. Triff technische
Entscheidungen selbst und begründe sie kurz. Frag nur, wenn eine Entscheidung die Nutzung betrifft.

## Was die App ist

- Progressive Web App (PWA) für iPhone/Safari, zum Homescreen hinzugefügt, funktioniert offline.
- Kein eigener Server, keine Internet-Datenbank, keine kostenpflichtigen Dienste, kein Tracking, keine CDNs, **keine fremden Bibliotheken**.
- Daten liegen auf dem Gerät in IndexedDB. Hosting der Dateien: GitHub Pages.
- **Ausnahme auf ausdrücklichen Wunsch des Nutzers (seit 1.2):** optionale Verbindung zur eigenen Dropbox als Schnittstelle zu Claude. Dann liegen Stand, Rezepte und Sicherung zusätzlich im App-Ordner seiner Dropbox. Ohne Verbindung bleibt alles lokal.
- Essen wird NICHT in der App geloggt. Tageswerte kommen aus Yazio über den Claude-Import.
- Rezepte (seit 1.1) dienen nur zum Nachschlagen von Mengen und Nährwerten; sie fließen nicht in die Tageswerte ein.
- Noch nicht enthalten: Rezeptrechner mit Topfgewicht, Übungsbilder, automatische Schritte-Übertragung.

## Feste Regeln

1. **Niemals persönliche Daten ins Repository.** `health-data.json`, `README-health-data.md`, Sicherungen und die Prompt-Datei stehen in `.gitignore`. Vor jedem Commit `git status` prüfen. Der Hook `.githooks/pre-commit` bricht ab, wenn solche Dateien dabei sind (aktiv über `git config core.hooksPath .githooks`). Beispiele und Tests nur mit erfundenen Werten.
2. **Ziele, Grenzwerte und Trainingsplan stehen in den Daten, nicht im Code.** Im Code stehen nur Schlüssel, Bezeichnungen und Startwerte (`js/core/ziele.js`, `js/core/state.js`).
3. **Ziele haben `gueltig_ab`.** Vergangene Tage werden mit dem damals gültigen Wert bewertet. Gilt auch für den Wochenplan (`plan.wochenplanAlt`).
4. **Drei Bereiche getrennt:** Ernährung, Training, Schritte. Kein Gesamtwert, keine Serien (Streaks).
5. **Täglicher Eintrag höchstens 2 Minuten:** wenige Felder, Vorbelegung, nichts doppelt.
6. Oberfläche komplett Deutsch, Zahlen deutsch (`fmt`), Komma-Eingabe (`parseZahl`), Datum TT.MM.JJJJ, Woche ab Montag, Zeitzone Europe/Berlin (`heute()`).
7. Nach jedem funktionierenden Schritt: Tests laufen lassen, Commit mit verständlicher deutscher Beschreibung.
8. Bei jeder Änderung: diese Datei aktuell halten. Bei Änderungen am Import zusätzlich `IMPORT-FORMAT.md`.
9. **Bei jedem Update** `VERSION` in `js/version.js` UND `sw.js` gleich erhöhen, neue Dateien in `DATEIEN` (`sw.js`) eintragen. Ein Test prüft beides.

## Befehle

```
npm test      # alle automatischen Tests (Node, ohne Abhängigkeiten)
npm start     # Vorschau auf http://localhost:5173
npm run icons # App-Symbole neu erzeugen
```

Auf `localhost` ist der Service Worker aus (Änderungen sofort sichtbar). Offline-Test: `http://localhost:5173/?offline=1`.

## Aufbau

Reines HTML/CSS/JavaScript (ES-Module), kein Build-Schritt. Die Dateien im Ordner sind die App.

```
index.html              Grundgerüst, untere Navigation
manifest.webmanifest    PWA-Angaben
sw.js                   Service Worker (Offline-Cache, Version)
css/app.css             gesamtes Aussehen, hell/dunkel über prefers-color-scheme
icons/                  App-Symbole (erzeugt von tools/make-icons.mjs)
js/app.js               Einstieg, Navigation (#heute, #kalender, #tag/DATUM, #training/…, #fortschritt, #mehr/…)
js/store.js             Datenstand im Speicher, Speichern, Wechsel echte Daten/Testdaten
js/db.js                IndexedDB-Hülle
js/cloud.js             Dropbox-Abgleich: hochladen, Eingang abholen, automatisch beim Öffnen/nach Änderungen
js/version.js           Versionsnummer
js/core/                REINE LOGIK ohne Bildschirm-Code (in Node testbar)
  datum.js              Datum, Wochen, Berlin-Zeit
  zahl.js               deutsche Zahlen lesen/ausgeben
  state.js              Aufbau der Daten, Startzustand, Standardplan
  ziele.js              Zielschlüssel, zielWert(datum), Minimalversion, Wochenplan je Datum
  bewertung.js          alle Farbregeln, Wochenwertung, 7-Tage-Schnitt, Zielpfad
  import.js             Claude-Import (prüfen, Vorschau, anwenden)
  erstimport.js         health-data.json → App-Stand
  checkin.js            Wochenwerte und Text für Claude
  dropbox.js            Dropbox-API (OAuth mit PKCE ohne Weiterleitung, Dateien), fetch wird übergeben
  claude-dateien.js     Inhalte für Claude: stand.md, rezepte.md, LIESMICH-fuer-Claude.md, Sicherung, Export
  rezepte.js            Kategorien, Nährwertfelder, Übernahme aus dem Archiv, Portion aus 100-g-Werten
  kraft.js              Verlauf je Übung (Gewicht × Wdh.), Kennzahlen, Vergleich zur Vorgänger-Einheit
  demo.js               Testdaten (3 Wochen, erfunden)
js/ui/                  Bildschirme, je ein Modul
  dom.js                Bausteine: h(), Felder, Punkte, Ring, Diagramm (eigenes SVG)
  heute.js  kalender.js  tag.js  training.js  fortschritt.js  mehr.js  rezepte.js (#rezepte, erreichbar über „Mehr“)
  cloud.js (#cloud, Claude-Verbindung)  vorschau.js (Import-Vorschau, von Einfüge-Import und Dropbox-Eingang benutzt)
tests/                  node:test – bewertung, import, rezepte-kraft, cloud (mit nachgebautem fetch), weitere (Datum, Zahlen, Erstbefüllung, Check-in, Offline-Liste)
tools/                  server.mjs (Vorschau), make-icons.mjs
```

**Neuen Bildschirm ergänzen** (z. B. Rezeptrechner): Modul in `js/ui/` anlegen, das `{ titel, zurueck, knoten }` zurückgibt, in `SCREENS` (`js/app.js`) eintragen, Datei in `sw.js` aufnehmen. Rechenlogik gehört nach `js/core/` mit Tests. Rohdaten für später (Rezepte, Standardmahlzeiten, Regeln) liegen bereits in `einstellungen.archiv`.

## Datenmodell

IndexedDB-Datenbank `fitness-app` (echte Daten) bzw. `fitness-app-demo` (Testdaten), ein Speicher `daten`, je Sammlung ein Eintrag:

| Sammlung | Inhalt |
|---|---|
| `tage` | Objekt je Datum: `kcal, eiweiss_g, kh_g, fett_g, ballaststoffe_g, ges_fett_g, zucker_g, salz_g, schritte, gewicht_kg, schlaf_h, schlaf_qualitaet, stress, kreatin, fussball, notiz, ungenau` |
| `trainings` | Liste. Kraft: `{ id, typ:'kraft', datum, einheit, dauer_min, verkuerzt, uebungen:[{ name, saetze:[{ wdh, kg, sek }], notiz }], notiz }` · Cardio: `{ id, typ:'cardio', datum, art, dauer_min, km, notiz }` |
| `messungen` | Liste, ein Eintrag je Datum+Quelle: `bauch_cm, koerperfett_pct, gewicht_kg, muskelmasse_kg, …, liegestuetze_max, kniebeugen_max, quelle, ungueltig, grund` |
| `blutwerte` | Liste: `{ id, datum, name, wert, wert_text, einheit, norm_min, norm_max }` |
| `ziele` | Liste: `{ id, schluessel, gueltig_ab, wert }` – Schlüssel siehe `ZIEL_INFO` / IMPORT-FORMAT.md |
| `einstellungen` | `start, profil, phasen, minimal.zeitraeume[{von,bis}], minimalKraft, plan{maxMinuten, wochenplan{1..7}, wochenplanAlt[{bis, wochenplan}], einheiten{Name:[Übungen]}, progression}, zielpfad{von,bis}, pauseSek, supplements, letzteSicherung, eingerichtet, archiv` |
| `checkins` | Objekt je Montag: `{ verdauung, besonderheiten }` |
| `rezepte` | Liste: `{ id, name, kategorie (Frühstück/Mittagessen/Abendessen/Snacks), bezug:'portion'|'100g', portion, zutaten:[{ name, menge }], kcal, eiweiss_g, kh_g, fett_g, ges_fett_g, zucker_g, ballaststoffe_g, salz_g, notiz }`. Fehlt die Sammlung (Stand aus 1.0), baut `ergaenze()` sie aus `einstellungen.archiv`. |
| `entwurf` | laufendes Training (nicht Teil der Sicherung): Übungen mit Sätzen, `startMs`, `angehaltenSeit`, `angehaltenMs` (angehaltene Zeit zählt nicht zur Dauer), `pauseBis` (Satzpause) |

Sicherungsdatei: `{ "format": "fitness-sicherung", "version": 1, "erstellt", "daten": { alle Sammlungen } }`, Name `fitness-sicherung-JJJJ-MM-TT.json`.

## Bewertungsregeln (Umsetzung: `js/core/bewertung.js`)

Status: `gruen` geschafft · `gelb` knapp · `rot` verfehlt · `grau` trifft nicht zu · `leer` keine Daten · `offen` heute geplant, noch nicht erledigt.

- **Kalorien** sind ein Korridor (zu wenig ist nicht grün). Varianten: Mo–Sa, Fußballtag mit Fußball, Minimalversion. Der Ring zeigt das Tagesziel, der grüne Bereich beginnt 100 kcal darunter.
- **Ernährung:** grün = Kalorien UND Eiweiß grün · rot = eines rot · sonst gelb. Ballaststoffe, gesättigte Fette, Kreatin haben eigene Farben, beeinflussen den Bereich NICHT.
- **Schritte:** grün ab Ziel, gelb ab 90 %, sonst rot. Ziel = Phasenwert (`schritte_ziel` mit Datum) oder `schritte_minimal`.
- **Training** (nur an Plantagen, sonst grau; vor `einstellungen.start` und in der Zukunft leer):
  - `kraft` (Mo/Do): erledigt grün, verkürzt gelb, ausgefallen rot. Jede Krafteinheit an dem Tag zählt.
  - `laufband` (Di/Fr): Minuten des Tages zusammengezählt, ab 25 grün, ab 15 gelb, sonst rot. In der Minimalversion grau.
  - `bonus` (Sa): Krafteinheit grün, sonst grau.
  - `fussball` (So): gespielt grün; ausgefallen + Spaziergang ab 45 Min. grün; sonst rot.
  - Training ohne Wertung wird als Zusatz mit Stern gezeigt.
- **Fußball und Kalorien:** Schalter `tag.fussball`. Ohne Schalter: Fußball-Einheit eingetragen = gespielt; heute/Zukunft = laut Plan gespielt; vergangener Tag = nicht gespielt (dann gilt das Mo–Sa-Ziel).
- **Wochenwertung:** Ernährung x/7, Training x/y Plantage (y = Tage mit Wertung), Schritte x/7, dazu Schritte-Schnitt und Kalorien-Wochenschnitt mit eigener Bewertung (zwischen „grün bis“ und „gelb bis“ ist gelb).
- **Minimalversion** (Zeiträume in den Einstellungen): Schritte 6.000, Kalorien 2.100–2.500 grün, Kraft an Pflichttagen 20 Min./erste 3 Übungen, Laufband ohne Wertung. „Gewicht und Bauchumfang halten“ gilt als Erfolg und wird so angezeigt.
- **Regel 15 Uhr:** ab 15:00 und Schritte unter `schritte_pflicht_grenze` → „Laufband heute Abend: Pflicht“.
- **Gewicht:** Hauptlinie ist der 7-Tage-Schnitt (`gleitSchnitt`). **Bauchumfang** ist die Hauptkennzahl, mit linearem Zielpfad.
- Schlaf und Stress werden erfasst und angezeigt, nicht bewertet.

## Claude-Import (exakt so)

Vollständige Beschreibung: **IMPORT-FORMAT.md**. Kurzfassung:

- Textblock beginnt mit `FITNESS-IMPORT v1`, danach JSON `{ "eintraege": [ … ] }`.
- Typen: `tag`, `training`, `cardio`, `messung`, `ziel`, `blutwert`, `rezept` (ohne Datum, Schlüssel ist der Name).
- Pflicht nur `typ` und `datum` (plus Kennfelder: `einheit`, `art`, `name`, bei `ziel`: `gueltig_ab`, `schluessel`, `wert`).
- Nur vorhandene Felder werden übernommen; `null` = nicht ändern.
- Vorschau (neu / alt → neu) vor dem Speichern; gespeichert wird erst nach „Übernehmen“.
- Ein ungültiger Eintrag verwirft den ganzen Block mit verständlicher Meldung.
- Training mit gleichem Datum und gleicher Einheit ersetzt das vorhandene nach Rückfrage.
- Unbekannte Felder werden ignoriert und als Hinweis gezeigt.
- Erweiterungen: nur neue optionale Felder/Typen; sonst neue Kopfzeile `v2`, `v1` bleibt lesbar.

## Claude-Verbindung über Dropbox (seit 1.2)

- **Einrichtung durch den Nutzer:** eigene Dropbox-App (Scoped access, „App folder“, Rechte `files.metadata.read`, `files.content.read`, `files.content.write`), App key in der App eintragen, bei Dropbox anmelden, angezeigten Code einfügen. Kein Redirect, kein Client-Secret.
- **Gespeichert** wird die Verbindung unter dem Schlüssel `cloud` in der Datenbank `fitness-app` (`appKey, refreshToken, accessToken, ablauf, konto, letzterAbgleich, liesmichVersion, fehler`). Sie ist nicht Teil von Sicherung und Export. Im Testdaten-Modus ist der Abgleich aus.
- **Ordner** (relativ zum App-Ordner `Apps/<Name>/`): `stand.md`, `rezepte.md`, `LIESMICH-fuer-Claude.md`, `sicherung/fitness-sicherung.json` (App schreibt), `eingang/` (Claude legt Import-Dateien ab), `erledigt/` (App verschiebt Verarbeitetes).
- **Abgleich** (`abgleichen()`): lädt die vier Dateien hoch, listet `eingang/`, lädt neue Dateien und prüft sie mit `leseImport`. Automatisch 1,5 s nach dem Start, beim Zurückkehren in die App (wenn älter als 2 Min.) und 15 s nach einer Änderung.
- **Nichts wird automatisch übernommen.** Jede Datei erscheint mit Vorschau unter „Claude-Verbindung“ (Hinweis auf „Heute“); „Übernehmen“ oder „Verwerfen“ verschiebt sie nach `erledigt/`.
- Der erfolgreiche Abgleich setzt `letzteSicherung` (die Dropbox-Sicherung zählt).
- `LIESMICH-fuer-Claude.md` wird neu hochgeladen, wenn sich App-Version oder `LIESMICH_VERSION` ändert. Bei Änderungen am Importformat den Text in `liesmichDatei()` anpassen.
- **Prüfstand (15.11.2026):** Anmeldung und erster Abgleich mit dem echten Dropbox-Konto des Nutzers funktionieren in Chrome am Computer (Version 1.2.1). Noch offen: Anmeldung aus der Homescreen-App auf dem iPhone und ob Claudes Dropbox-Connector Dateien in `eingang/` anlegen kann.
- Eine begonnene Anmeldung (`verifier`, `anmeldeUrl`) bleibt gespeichert, bis sie abgeschlossen oder verworfen wird. Sonst passt ein schon geholter Code nach einem Neuladen nicht mehr.

## Training durchführen und Steigerung

- Timer oben: **Anhalten/Fortsetzen** (ganze Einheit, Zeit steht) und **Beenden** (speichert bestätigte Sätze, fragt bei offenen Sätzen nach). Darunter die Satzpause, die nach jedem ✓ automatisch startet.
- Jede gespeicherte Einheit hält je Übung alle Sätze mit Gewicht und Wiederholungen fest.
- **„Steigerung je Übung“** (auf „Training“ und „Fortschritt“): letzter Stand je Übung, Veränderung zur vorherigen Einheit und seit dem ersten Eintrag. Detail je Übung: Bestwert, Diagramme (Gewicht, Wiederholungen, Gewicht × Wdh.), alle Einträge mit Veränderung.
- Übungen werden über `uebungsSchluessel()` zusammengeführt (Name bis zum ersten Komma oder zur ersten Klammer, Kleinschreibung). Mehr Gewicht zählt als Steigerung, auch bei weniger Wiederholungen.

## Besonderheiten der Daten

- Rezepte aus der health-data.json: `standard_meals` (pro Portion) und `foods_per_100g` (pro 100 g). Die Kategorie wird geschätzt (Gerichte → Abendessen) und ist in der App änderbar.

- Eiweißwerte bis 13.11.2026 sind 5–15 g zu niedrig (falsches Proteinpulver in Yazio). Diese Tage tragen `ungenau: true` und werden als „Werte ungenau“ gezeigt. Ein neuer Eiweißwert per Import entfernt die Markierung.
- Die Minimalversion beginnt laut Erstimport am 07.12.2026 ohne Enddatum (Prüfungstermin unbekannt); der Nutzer schaltet sie aus oder trägt ein Ende ein.
- Blutwerte ohne Normbereich in der Quelldatei werden ohne Markierung angezeigt.
- Tanita-Messung mit `ungueltig` bleibt sichtbar (ausgegraut), fließt nicht in Verläufe ein.

## Bekannte Grenzen

- iOS: Vibration gibt es in Safari nicht; der Timer-Ton funktioniert nur, solange die App im Vordergrund ist.
- Eine gespeicherte Krafteinheit lässt sich nicht satzweise bearbeiten (löschen und neu eintragen oder per Import ersetzen).
- Einheiten im Plan (Kraft A/B/C) können bearbeitet, aber nicht neu angelegt oder umbenannt werden.
