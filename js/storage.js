const DB_NAME = "gbr_db";
const DB_VERSION = 2;
const STORE_DETECTIONS = "detections";
const STORE_CUSTOM_PATTERNS = "custom_patterns";
const CURRENT_SCHEMA_VERSION = 2;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DETECTIONS)) {
        const s = db.createObjectStore(STORE_DETECTIONS, {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("byTimestamp", "timestamp");
        s.createIndex("byLanguage", "language");
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOM_PATTERNS)) {
        const s = db.createObjectStore(STORE_CUSTOM_PATTERNS, {
          keyPath: "id",
        });
        s.createIndex("byType", "type");
        s.createIndex("byCreatedAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      runMigrations(db).then(() => resolve(db)).catch(reject);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function runMigrations(db) {
  const meta = db.transaction("meta", "readwrite").objectStore("meta");
  const existing = await reqToPromise(meta.get("schemaVersion"));
  const current = existing?.value || 0;
  if (current >= CURRENT_SCHEMA_VERSION) return;
  for (let v = current + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    if (v === 2) {
      await migrateToV2(db);
    }
  }
  await reqToPromise(meta.put({ key: "schemaVersion", value: CURRENT_SCHEMA_VERSION }));
}

async function migrateToV2(db) {
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_DETECTIONS, STORE_CUSTOM_PATTERNS], "readwrite");
    const det = tx.objectStore(STORE_DETECTIONS);
    const pat = tx.objectStore(STORE_CUSTOM_PATTERNS);
    const cur = det.openCursor();
    cur.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        const r = c.value;
        if (!r.schemaVersion) {
          r.schemaVersion = 1;
          if (typeof r.rewriteApplied !== "boolean") r.rewriteApplied = false;
          c.update(r);
        }
        c.continue();
      }
    };
    const cur2 = pat.openCursor();
    cur2.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        const r = c.value;
        if (!r.schemaVersion) {
          r.schemaVersion = 1;
          if (typeof r.enabled !== "boolean") r.enabled = true;
          if (!Array.isArray(r.homophones)) r.homophones = [];
          c.update(r);
        }
        c.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function tx(store, mode) {
  return openDb().then((db) => {
    const t = db.transaction(store, mode);
    return t.objectStore(store);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addDetection(record) {
  const store = await tx(STORE_DETECTIONS, "readwrite");
  const entry = {
    timestamp: new Date().toISOString(),
    text: record.text || "",
    language: record.language || "zh-CN",
    findings: record.findings || [],
    findingCount: (record.findings || []).length,
    userChoice: record.userChoice || "none",
    rewriteApplied: !!record.rewriteApplied,
    usedCloud: !!record.usedCloud,
    textLength: (record.text || "").length,
  };
  return reqToPromise(store.add(entry));
}

export async function getDetections(limit = 50) {
  const store = await tx(STORE_DETECTIONS, "readonly");
  const all = await reqToPromise(store.getAll());
  return all
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, limit);
}

export async function getDetectionStats() {
  const store = await tx(STORE_DETECTIONS, "readonly");
  const all = await reqToPromise(store.getAll());
  const total = all.length;
  const totalFindings = all.reduce((s, d) => s + (d.findingCount || 0), 0);
  const accepts = all.filter((d) => d.userChoice === "accept").length;
  const ignores = all.filter((d) => d.userChoice === "ignore").length;
  const learns = all.filter((d) => d.userChoice === "learn").length;
  const byType = { explicit: 0, implicit: 0, benevolent: 0 };
  const phraseFreq = {};
  for (const d of all) {
    for (const f of d.findings || []) {
      if (byType[f.type] !== undefined) byType[f.type]++;
      const k = f.phrase || "?";
      phraseFreq[k] = (phraseFreq[k] || 0) + 1;
    }
  }
  const topPhrases = Object.entries(phraseFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  return {
    total,
    totalFindings,
    accepts,
    ignores,
    learns,
    byType,
    topPhrases,
  };
}

export async function clearDetections() {
  const store = await tx(STORE_DETECTIONS, "readwrite");
  return reqToPromise(store.clear());
}

export async function exportDetections() {
  const all = await getDetections(10000);
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), detections: all },
    null,
    2
  );
}

export async function addCustomPattern(pattern) {
  const store = await tx(STORE_CUSTOM_PATTERNS, "readwrite");
  const entry = {
    id: pattern.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: pattern.type || "implicit",
    patterns: Array.isArray(pattern.patterns) ? pattern.patterns : [pattern.patterns].filter(Boolean),
    patterns_en: Array.isArray(pattern.patterns_en) ? pattern.patterns_en : (pattern.patterns_en ? [pattern.patterns_en] : []),
    homophones: Array.isArray(pattern.homophones) ? pattern.homophones : [],
    rewrite_zh: pattern.rewrite_zh || "(建议中性改写)",
    rewrite_en: pattern.rewrite_en || "(neutral rewrite suggested)",
    reason_zh: pattern.reason_zh || "",
    reason_en: pattern.reason_en || "",
    isHomophone: !!pattern.isHomophone,
    enabled: pattern.enabled !== false,
    contextHints: Array.isArray(pattern.contextHints) ? pattern.contextHints : [],
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await reqToPromise(store.put(entry));
  return entry;
}

export async function updateCustomPattern(id, updates) {
  const store = await tx(STORE_CUSTOM_PATTERNS, "readwrite");
  const existing = await reqToPromise(store.get(id));
  if (!existing) throw new Error("Pattern not found: " + id);
  const merged = {
    ...existing,
    ...updates,
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  if (Array.isArray(updates.patterns)) merged.patterns = updates.patterns;
  if (Array.isArray(updates.patterns_en)) merged.patterns_en = updates.patterns_en;
  if (Array.isArray(updates.homophones)) merged.homophones = updates.homophones;
  if (Array.isArray(updates.contextHints)) merged.contextHints = updates.contextHints;
  await reqToPromise(store.put(merged));
  return merged;
}

export async function getCustomPattern(id) {
  const store = await tx(STORE_CUSTOM_PATTERNS, "readonly");
  return reqToPromise(store.get(id));
}

export async function getCustomPatterns() {
  const store = await tx(STORE_CUSTOM_PATTERNS, "readonly");
  return reqToPromise(store.getAll());
}

export async function getCustomPatternsByType(type) {
  const all = await getCustomPatterns();
  return all.filter((p) => p.type === type);
}

export async function deleteCustomPattern(id) {
  const store = await tx(STORE_CUSTOM_PATTERNS, "readwrite");
  return reqToPromise(store.delete(id));
}

export async function exportCustomPatterns() {
  const all = await getCustomPatterns();
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), patterns: all },
    null,
    2
  );
}

export async function importCustomPatterns(jsonString) {
  const data = JSON.parse(jsonString);
  const list = Array.isArray(data) ? data : data.patterns || [];
  let count = 0;
  for (const p of list) {
    await addCustomPattern(p);
    count++;
  }
  return count;
}

export async function clearCustomPatterns() {
  const store = await tx(STORE_CUSTOM_PATTERNS, "readwrite");
  return reqToPromise(store.clear());
}

export async function isAvailable() {
  try {
    await openDb();
    return true;
  } catch (e) {
    return false;
  }
}
