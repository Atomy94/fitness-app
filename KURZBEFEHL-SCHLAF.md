# Schlaf in den Kurzbefehl „Fitness-Import“ aufnehmen

Ab App-Version 1.17. Der Kurzbefehl liest den Schlaf der letzten Nacht aus Apple Health und schreibt ihn
in dieselbe Datei wie die Yazio-Werte. Die App zeigt ihn dann unter **Schlaf** und auf **Heute**.

Gilt jetzt schon, wenn dein iPhone oder eine andere App Schlaf in Health schreibt. Mit dem Xiaomi Band
kommt der Schlaf über **Mi Fitness → Apple Health** (in Mi Fitness: Profil → Drittanbieter-Apps → Apple Health
→ Schlaf und Herzfrequenz erlauben).

**Wichtig:** Fehlt ein Wert (z. B. Band noch nicht synchronisiert), darf die Datei trotzdem nicht kaputtgehen.
Deshalb kommen alle neuen Werte im Text **in Anführungszeichen**. Ein leerer Wert `""` oder `"0"` heißt für die
App „keine Messung“; die Yazio-Werte werden trotzdem übernommen.

---

## Teil 1: Schlafdauer, Einschlafen, Aufwachen

Öffne den Kurzbefehl zum Bearbeiten. Füge die folgenden Aktionen **vor** dem großen Text-Block
(`FITNESS-IMPORT v1 …`) ein. Aktionen findest du über das Suchfeld unten.

1. **Health-Samples suchen**
   - Typ: **Schlafanalyse**
   - Filter hinzufügen: **Enddatum** · **ist heute**
   - Filter hinzufügen: **Wert** · **ist nicht** · **Im Bett**
   - Filter hinzufügen: **Wert** · **ist nicht** · **Wach**
   - Später mit dem Band zusätzlich: **Quelle** · **ist** · **Mi Fitness** (sonst zählt Schlaf doppelt, wenn auch das iPhone Schlaf einträgt)
   - Sortieren nach: **Startdatum**, **Älteste zuerst**
   - Danach **Variable festlegen**: Name `Schlafstücke`

2. **Wiederholen mit jedem** Objekt in `Schlafstücke`
   - Darin: **Zeit zwischen Daten abrufen**
     - erstes Datum: `Wiederholungsobjekt` antippen → **Startdatum**
     - zweites Datum: `Wiederholungsobjekt` antippen → **Enddatum**
     - Einheit: **Minuten**
   - (Ende Wiederholen)

3. **Statistik berechnen**: **Summe** von `Wiederholungsergebnisse`
4. **Rechnen**: Ergebnis **÷ 60**
5. **Zahl runden**: auf **Hundertstel**
6. **Variable festlegen**: Name `schlaf`

7. **Element aus Liste abrufen**: **Erstes Objekt** aus `Schlafstücke`
8. **Datum formatieren**: Datum = Ergebnis antippen → **Startdatum**, Format **Eigenes**, `HH:mm`
9. **Variable festlegen**: Name `einschlafen`

10. **Element aus Liste abrufen**: **Letztes Objekt** aus `Schlafstücke`
11. **Datum formatieren**: Ergebnis → **Enddatum**, Format **Eigenes**, `HH:mm`
12. **Variable festlegen**: Name `aufwachen`

13. Im großen **Text-Block** direkt vor `} ] }` einfügen (Semikolon wie bei den anderen Feldern):

```
; "schlaf_h": "[schlaf]"; "einschlafen": "[einschlafen]"; "aufwachen": "[aufwachen]"
```

`[schlaf]` usw. sind die Variablen: an der Stelle tippen und die Variable aus der Leiste wählen.

## Teil 2: Ruhepuls (sobald das Band ihn liefert)

1. **Health-Samples suchen**: Typ **Ruheherzfrequenz**, Filter **Startdatum ist heute**, Sortieren **Neueste zuerst**, Limit **1**
2. **Details von Health-Samples abrufen**: **Wert**
3. **Zahl runden**: auf **Einer**
4. **Variable festlegen**: `ruhepuls`
5. Im Text-Block ergänzen: `; "ruhepuls": "[ruhepuls]"`

## Teil 3: Schlafphasen und HRV (wenn das Band da ist)

Welche Phasen Mi Fitness an Apple Health gibt und wie sie dort heißen, sehen wir erst mit dem Band.
Dann ergänzen wir nach einem Screenshot aus Health (Schlaf → Alle Daten anzeigen) die Felder
`schlaf_tief_min`, `schlaf_rem_min`, `schlaf_leicht_min`, `schlaf_wach_min` und `hrv_ms`. Die App kann sie schon anzeigen.

## Testen

Unten auf **▶** tippen. Läuft der Kurzbefehl ohne rote Meldung durch, öffne die App: Unter **Schlaf** steht die
letzte Nacht. Hast du heute noch keinen Schlaf in Health, bleibt die Anzeige leer – das ist in Ordnung.

Gerundet wird nur, damit die Werte lesbar bleiben. Die App liest bei den Schlaf- und Pulswerten einen Punkt immer
als Komma („7.125“ = 7,125 Std.).
