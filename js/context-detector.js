export function extractSentence(text, position) {
  const left = text.slice(0, position);
  const right = text.slice(position);
  const sentenceEnders = /[。！？!?\n;；]/;
  const leftStart = (() => {
    for (let i = left.length - 1; i >= 0; i--) {
      if (sentenceEnders.test(left[i])) return i + 1;
    }
    return 0;
  })();
  const rightEnd = (() => {
    for (let i = 0; i < right.length; i++) {
      if (sentenceEnders.test(right[i])) return i + 1;
    }
    return right.length;
  })();
  return text.slice(leftStart, position + rightEnd);
}

export function getContextWindow(text, start, end, windowSize = 12) {
  const ctxStart = Math.max(0, start - windowSize);
  const ctxEnd = Math.min(text.length, end + windowSize);
  return {
    before: text.slice(ctxStart, start),
    after: text.slice(end, ctxEnd),
    full: text.slice(ctxStart, ctxEnd),
  };
}

export function scoreContext(text, finding, contextRules) {
  if (!contextRules) return 1.0;
  const ctx = getContextWindow(text, finding.start, finding.end, 16);
  const sentence = extractSentence(text, finding.start);
  let score = 1.0;
  const findings = [];

  if (contextRules.negators) {
    for (const n of contextRules.negators) {
      if (ctx.before.endsWith(n) || ctx.before.includes(" " + n) || sentence.startsWith(n)) {
        score *= 0.25;
        findings.push({ rule: "negator", term: n });
        break;
      }
    }
  }

  if (contextRules.quoteIndicators && score > 0.3) {
    for (const q of contextRules.quoteIndicators) {
      if (ctx.before.endsWith(q) || ctx.before.includes(q + ":") || ctx.before.includes(q + "：")) {
        score *= 0.4;
        findings.push({ rule: "quote", term: q });
        break;
      }
    }
  }

  if (contextRules.reinforcers) {
    let boosted = false;
    for (const r of contextRules.reinforcers) {
      if (ctx.before.endsWith(r) || ctx.after.startsWith(r) || sentence.includes(r)) {
        score *= 1.25;
        boosted = true;
        findings.push({ rule: "reinforcer", term: r });
        break;
      }
    }
    if (!boosted && contextRules.compoundBiasPatterns) {
      for (const c of contextRules.compoundBiasPatterns) {
        if (sentence.includes(c) || (ctx.full || "").includes(c)) {
          score *= 1.15;
          findings.push({ rule: "compound", term: c });
          break;
        }
      }
    }
  }

  if (contextRules.dismissiveFrames) {
    for (const d of contextRules.dismissiveFrames) {
      if (ctx.before.includes(d) || sentence.startsWith(d)) {
        score *= 1.2;
        findings.push({ rule: "dismissive", term: d });
        break;
      }
    }
  }

  return {
    score: Math.min(1.5, Math.max(0.05, score)),
    adjustedConfidence: Math.min(1.0, (finding.confidence || 1) * score),
    contextFindings: findings,
    sentence,
    contextWindow: ctx,
  };
}

export function enrichFindingsWithContext(text, findings, contextRules) {
  if (!findings || !findings.length) return findings;
  const threshold = 0.2;
  return findings
    .map((f) => {
      const scored = scoreContext(text, f, contextRules);
      return { ...f, ...scored };
    })
    .filter((f) => f.adjustedConfidence >= threshold);
}
