import { loadPatterns, detectLocalOnly } from "./detector.js";
import { analyzeAll } from "./deep-analyzer.js";

export function splitSentences(text) {
  const sentences = [];
  const zhEnders = /[。！？；!?;]/;
  const enEnders = /(?<=[.!?])\s+(?=[A-Z\u00C0-\u024F])/;
  const segments = text.split(/(\n{2,}|[\r\n]+)/);

  for (const seg of segments) {
    if (/^[\r\n]+$/.test(seg) || !seg.trim()) continue;
    const parts = seg.split(zhEnders).filter(Boolean);
    for (const part of parts) {
      const enParts = part.split(enEnders).filter(Boolean);
      for (const p of enParts) {
        const trimmed = p.trim();
        if (!trimmed) continue;
        sentences.push(trimmed);
      }
    }
  }
  return sentences.length ? sentences : [text.trim()];
}

function computeRiskScore(results) {
  const total = results.length;
  if (!total) return { score: 0, level: "none", label: "无风险" };

  let biasedCount = 0;
  let weighted = 0;
  const weights = { explicit: 3, implicit: 2, benevolent: 1 };

  for (const r of results) {
    if (r.findings && r.findings.length) {
      biasedCount++;
      for (const f of r.findings) {
        weighted += weights[f.type] || 1;
      }
    }
  }

  const density = biasedCount / total;
  const severity = weighted / total;
  const score = Math.min(100, Math.round((density * 0.6 + Math.min(1, severity / 3) * 0.4) * 100));

  let level, label;
  if (score >= 30) { level = "high"; label = "高风险"; }
  else if (score >= 10) { level = "medium"; label = "中风险"; }
  else if (score > 0) { level = "low"; label = "低风险"; }
  else { level = "none"; label = "无风险"; }

  return { score, level, label, biasedCount, totalSentences: total, weightedScore: weighted };
}

function buildDistribution(results) {
  const dist = { explicit: 0, implicit: 0, benevolent: 0 };
  const deepDist = {};
  for (const r of results) {
    if (!r.findings) continue;
    for (const f of r.findings) {
      if (f.source === "deep-analyzer") {
        const cat = f.category || "other";
        deepDist[cat] = (deepDist[cat] || 0) + 1;
      } else if (dist[f.type] !== undefined) {
        dist[f.type]++;
      }
    }
  }
  return { ...dist, deep: deepDist };
}

function buildTopBiased(results, max = 5) {
  const list = [];
  for (const r of results) {
    if (r.findings && r.findings.length) {
      list.push({
        sentence: r.sentence.length > 60 ? r.sentence.slice(0, 60) + "…" : r.sentence,
        count: r.findings.length,
        types: [...new Set(r.findings.map(f => f.type))],
        phrases: r.findings.map(f => f.phrase).filter(Boolean),
      });
    }
  }
  list.sort((a, b) => b.count - a.count);
  return list.slice(0, max);
}

function mergeFindingsArray(a, b) {
  const merged = [...a, ...b].sort((x, y) => x.start - y.start);
  const out = [];
  let lastEnd = -1;
  for (const f of merged) {
    if (f.start >= lastEnd) { out.push(f); lastEnd = f.end; }
  }
  return out;
}

export function generateReport(text, rawResults) {
  const results = [];
  let totalFindings = 0;

  for (const r of rawResults) {
    const findings = r.detection?.local || [];
    const deep = r.deep || [];
    const all = mergeFindingsArray(findings, deep);
    if (all.length) totalFindings += all.length;
    results.push({
      sentence: r.sentence,
      start: r.start,
      end: r.end,
      findings: all,
      hasBias: all.length > 0,
      patternCount: findings.length,
      deepCount: deep.length,
    });
  }

  const risk = computeRiskScore(results);
  const distribution = buildDistribution(results);
  const topBiased = buildTopBiased(results);

  return { results, risk, distribution, topBiased, totalFindings, deepEnabled: true };
}

export async function analyzeBlog(text) {
  await loadPatterns();
  const sentences = splitSentences(text);

  const rawResults = [];
  let offset = 0;

  for (const s of sentences) {
    const idx = text.indexOf(s, offset);
    const start = idx !== -1 ? idx : offset;
    const end = start + s.length;
    const detection = detectLocalOnly(s);
    const deep = analyzeAll(s);
    rawResults.push({ sentence: s, start, end, detection, deep });
    offset = end;
  }

  return generateReport(text, rawResults);
}
