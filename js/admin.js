import { t } from "./i18n.js";
import {
  addCustomPattern,
  updateCustomPattern,
  getCustomPatterns,
  deleteCustomPattern,
  clearCustomPatterns,
  getDetectionStats,
  getDetections,
  clearDetections,
  exportDetections,
  isAvailable as storageAvailable,
} from "./storage.js";
import { refreshCustomPatterns, getSystemPatternsSync } from "./detector.js";
import { escapeHtml } from "./rewriter.js";
import { SHARED } from "./shared-store.js";
import { loadAll as loadSharedPool } from "./shared-ui.js";

const state = {
  lang: "zh-CN",
  filterType: "all",
  filterSource: "all",
  storageOk: true,
  editingId: null,
};

function $(id) {
  return document.getElementById(id);
}

function setLang(lang) {
  state.lang = lang;
  renderAll();
}

function flashEl(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add("flash-msg");
  setTimeout(() => el.classList.remove("flash-msg"), 1500);
}

export async function bindAdmin() {
  state.storageOk = await storageAvailable();
  if (!state.storageOk) {
    const sections = ["logControls", "logStats", "logList", "contribList", "contribForm"];
    sections.forEach((id) => {
      const el = $(id);
      if (el) {
        el.innerHTML = `<p style="color:#fbc02d;padding:12px;background:#3a2c0e;border-radius:6px">${t(state.lang, "storageUnavailable")}</p>`;
      }
    });
    return;
  }

  $("addPatternBtn").addEventListener("click", onAddOrUpdatePattern);
  $("clearFormBtn").addEventListener("click", resetForm);
  $("cancelEditBtn")?.addEventListener("click", resetForm);

  $("refreshLogBtn").addEventListener("click", renderAll);
  $("exportLogBtn").addEventListener("click", onExportHistory);
  $("clearLogBtn").addEventListener("click", onClearHistory);

  $("importLogInput").addEventListener("change", onImportHistory);

  await renderAll();
}

export async function renderAll() {
  if (!state.storageOk) return;
  await Promise.all([renderLogList(), renderLogStats(), renderContribList()]);
}

async function renderLogList() {
  const list = await getDetections(50);
  const container = $("logList");
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<p class="empty-log">${t(state.lang, "emptyLog")}</p>`;
    return;
  }
  container.innerHTML = list
    .map((d) => {
      const time = new Date(d.timestamp).toLocaleString(state.lang === "en-US" ? "en-US" : "zh-CN");
      const choiceKey = d.userChoice === "accept" ? "historyChoiceAccept"
        : d.userChoice === "ignore" ? "historyChoiceIgnore"
        : d.userChoice === "learn" ? "historyChoiceLearn"
        : "historyChoiceNone";
      const choiceLabel = t(state.lang, choiceKey);
      const choiceClass = d.userChoice === "accept" ? "choice-accept"
        : d.userChoice === "ignore" ? "choice-ignore"
        : d.userChoice === "learn" ? "choice-learn"
        : "choice-none";
      const findings = (d.findings || []).slice(0, 3).map((f) => f.phrase).join(" · ") || "—";
      const textShort = d.text.length > 120 ? d.text.slice(0, 120) + "…" : d.text;
      return `<div class="log-card">
        <div class="log-meta">
          <span class="log-time">${escapeHtml(time)}</span>
          <span class="${choiceClass}">${escapeHtml(choiceLabel)}</span>
          <span class="log-count">${d.findingCount || 0}</span>
        </div>
        <div class="log-text">${escapeHtml(textShort)}</div>
        ${findings !== "—" ? `<div class="log-findings">${escapeHtml(findings)}</div>` : ""}
      </div>`;
    })
    .join("");
}

async function renderLogStats() {
  const stats = await getDetectionStats();
  const container = $("logStats");
  if (!container) return;
  container.innerHTML = `
    <div class="log-stat-card">
      <div class="log-stat-num">${stats.total}</div>
      <div class="log-stat-label">${t(state.lang, "statTotalDetections")}</div>
    </div>
    <div class="log-stat-card">
      <div class="log-stat-num">${stats.totalFindings}</div>
      <div class="log-stat-label">${t(state.lang, "statTotalFindings")}</div>
    </div>
    <div class="log-stat-card">
      <div class="log-stat-num">${stats.accepts}</div>
      <div class="log-stat-label">${t(state.lang, "statAccepts")}</div>
    </div>
    <div class="log-stat-card">
      <div class="log-stat-num">${stats.ignores}</div>
      <div class="log-stat-label">${t(state.lang, "statIgnores")}</div>
    </div>
    <div class="log-stat-card">
      <div class="log-stat-num">${stats.learns}</div>
      <div class="log-stat-label">${t(state.lang, "statLearns")}</div>
    </div>
  `;
}

async function renderContribList() {
  const custom = await getCustomPatterns();
  const container = $("contribList");
  if (!container) return;
  if (!custom.length) {
    container.innerHTML = `<p class="empty-log">${t(state.lang, "emptyContrib")}</p>`;
    return;
  }
  container.innerHTML = `
    <div class="contrib-header">
      <span>${t(state.lang, "contribCount").replace("N", custom.length)}</span>
      <button id="clearAllCustomBtn" class="btn-ghost btn-tiny">${t(state.lang, "vocabClearCustom")}</button>
    </div>
    ${custom
      .map((p) => {
        const phrases = [...(p.patterns || []), ...(p.patterns_en || []), ...(p.homophones || [])].join(" / ");
        const editingCls = state.editingId === p.id ? " contrib-item-editing" : "";
        const disabledBadge = p.enabled === false
          ? `<span class="tag tag-disabled">${state.lang === "en-US" ? "Off" : "停用"}</span>`
          : "";
        return `<div class="contrib-item${editingCls}">
          <div class="contrib-head">
            <span class="tag tag-${p.type}">${p.type}</span>
            ${p.isHomophone ? `<span class="tag tag-homo">${state.lang === "en-US" ? "Homo" : "谐音"}</span>` : ""}
            ${disabledBadge}
            <span class="contrib-id">${escapeHtml(p.id)}</span>
            <button class="btn-tiny btn-edit" data-id="${escapeHtml(p.id)}">${t(state.lang, "vocabEdit")}</button>
            <button class="btn-tiny btn-delete" data-id="${escapeHtml(p.id)}">${t(state.lang, "vocabDelete")}</button>
          </div>
          <div class="contrib-phrases">${escapeHtml(phrases)}</div>
          ${p.rewrite_zh ? `<div class="contrib-rewrite">→ ${escapeHtml(p.rewrite_zh)}</div>` : ""}
          ${p.reason_zh ? `<div class="contrib-reason">${escapeHtml(p.reason_zh)}</div>` : ""}
        </div>`;
      })
      .join("")}
  `;
  $("clearAllCustomBtn")?.addEventListener("click", async () => {
    if (!confirm(t(state.lang, "vocabConfirmClearCustom"))) return;
    await clearCustomPatterns();
    await refreshCustomPatterns();
    renderContribList();
  });
  container.querySelectorAll("button.btn-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(t(state.lang, "deleteConfirm"))) return;
      await deleteCustomPattern(btn.dataset.id);
      if (state.editingId === btn.dataset.id) resetForm();
      await refreshCustomPatterns();
      renderContribList();
    });
  });
  container.querySelectorAll("button.btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => loadPatternIntoForm(btn.dataset.id));
  });
}

async function loadPatternIntoForm(id) {
  const list = await getCustomPatterns();
  const p = list.find((x) => x.id === id);
  if (!p) return;
  state.editingId = id;
  $("newPatternType").value = p.type || "implicit";
  $("newPatternEnabled").value = p.enabled === false ? "false" : "true";
  $("newPatternsZh").value = (p.patterns || []).join(", ");
  $("newPatternsEn").value = (p.patterns_en || []).join(", ");
  $("newHomophones").value = (p.homophones || []).join(", ");
  $("newContext").value = (p.contextHints || []).join("\n");
  $("newRewriteZh").value = p.rewrite_zh || "";
  $("newRewriteEn").value = p.rewrite_en || "";
  $("newReasonZh").value = p.reason_zh || "";
  $("newReasonEn").value = p.reason_en || "";
  $("addPatternBtn").textContent = t(state.lang, "updatePattern");
  $("cancelEditBtn").hidden = false;
  $("formEditBanner").hidden = false;
  $("formEditBannerText").textContent = `${t(state.lang, "editingPattern")}: ${id}`;
  document.getElementById("contribFormCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  renderContribList();
}

function resetForm() {
  state.editingId = null;
  ["newPatternType", "newPatternEnabled", "newPatternsZh", "newPatternsEn", "newHomophones", "newContext", "newRewriteZh", "newRewriteEn", "newReasonZh", "newReasonEn"]
    .forEach((id) => { if ($(id)) $(id).value = ""; });
  $("newPatternEnabled").value = "true";
  $("newPatternType").value = "explicit";
  $("addPatternBtn").textContent = t(state.lang, "addPattern");
  const cb = $("cancelEditBtn"); if (cb) cb.hidden = true;
  const fb = $("formEditBanner"); if (fb) fb.hidden = true;
  $("contribStatus").textContent = "";
  renderContribList();
}

function readFormIntoObject() {
  const type = $("newPatternType").value;
  const enabled = $("newPatternEnabled").value === "true";
  const patternsZhRaw = $("newPatternsZh").value.trim();
  const patternsEnRaw = $("newPatternsEn").value.trim();
  const homoRaw = $("newHomophones").value.trim();
  const contextHint = $("newContext").value.trim();
  const rewriteZh = $("newRewriteZh").value.trim();
  const rewriteEn = $("newRewriteEn").value.trim();
  const reasonZh = $("newReasonZh").value.trim();
  const reasonEn = $("newReasonEn").value.trim();

  const splitCommas = (s) => s.split(/[,，;；\n]/).map((x) => x.trim()).filter(Boolean);

  return {
    type,
    enabled,
    patterns: splitCommas(patternsZhRaw),
    patterns_en: splitCommas(patternsEnRaw),
    homophones: splitCommas(homoRaw),
    contextHints: contextHint ? [contextHint] : [],
    rewrite_zh: rewriteZh || "(建议中性改写)",
    rewrite_en: rewriteEn || "(neutral rewrite suggested)",
    reason_zh: reasonZh,
    reason_en: reasonEn,
    isHomophone: !!homoRaw,
  };
}

async function onAddOrUpdatePattern() {
  const data = readFormIntoObject();
  if (!data.patterns.length && !data.patterns_en.length && !data.homophones.length) {
    flashEl($("contribStatus"), state.lang === "en-US" ? "Please enter at least one phrase" : "请至少输入一个偏置词/谐音");
    return;
  }

  if (state.editingId) {
    await updateCustomPattern(state.editingId, data);
    flashEl($("contribStatus"), t(state.lang, "patternUpdated"));
    SHARED.editCustomPattern(state.editingId, data)
      .then((r) => {
        flashEl($("contribStatus"), r.ok ? t(state.lang, "patternUploadedShared") : t(state.lang, "patternLocalOnly"));
        if (r.ok) setTimeout(loadSharedPool, 500);
      })
      .catch(() => flashEl($("contribStatus"), t(state.lang, "patternLocalOnly")));
    resetForm();
  } else {
    await addCustomPattern(data);
    flashEl($("contribStatus"), t(state.lang, "customPatternAdded"));
    SHARED.addCustomPattern(data)
      .then((r) => {
        flashEl($("contribStatus"), r.ok ? t(state.lang, "patternUploadedShared") : t(state.lang, "patternLocalOnly"));
        if (r.ok) setTimeout(loadSharedPool, 500);
      })
      .catch(() => flashEl($("contribStatus"), t(state.lang, "patternLocalOnly")));
    ["newPatternsZh", "newPatternsEn", "newHomophones", "newContext", "newRewriteZh", "newRewriteEn", "newReasonZh", "newReasonEn"]
      .forEach((id) => { if ($(id)) $(id).value = ""; });
  }
  await refreshCustomPatterns();
  renderContribList();
}

async function onClearHistory() {
  if (!confirm(t(state.lang, "historyConfirmClear"))) return;
  await clearDetections();
  renderAll();
}

async function onExportHistory() {
  const data = await exportDetections();
  downloadJSON(JSON.parse(data), `gbr-history-${Date.now()}.json`);
}

async function onImportHistory(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    const list = data.detections || data;
    if (!Array.isArray(list)) throw new Error("Invalid format");
    const { addDetection } = await import("./storage.js");
    for (const d of list) {
      await addDetection({
        text: d.text,
        language: d.language,
        findings: d.findings || [],
        userChoice: d.userChoice || "none",
        rewriteApplied: d.rewriteApplied,
        usedCloud: d.usedCloud,
      });
    }
    renderAll();
    flashEl($("logStatus"), state.lang === "en-US" ? `Imported ${list.length} records` : `已导入 ${list.length} 条记录`);
  } catch (err) {
    alert((state.lang === "en-US" ? "Import failed: " : "导入失败:") + err.message);
  }
  e.target.value = "";
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { state as adminState, setLang as setAdminLang };
