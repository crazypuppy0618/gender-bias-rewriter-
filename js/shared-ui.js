import { t, I18N } from "./i18n.js";
import { SHARED, getServerInfo } from "./shared-store.js";
import { escapeHtml } from "./rewriter.js";

const state = {
  lang: "zh-CN",
  inited: false,
  patterns: [],
  corpus: [],
  stats: null,
  online: null,
};

function $(id) {
  return document.getElementById(id);
}

function setLang(lang) {
  state.lang = lang;
  if (state.inited) renderAll();
}

function flashEl(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add("flash-msg");
  setTimeout(() => el.classList.remove("flash-msg"), 1500);
}

async function initShared() {
  if (state.inited) return;
  state.inited = true;

  $("refreshSharedBtn")?.addEventListener("click", () => loadAll());
  $("submitCorpusBtn")?.addEventListener("click", onSubmitCorpus);

  await loadAll();
}

async function loadAll() {
  setStatus("loading");
  const online = await SHARED.refreshStatus();
  state.online = online;
  if (!online) {
    setStatus("offline");
    return;
  }
  setStatus("online");
  const info = getServerInfo();
  if (info?.version) {
    $("sharedServerVersion").textContent = `server v${info.version}`;
  }

  const [statsRes, patternsRes, corpusRes] = await Promise.all([
    SHARED.fetchStats(),
    SHARED.fetchPatterns(),
    SHARED.fetchCorpus(),
  ]);
  if (statsRes.ok) {
    state.stats = statsRes.stats;
    renderStats();
  }
  if (patternsRes.ok) {
    state.patterns = patternsRes.patterns || [];
    renderPatterns();
  }
  if (corpusRes.ok) {
    state.corpus = corpusRes.corpus || [];
    renderCorpus();
  }
}

function setStatus(s) {
  const dot = $("sharedStatusDot");
  const text = $("sharedStatusText");
  if (!dot || !text) return;
  dot.className = "status-dot";
  if (s === "online") {
    dot.classList.add("status-dot-online");
    text.textContent = t(state.lang, "sharedStatusOnline");
  } else if (s === "offline") {
    dot.classList.add("status-dot-offline");
    text.textContent = t(state.lang, "sharedStatusOffline");
  } else if (s === "loading") {
    dot.classList.add("status-dot-loading");
    text.textContent = t(state.lang, "sharedStatusLoading");
  } else {
    dot.classList.add("status-dot-unknown");
    text.textContent = t(state.lang, "sharedStatusUnknown");
  }
}

function renderStats() {
  if (!state.stats) return;
  $("statTotalRecords").textContent = state.stats.total ?? 0;
  $("statTotalPatterns").textContent = state.stats.byType?.customPattern ?? 0;
  $("statTotalCorpus").textContent = state.stats.byType?.corpus ?? 0;
  $("statTotalDetectionsShared").textContent = state.stats.byType?.detection ?? 0;
  $("statVersionCount").textContent = Object.keys(state.stats.byAppVersion || {}).length;
}

function renderPatterns() {
  const container = $("sharedPatternsList");
  if (!container) return;
  if (!state.patterns.length) {
    container.innerHTML = `<p class="empty-log">${t(state.lang, "sharedEmptyPatterns")}</p>`;
    return;
  }
  const recent = state.patterns.slice(-50).reverse();
  container.innerHTML = recent
    .map((p) => {
      const phrases = [...(p.patterns || []), ...(p.patternsEn || []), ...(p.homophones || [])].join(" / ");
      const ver = p.appVersion ? `<span class="tag tag-version">${escapeHtml(p.appVersion)}</span>` : "";
      return `<div class="shared-item" data-id="${escapeHtml(p.id)}">
        <div class="shared-item-head">
          <span class="tag tag-${escapeHtml(p.patternType || "implicit")}">${escapeHtml(p.patternType || "implicit")}</span>
          ${ver}
          <span class="shared-item-id">${escapeHtml(p.id)}</span>
          <button class="btn-tiny btn-copy-shared" data-action="copy" data-id="${escapeHtml(p.id)}" data-text="${escapeHtml(phrases)}">${t(state.lang, "sharedCopyPhrases")}</button>
        </div>
        <div class="shared-item-phrases">${escapeHtml(phrases)}</div>
        ${p.rewrite_zh ? `<div class="shared-item-rewrite">→ ${escapeHtml(p.rewrite_zh)}</div>` : ""}
        ${p.reason_zh ? `<div class="shared-item-reason">${escapeHtml(p.reason_zh)}</div>` : ""}
      </div>`;
    })
    .join("");
  container.querySelectorAll('button[data-action="copy"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const txt = btn.dataset.text || "";
      navigator.clipboard?.writeText(txt);
      flashEl(btn, t(state.lang, "sharedCopied"));
    });
  });
}

function renderCorpus() {
  const container = $("sharedCorpusList");
  if (!container) return;
  if (!state.corpus.length) {
    container.innerHTML = `<p class="empty-log">${t(state.lang, "sharedEmptyCorpus")}</p>`;
    return;
  }
  const recent = state.corpus.slice(-50).reverse();
  container.innerHTML = recent
    .map((c) => {
      const date = new Date(c.ts).toLocaleDateString(state.lang === "en-US" ? "en-US" : "zh-CN");
      const ver = c.appVersion ? `<span class="tag tag-version">${escapeHtml(c.appVersion)}</span>` : "";
      const lang = c.language ? `<span class="tag tag-lang">${escapeHtml(c.language)}</span>` : "";
      const label = c.label ? `<span class="tag tag-label">${escapeHtml(c.label)}</span>` : "";
      return `<div class="shared-item" data-id="${escapeHtml(c.id)}">
        <div class="shared-item-head">
          ${lang}${label}${ver}
          <span class="shared-item-id">${escapeHtml(c.id)}</span>
          <span class="shared-item-date">${escapeHtml(date)}</span>
          <button class="btn-tiny btn-copy-shared" data-action="use" data-text="${escapeHtml(c.text || "")}">${t(state.lang, "sharedUseAsTest")}</button>
        </div>
        <div class="shared-item-text">${escapeHtml(c.text || "")}</div>
        ${c.notes ? `<div class="shared-item-reason">${escapeHtml(c.notes)}</div>` : ""}
      </div>`;
    })
    .join("");
  container.querySelectorAll('button[data-action="use"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const txt = btn.dataset.text || "";
      const input = $("inputText");
      if (input) {
        input.value = txt;
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus();
      }
      flashEl(btn, t(state.lang, "sharedLoadedToInput"));
    });
  });
}

async function onSubmitCorpus() {
  const text = ($("corpusText")?.value || "").trim();
  const label = ($("corpusLabel")?.value || "").trim();
  const language = $("corpusLang")?.value || "zh-CN";
  if (!text) {
    flashEl($("corpusStatus"), t(state.lang, "corpusEmpty"));
    return;
  }
  const btn = $("submitCorpusBtn");
  if (btn) btn.disabled = true;
  const res = await SHARED.addCorpus({ text, label, language });
  if (btn) btn.disabled = false;
  if (res.ok) {
    flashEl($("corpusStatus"), t(state.lang, "corpusSubmitted"));
    $("corpusText").value = "";
    $("corpusLabel").value = "";
    setTimeout(() => loadAll(), 300);
  } else {
    flashEl($("corpusStatus"), t(state.lang, "corpusFailed") + " (" + (res.reason || "unknown") + ")");
  }
}

function renderAll() {
  if (!state.inited) return;
  setStatus(state.online === true ? "online" : state.online === false ? "offline" : "unknown");
  if (state.stats) renderStats();
  if (state.patterns.length) renderPatterns();
  if (state.corpus.length) renderCorpus();
}

export { initShared, setLang as setSharedLang, loadAll };
