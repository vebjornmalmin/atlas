import { validatePackage } from './content.js';

export const DB_VERSION = 1;
export const STORES = ['settings', 'packages', 'entities', 'relationships', 'targets', 'states', 'reviews', 'sessions', 'logs'];
// What belongs to the learner. The knowledge library is installed from the app and is not part of a backup.
export const PERSONAL_STORES = ['settings', 'states', 'reviews', 'sessions', 'logs'];
export const BACKUP_VERSION = 2;
export function openDatabase(name = 'atlas-memory') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: 'id' });
        if (name === 'targets' || name === 'entities') store.createIndex('collections', 'collectionIds', { multiEntry: true });
        if (name === 'states') store.createIndex('due', 'due');
        if (name === 'reviews') { store.createIndex('targetId', 'targetId'); store.createIndex('timestamp', 'timestamp'); }
        if (name === 'relationships') { store.createIndex('from', 'from'); store.createIndex('to', 'to'); }
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Lukk andre Atlas-faner for å fullføre oppgraderingen av databasen.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function get(db, store, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function all(db, store) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transaction(db, stores, operations) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Lagringen ble avbrutt. Ingenting ble endret.'));
    tx.onerror = () => {};
    try { operations(tx); } catch (error) { tx.abort(); reject(error); }
  });
}

export function put(db, store, record) {
  return transaction(db, [store], tx => tx.objectStore(store).put(record));
}

export async function installPackage(db, data, metadata = {}) {
  const errors = validatePackage(data);
  if (errors.length) throw new Error(errors.slice(0, 3).join(' '));
  const installed = await all(db, 'packages');
  const packages = [...installed.filter(p => p.id !== data.id), { ...data, ...metadata, installedAt: new Date().toISOString() }];
  await transaction(db, ['packages', 'entities', 'relationships', 'targets'], tx => {
    tx.objectStore('packages').put(packages.at(-1));
    for (const name of ['entities', 'relationships', 'targets']) {
      const store = tx.objectStore(name);
      store.clear();
      for (const pkg of packages) for (const item of pkg[name]) store.put(item);
    }
  });
}

export function recordReview(db, state, review, legacyState = null) {
  return new Promise((resolve, reject) => {
    let applied = false;
    const tx = db.transaction(['states', 'reviews'], 'readwrite');
    tx.oncomplete = () => resolve(applied);
    tx.onabort = () => reject(tx.error || new Error('Svaret kunne ikke lagres.'));
    tx.onerror = () => {};
    const existing = tx.objectStore('reviews').get(review.id);
    existing.onsuccess = () => {
      if (existing.result) return;
      if (!review.practice) {
        tx.objectStore('states').put(state);
        if(legacyState) tx.objectStore('states').put(legacyState);
      }
      tx.objectStore('reviews').add(review);
      applied = true;
    };
  });
}

export async function logEvent(db, component, message, severity = 'info', context = {}) {
  await transaction(db, ['logs'], tx => {
    const store = tx.objectStore('logs');
    store.put({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), component, message: String(message).slice(0, 1000), severity, context });
    const request = store.getAll();
    request.onsuccess = () => {
      const logs = request.result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      for (const item of logs.slice(0, Math.max(0, logs.length - 100))) store.delete(item.id);
    };
  });
}

/**
 * A backup holds the learner's own data: settings, memory schedule, answers, sessions and the log.
 * The knowledge library is left out; it is 17 MB, identical for everyone and installed from the app.
 */
export async function exportDatabase(db) {
  const stores = {};
  await new Promise((resolve, reject) => {
    const tx = db.transaction(PERSONAL_STORES, 'readonly');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    for (const name of PERSONAL_STORES) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { stores[name] = request.result; };
    }
  });
  return { format: 'atlas-backup', version: BACKUP_VERSION, databaseVersion: DB_VERSION, exportedAt: new Date().toISOString(), stores };
}

/** Version 1 backups also carried the knowledge library; they can still be restored. */
const backupStores = data => data.version === 1 ? STORES : PERSONAL_STORES;

export function validateBackup(data) {
  if (!data || data.format !== 'atlas-backup' || ![1, BACKUP_VERSION].includes(data.version) || data.databaseVersion > DB_VERSION || !data.stores) throw new Error('Filen er ikke en sikkerhetskopi fra Atlas som denne utgaven kan lese.');
  for (const name of backupStores(data)) {
    if (!Array.isArray(data.stores[name])) throw new Error(`Sikkerhetskopien mangler ${name}.`);
    const ids = new Set();
    for (const item of data.stores[name]) {
      if (!item || typeof item.id !== 'string' || ids.has(item.id)) throw new Error(`Sikkerhetskopien har en ugyldig eller dobbel oppføring i ${name}.`);
      ids.add(item.id);
    }
  }
  if (data.version === 1) for (const pkg of data.stores.packages) {
    const errors = validatePackage(pkg);
    if (errors.length) throw new Error('Sikkerhetskopien inneholder en ugyldig kunnskapspakke.');
  }
  for (const state of data.stores.states) {
    if (!Number.isFinite(new Date(state.due).getTime()) || !Number.isFinite(state.stability) || state.stability < 0 || !Number.isFinite(state.difficulty) || state.difficulty < 0 || state.difficulty > 10 || !Number.isInteger(state.reps) || state.reps < 0 || ![0,1,2,3].includes(state.state)) throw new Error('Sikkerhetskopien inneholder en ugyldig repetisjonsplan.');
  }
  for (const review of data.stores.reviews) {
    if (!review.targetId || ![1, 2, 3, 4].includes(review.rating) || !Number.isFinite(new Date(review.timestamp).getTime())) throw new Error('Sikkerhetskopien inneholder ugyldig læringshistorikk.');
  }
  return data;
}

export async function restoreDatabase(db, data) {
  validateBackup(data);
  const names = backupStores(data);
  const records = structuredClone(Object.fromEntries(names.map(name => [name, data.stores[name]])));
  if (data.version === 1) for (const name of ['entities', 'relationships', 'targets']) {
    records[name] = Array.from(new Map(records.packages.flatMap(pkg => pkg[name]).map(item => [item.id, item])).values());
  }
  await transaction(db, names, tx => {
    for (const name of names) {
      const store = tx.objectStore(name);
      store.clear();
      for (const item of records[name]) store.put(item);
    }
  });
}

export async function clearLogs(db) {
  return transaction(db, ['logs'], tx => tx.objectStore('logs').clear());
}
