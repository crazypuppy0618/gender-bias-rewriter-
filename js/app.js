import { CONFIG } from "./config.js";
import { t, I18N } from "./i18n.js";
import { loadPatterns, detectHybrid, detectLocalOnly, getCustomPatternsSync, getSystemPatternsSync } from "./detector.js";
import {
  buildHighlightedHtml,
  buildRewriteText,
  applyRewriteToInput,
  escapeHtml,
} from "./rewriter.js";
import { addDetection, isAvailable as storageAvailable } from "./storage.js";
import { bindAdmin, renderAll as renderAdminAll, setAdminLang } from "./admin.js";
import { SHARED } from "./shared-store.js";
import { initShared, setSharedLang } from "./shared-ui.js";
import { analyzeBlog } from "./blog-scanner.js";
import { analyzeAll } from "./deep-analyzer.js";

const state = {
  lang: "zh-CN",
  apiKey: "",
  lastFindings: [],
  lastText: "",
  lastRewrite: "",
  lastCloud: null,
  session: { detected: 0, accepted: 0 },
  storageOk: true,
};

const SAMPLES = {
  "zh-CN": "她**不是**说女人都情绪化,只是在反驳那种说法。他批评说:那些女拳真离谱。",
  "en-US": "She didn't say women are emotional. She was actually criticising that idea. He said those fem-nazis are crazy.",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.lang = localStorage.getItem(CONFIG.langStorageKey) || "zh-CN";
  state.apiKey = localStorage.getItem(CONFIG.storageKey) || "";

  document.getElementById("langSelect").value = state.lang;
  document.getElementById("apiKeyInput").value = state.apiKey ? "********" : "";
  applyTranslations();
  refreshModeBadge();
  bindEvents();
  animateWorkflow(0);

  try {
    state.storageOk = await storageAvailable();
  } catch (e) {
    state.storageOk = false;
  }

  if (state.storageOk) {
    await bindAdmin();
    setAdminLang(state.lang);
  }

  try {
    await loadPatterns();
  } catch (e) {
    console.error("Pattern load error:", e);
  }

  try {
    await initShared();
    setSharedLang(state.lang);
  } catch (e) {
    console.warn("shared-ui init failed:", e);
  }
}

function bindEvents() {
  document.getElementById("langSelect").addEventListener("change", (e) => {
    state.lang = e.target.value;
    localStorage.setItem(CONFIG.langStorageKey, state.lang);
    applyTranslations();
    refreshModeBadge();
    rerenderLastResult();
    if (state.storageOk) {
      setAdminLang(state.lang);
      renderAdminAll();
    }
    setSharedLang(state.lang);
  });

  document.getElementById("saveKeyBtn").addEventListener("click", () => {
    const el = document.getElementById("apiKeyInput");
    if (el.value && el.value !== "********") {
      state.apiKey = el.value.trim();
      localStorage.setItem(CONFIG.storageKey, state.apiKey);
      el.value = "********";
      flashStatus(t(state.lang, "apiKeySaved"));
    } else if (el.value === "********") {
      state.apiKey = "";
      localStorage.removeItem(CONFIG.storageKey);
      el.value = "";
      flashStatus(t(state.lang, "apiKeyCleared"));
    }
    refreshModeBadge();
  });

  document.getElementById("detectBtn").addEventListener("click", onDetect);
  document.getElementById("loadSampleBtn").addEventListener("click", () => {
    document.getElementById("inputText").value = SAMPLES[state.lang];
  });
  document.getElementById("clearBtn").addEventListener("click", () => {
    document.getElementById("inputText").value = "";
    state.lastFindings = [];
    state.lastText = "";
    state.lastRewrite = "";
    state.lastCloud = null;
    document.getElementById("resultSection").hidden = true;
    animateWorkflow(0);
  });

  document.getElementById("choiceButtons").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-choice]");
    if (!btn) return;
    handleChoice(btn.dataset.choice);
  });

  document.getElementById("blogAnalyzeBtn").addEventListener("click", onBlogAnalyze);
  document.getElementById("commentCheckBtn").addEventListener("click", onCommentCheck);
  document.getElementById("commentClearBtn").addEventListener("click", () => {
    document.getElementById("commentInput").value = "";
    document.getElementById("commentResult").hidden = true;
    document.getElementById("commentCharCount").textContent = "0";
    document.getElementById("commentStatus").textContent = "";
  });
  document.getElementById("commentInput").addEventListener("input", () => {
    document.getElementById("commentCharCount").textContent = document.getElementById("commentInput").value.length;
  });
  document.getElementById("blogClearBtn").addEventListener("click", () => {
    document.getElementById("blogInput").value = "";
    document.getElementById("blogResults").hidden = true;
    document.getElementById("blogStatus").textContent = "";
  });

  document.getElementById("modalClose")?.addEventListener("click", closeLearnModal);
  document.getElementById("modalCloseBtn")?.addEventListener("click", closeLearnModal);
  document.getElementById("learnModal")?.addEventListener("click", (e) => {
    if (e.target.id === "learnModal") closeLearnModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLearnModal();
  });
}

function closeLearnModal() {
  const m = document.getElementById("learnModal");
  if (m) {
    m.hidden = true;
    m.style.display = "none";
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(state.lang, key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.placeholder = t(state.lang, key);
  });
  document.title = t(state.lang, "pageTitle");
}

function refreshModeBadge() {
  const badge = document.getElementById("modeBadge");
  if (state.apiKey) {
    badge.textContent = t(state.lang, "onlineMode");
    badge.className = "badge badge-online";
  } else {
    badge.textContent = t(state.lang, "offlineMode");
    badge.className = "badge badge-offline";
  }
}

function flashStatus(msg) {
  const original = document.title;
  document.title = msg;
  setTimeout(() => (document.title = original), 1500);
}

async function onDetect() {
  const text = document.getElementById("inputText").value.trim();
  if (!text) {
    flashStatus(t(state.lang, "errorEmpty"));
    return;
  }
  state.lastText = text;
  await animateWorkflow();

  let result;
  try {
    result = await detectHybrid(text, state.apiKey, state.lang);
  } catch (e) {
    console.error(e);
    result = detectLocalOnly(text);
    result.cloud = { error: true, message: e.message };
  }
  state.lastFindings = result.local;
  state.lastCloud = result.cloud;

  const rewrite = buildRewriteText(text, result.local, state.lang);
  state.lastRewrite = rewrite;
  renderResult(text, result.local, rewrite, result.cloud);
  updateSessionStats();
  animateWorkflow(5);

  if (state.storageOk) {
    try {
      const findings = result.local.map((f) => ({
        type: f.type,
        phrase: f.phrase,
        start: f.start,
        end: f.end,
        source: f.source,
        isHomophone: f.isHomophone,
        contextScore: f.score,
      }));
      await addDetection({
        text,
        language: state.lang,
        findings,
        userChoice: "none",
        rewriteApplied: false,
        usedCloud: !!(result.cloud && !result.cloud.error),
      });
      if (state.storageOk) await renderAdminAll();
      SHARED.addDetection({
        text,
        language: state.lang,
        findings,
        userChoice: "none",
        rewriteApplied: false,
        usedCloud: !!(result.cloud && !result.cloud.error),
      }).catch((e) => console.warn("shared-store addDetection failed:", e));
    } catch (e) {
      console.warn("Failed to save detection:", e);
    }
  }
}

function renderResult(originalText, findings, rewrite, cloud) {
  const section = document.getElementById("resultSection");
  section.hidden = false;
  const origView = document.getElementById("originalView");
  const rewriteView = document.getElementById("rewriteView");

  if (!findings.length) {
    origView.innerHTML = `<span>${escapeHtml(originalText)}</span><br><em style="color:#7ddc8a">${t(state.lang, "noBiasFound")}</em>`;
    rewriteView.innerHTML = `<span>${escapeHtml(rewrite || originalText)}</span><br><em style="color:#7ddc8a">${t(state.lang, "noRewriteNeeded")}</em>`;
  } else {
    origView.innerHTML = buildHighlightedHtml(originalText, findings, state.lang);
    rewriteView.innerHTML = escapeHtml(rewrite);
  }

  origView.querySelectorAll(".context-tag-extra, .context-extra").forEach((e) => e.remove());

  if (cloud && cloud.error) {
    const warn = document.createElement("p");
    warn.style.cssText = "color:#fbc02d;font-size:12px;margin-top:8px";
    warn.textContent = "⚠ " + t(state.lang, "errorApi") + ": " + (cloud.message || "");
    origView.after(warn);
  }
  if (cloud && cloud.note) {
    const ok = document.createElement("p");
    ok.style.cssText = "color:#7ddc8a;font-size:12px;margin-top:8px";
    ok.textContent = "☁ " + cloud.note;
    origView.after(ok);
  }

  for (const f of findings) {
    if (f.contextFindings && f.contextFindings.length) {
      const tags = f.contextFindings
        .map((cf) => {
          if (cf.rule === "negator") return `<span style="color:#7ddc8a">-[neg:${escapeHtml(cf.term)}]</span>`;
          if (cf.rule === "quote") return `<span style="color:#7ddc8a">-[quote:${escapeHtml(cf.term)}]</span>`;
          if (cf.rule === "reinforcer") return `<span style="color:#ff7b7b">+[rein:${escapeHtml(cf.term)}]</span>`;
          if (cf.rule === "dismissive") return `<span style="color:#ff7b7b">+[dismiss:${escapeHtml(cf.term)}]</span>`;
          if (cf.rule === "compound") return `<span style="color:#ff7b7b">+[compound]</span>`;
          return "";
        })
        .join(" ");
      if (tags) {
        const info = document.createElement("div");
        info.style.cssText = "font-size:11px;margin-top:4px;font-family:ui-monospace,monospace";
        info.innerHTML = tags;
        rewriteView.appendChild(info);
      }
    }
  }
}

function rerenderLastResult() {
  if (!state.lastText) return;
  const rewrite = buildRewriteText(state.lastText, state.lastFindings, state.lang);
  state.lastRewrite = rewrite;
  const origView = document.getElementById("originalView");
  const rewriteView = document.getElementById("rewriteView");
  if (!state.lastFindings.length) {
    origView.innerHTML = `<span>${escapeHtml(state.lastText)}</span><br><em style="color:#7ddc8a">${t(state.lang, "noBiasFound")}</em>`;
    rewriteView.innerHTML = `<span>${escapeHtml(rewrite || state.lastText)}</span><br><em style="color:#7ddc8a">${t(state.lang, "noRewriteNeeded")}</em>`;
  } else {
    origView.innerHTML = buildHighlightedHtml(state.lastText, state.lastFindings, state.lang);
    rewriteView.innerHTML = escapeHtml(rewrite);
  }
}

async function handleChoice(choice) {
  if (choice === "accept") {
    if (state.lastRewrite) {
      applyRewriteToInput(document.getElementById("inputText"), state.lastRewrite);
      state.session.accepted += state.lastFindings.length;
      flashStatus(t(state.lang, "rewriteApplied"));
    }
  } else if (choice === "ignore") {
    document.getElementById("resultSection").hidden = true;
  } else if (choice === "learn") {
    openLearnModal();
  }
  await recordChoice(choice);
  updateSessionStats();
}

async function recordChoice(choice) {
  if (!state.storageOk) return;
  try {
    const findings = state.lastFindings.map((f) => ({
      type: f.type,
      phrase: f.phrase,
      start: f.start,
      end: f.end,
      source: f.source,
      isHomophone: f.isHomophone,
    }));
    await addDetection({
      text: state.lastText,
      language: state.lang,
      findings,
      userChoice: choice,
      rewriteApplied: choice === "accept",
      usedCloud: !!(state.lastCloud && !state.lastCloud.error),
    });
    await renderAdminAll();
    SHARED.addDetection({
      text: state.lastText,
      language: state.lang,
      findings,
      userChoice: choice,
      rewriteApplied: choice === "accept",
      usedCloud: !!(state.lastCloud && !state.lastCloud.error),
    }).catch((e) => console.warn("shared-store addDetection failed:", e));
  } catch (e) {
    console.warn("recordChoice error:", e);
  }
}

function openLearnModal() {
  const body = document.getElementById("learnBody");
  if (!state.lastFindings.length) {
    body.innerHTML = `<p>${t(state.lang, "noBiasFound")}</p>`;
  } else {
    const items = state.lastFindings
      .map((f) => {
        const reason = state.lang === "en-US" ? f.reason_en : f.reason_zh;
        const typeName = CONFIG.typeLabels[f.type]?.[state.lang] || f.type;
        const homo = f.isHomophone ? `<span class="tag tag-homo">${state.lang === "en-US" ? "Homo" : "谐音"}</span>` : "";
        const ctx = f.contextFindings && f.contextFindings.length
          ? `<div style="font-size:11px;margin-top:4px;color:#9fb3c8">` +
            f.contextFindings.map((c) => `${c.rule}:${c.term || ""}`).join(" · ") +
            `</div>`
          : "";
        return `<div class="learn-item">
          <div class="learn-phrase">"${escapeHtml(f.phrase)}"</div>
          <span class="learn-type">${typeName}</span> ${homo}
          <div class="learn-reason">${escapeHtml(reason || "")}</div>
          ${ctx}
        </div>`;
      })
      .join("");
    body.innerHTML = `<p style="margin-bottom:10px;color:#9fb3c8">${t(state.lang, "learningItems")}:</p>${items}`;
  }
  document.getElementById("learnModal").hidden = false;
  document.getElementById("learnModal").style.display = "flex";
}

function updateSessionStats() {
  document.getElementById("sessionDetected").textContent = state.session.detected;
  document.getElementById("sessionAccepted").textContent = state.session.accepted;
  const total = state.session.detected || 1;
  const reduction = Math.round((state.session.accepted / total) * 100);
  document.getElementById("sessionReduction").textContent = reduction + "%";
}

async function onBlogAnalyze() {
  const text = document.getElementById("blogInput").value.trim();
  const status = document.getElementById("blogStatus");
  const resultsDiv = document.getElementById("blogResults");

  if (!text) {
    status.textContent = t(state.lang, "blogError");
    return;
  }
  status.textContent = t(state.lang, "blogScanning");
  resultsDiv.hidden = true;

  try {
    const report = await analyzeBlog(text);
    renderBlogReport(report);
    resultsDiv.hidden = false;
    status.textContent = "";
  } catch (e) {
    console.error("Blog scan error:", e);
    status.textContent = "✗ Error: " + e.message;
  }
}

function renderBlogReport(report) {
  const { risk, distribution, topBiased, results, totalFindings } = report;

  const riskLevel = document.getElementById("blogRiskLevel");
  const riskScore = document.getElementById("blogRiskScore");
  riskLevel.textContent = t(state.lang, "blogRisk" + risk.label.replace("无", "None").replace("低", "Low").replace("中", "Medium").replace("高", "High"));
  riskLevel.className = "blog-risk-level risk-" + risk.level;
  riskScore.textContent = risk.level === "none" ? "—" : risk.score + "%";
  riskScore.className = "blog-risk-score risk-" + risk.level;

  const summaryTpl = t(state.lang, "blogSummary");
  document.getElementById("blogSummary").textContent = summaryTpl
    .replace("N", String(risk.totalSentences))
    .replace("M", String(risk.biasedCount))
    .replace("F", String(totalFindings));

  document.getElementById("blogStatTotal").textContent = risk.totalSentences;
  document.getElementById("blogStatBiased").textContent = risk.biasedCount;
  document.getElementById("blogStatFindings").textContent = totalFindings;

  const distTotal = Math.max(
    distribution.explicit + distribution.implicit + distribution.benevolent,
    1
  );
  document.getElementById("distExplicit").style.width = (distribution.explicit / distTotal * 100) + "%";
  document.getElementById("distImplicit").style.width = (distribution.implicit / distTotal * 100) + "%";
  document.getElementById("distBenevolent").style.width = (distribution.benevolent / distTotal * 100) + "%";
  document.getElementById("distExplicitNum").textContent = distribution.explicit;
  document.getElementById("distImplicitNum").textContent = distribution.implicit;
  document.getElementById("distBenevolentNum").textContent = distribution.benevolent;

  const topList = document.getElementById("blogTopList");
  if (!topBiased.length) {
    topList.innerHTML = `<p class="empty-log">${t(state.lang, "blogNoBias")}</p>`;
  } else {
    topList.innerHTML = topBiased.map((item, i) =>
      `<div class="blog-top-item">
        <span class="blog-top-num">#${i + 1}</span>
        <span class="blog-top-text">${esc(item.sentence)}</span>
        <span class="blog-top-badges">${
          item.types.map(tp =>
            `<span class="blog-top-badge badge-${tp}">${tp}</span>`
          ).join("")
        }</span>
      </div>`
    ).join("");
  }

  const sentList = document.getElementById("blogSentenceList");
  sentList.innerHTML = results.map((r, i) => {
    const num = i + 1;
    if (r.hasBias) {
      const types = [...new Set(r.findings.map(f => f.type || f.category))];
      const labels = types.map(tp =>
        `<span class="blog-top-badge badge-${tp === "gender_norm_naturalization" || tp === "tradition_justification" || tp === "identity_label" || tp.includes("metaphor") || tp === "normative_history" || tp === "encrypted_slur" ? "explicit" : tp}">${tp}</span>`
      ).join(" ");
      const phrases = r.findings.map(f => {
        const cls = f.source === "deep-analyzer" ? "tag-deep" : "tag-" + (f.type || "implicit");
        return `<span class="tag ${cls}" style="margin-right:4px">${esc(f.phrase)}</span>`;
      }).join("");
      return `<div class="blog-sent-item sent-biased">
        <span class="blog-sent-num">#${num}</span>
        <span class="blog-sent-text">${esc(r.sentence)}</span>
        <span class="blog-sent-findings">${phrases} ${r.findings.length} ${t(state.lang, "blogFindings")}</span>
      </div>`;
    }
    return `<div class="blog-sent-item sent-clean">
      <span class="blog-sent-num">#${num}</span>
      <span class="blog-sent-text">${esc(r.sentence)}</span>
      <span class="blog-sent-clean-label">${t(state.lang, "blogNoBias")}</span>
    </div>`;
  }).join("");
}

async function onCommentCheck() {
  const text = document.getElementById("commentInput").value.trim();
  const status = document.getElementById("commentStatus");
  const resultDiv = document.getElementById("commentResult");
  if (!text) { status.textContent = t(state.lang, "commentCheckEmpty"); return; }
  status.textContent = t(state.lang, "blogScanning");
  resultDiv.hidden = true;

  try {
    await loadPatterns();
    const detection = detectLocalOnly(text);
    const deep = analyzeAll(text);
    const all = mergeFindings(detection.local || [], deep);
    renderCommentResult(text, all);
    resultDiv.hidden = false;
    status.textContent = "";
  } catch (e) {
    console.error("Comment check error:", e);
    status.textContent = "✗ Error: " + e.message;
  }
}

function renderCommentResult(text, findings) {
  const icon = document.getElementById("commentResultIcon");
  const header = document.getElementById("commentResultHeader");
  const desc = document.getElementById("commentResultText");
  const findingsDiv = document.getElementById("commentResultFindings");
  const card = document.getElementById("commentResultCard");

  if (!findings.length) {
    icon.textContent = "✅";
    header.textContent = t(state.lang, "commentCheckSafe");
    desc.textContent = t(state.lang, "commentCheckSafeDesc");
    findingsDiv.innerHTML = "";
    card.className = "comment-result-card comment-result-safe";
  } else {
    icon.textContent = "⚠️";
    header.textContent = t(state.lang, "commentCheckWarning");
    desc.textContent = t(state.lang, "commentCheckWarningDesc");
    card.className = "comment-result-card comment-result-warn";

    findingsDiv.innerHTML = findings.map(f => {
      const isDeep = f.source === "deep-analyzer";
      const typeLabel = isDeep ? f.category : (CONFIG.typeLabels[f.type]?.[state.lang] || f.type);
      const tagClass = isDeep ? "tag-deep" : ("tag-" + (f.type || "implicit"));
      const reason = state.lang === "en-US" ? (f.reason_en || f.reason_zh) : f.reason_zh;
      const rewrite = f.rewrite_en || f.rewrite_zh || "";
      return `<div class="comment-finding">
        <div class="comment-finding-phrase">
          <span class="tag ${tagClass}">${esc(typeLabel)}</span>
          ${isDeep && f.decoded ? `<span class="tag tag-homo">解码: ${esc(f.decoded)}</span>` : ""}
          "${esc(f.phrase)}"
        </div>
        <div class="comment-finding-reason">${esc(reason || "")}</div>
        ${rewrite ? `<div class="comment-finding-rewrite">${state.lang === "en-US" ? "Suggestion" : "建议"}: ${esc(rewrite)}</div>` : ""}
      </div>`;
    }).join("");
  }
}

function mergeFindings(a, b) {
  const all = [...a, ...b].sort((x, y) => x.start - y.start);
  const out = [];
  let lastEnd = -1;
  for (const f of all) {
    if (f.start >= lastEnd) { out.push(f); lastEnd = f.end; }
  }
  return out;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function animateWorkflow(stopAt = 0) {
  const steps = document.querySelectorAll(".step");
  steps.forEach((s) => s.classList.remove("active"));
  if (stopAt > 0) {
    for (let i = 0; i < stopAt && i < steps.length; i++) {
      steps[i].classList.add("active");
    }
    return;
  }
  for (let i = 0; i < steps.length; i++) {
    steps[i].classList.add("active");
    await new Promise((r) => setTimeout(r, 220));
    steps[i].classList.remove("active");
  }
}
