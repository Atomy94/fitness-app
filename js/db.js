// Kleine Hülle um IndexedDB. Pro Datenbank gibt es einen Speicher "daten",
// in dem jede Sammlung (tage, trainings, …) unter ihrem Namen liegt.
// Echte Daten und Testdaten liegen in zwei getrennten Datenbanken.

const offen = {};

function oeffne(name) {
  if (!offen[name]) {
    offen[name] = new Promise((ok, fehler) => {
      const anfrage = indexedDB.open(name, 1);
      anfrage.onupgradeneeded = () => anfrage.result.createObjectStore('daten');
      anfrage.onsuccess = () => ok(anfrage.result);
      anfrage.onerror = () => fehler(anfrage.error);
    });
  }
  return offen[name];
}

/** Liest mehrere Schlüssel; fehlende sind undefined. */
export async function lies(name, schluessel) {
  const db = await oeffne(name);
  return new Promise((ok, fehler) => {
    const tx = db.transaction('daten', 'readonly');
    const speicher = tx.objectStore('daten');
    const aus = {};
    for (const k of schluessel) {
      const a = speicher.get(k);
      a.onsuccess = () => { aus[k] = a.result; };
    }
    tx.oncomplete = () => ok(aus);
    tx.onerror = () => fehler(tx.error);
  });
}

/** Schreibt alle übergebenen Schlüssel in EINEM Schritt (ganz oder gar nicht). */
export async function schreibe(name, werte) {
  const db = await oeffne(name);
  return new Promise((ok, fehler) => {
    const tx = db.transaction('daten', 'readwrite');
    const speicher = tx.objectStore('daten');
    for (const [k, v] of Object.entries(werte)) {
      if (v === undefined) speicher.delete(k);
      else speicher.put(v, k);
    }
    tx.oncomplete = () => ok();
    tx.onerror = () => fehler(tx.error);
    tx.onabort = () => fehler(tx.error);
  });
}

export async function leere(name) {
  const db = await oeffne(name);
  return new Promise((ok, fehler) => {
    const tx = db.transaction('daten', 'readwrite');
    tx.objectStore('daten').clear();
    tx.oncomplete = () => ok();
    tx.onerror = () => fehler(tx.error);
  });
}
