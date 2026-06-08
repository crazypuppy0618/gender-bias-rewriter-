export function buildHighlightedHtml(text, findings, lang, showContext = false) {
  if (!findings.length) {
    return escapeHtml(text);
  }
  const segments = [];
  let cursor = 0;
  for (const f of findings) {
    if (f.start > cursor) {
      segments.push(escapeHtml(text.slice(cursor, f.start)));
    }
    const cls = f.weak ? `highlight-${f.type} highlight-weak` : `highlight-${f.type}`;
    const ctxHint = f.context && f.context.contextTags && f.context.contextTags.length
      ? ` · ctx: ${f.context.contextTags.join(",")}`
      : "";
    const title = `${f.type}${ctxHint} · ${f.source || "builtin"}`;
    segments.push(
      `<span class="${cls}" title="${escapeHtml(title)}">${escapeHtml(text.slice(f.start, f.end))}</span>`
    );
    cursor = f.end;
  }
  if (cursor < text.length) {
    segments.push(escapeHtml(text.slice(cursor)));
  }
  return segments.join("");
}

export function buildRewriteText(text, findings, lang) {
  if (!findings.length) return text;
  let result = text;
  for (let i = findings.length - 1; i >= 0; i--) {
    const f = findings[i];
    const replacement = lang === "en-US" ? f.rewrite_en : f.rewrite_zh;
    result = result.slice(0, f.start) + replacement + result.slice(f.end);
  }
  return result;
}

export function applyRewriteToInput(inputEl, rewriteText) {
  inputEl.value = rewriteText;
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  inputEl.classList.add("flash");
  setTimeout(() => inputEl.classList.remove("flash"), 600);
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
