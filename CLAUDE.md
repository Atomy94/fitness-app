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
- Fortschrittsfotos (seit 1.18) liegen auf dem Gerät und, wenn verbunden, im Dropbox-Ordner `fotos/`, nie im Repository.
- Noch nicht enthalten: Rezeptrechner mit Topfgewicht, Übungsbilder. Schlafphasen und HRV aus dem Xiaomi Band: App bereit, Kurzbefehl wird ergänzt, sobald das Band da ist.

## Feste Regeln

1. **Niemals persönliche Daten ins Repository.** `health-data.json`, `README-health-data.md`, Sicherungen und die Prompt-Datei stehen in `.gitignore`. Vor jedem Commit `git status` prüfen. Der Hook `.githooks/pre-commit` bricht ab, wenn solche Dateien dabei sind (aktiv über `git config core.hooksPath .githooks`). Beispiele und Tests nur mit erfundenen Werten.
2. **Ziele, Grenzwerte und Trainingsplan stehen in den Daten, nicht im Code.** Im Code stehen nur Schlüssel, Bezeichnungen und Startwerte (`js/core/ziele.js`, `js/core/state.js`).
3. **Ziele haben `gueltig_ab`.** Vergangene Tage werden mit dem damals gültigen Wert bewertet. Gilt auch für den Wochenplan (`plan.wochenplanAlt`).
4. **Drei Bereiche bleiben immer einzeln sichtbar:** Ernährung, Training, Schritte. Seit 1.9 gibt es auf Wunsch des Nutzers zusätzlich eine Tages- und Wochenwertung in Prozent; sie darf nie allein stehen, sondern wird immer zusammen mit den drei Bereichsbalken gezeigt. (Die frühere Regel „kein Gesamtwert, keine Serien“ hat der Nutzer am 16.11.2026 ausdrücklich aufgehoben.)
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
js/app.js               Einstieg, Navigation (#heute, #kalender, #tag/DATUM, #training/…, #schlaf, #fortschritt, #fotos, #mehr/…)
js/store.js             Datenstand im Speicher, Speichern, Wechsel echte Daten/Testdaten
js/db.js                IndexedDB-Hülle
js/cloud.js             Dropbox-Abgleich: hochladen, Eingang abholen, Fotos abgleichen, automatisch beim Öffnen/nach Änderungen
js/fotos.js             Fortschrittsfotos: verkleinern, in IndexedDB speichern, löschen, Abgleich mit Dropbox fotos/
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
  eingang.js            Eingang verarbeiten: Auto-Importe je Datum auf die neueste Datei eindampfen, konfliktfrei nach erledigt/ verschieben, optional ohne Vorschau übernehmen
  claude-dateien.js     Inhalte für Claude: stand.md, rezepte.md, LIESMICH-fuer-Claude.md, Sicherung, Export
  rezepte.js            Kategorien, Nährwertfelder, Übernahme aus dem Archiv, Portion aus 100-g-Werten
  wertung.js            Tages- und Wochenwertung in Prozent (Gewichte und Grenzen aus den Zielen)
  vorschlag.js          Abend-Vorschläge „Für heute noch“ (rein rechnerisch), Startwerte der Snack-Liste
  satzzeit.js           Satz- und Pausenzeiten: Satzbeginn/-ende auf der Trainingsuhr, gemessene Pausen, Speichern, Auswertung
  check.js              Check vor dem Training: Stufe aus drei Antworten, Vorschlag auf die Übungsliste anwenden
  fotos.js              Fotos: Dateinamen, Termine, Vorher/Nachher-Auswahl, Messwerte zum Termin, Abgleichplan
  schlaf.js             Schlaf je Nacht, Phasenanteile, Wochenschnitt, Verlauf, Vorbelegung des Checks (schlafNote)
  signal.js             Zeitplan der Töne am Pausenende
  wach.js               Bildschirm anlassen während des Trainings (Screen Wake Lock, still ohne Unterstützung)
  kraft.js              Verlauf je Übung (Gewicht × Wdh.), Kennzahlen, Vergleich zur Vorgänger-Einheit
  demo.js               Testdaten (3 Wochen, erfunden)
js/ui/                  Bildschirme, je ein Modul
  dom.js                Bausteine: h(), Felder, Punkte, Ring, Diagramm (eigenes SVG)
  heute.js  kalender.js  tag.js  training.js  schlaf.js  fortschritt.js  mehr.js  rezepte.js (#rezepte, erreichbar über „Mehr“)  fotos.js (#fotos, über „Fortschritt“ und „Mehr“)
  symbole.js (eigene SVG-Symbole; uebungsArt(name) ordnet Übungen/Sportarten Symbol und Farbgruppe zu; kachel())
  wertung.js (Anzeige der Wertung: große Zahl + drei Bereichsbalken)
  cloud.js (#cloud, Claude-Verbindung)  vorschau.js (Import-Vorschau, von Einfüge-Import und Dropbox-Eingang benutzt)
tests/                  node:test – bewertung, import, rezepte-kraft, cloud (mit nachgebautem fetch), eingang (mit nachgebauter Dropbox), varianten, samstag (Auswahl am Plantag, Übungsnamen, plantag-Import), vorschlag (Abend-Vorschläge), wertung (Tages- und Wochenwertung, Wochendiagramm), streak (Streak mit Joker), sonntag (Sonntags-Hinweis), schlaf (Schlaf, Import der Messwerte), fotos (Dateinamen, Termine, Abgleichplan), satzzeit (komplettes Training mit Supersatz, Pause aus, Anhalten, Export, Import), gewicht (Rundung), check (Check vor dem Training), weitere (Datum, Zahlen, Erstbefüllung, Check-in, Offline-Liste)
tools/                  server.mjs (Vorschau), make-icons.mjs
```

**Neuen Bildschirm ergänzen** (z. B. Rezeptrechner): Modul in `js/ui/` anlegen, das `{ titel, zurueck, knoten }` zurückgibt, in `SCREENS` (`js/app.js`) eintragen, Datei in `sw.js` aufnehmen. Rechenlogik gehört nach `js/core/` mit Tests. Rohdaten für später (Rezepte, Standardmahlzeiten, Regeln) liegen bereits in `einstellungen.archiv`.

## Datenmodell

IndexedDB-Datenbank `fitness-app` (echte Daten) bzw. `fitness-app-demo` (Testdaten), ein Speicher `daten`, je Sammlung ein Eintrag:

| Sammlung | Inhalt |
|---|---|
| `tage` | Objekt je Datum: `kcal, eiweiss_g, kh_g, fett_g, ballaststoffe_g, ges_fett_g, zucker_g, salz_g, schritte, gewicht_kg, schlaf_h, schlaf_qualitaet (alt), schlaf_tief_min, schlaf_rem_min, schlaf_leicht_min, schlaf_wach_min, einschlafen, aufwachen, ruhepuls, hrv_ms, stress, kreatin, fussball, notiz, ungenau` (Schlaf = Nacht, die am Morgen des Tages endet) |
| `trainings` | Liste. Kraft: `{ id, typ:'kraft', datum, einheit, start, ende, dauer_min, verkuerzt, ersetzt, check_muskelkater, check_schlaf, check_energie, check_regionen, check_vorschlag, check_angenommen, uebungen:[{ name, pause_geplant_sek, saetze:[{ wdh, kg, sek, start, dauer_sek, pause_sek }], notiz }], notiz }` (Zeitfelder seit 1.19, nur bei live aufgezeichneten Einheiten) · Cardio: `{ id, typ:'cardio', datum, art, dauer_min, km, notiz }` |
| `messungen` | Liste, ein Eintrag je Datum+Quelle: `bauch_cm, koerperfett_pct, gewicht_kg, muskelmasse_kg, …, liegestuetze_max, kniebeugen_max, quelle, ungueltig, grund` |
| `blutwerte` | Liste: `{ id, datum, name, wert, wert_text, einheit, norm_min, norm_max }` |
| `ziele` | Liste: `{ id, schluessel, gueltig_ab, wert }` – Schlüssel siehe `ZIEL_INFO` / IMPORT-FORMAT.md |
| `einstellungen` | `start, profil, phasen, minimal.zeitraeume[{von,bis}], minimalKraft, plan{maxMinuten, wochenplan{1..7: { typ, einheit, minuten, text, wahl:[{ text, einheit }] }}, wochenplanAlt[{bis, wochenplan}], einheiten{Name:[{ name, saetze, wdh, kg, kg_text, sek, pause_sek, notiz, schwer:{ name, wdh, kg, sek, saetze, pause_sek, notiz } }]}, progression}, zielpfad{von,bis}, pauseSek, snacks:[{ id, name, kcal, eiweiss_g, fett_g, hinweis }], vorschlagAbStunde, autoImportOhneVorschau, supplements, letzteSicherung, eingerichtet, archiv` |
| `checkins` | Objekt je Montag: `{ verdauung, besonderheiten }` |
| `rezepte` | Liste: `{ id, name, kategorie (Frühstück/Mittagessen/Abendessen/Snacks), bezug:'portion'|'100g', portion, zutaten:[{ name, menge }], kcal, eiweiss_g, kh_g, fett_g, ges_fett_g, zucker_g, ballaststoffe_g, salz_g, notiz }`. Fehlt die Sammlung (Stand aus 1.0), baut `ergaenze()` sie aus `einstellungen.archiv`. |
| `fotos` | Metadaten der Fortschrittsfotos `[{ id, datum, ansicht (vorne/seite/hinten), hochgeladen, erstellt }]`; Bilder einzeln unter `foto:<id>` als `{ typ, daten, mini }` (Bytes), dazu `fotos-geloescht` (Dateinamen, die beim Abgleich in der Dropbox gelöscht werden). **Nicht** im Datenstand, nicht in Sicherung, Export oder stand.md. |
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
  - `bonus` (Sa): Krafteinheit grün, durch Bewegung ersetzt (`ersetzt`) gelb, sonst grau.
  - `fussball` (So): gespielt grün; ausgefallen + Spaziergang ab 45 Min. grün; sonst rot.
  - Training ohne Wertung wird als Zusatz mit Stern gezeigt.
- **Fußball und Kalorien:** Schalter `tag.fussball`. Ohne Schalter: Fußball-Einheit eingetragen = gespielt; heute/Zukunft = laut Plan gespielt; vergangener Tag = nicht gespielt (dann gilt das Mo–Sa-Ziel).
- **Wochenwertung:** Ernährung x/7, Training x/y Plantage (y = Tage mit Wertung), Schritte x/7, dazu Schritte-Schnitt und Kalorien-Wochenschnitt mit eigener Bewertung (zwischen „grün bis“ und „gelb bis“ ist gelb).
- **Minimalversion** (Zeiträume in den Einstellungen): Schritte 6.000, Kalorien 2.100–2.500 grün, Kraft an Pflichttagen 20 Min./erste 3 Übungen, Laufband ohne Wertung. „Gewicht und Bauchumfang halten“ gilt als Erfolg und wird so angezeigt.
- **Fußball ersetzt Schritte (seit 1.20, `schritteDurchFussball()`):** Cardio-Einträge mit Fußball in der Art (z. B. „Hallenfußball“) mit zusammen mindestens `fussball_ersetzt_schritte_min` Minuten (Ziel, Startwert 45) → Schritte grün und Tageswertung Schritte 100 %, egal wie viele Schritte. Zählt bei „Schritte x/7“; der Schrittdurchschnitt bleibt nur aus echten Schritten. Gilt rückwirkend (wird berechnet, nicht gespeichert). Tagesansicht: Hinweis „Fußball ersetzt Schritte“; stand.md/Export: `schritte_ersetzt_durch_fussball: true` am Tag.
- **Regel 15 Uhr:** ab 15:00 und Schritte unter `schritte_pflicht_grenze` → „Laufband heute Abend: Pflicht“.
- **Gewicht** wird immer mit höchstens einer Nachkommastelle gespeichert (seit 1.16.1: Import, Eingabefeld und beim Laden vorhandener Daten gerundet). Hauptlinie ist der 7-Tage-Schnitt (`gleitSchnitt`). **Bauchumfang** ist die Hauptkennzahl, mit linearem Zielpfad.
- Schlaf, Ruhepuls, HRV und Stress werden angezeigt, nicht bewertet (siehe „Schlaf“).
- **Sonntags-Hinweis (seit 1.15):** Sonntags zeigt „Heute“ „Bauchumfang messen und Fotos machen“ (Knöpfe zur Tagesansicht mit dem Feld Bauchumfang und, seit 1.18, zu den Fotos), bis für diesen Sonntag ein gültiger Bauchumfang eingetragen ist (`sonntagsMessungOffen()` in `js/core/bewertung.js`, Messung mit beliebiger Quelle).

## Tages- und Wochenwertung in Prozent (seit 1.9, Umsetzung: `js/core/wertung.js`)

Zusätzlich zu den Farbstatus der drei Bereiche. Pro Tag 0–100 %, nie mehr.

- **Ernährung 50 %:** Kalorien 30 % (100 % im grünen Korridor des Tages; außerhalb linear fallend bis 0 % bei 500 kcal Abstand, zu wenig UND zu viel) + Eiweiß 20 % (`min(Eiweiß / eiweiss_min, 1)`).
- **Training 25 %:** nur an Plantagen, abgeleitet vom Farbstatus: grün 100 %, gelb (verkürzt bzw. Laufband 15–24 Min.) 50 %, rot 0 %, heute noch offen 0 %. Grau/leer (kein Plantag, Bonus ausgefallen) wird nicht gewertet.
- **Schritte 25 %:** `min(Schritte / Tagesziel, 1)`.
- **Nicht gewertete Bereiche** (kein Plantag, keine Schritte eingetragen) geben ihr Gewicht anteilig an die übrigen ab. Fehlt nur der Eiweiß- oder nur der Kalorienwert, zählt innerhalb der Ernährung der vorhandene.
- **Ohne Ernährungsdaten** ist der Tag nicht gewertet (grau), ebenso Tage in der Zukunft.
- **Heute ist „vorläufig“**, bis der Tag vorbei ist. **Wochenwertung** = Durchschnitt der gewerteten Tage; die laufende Woche ist „vorläufig“.
- **Guter Tag** = mindestens `wertung_guter_tag` (Startwert 80 %).
- Gewichte und Grenzen stehen als Ziele mit `gueltig_ab` in den Daten: `wertung_kcal_pct`, `wertung_eiweiss_pct`, `wertung_training_pct`, `wertung_schritte_pct`, `wertung_kcal_null_abstand`, `wertung_guter_tag` (Mehr → Einstellungen → Tageswertung).
- **Anzeige** (`wertungBlock()` in `js/ui/wertung.js`): groß die Prozentzahl, darunter immer die drei Bereiche als Balken. Auf „Heute“ und in der Tagesansicht zeigt der Punkt vor dem Balken den Farbstatus des Bereichs, der Balken selbst ist neutral. Im Kalender: Zahl je Tag im Monatsraster (`*` = vorläufig), Wochenwertung in „Diese Woche“ und in der Wochentabelle. Auch im Check-in und im Export (`wertung_pct`).

### Streak mit Joker (seit 1.11, `streak()` in `js/core/wertung.js`)

- **Streak** = gute Tage in Folge (guter Tag: Tageswertung ab `wertung_guter_tag`). Gezählt wird ab `einstellungen.start`. Der längste Streak wird jedes Mal aus dem Verlauf berechnet, nicht gespeichert.
- **Joker:** Pro Kalenderwoche (Mo–So) darf ein Tag schwach sein. Er zählt nicht mit, der Streak bleibt. Jeder weitere schwache Tag derselben Woche setzt den Streak auf 0. Der erste schwache Tag der Woche verbraucht die Ausnahme auch dann, wenn gerade kein Streak lief (im Kalender ist er dann nicht als Joker markiert).
- **Tage ohne Ernährungsdaten** sind schwache Tage.
- **Heute** kann den Streak erst beenden, wenn der Tag vorbei ist: schon gut → zählt mit; noch schwach → bleibt außen vor und verbraucht keinen Joker.
- **Anzeige:** auf „Heute“ in der Karte „Tageswertung“ (Flamme, Anzahl, längster Streak, Stand des Jokers), im Kalender als Stern-Symbol am Joker-Tag und in „Diese Woche“, in der Tagesansicht als Hinweis, im Check-in als Zeile.

### Diagramm „Verlauf der Wochenwertungen“ (seit 1.10)

- Daten: `wochenVerlauf()` in `js/core/wertung.js`. Je Woche der Anteil grüner Tage je Bereich und die Wochenwertung (gesamt) als vierte, kräftige Linie.
- **Laufende Woche nur aus den bisherigen Tagen:** vergangene Tage zählen immer; der heutige Tag zählt je Bereich erst, wenn ein Ergebnis vorliegt (Ernährung/Schritte eingetragen, Training nicht mehr offen). Vorher wurde durch 7 geteilt, wodurch die Linien am Wochenanfang fälschlich abfielen.
- Die laufende Woche ist vorläufig: Punkt hohl, Strecke dorthin gestrichelt (`vorlaeufig` am Punkt, siehe `diagramm()` in `js/ui/dom.js`).
- X-Achse mit Kalenderwochen (`xMarken`). Die Bereichslinien unterscheiden sich zusätzlich zur Farbe durch die Punktform (Kreis, Quadrat, Raute).

## Schlaf (seit 1.17, eigener Bereich #schlaf in der unteren Leiste)

- **Quelle:** Xiaomi Band → Mi Fitness → Apple Health → Kurzbefehl „Fitness-Import“ → Dropbox (Auto-Import). Anleitung für den Kurzbefehl: **KURZBEFEHL-SCHLAF.md**. Die Nacht, die am Morgen des Tages D endet, steht bei D.
- **Logik:** `js/core/schlaf.js` (`nacht()`, `phasenAnteile()`, `schlafSchnitt()`, `schlafWoche()`, `schlafVerlauf()` mit 7-Tage-Schnitt, `schlafNote()`). Ohne `schlaf_h`, aber mit Phasen zählt die Summe der Schlafphasen ohne Wachzeit.
- **Bildschirm** `js/ui/schlaf.js`: letzte Nacht (Dauer, Zeiten, Ruhepuls, HRV, Phasenbalken), Diese Woche (Ø mit Vergleich zur Vorwoche), Schlafdauer 30 Tage mit Bezugslinie `schlaf_bedarf_h` (Ziel, Startwert 7,5), Ruhepuls, HRV und Stress als Verläufe (nur wenn Daten da sind), Liste der Nächte. Phasenfarben eigene Variablen (`--p-tief` …), nicht Grün/Gelb/Rot.
- **Heute:** Karte „Schlaf letzte Nacht“ (`schlafKarte()`). Die Schnelleingabe fragt Schlaf und Schlafqualität nicht mehr ab; in der Tagesansicht bleibt „Schlaf (Korrektur)“.
- **Schätzwert von Hand (seit 1.17.1, Wunsch des Nutzers bis das Band da ist):** Solange die Nacht von heute keine Messung mit Uhrzeiten oder Phasen hat (`ohneMessung()`), zeigen die Karte auf „Heute“ und der Bereich „Schlaf“ das Feld „Wie lange hast du ca. geschlafen?“ (schreibt `schlaf_h`). Eine spätere Messung aus dem Kurzbefehl überschreibt den Wert, danach verschwindet das Feld. Stress bleibt Selbsteingabe (Apple Health kennt keinen Stresswert).
- **Check vor dem Training:** Die Frage „Schlaf letzte Nacht“ ist aus der Messung vorbelegt (`schlafNote()`: ab Bedarf 5, je fehlender Stunde eine Stufe weniger, min. 1), mit Hinweis auf die gemessene Dauer.
- **Import:** leere Texte oder 0 bei den Messwerten = keine Messung (der Auto-Import scheitert nicht, wenn das Band noch nicht synchronisiert hat); Punkt = Dezimaltrenner.

## Fortschrittsfotos (seit 1.18, `#fotos`)

- **Aufnehmen:** Datum (Startwert heute) und je Ansicht (Vorne, Seite, Hinten) ein Knopf mit `<input type="file" accept="image/*">`: iOS bietet Kamera oder Mediathek an. `js/fotos.js` verkleinert auf längste Seite 1280 px (JPG 0,82) plus Vorschaubild 400 px. Mehrere Fotos derselben Ansicht am selben Tag sind erlaubt; gezeigt wird das zuletzt aufgenommene.
- **Vorher/Nachher:** Ansicht wählen (nur Ansichten mit mindestens zwei Terminen), zwei Termine (Startwert ältester und neuester), Nebeneinander oder Überblenden mit Schieberegler. Unter jedem Foto Gewicht des Tages und Bauchumfang (`messwerteAm()`).
- **Alle Termine:** neuester zuerst, je Termin drei Plätze; Tippen öffnet das Vollbild mit „Foto löschen“.
- **Speicher:** eigener Eintrag in IndexedDB (siehe Datenmodell), getrennt nach echten Daten und Testdaten. „Alle Daten löschen“ löscht auch die Fotos.
- **Dropbox (Wunsch des Nutzers):** `fotosAbgleichen()` läuft im Abgleich nach der Sicherung: lädt fehlende Fotos nach `fotos/JJJJ-MM-TT_ansicht_id.jpg` hoch, löscht dort lokal gelöschte, holt Fotos, die nur in der Dropbox liegen (Gerätewechsel), höchstens 20 je Abgleich. Plan: `fotoAbgleichPlan()` (getestet). Änderungen an der Fotoliste lesen immer den aktuellen Stand, damit während des Abgleichs aufgenommene Fotos nicht verloren gehen.
- Erreichbar über Fortschritt (Karte „Fortschrittsfotos“), Mehr und den Sonntags-Hinweis (Knöpfe „Bauchumfang“ und „Fotos“).

## Abend-Vorschläge „Für heute noch“ (seit 1.8)

- Ab `einstellungen.vorschlagAbStunde` (Startwert 20 Uhr, Berliner Zeit) zeigt „Heute“ die Karte. Umsetzung: `abendVorschlag()` in `js/core/vorschlag.js`, ohne KI.
- **Fehlt:** Kalorien bis zum unteren Rand des grünen Korridors des Tages (`kcal.min`, also auch Fußballtag/Minimalversion) und Eiweiß bis `eiweiss_min`. **Frei:** Kalorien bis `kcal.max` und Fett bis `fett_max` (nur wenn für heute ein Fettwert vorliegt).
- **Auswahl:** Kandidaten sind jeder Snack einzeln und jedes Paar aus zwei verschiedenen Snacks. Kein Kandidat darf über die Obergrenze des Korridors oder die Fettgrenze führen. Fehlt Eiweiß, gewinnt, was die Eiweißlücke am besten schließt (dann Kalorienlücke, dann weniger Snacks, dann weniger Kalorien). Fehlen nur Kalorien, gewinnen die kalorienreicheren. Gezeigt werden höchstens zwei Vorschläge mit dem Stand danach.
- Zustände: keine Tageswerte, „Ziele erreicht – heute nichts mehr nötig.“, Vorschläge, oder „kein Snack passt mehr“.
- **Snack-Liste** liegt in `einstellungen.snacks`, bearbeitbar unter Mehr → Einstellungen. Tagesgrenzen wie „Quark höchstens 250 g“ werden nur als `hinweis` am Snack angezeigt: Die App weiß nicht, was heute schon gegessen wurde.

## Claude-Import (exakt so)

Vollständige Beschreibung: **IMPORT-FORMAT.md**. Kurzfassung:

- Textblock beginnt mit `FITNESS-IMPORT v1`, danach JSON `{ "eintraege": [ … ] }`.
- Typen: `tag`, `training`, `cardio`, `messung`, `ziel`, `blutwert`, `rezept` (ohne Datum, Schlüssel ist der Name), `einheit` (ohne Datum; ersetzt die Übungsliste einer Plan-Einheit oder legt eine neue an), `plantag` (ohne Datum; ändert einen Wochentag des Wochenplans, auch mit Auswahl mehrerer Einheiten).
- Pflicht nur `typ` und `datum` (plus Kennfelder: `einheit`, `art`, `name`, bei `ziel`: `gueltig_ab`, `schluessel`, `wert`).
- Nur vorhandene Felder werden übernommen; `null` = nicht ändern.
- Vorschau (neu / alt → neu) vor dem Speichern; gespeichert wird erst nach „Übernehmen“.
- Ein ungültiger Eintrag verwirft den ganzen Block mit verständlicher Meldung.
- Training mit gleichem Datum und gleicher Einheit ersetzt das vorhandene nach Rückfrage.
- Unbekannte Felder werden ignoriert und als Hinweis gezeigt.
- Erweiterungen: nur neue optionale Felder/Typen; sonst neue Kopfzeile `v2`, `v1` bleibt lesbar.

## Claude-Verbindung über Dropbox (seit 1.2)

- **Einrichtung durch den Nutzer:** eigene Dropbox-App (Scoped access, „App folder“, Rechte `files.metadata.read`, `files.content.read`, `files.content.write`), App key in der App eintragen, bei Dropbox anmelden, angezeigten Code einfügen. Kein Redirect, kein Client-Secret.
- **Gespeichert** wird die Verbindung unter dem Schlüssel `cloud` in der Datenbank `fitness-app` (`appKey, refreshToken, accessToken, ablauf, konto, letzterAbgleich, liesmichVersion, fehler, protokoll`). Sie ist nicht Teil von Sicherung und Export. Im Testdaten-Modus ist der Abgleich aus.
- **Ordner** (relativ zum App-Ordner `Apps/<Name>/`): `stand.md`, `rezepte.md`, `LIESMICH-fuer-Claude.md`, `sicherung/fitness-sicherung.json` (App schreibt), `eingang/` (Claude legt Import-Dateien ab), `erledigt/` (App verschiebt Verarbeitetes), `fotos/` (Fortschrittsfotos, seit 1.18; laut LIESMICH öffnet Claude sie nur auf ausdrücklichen Wunsch).
- **Abgleich** (`abgleichen()`): lädt die vier Dateien hoch, listet `eingang/`, lädt neue Dateien und prüft sie mit `leseImport`. Automatisch 1,5 s nach dem Start, beim Zurückkehren in die App (wenn älter als 2 Min.) und 15 s nach einer Änderung.
- **Jede Datei erscheint mit Vorschau** unter „Claude-Verbindung“ (Hinweis auf „Heute“); „Übernehmen“ oder „Verwerfen“ verschiebt sie nach `erledigt/`. Einzige Ausnahme: Auto-Importe mit eingeschalteter Einstellung (nächster Punkt).
- **Auto-Import aus dem Kurzbefehl (seit 1.6):** Ein iOS-Kurzbefehl legt bei jedem Schließen von Yazio `eingang/import-auto-JJJJ-MM-TT.txt` mit genau einem `tag`-Eintrag ab; durch die Dropbox entstehen Varianten (`-2`, „conflicted copy“, `(1)`). `verarbeiteEingang()` in `js/core/eingang.js` gruppiert alle `import-auto-`-Dateien nach dem **Datum im Inhalt**, behält je Datum die neueste (`server_modified`) und verschiebt ältere ohne Rückfrage nach `erledigt/`. Ungültige Auto-Dateien zählen nicht als neueste. Andere Dateien bleiben unberührt.
- **Einstellung `einstellungen.autoImportOhneVorschau`** (Standard aus, Schalter unter „Claude-Verbindung“): übernimmt die neueste gültige Auto-Datei je Datum direkt. Gilt nur für `tag`-Einträge aus `import-auto-`-Dateien. `js/cloud.js` wendet die Einträge am Ende des Abgleichs auf den dann aktuellen Stand an, damit Eingaben während des Abgleichs nicht verloren gehen.
- **Protokoll:** `cloud.protokoll` (höchstens 30 Einträge: übersprungen / übernommen mit alter → neuer Wert) wird unter „Claude-Verbindung“ angezeigt.
- **Verschieben ohne Namenskonflikt:** `erledigtName()` hängt bei vorhandenem Namen in `erledigt/` einen Zeitstempel an (`name__JJJJ-MM-TTTHHMM.txt`, Berliner Zeit); nichts wird überschrieben.
- **Reihenfolge im Abgleich:** erst Eingang verarbeiten, dann `stand.md`, `rezepte.md` und Sicherung hochladen (so enthalten sie übernommene Auto-Importe schon).
- Der erfolgreiche Abgleich setzt `letzteSicherung` (die Dropbox-Sicherung zählt).
- `LIESMICH-fuer-Claude.md` wird neu hochgeladen, wenn sich App-Version oder `LIESMICH_VERSION` ändert. Bei Änderungen am Importformat den Text in `liesmichDatei()` anpassen.
- **Prüfstand (15.11.2026):** Anmeldung und erster Abgleich mit dem echten Dropbox-Konto des Nutzers funktionieren (Version 1.2.1). Der ganze Kreislauf ist bestätigt: Claudes Dropbox-Connector legt Dateien in `eingang/` an, die App holt sie ab und verschiebt sie nach `erledigt/` (dort liegen verarbeitete Importe vom 15.11.). Der App-Ordner des Nutzers liegt in der Dropbox unter `/Apps/` (Name der Dropbox-App).
- **Versionen beachten:** Ein Import mit neuen Typen oder Feldern (z. B. `einheit` ab 1.3, `schwer` ab 1.4) setzt voraus, dass die App auf dem iPhone schon aktualisiert ist. Ältere Versionen lehnen unbekannte Typen ab und ignorieren unbekannte Felder still.
- Eine begonnene Anmeldung (`verifier`, `anmeldeUrl`) bleibt gespeichert, bis sie abgeschlossen oder verworfen wird. Sonst passt ein schon geholter Code nach einem Neuladen nicht mehr.

## Gestaltung (seit 1.5)

- **Symbole:** `js/ui/symbole.js` enthält alle Symbole als einfache Strichzeichnungen (24 × 24, `currentColor`). Neue Übung ohne passendes Symbol → Muster in `ARTEN` ergänzen (erster Treffer gewinnt), sonst erscheint die Hantel.
- **Farbgruppen** (`.k-druecken`, `.k-ziehen`, `.k-schulter`, `.k-beine`, `.k-rueckseite`, `.k-rumpf`, `.k-cardio`, `.k-kraft` in `css/app.css`): eigene Farbe je Gruppe, jeweils für hell und dunkel. **Grün, Gelb und Rot bleiben dem Status vorbehalten** und werden nicht als Gruppenfarbe verwendet.
- **Bausteine im Trainingsbereich:** Wochenleiste (`wochenLeiste`, Farbe = Status des Trainings), Einheiten-Karten (`einheitKarte`), Marken mit Symbol (`chip`, `zielChips`), Übungskarte mit farbigem Rand, Symbol und Satz-Punkten (`.ukarte`, `.pips`), Timer mit Zeitbalken und „x von y Sätzen“.

## Training durchführen und Steigerung

- **Auswahl am Plantag (seit 1.7):** Hat ein Plantag `wahl` (2–4 Einträge `{ text, einheit }`), fragt die App auf „Heute“ und auf „Training“ „Wie trainierst du heute?“ und zeigt je Möglichkeit einen Knopf (`planAuswahl()` in `js/core/ziele.js`). Beim Nutzer: Samstag „Alleine“ → Kraft C, „Mit …“ → Studio-Einheit. Gewertet wird wie bisher nach `typ` (Bonus: jede Krafteinheit grün, sonst grau). Die konkreten Namen stehen in den Daten des Nutzers, nicht im Code.
- **Eigene Übung im Training (seit 1.7):** Karte „Eigene Übung hinzufügen“ im laufenden Training. Mit Haken „Künftig immer in …“ wird sie über `ergaenzePlanUebung()` dauerhaft in den Plan der Einheit geschrieben. Sie bekommt automatisch einen eigenen Verlauf.
- **Übungsnamen:** `uebungsName()` schneidet alles nach dem ersten Komma und reine Hinweis-Klammern ab (beginnen mit Tempo, je, nach, langsam oder einer Ziffer). Andere Klammern gehören zum Namen: „Liegestütze (Studio)“ ist eine eigene Übung mit eigenem Verlauf.
- Ein Satz ohne eingetragene Wiederholungen lässt sich nicht bestätigen (die App setzt den Cursor ins Feld).
- **Ablauf (seit 1.4):** Eine Einheit öffnet zuerst eine **Übersicht ohne Zeit** (`vorbereitung()` in `js/ui/training.js`): alle Übungen mit Ziel, Pause und letztem Stand. Erst „Training starten“ legt den Entwurf an und startet die Zeit.
- **Einfache und anspruchsvolle Version:** Hat eine Plan-Übung `schwer`, gibt es je Übung einen Knopf zum Wechseln (in der Übersicht und im laufenden Training). `variante()` in `js/core/kraft.js` baut die anspruchsvolle Version (erbt Sätze und Pause; Wdh./Sek./kg nur, wenn sie selbst nichts angibt). Vorbelegt wird die zuletzt trainierte Version (`zuletztSchwer()`). Beide Versionen haben eigene Namen und damit getrennte Verläufe unter „Steigerung je Übung“. Pflegbar unter Mehr → Trainingsplan oder per Import (`einheit`, Feld `schwer`).
- **Pause je Übung:** `pause_sek` im Plan ist die vorgeschriebene Pause nach jedem Satz. Nach ✓ startet der Timer mit genau diesem Wert und zeigt „Soll … Sek.“. Ohne Angabe gilt `einstellungen.pauseSek` (Standard-Pause). Einstellbar unter Mehr → Trainingsplan (Feld „Pause“) oder per Import (`einheit`).
- **Pausen-Signal (seit 1.12):** bei 3 und 2 Sekunden Restzeit ein kurzer Ton, in der letzten Sekunde ein langer Ton bis zum Pausenende. Der Zeitplan kommt aus `pausenSignal()` (`js/core/signal.js`, getestet); `signalPlanen()` in `js/ui/training.js` plant die Töne beim Start der Pause fest auf der Web-Audio-Uhr ein und plant bei „+15 s“ neu; „Pause aus“, Anhalten und Verlassen brechen ab. Freigeschaltet wird Web Audio beim ersten Tippen im Training (`tonBereit()`), wie iOS es verlangt. Ausgabe über das aktive Gerät (auch Kopfhörer).
- **Bildschirm bleibt an (seit 1.13):** Während eines laufenden Trainings (nicht beim Nachtragen und nicht in der Übersicht davor) hält `wachhalter()` aus `js/core/wach.js` den Bildschirm über die Screen-Wake-Lock-Schnittstelle an. Beim Beenden, Verwerfen oder Verlassen wird freigegeben. Geht die App in den Hintergrund, gibt das System frei; bei der Rückkehr wird neu angefordert. Fehlt die Unterstützung oder lehnt das Gerät ab (z. B. Stromsparmodus), passiert still nichts.
- **Bestwert-Meldung (seit 1.14):** Nach jedem bestätigten Satz prüft `rekord()` (`js/core/kraft.js`) gegen alle früheren Sätze der Übung (frühere Einheiten plus die heute schon bestätigten). Mit Gewicht, in dieser Reihenfolge: mehr Gewicht als je zuvor bei mindestens so vielen Wiederholungen (üblicher „Wiederholungs-Bestwert“: 16 kg × 10 zählt auch nach 14 kg × 12), mehr Wiederholungen bei gleichem Gewicht, höchster Satz (kg × Wdh.). Ohne Gewicht zählen Wiederholungen bzw. Sekunden. Ohne frühere Einheit gibt es keinen Rekord. Die App blendet „Neuer Rekord: Übung 16 kg × 12“ ein und markiert den Satz. `markiereRekorde()` kennzeichnet im Übungsverlauf die Einheiten, in denen ein Rekord fiel.
- **Check vor dem Training (seit 1.16, Logik `js/core/check.js`):** Beim Live-Start einer Krafteinheit fragt die Übersicht (`checkKarte()` in `js/ui/training.js`) Muskelkater, Schlaf, Energie je 1–5 (5 = gut), bei Muskelkater ≤ 2 auch die Regionen (Oberkörper/Beine/Rumpf, mehrere). Stufe nach Summe (`checkStufe()`, Grenzen als Ziele `check_normal_ab` 11, `check_leicht_ab` 7, `check_reduziert_ab` 4): **normal** (Plan bleibt, anspruchsvolle Version je Übung wählbar) · **leicht** (alle einfach, Übungen der Muskelkater-Regionen je ein Satz weniger, Region über `uebungsRegion()`) · **reduziert** (unter 7 oder ein Wert = 1: alle einfach, höchstens 2 Sätze, Hinweis „Heute kurz halten …“) · **ersatz** (unter 4: Spaziergang/Laufband statt Kraft). Vorschlag mit Begründung; „Vorschlag übernehmen“ oder „Trotzdem normal“. Ohne Antworten startet das Training wie bisher. Gespeichert an der Einheit: `check_muskelkater, check_schlaf, check_energie, check_regionen, check_vorschlag, check_angenommen`; Anzeige im Einheiten-Detail (`checkZeile()`).
- **Wertung mit Check:** angepasster Vorschlag vollständig = erledigt (grün); mit offenen Sätzen beendet = automatisch verkürzt. Ersatz legt eine Krafteinheit mit `ersetzt: true, verkuerzt: true` und ohne Übungen an (gelb, 50 %; am Bonus-Tag ebenfalls gelb statt grün) und öffnet „Cardio eintragen“.
- **Satz- und Pausenzeiten (seit 1.19, `js/core/satzzeit.js`):** Bei einem Live-Training speichert die App je Satz `start` (Ortszeit Berlin, `berlinIso()`), `dauer_sek` und `pause_sek` (gemessen, nicht geplant), je Übung `pause_geplant_sek`, an der Einheit `start` und `ende`. Gezählt wird auf der Trainingsuhr (angehaltene Zeit zählt nicht). Satzende = ✓ (`zeitBeiHaken()`), Satzbeginn = Ende der vorigen Pause (`en.bereitLauf`: Soll-Pause nach ✓ bzw. „Pause neu“, +15 s, „Pause aus“ oder Anhalten beenden sie früher) bzw. Trainingsstart. Kommt der ✓ vor Ablauf der Pause (Supersatz), begann der Satz direkt nach dem vorigen (Pause 0). Pause = bis zum chronologisch nächsten Satz, egal welcher Übung; beim allerletzten Satz `null`. ✓ zurücknehmen verwirft die Zeiten und stellt die Pause davor wieder her. Nachträge und alte Einheiten haben keine Zeitfelder. Die Einheiten-Ansicht zeigt die Karte „Satz- und Pausenzeiten“ (reine Satzzeit, Pausenzeit gesamt, je Übung Ø Pause gegen geplant; `zeitAuswertung()`). Die Felder stehen in stand.md (über `exportDaten`) und sind im Import erlaubt.
- Timer oben: **Anhalten/Fortsetzen** (ganze Einheit, Zeit steht) und **Beenden** (speichert bestätigte Sätze, fragt bei offenen Sätzen nach). Darunter die Satzpause, die nach jedem ✓ automatisch startet.
- Jede gespeicherte Einheit hält je Übung alle Sätze mit Gewicht und Wiederholungen fest.
- **„Steigerung je Übung“** (auf „Training“ und „Fortschritt“): letzter Stand je Übung, Veränderung zur vorherigen Einheit und seit dem ersten Eintrag. Detail je Übung: Bestwert, Diagramme (Gewicht, Wiederholungen, Gewicht × Wdh.), alle Einträge mit Veränderung.
- Übungen werden über `uebungsSchluessel()` zusammengeführt (`uebungsName()` in Kleinschreibung, siehe oben). Mehr Gewicht zählt als Steigerung, auch bei weniger Wiederholungen.

## Besonderheiten der Daten

- Rezepte aus der health-data.json: `standard_meals` (pro Portion) und `foods_per_100g` (pro 100 g). Die Kategorie wird geschätzt (Gerichte → Abendessen) und ist in der App änderbar.

- Eiweißwerte bis 13.11.2026 sind 5–15 g zu niedrig (falsches Proteinpulver in Yazio). Diese Tage tragen `ungenau: true` und werden als „Werte ungenau“ gezeigt. Ein neuer Eiweißwert per Import entfernt die Markierung.
- Die Minimalversion beginnt laut Erstimport am 07.12.2026 ohne Enddatum (Prüfungstermin unbekannt); der Nutzer schaltet sie aus oder trägt ein Ende ein.
- Blutwerte ohne Normbereich in der Quelldatei werden ohne Markierung angezeigt.
- Tanita-Messung mit `ungueltig` bleibt sichtbar (ausgegraut), fließt nicht in Verläufe ein.

## Bekannte Grenzen

- iOS: Vibration gibt es in Safari nicht; der Timer-Ton funktioniert nur, solange die App im Vordergrund ist. Ob der Stummschalter des iPhones die Töne unterdrückt, ist auf dem Gerät nicht geprüft (Stand 16.11.2026).
- Eine gespeicherte Krafteinheit lässt sich nicht satzweise bearbeiten (löschen und neu eintragen oder per Import ersetzen).
- Einheiten im Plan können in der App bearbeitet, aber nur per Import (`einheit`) neu angelegt werden; umbenennen und löschen geht nicht. Eine zweite Einheit zur Auswahl lässt sich unter Mehr → Trainingsplan je Wochentag einstellen.
- „Heute“ zeigt drei Ringe: Kalorien, Eiweiß, Schritte (jeweils gegen das Tagesziel, Farbe = Status).
