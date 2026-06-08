import { CONFIG } from "./config.js";
import { enrichFindingsWithContext } from "./context-detector.js";
import { detectHomophones, mergeFindings } from "./homophone-detector.js";
import { getCustomPatterns } from "./storage.js";

let systemPatternsCache = null;
let contextRulesCache = null;
let customPatternsCache = null;

export async function loadPatterns() {
  if (systemPatternsCache) {
    return { system: systemPatternsCache, contextRules: contextRulesCache, custom: customPatternsCache };
  }
  const res = await fetch(CONFIG.patternFile);
  if (!res.ok) throw new Error("Failed to load bias patterns: " + res.status);
  const data = await res.json();
  systemPatternsCache = data.patterns || [];
  contextRulesCache = data.contextRules || null;
  try {
    customPatternsCache = await getCustomPatterns();
  } catch (e) {
    customPatternsCache = [];
  }
  return { system: systemPatternsCache, contextRules: contextRulesCache, custom: customPatternsCache };
}

export async function refreshCustomPatterns() {
  try {
    customPatternsCache = await getCustomPatterns();
  } catch (e) {
    customPatternsCache = [];
  }
  return customPatternsCache;
}

export function getSystemPatternsSync() {
  return systemPatternsCache;
}

export function getContextRulesSync() {
  return contextRulesCache;
}

export function getCustomPatternsSync() {
  return customPatternsCache;
}

export async function detectWithHuggingFace(text, apiKey, modelName, lang) {
  const url = `${CONFIG.hfEndpoint}/${modelName || CONFIG.defaultModel}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": apiKey ? `Bearer ${apiKey}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HF API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return interpretHfResponse(data, lang);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function interpretHfResponse(data, lang) {
  if (!Array.isArray(data)) return null;
  const first = Array.isArray(data[0]) ? data[0] : data;
  let topLabel = null;
  let topScore = 0;
  for (const item of first) {
    if (typeof item.score === "number" && item.score > topScore) {
      topScore = item.score;
      topLabel = item.label;
    }
  }
  const negativeKeywords = ["negative", "1 star", "2 stars", "LABEL_0", "toxic", "hate"];
  const isNegative = negativeKeywords.some((kw) =>
    (topLabel || "").toLowerCase().includes(kw)
  );
  if (isNegative && topScore >= CONFIG.negativeThreshold) {
    return {
      cloud: true,
      confidence: topScore,
      label: topLabel,
      type: "implicit",
      note: lang === "en-US"
        ? `Cloud model flagged this text as ${topLabel} (score ${topScore.toFixed(2)}).`
        : `云端模型将文本标记为 ${topLabel} (置信度 ${topScore.toFixed(2)})。`,
    };
  }
  return null;
}

function findInPatterns(text, patterns) {
  const findings = [];
  if (!patterns) return findings;
  for (const p of patterns) {
    const candidates = [...(p.patterns || []), ...(p.patterns_en || [])];
    for (const phrase of candidates) {
      if (!phrase) continue;
      const needle = phrase.toLowerCase();
      const hayLower = text.toLowerCase();
      let fromIdx = 0;
      while (true) {
        const idx = hayLower.indexOf(needle, fromIdx);
        if (idx === -1) break;
        findings.push({
          id: p.id,
          type: p.type,
          phrase: text.substr(idx, phrase.length),
          start: idx,
          end: idx + phrase.length,
          rewrite_zh: p.rewrite_zh,
          rewrite_en: p.rewrite_en,
          reason_zh: p.reason_zh,
          reason_en: p.reason_en,
          source: p.id && p.id.startsWith("custom-") ? "custom" : "system",
          isHomophone: !!p.isHomophone,
          confidence: 0.9,
        });
        fromIdx = idx + phrase.length;
      }
    }
  }
  return findings;
}

function dedupeOverlaps(items) {
  const result = [];
  let lastEnd = -1;
  for (const it of items.sort((a, b) => a.start - b.start)) {
    if (it.start >= lastEnd) {
      result.push(it);
      lastEnd = it.end;
    }
  }
  return result;
}

function detectLocalAll(text) {
  const system = getSystemPatternsSync() || [];
  const custom = getCustomPatternsSync() || [];
  const sysFindings = findInPatterns(text, system);
  const customFindings = findInPatterns(text, custom);
  const homoFindings = detectHomophones(text, system);
  const merged = mergeFindings(sysFindings, customFindings, homoFindings);
  return dedupeOverlaps(merged);
}

export async function detectHybrid(text, apiKey, lang) {
  await loadPatterns();
  const raw = detectLocalAll(text);
  const enriched = enrichFindingsWithContext(text, raw, getContextRulesSync());
  const local = dedupeOverlaps(enriched);

  let cloud = null;
  if (apiKey && CONFIG.enableCloudDetection) {
    try {
      cloud = await detectWithHuggingFace(text, apiKey, CONFIG.defaultModel, lang);
    } catch (e) {
      cloud = { cloud: true, error: true, message: e.message };
    }
  }
  return { local, cloud, rawCount: raw.length };
}

export function detectLocalOnly(text) {
  if (!systemPatternsCache) {
    const raw = [];
    return { local: raw, cloud: null, rawCount: 0 };
  }
  const raw = detectLocalAll(text);
  const enriched = enrichFindingsWithContext(text, raw, getContextRulesSync());
  return { local: dedupeOverlaps(enriched), cloud: null, rawCount: raw.length };
}
