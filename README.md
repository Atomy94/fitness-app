# Fitness-App

Persönliche App für Training, Ernährungsziele und Gesundheitswerte. Sie läuft auf dem iPhone wie eine normale App, funktioniert ohne Internet und speichert alle Daten **nur auf deinem Gerät**.

In diesem Ordner liegt nur das Programm. Deine persönlichen Daten (`health-data.json`, Sicherungen) werden nie mit hochgeladen.

---

## 1. App am Computer ausprobieren

Voraussetzung: Node.js ist installiert.

1. Öffne den Ordner `FitnessApp` im Explorer.
2. Klicke oben in die Adresszeile, tippe `powershell` und drücke Enter.
3. Tippe:

   ```
   npm start
   ```

4. Öffne im Browser `http://localhost:5173`.
5. Zum Beenden im PowerShell-Fenster `Strg + C` drücken.

Tipp: Unter **Mehr → Daten → Testdaten anzeigen** siehst du drei Wochen erfundene Werte.

Automatische Tests laufen mit `npm test`.

---

## 2. Auf GitHub Pages veröffentlichen (einmalig)

GitHub Pages stellt die Dateien kostenlos ins Internet, damit dein iPhone sie laden kann. Das Projekt ist öffentlich sichtbar, enthält aber keine persönlichen Daten.

1. Lege auf [github.com](https://github.com) ein kostenloses Konto an (falls noch nicht vorhanden).
2. Klicke oben rechts auf **+** → **New repository**.
   - Repository name: `fitness-app`
   - **Public** auswählen
   - Sonst nichts ankreuzen → **Create repository**
3. Öffne PowerShell im Ordner `FitnessApp` (siehe oben) und gib nacheinander ein. Ersetze `DEINNAME` durch deinen GitHub-Benutzernamen:

   ```
   git remote add origin https://github.com/DEINNAME/fitness-app.git
   ```

   ```
   git push -u origin main
   ```

   Beim ersten Mal öffnet sich ein Fenster zur Anmeldung bei GitHub. Melde dich dort an.
4. Auf der GitHub-Seite deines Repositorys: **Settings** → links **Pages** → bei **Branch** `main` und `/ (root)` wählen → **Save**.
5. Nach ein bis zwei Minuten ist die App erreichbar unter:

   ```
   https://DEINNAME.github.io/fitness-app/
   ```

---

## 3. Auf dem iPhone zum Homescreen hinzufügen

1. Öffne die Adresse oben in **Safari** (nicht Chrome, nicht im privaten Modus).
2. Tippe unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Wähle **Zum Home-Bildschirm** → **Hinzufügen**.
4. Starte die App ab jetzt immer über das Symbol auf dem Homescreen.

Wichtig: Die App auf dem Homescreen hat ihren **eigenen** Datenspeicher. Importiere deine Daten deshalb erst dort (nicht vorher in Safari).

Beim ersten Öffnen lädt die App alle Dateien. Danach läuft sie auch im Flugmodus.

---

## 4. Deine Daten übernehmen (`health-data.json`)

1. Bringe die Datei `health-data.json` aufs iPhone, z. B. in iCloud Drive legen oder dir selbst per AirDrop/Mail schicken und „In Dateien sichern“.
2. Öffne die App. Beim ersten Start erscheint **Willkommen** → **health-data.json auswählen**.
3. Wähle die Datei aus. Die App zeigt, was übernommen wurde (Tage, Trainings, Messwerte, Blutwerte, Plan, Ziele).

Später findest du den Import unter **Mehr → Daten → health-data.json importieren**. Er ersetzt alle vorhandenen Daten.

Die Eiweißwerte bis 13.11.2026 sind als „Werte ungenau“ markiert.

---

## 5. Täglicher Ablauf

- **Heute:** Gewicht, Schritte, Schlaf, Stress, Kreatin eintragen. Jede Eingabe wird sofort gespeichert.
- **Yazio-Werte:** Schicke Claude abends den Yazio-Screenshot. Claude antwortet mit einem Block, der mit `FITNESS-IMPORT v1` beginnt. Kopiere ihn, öffne **Mehr → Von Claude importieren**, füge ihn ein, tippe **Prüfen** und dann **Übernehmen**.
- **Training:** Einheit starten, jeden Satz mit ✓ bestätigen. Oben kannst du die Einheit **anhalten** und **beenden**. Unter „Steigerung je Übung“ siehst du Gewicht und Wiederholungen im Vergleich zur letzten Einheit.
- **Rezepte:** **Mehr → Rezepte**, sortiert nach Frühstück, Mittagessen, Abendessen und Snacks, mit Mengen und Nährwerten. Neue Rezepte kannst du selbst anlegen oder von Claude als Import-Block bekommen.
- **Sonntags:** **Mehr → Wochen-Check-in** → **Für Claude kopieren** und im Chat einfügen.

Das Format für Claude steht in `IMPORT-FORMAT.md`.

---

## 5a. Claude direkt anbinden (Dropbox)

Damit Claude deine Daten selbst lesen und neue Einträge ablegen kann, verbindest du die App einmalig mit deiner Dropbox. Deine Daten liegen dann zusätzlich in einem eigenen Ordner deiner Dropbox.

**Einmalig am Computer:**

1. Öffne `https://www.dropbox.com/developers/apps` und melde dich an.
2. **Create app** → **Scoped access** → **App folder** → Namen vergeben (z. B. `FitnessApp-DeinName`) → **Create app**.
3. Reiter **Permissions**: `files.metadata.read`, `files.content.read` und `files.content.write` ankreuzen → unten **Submit**.
4. Reiter **Settings**: den **App key** kopieren.

**In der App auf dem iPhone:**

5. **Mehr → Claude-Verbindung (Dropbox)** → App key eintragen → **Weiter**.
6. **Bei Dropbox anmelden** antippen, Zugriff erlauben, den angezeigten Code kopieren.
7. Zurück in die App, Code einfügen → **Verbinden**.

**In Claude:**

8. Den Dropbox-Connector aktivieren (Einstellungen → Connectors).
9. Den Satz aus der App („Satz kopieren“) einmal im Chat einfügen oder dauerhaft in die Projekt-Anweisungen schreiben.

Danach gilt:

- Claude liest deinen Stand aus der Datei `stand.md`. Sie ist so aktuell wie das letzte Öffnen der App.
- Claude legt neue Einträge im Ordner `eingang` ab. Beim nächsten Öffnen zeigt die App auf „Heute“ einen Hinweis. Du siehst die Vorschau und tippst **Übernehmen**.
- Die Sicherung landet bei jedem Abgleich automatisch in der Dropbox.

Trennen kannst du die Verbindung jederzeit unter **Mehr → Claude-Verbindung**.

---

## 6. Daten sichern und wiederherstellen

Die Daten liegen nur auf dem iPhone. Geht das Gerät verloren oder löscht iOS den Speicher, sind sie ohne Sicherung weg.

**Sichern (am besten wöchentlich):**

1. **Mehr → Daten → Sicherung erstellen**.
2. Im Teilen-Menü **In Dateien sichern** wählen und einen Ordner in iCloud Drive aussuchen.
3. Die Datei heißt `fitness-sicherung-JJJJ-MM-TT.json`.

Ist die letzte Sicherung älter als 7 Tage, erinnert dich die App auf „Heute“.

**Wiederherstellen:**

1. **Mehr → Daten → Wiederherstellen …**
2. Sicherungsdatei auswählen und die Rückfrage bestätigen. Alle aktuellen Daten werden durch die Sicherung ersetzt.

Sicherungsdateien gehören nicht in diesen Projektordner. Falls doch eine hier landet, verhindert eine Sperre, dass sie hochgeladen wird.

---

## 7. Updates einspielen

Wenn Claude Code die App geändert hat:

1. PowerShell im Ordner `FitnessApp` öffnen und eingeben:

   ```
   git push
   ```

2. Ein bis zwei Minuten warten.
3. Auf dem iPhone die App **ganz schließen** (nach oben wegwischen) und neu öffnen. Sie lädt das Update im Hintergrund und startet einmal neu. Falls noch die alte Version erscheint: noch einmal schließen und öffnen.
4. Unter **Mehr** steht unten die Versionsnummer.

Deine Daten bleiben bei Updates erhalten. Erstelle vor größeren Updates trotzdem eine Sicherung.

---

## 8. Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| App zeigt nach Update die alte Version | App zweimal ganz schließen und öffnen. iPhone muss online sein. |
| „Daten konnten nicht geladen werden“ | Privates Surfen in Safari ausschalten. |
| Daten nach „Zum Home-Bildschirm“ leer | Normal: Homescreen-App hat eigenen Speicher. Dort importieren oder Sicherung wiederherstellen. |
| Kein Ton beim Pausentimer | iPhone-Stummschalter prüfen. Ton gibt es nur, solange die App geöffnet ist. Vibration erlaubt iOS in Web-Apps nicht. |
| `git push` verlangt Anmeldung | Im erscheinenden Fenster bei GitHub anmelden. |

---

## Für die Weiterentwicklung

Aufbau, Datenmodell und Regeln stehen in `CLAUDE.md`. In einer neuen Claude-Code-Sitzung reicht: „Lies CLAUDE.md und setze dann Folgendes um: …“
