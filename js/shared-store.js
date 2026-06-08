const APP_VERSION = "3.0";
const ENDPOINTS = {
  records: "/api/records",
  stats: "/api/stats",
  patterns: "/api/patterns",
  corpus: "/api/corpus",
  health: "/api/health",
  export: "/api/export",
};

let _serverInfo = null;
let _online = null;
let _lastCheck = 0;
const CACHE_TTL = 5000;

async function checkOnline(timeout = 3000) {
  const now = Date.now();
  if (_online !== null && now - _lastCheck < CACHE_TTL) return _online;
  _online = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    const r = await fetch(ENDPOINTS.health, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (r.ok) {
      const j = await r.json();
      _serverInfo = j;
      _online = true;
      _lastCheck = Date.now();
      return _online;
    }
  } catch (e) {
  }
  _online = false;
  _lastCheck = Date.now();
  return _online;
}

function getServerInfo() {
  return _serverInfo;
}

function _invalidate() {
  _online = null;
  _lastCheck = 0;
}

async function _post(payload) {
  if (!(await checkOnline())) {
    return { ok: false, reason: "offline" };
  }
  try {
    const r = await fetch(ENDPOINTS.records, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      return { ok: false, reason: `HTTP ${r.status}` };
    }
    return await r.json();
  } catch (e) {
    _invalidate();
    return { ok: false, reason: e.message || "network" };
  }
}

async function _get(path) {
  if (!(await checkOnline())) {
    return { ok: false, reason: "offline" };
  }
  try {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) {
    _invalidate();
    return { ok: false, reason: e.message || "network" };
  }
}

const SHARED = {
  APP_VERSION,

  async addDetection(detection) {
    const safe = {
      __appVersion: APP_VERSION,
      text: detection.text || "",
      language: detection.language || "zh-CN",
      findingCount: (detection.findings || []).length,
      findings: detection.findings || [],
      userChoice: detection.userChoice || "none",
      rewriteApplied: !!detection.rewriteApplied,
      usedCloud: !!detection.usedCloud,
    };
    return _post({ type: "detection", data: safe });
  },

  async addCustomPattern(pattern) {
    const safe = {
      __appVersion: APP_VERSION,
      patternType: pattern.type || "implicit",
      enabled: pattern.enabled !== false,
      patterns: pattern.patterns || [],
      patternsEn: pattern.patterns_en || pattern.patternsEn || [],
      homophones: pattern.homophones || [],
      rewrite_zh: pattern.rewrite_zh || "",
      rewrite_en: pattern.rewrite_en || "",
      reason_zh: pattern.reason_zh || "",
      reason_en: pattern.reason_en || "",
      contextHints: pattern.contextHints || [],
    };
    return _post({ type: "customPattern", data: safe });
  },

  async editCustomPattern(targetId, pattern) {
    const safe = {
      __appVersion: APP_VERSION,
      targetId,
      patternType: pattern.type || "implicit",
      patterns: pattern.patterns || [],
      patternsEn: pattern.patterns_en || pattern.patternsEn || [],
      homophones: pattern.homophones || [],
      rewrite_zh: pattern.rewrite_zh || "",
      rewrite_en: pattern.rewrite_en || "",
      reason_zh: pattern.reason_zh || "",
      reason_en: pattern.reason_en || "",
    };
    return _post({ type: "edit", data: safe });
  },

  async addCorpus(corpus) {
    const safe = {
      __appVersion: APP_VERSION,
      text: (corpus.text || "").trim(),
      language: corpus.language || "zh-CN",
      label: (corpus.label || "").trim(),
      notes: (corpus.notes || "").trim(),
      tag: corpus.tag || "user-submitted",
    };
    if (!safe.text) return { ok: false, reason: "empty" };
    return _post({ type: "corpus", data: safe });
  },

  async fetchStats() {
    return _get(ENDPOINTS.stats);
  },

  async fetchPatterns() {
    return _get(ENDPOINTS.patterns);
  },

  async fetchCorpus() {
    return _get(ENDPOINTS.corpus);
  },

  async fetchAllRecords(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.type) qs.set("type", opts.type);
    if (opts.limit) qs.set("limit", String(opts.limit));
    return _get(ENDPOINTS.records + (qs.toString() ? "?" + qs : ""));
  },

  isOnline() {
    return _online === true;
  },

  async refreshStatus() {
    _invalidate();
    _serverInfo = null;
    return checkOnline();
  },
};

export { SHARED, getServerInfo };
