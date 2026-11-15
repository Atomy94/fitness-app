# Import-Format „FITNESS-IMPORT v1“

Dieses Dokument beschreibt vollständig, welche Datenblöcke die App unter **Mehr → Von Claude importieren** annimmt.
Es ist die verbindliche Vorlage für Claude (im Chat) und für spätere Erweiterungen der App.

Umsetzung im Code: `js/core/import.js` · Tests: `tests/import.test.mjs`

## Aufbau

Ein Textblock, dessen erste Zeile exakt `FITNESS-IMPORT v1` lautet. Danach folgt ein JSON-Objekt mit der Liste `eintraege`.

```
FITNESS-IMPORT v1
{
  "eintraege": [
    { "typ": "tag", "datum": "2026-11-14", "kcal": 2078, "eiweiss_g": 172, "kh_g": 206, "fett_g": 54, "ballaststoffe_g": 28.5, "ges_fett_g": 22.1, "salz_g": 6.2, "schritte": 6900, "gewicht_kg": 93.4, "bauch_cm": null, "schlaf_h": 7.5, "schlaf_qualitaet": 4, "stress": 5, "kreatin": true, "fussball": null, "notiz": "..." },
    { "typ": "training", "datum": "2026-11-14", "einheit": "Kraft C", "dauer_min": 35, "verkuerzt": false, "uebungen": [ { "name": "Liegestütze", "saetze": [ { "wdh": 10, "kg": 0 }, { "wdh": 10, "kg": 0 } ], "notiz": "..." } ], "notiz": "..." },
    { "typ": "cardio", "datum": "2026-11-14", "art": "Laufband", "dauer_min": 26, "km": 2.85 },
    { "typ": "messung", "datum": "2026-11-15", "bauch_cm": 101, "koerperfett_pct": null, "quelle": "Maßband" },
    { "typ": "ziel", "gueltig_ab": "2026-12-07", "schluessel": "kcal_mo_sa_min", "wert": 2350 },
    { "typ": "blutwert", "datum": "2026-11-12", "name": "Ferritin", "wert": 250, "einheit": "ng/ml", "norm_min": 30, "norm_max": 400 }
  ]
}
```

Der Block darf in Code-Zäunen (```) stehen und Leerzeilen davor haben.

## Allgemeine Regeln

1. **Pflicht sind nur `typ` und `datum`** (bei `ziel`: `gueltig_ab`, `schluessel`, `wert`; bei `training`: `einheit`; bei `cardio`: `art`; bei `blutwert`: `name`; bei `rezept`: `name`, kein Datum). Alles andere ist optional.
2. **Nur vorhandene Felder werden übernommen.** Fehlende Felder lassen vorhandene Werte unverändert.
3. **`null` bedeutet „nicht ändern“.** Ein Wert lässt sich per Import nicht löschen (das geht in der App).
4. **Datum** immer als `JJJJ-MM-TT`. Ein Datum, das es nicht gibt, ist ein Fehler.
5. **Zahlen** als JSON-Zahl mit Punkt (`93.4`). Texte mit Komma (`"93,4"`) werden ebenfalls akzeptiert.
6. **Vorschau vor dem Speichern:** Die App zeigt je Eintrag, ob er neu ist, etwas ändert (alter Wert → neuer Wert) oder unverändert bleibt. Gespeichert wird erst nach „Übernehmen“.
7. **Fehler:** Ist ein einziger Eintrag ungültig, wird der **gesamte Block abgelehnt** und nichts gespeichert. Die Meldung nennt Eintragsnummer, Feld und Grund.
8. **Unbekannte Felder** werden ignoriert und in der Vorschau als Hinweis aufgeführt. Ein **unbekannter `typ`** ist ein Fehler.

## Eintragstypen

### `tag` – Tageswerte (ein Datensatz pro Datum, Felder werden ergänzt)

| Feld | Typ | Bereich | Bedeutung |
|---|---|---|---|
| `kcal` | Zahl | 0–15.000 | Kalorien laut Yazio |
| `eiweiss_g`, `kh_g`, `fett_g` | Zahl | ≥ 0 | Makros in Gramm |
| `ballaststoffe_g`, `ges_fett_g`, `zucker_g`, `salz_g` | Zahl | ≥ 0 | weitere Nährwerte |
| `schritte` | ganze Zahl | 0–200.000 | |
| `gewicht_kg` | Zahl | 20–400 | |
| `bauch_cm` | Zahl | 30–250 | wird als Messung (Quelle „Maßband“) gespeichert |
| `schlaf_h` | Zahl | 0–24 | |
| `schlaf_qualitaet` | ganze Zahl | 1–5 | |
| `stress` | ganze Zahl | 1–10 | |
| `kreatin` | true/false | | |
| `fussball` | true/false | | Hat am Fußballtag Fußball stattgefunden? Bestimmt das Kalorienziel. |
| `ungenau` | true/false | | Markierung „Werte ungenau“ |
| `notiz` | Text | | |

Sonderfall: Ist ein Tag als „Werte ungenau“ markiert und der Import liefert einen **anderen** `eiweiss_g`-Wert (ohne `ungenau` anzugeben), entfernt die App die Markierung.

### `training` – Krafteinheit

| Feld | Typ | Bedeutung |
|---|---|---|
| `einheit` | Text, Pflicht | z. B. „Kraft A“, „Kraft B“, „Kraft C“, „Studio Oberkörper“ |
| `dauer_min` | Zahl | |
| `verkuerzt` | true/false | verkürzt = Bereich Training gelb |
| `uebungen` | Liste | je Übung: `name` (Pflicht), `saetze` (Liste), `notiz` |
| `uebungen[].saetze[]` | Objekt | `wdh` (ganze Zahl), `kg` (Zahl, 0 = Körpergewicht), `sek` (für Halteübungen) |
| `notiz` | Text | |

**Gleiches Datum und gleiche Einheit:** Die vorhandene Einheit wird **ersetzt** (nicht ergänzt). Die Vorschau fragt mit einem Haken „Vorhandene Einheit ersetzen“ nach; ohne Haken wird der Eintrag übersprungen.

### `cardio` – Ausdauer und Sport

| Feld | Typ | Bedeutung |
|---|---|---|
| `art` | Text, Pflicht | „Laufband“, „Hallenfußball“, „Spaziergang“ (diese drei wertet die App aus), sonst frei |
| `dauer_min` | Zahl | |
| `km` | Zahl | |
| `notiz` | Text | |

Gleiches Datum und gleiche Art: Felder werden ergänzt bzw. überschrieben (kein zweiter Eintrag).

### `messung` – Körper- und Kraftmessungen

Felder: `bauch_cm`, `koerperfett_pct`, `gewicht_kg`, `muskelmasse_kg`, `fettmasse_kg`, `fettfrei_kg`, `viszeral`, `grundumsatz_kcal`, `liegestuetze_max`, `kniebeugen_max` (Zahlen), `quelle` (Text, z. B. „Maßband“, „Tanita“, „Krafttest“), `ungueltig` (true/false), `grund` (Text).

Ein Datensatz je Datum und Quelle. Ungültige Messungen bleiben sichtbar (ausgegraut), fließen aber nicht in Verläufe ein.

### `ziel` – Ziel oder Grenzwert ab einem Datum

`gueltig_ab` (Datum), `schluessel` (siehe Liste), `wert` (Zahl) – alle Pflicht.
Tage **vor** `gueltig_ab` werden weiter mit dem alten Wert bewertet.

| Schlüssel | Bedeutung | Startwert |
|---|---|---|
| `kcal_mo_sa_ziel` | Kalorien Mo–Sa: Tagesziel (Ring) | 2200 |
| `kcal_mo_sa_min` / `kcal_mo_sa_max` | Kalorien Mo–Sa: grün von/bis | 2100 / 2450 |
| `kcal_mo_sa_gelb_min` / `kcal_mo_sa_gelb_max` | darunter/darüber rot | 1950 / 2650 |
| `kcal_so_ziel` | Fußballtag: Tagesziel (Ring) | 2500 |
| `kcal_so_min` / `kcal_so_max` | Fußballtag: grün von/bis | 2400 / 2750 |
| `kcal_so_gelb_min` / `kcal_so_gelb_max` | darunter/darüber rot | 2250 / 2950 |
| `kcal_minimal_min` / `kcal_minimal_max` | Minimalversion: grün von/bis | 2100 / 2500 |
| `kcal_minimal_gelb_min` / `kcal_minimal_gelb_max` | darunter/darüber rot | 1950 / 2650 |
| `kcal_woche_min` / `kcal_woche_max` | Wochenschnitt: grün von/bis | 2150 / 2450 |
| `kcal_woche_gelb_min` / `kcal_woche_gelb_max` | darunter/darüber rot | 2000 / 2600 |
| `eiweiss_ziel` | Eiweiß: Tagesziel (Ring) | 160 |
| `eiweiss_min` / `eiweiss_gelb_min` | grün ab / gelb ab | 150 / 135 |
| `schritte_ziel` | Schritte: Tagesziel (Phasen = mehrere Einträge mit Datum) | 5000 → 7000 → 8000 |
| `schritte_minimal` | Schritte in der Minimalversion | 6000 |
| `schritte_gelb_pct` | gelb ab … % des Ziels | 90 |
| `schritte_pflicht_grenze` | Laufband-Pflicht, wenn um 15 Uhr darunter | 2000 |
| `laufband_min` / `laufband_gelb_min` | Laufband: grün ab / gelb ab (Min.) | 25 / 15 |
| `spaziergang_min` | Spaziergang als Fußball-Ersatz ab (Min.) | 45 |
| `ballaststoffe_min` / `ballaststoffe_gelb_min` | grün ab / gelb ab | 30 / 25 |
| `ges_fett_max` / `ges_fett_gelb_max` | grün bis / gelb bis | 25 / 30 |
| `bauch_start` / `bauch_ziel` | Bauchumfang Start / Ziel (cm) | 102 / 92 |

Ein unbekannter Schlüssel ist ein Fehler (die Meldung listet alle erlaubten Schlüssel).

### `blutwert` – Laborwert

`name` (Pflicht), `wert` (Zahl), `wert_text` (Text, z. B. „<5“), `einheit`, `norm_min`, `norm_max`.
Ein Datensatz je Datum und Name. Liegt `wert` außerhalb von `norm_min`/`norm_max`, markiert die App ihn.

### `rezept` – Rezept (ab App-Version 1.1, **ohne `datum`**)

```
{ "typ": "rezept", "name": "Linsensuppe", "kategorie": "Mittagessen", "bezug": "100g", "kcal": 85, "eiweiss_g": 5.2, "kh_g": 9.1, "fett_g": 2.4, "zutaten": [ { "name": "Rote Linsen", "menge": "300 g" }, { "name": "Kokosmilch", "menge": "400 ml" } ], "notiz": "Topf ca. 2.300 g" }
```

| Feld | Typ | Bedeutung |
|---|---|---|
| `name` | Text, Pflicht | Schlüssel des Rezepts (Groß-/Kleinschreibung egal) |
| `kategorie` | Text | `Frühstück`, `Mittagessen`, `Abendessen` oder `Snacks` (anderes ist ein Fehler) |
| `bezug` | Text | `"portion"` (Standard) oder `"100g"` – worauf sich die Nährwerte beziehen |
| `portion` | Text | Beschreibung der Portion, z. B. „1 Schale“, „350 g“ |
| `zutaten` | Liste | je Zutat `name` (Pflicht) und `menge` (Text wie „60 g“, „3 Stück“; eine Zahl wird als Gramm gelesen). Ersetzt die vorhandene Zutatenliste komplett. |
| `kcal`, `eiweiss_g`, `kh_g`, `fett_g`, `ges_fett_g`, `zucker_g`, `ballaststoffe_g`, `salz_g` | Zahl | Nährwerte |
| `notiz` | Text | |

Gleicher Name: Das vorhandene Rezept wird ergänzt bzw. überschrieben (nur die gelieferten Felder).

## Nicht per Import änderbar

Trainingsplan, Wochenplan und Zeiträume der Minimalversion werden in der App eingestellt (Mehr → Trainingsplan bzw. Einstellungen).

## Regeln für Erweiterungen (Kompatibilität)

- Die Kopfzeile `FITNESS-IMPORT v1` bleibt gültig, solange nur **neue optionale Felder oder neue Typen** dazukommen.
- Bestehende Felder dürfen ihre Bedeutung, Einheit und ihren Namen nicht ändern.
- Eine Änderung, die alte Blöcke anders auslegen würde, braucht eine neue Kopfzeile (`v2`); `v1` muss weiter gelesen werden.
- Jedes neue Feld: in `FELDER` und `FELD_NAMEN` (`js/core/import.js`) eintragen, hier dokumentieren, Test ergänzen.

## Übertragung über Dropbox (ab App-Version 1.2)

Ist die App mit Dropbox verbunden (Mehr → Claude-Verbindung), muss nichts mehr kopiert werden:

- Claude legt denselben Block als **neue Textdatei** im App-Ordner unter `eingang/` ab, z. B. `eingang/import-2026-11-15-1930.md`. Der Dateiinhalt ist genau ein Block wie oben.
- Die App holt die Datei beim nächsten Abgleich ab, zeigt die Vorschau und verschiebt sie nach „Übernehmen“ oder „Verwerfen“ nach `erledigt/`.
- Die Anleitung für Claude liegt im selben Ordner als `LIESMICH-fuer-Claude.md` (erzeugt von `liesmichDatei()` in `js/core/claude-dateien.js`; ein Test prüft, dass sie alle Typen, Felder und Zielschlüssel nennt).

## Gegenrichtung

- **Wochen-Check-in → „Für Claude kopieren“:** Text mit allen Wochenwerten plus eine Zeile `JSON:` mit kompaktem JSON der Woche.
- **Dropbox:** `stand.md` (heute, laufende Woche, letzte 8 Wochen als JSON, alle Wochen als Übersicht), `rezepte.md`, `sicherung/fitness-sicherung.json`.
- **Mehr → Daten → Export:** Block `FITNESS-EXPORT v1` mit Zielen, Plan, Wochenwertungen, Tagen, Trainings, Messungen und Blutwerten. Die Feldnamen der Tage entsprechen dem Import.
