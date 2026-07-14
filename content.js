// Gemini Toolkit — content script
// 選取模型:Cmd/Ctrl+左鍵逐個選、Shift+左鍵範圍選、右鍵刪除。
// 選取用「對話 id(href /app/<id>)」記錄,不記 DOM 元素 → Gemini 重繪也不掉。
// Selector 對照開源 Gemini Mass Delete (MIT) 驗證。純本地、零外連。

(() => {
  "use strict";
  const TAG = "[GeminiToolkit]";

  // ── 驗證過的 selector ───────────────────────────────────────
  const ROW_SELECTOR = 'gem-nav-list-item[data-test-id="conversation"]';
  const ROW_FALLBACKS = ['[data-test-id="conversation"]'];
  const ACTIONS_BTN = [
    '[data-test-id="actions-menu-button"]',
    'button[aria-label*="動作"]',
    'button[aria-label*="options" i]',
    'button[aria-label*="actions" i]',
    'button[aria-label*="menu" i]',
  ];
  const MENU_PANEL = ['.mat-mdc-menu-panel', '[role="menu"]', '.cdk-overlay-pane'];
  const DELETE_BTN = ['button[data-test-id="delete-button"]', 'button[aria-label*="delete" i]'];
  const DIALOG = ['.mat-mdc-dialog-container', 'mat-dialog-container', '[role="dialog"]'];
  const CONFIRM_BTN = ['button[data-test-id="confirm-button"]', 'button[aria-label*="confirm" i]'];

  // ── 小工具 ──────────────────────────────────────────────────
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const querySel = (sels, parent = document) => {
    for (const s of sels) { try { const el = parent.querySelector(s); if (el) return el; } catch (_) {} }
    return null;
  };
  const findButtonByText = (terms, parent = document) => {
    for (const btn of parent.querySelectorAll("button")) {
      const hay = ((btn.textContent || "") + " " + (btn.getAttribute("aria-label") || "")).toLowerCase();
      if (terms.some((t) => hay.includes(t))) return btn;
    }
    return null;
  };
  const waitForElement = (sels, parent = document, timeout = 3000, type = "") =>
    new Promise((resolve) => {
      const get = () => {
        let el = querySel(sels, parent);
        if (!el && type === "delete") el = findButtonByText(["delete", "刪除", "删除"], parent);
        if (!el && type === "confirm") el = findButtonByText(["delete", "confirm", "刪除", "确定", "確定"], parent);
        return el;
      };
      let el = get();
      if (el && el.offsetParent !== null && !el.disabled) return resolve(el);
      let elapsed = 0;
      const iv = setInterval(() => {
        elapsed += 100;
        el = get();
        if (el && el.offsetParent !== null && !el.disabled) { clearInterval(iv); resolve(el); }
        else if (elapsed >= timeout) { clearInterval(iv); resolve(null); }
      }, 100);
    });
  const simulateClick = (el) => {
    if (!el) return;
    try {
      el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      el.click();
    } catch (_) { el.click(); }
  };
  const pressEscape = () =>
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));

  function getRows() {
    let rows = document.querySelectorAll(ROW_SELECTOR);
    if (rows.length) return Array.from(rows);
    for (const s of ROW_FALLBACKS) { rows = document.querySelectorAll(s); if (rows.length) return Array.from(rows); }
    return [];
  }
  function idOf(row) {
    const a = row.matches("a[href]") ? row : row.querySelector('a[href]');
    const href = (a && a.getAttribute("href")) || "";
    const m = href.match(/\/app\/([^/?#]+)/);
    return m ? m[1] : href;
  }
  function rowTitle(row) {
    const t = row.querySelector(".title-text");
    if (t) return (t.textContent || "").trim();
    const a = row.querySelector("a[aria-label]");
    return a ? (a.getAttribute("aria-label") || "").trim() : "";
  }

  // ── 選取狀態(以 id 記錄)──────────────────────────────────
  const selected = new Set();
  let anchorId = null;
  let aborted = false;
  let selectMode = false;
  try { selectMode = localStorage.getItem("gbd.selectMode") === "1"; } catch (_) {}
  const setSelectMode = (v) => {
    selectMode = v;
    try { localStorage.setItem("gbd.selectMode", v ? "1" : "0"); } catch (_) {}
    updateBar();
  };

  function applyHighlight() {
    for (const row of getRows()) row.classList.toggle("gbd-selected", selected.has(idOf(row)));
  }
  function clearSelection() { selected.clear(); anchorId = null; applyHighlight(); updateBar(); }
  function toggle(id) { selected.has(id) ? selected.delete(id) : selected.add(id); applyHighlight(); updateBar(); }
  function selectRange(fromId, toId) {
    const ids = getRows().map(idOf);
    const a = ids.indexOf(fromId), b = ids.indexOf(toId);
    if (a === -1 || b === -1) { selected.add(toId); applyHighlight(); updateBar(); return; }
    const [lo, hi] = a < b ? [a, b] : [b, a];
    for (let i = lo; i <= hi; i++) selected.add(ids[i]);
    applyHighlight(); updateBar();
  }

  // ── 刪除單筆(原生 三點選單 → 刪除 → 確認,等 DOM 移除)───
  async function deleteOneRow(item) {
    item.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    let btn = await waitForElement(ACTIONS_BTN, item, 1500);
    if (!btn) {
      for (const b of item.querySelectorAll("button")) {
        const icon = b.querySelector("mat-icon");
        if (icon && (icon.getAttribute("fonticon") === "more_vert" ||
                     (icon.getAttribute("data-mat-icon-name") || "") === "more_vert")) { btn = b; break; }
      }
    }
    if (!btn) return false;
    simulateClick(btn);
    const panel = await waitForElement(MENU_PANEL, document, 3000);
    if (!panel) return false;
    const del = await waitForElement(DELETE_BTN, panel, 3000, "delete");
    if (!del) { pressEscape(); return false; }
    simulateClick(del);
    const dialog = await waitForElement(DIALOG, document, 3000);
    if (!dialog) return false;
    const confirm = await waitForElement(CONFIRM_BTN, dialog, 3000, "confirm");
    if (!confirm) { pressEscape(); return false; }
    simulateClick(confirm);
    for (let i = 0; i < 50; i++) {
      if (!document.body.contains(item) || item.offsetParent === null) return true;
      await delay(100);
    }
    pressEscape();
    return false;
  }

  let running = false;
  async function runDelete() {
    if (running || !selected.size) return;
    hideMenu();
    // 依 DOM 由上到下取出已選 row,反向刪(bottom-up 避免位移)
    const targets = getRows().filter((r) => selected.has(idOf(r))).reverse();
    if (!targets.length) return;
    if (!confirm(`確定刪除 ${targets.length} 筆對話?此動作無法復原。`)) return;

    running = true;
    aborted = false;
    document.body.classList.add("gbd-deleting");
    updateBar(); // 顯示中止鈕
    const status = bar.querySelector(".gbd-status");
    let done = 0, fail = 0;
    for (let i = 0; i < targets.length; i++) {
      if (aborted) break;
      status.textContent = `刪除中 ${i + 1}/${targets.length}…`;
      const id = idOf(targets[i]);
      if (await deleteOneRow(targets[i])) { selected.delete(id); done++; } else { fail++; }
      await delay(400);
    }
    document.body.classList.remove("gbd-deleting");
    running = false;
    applyHighlight();
    updateBar();
    const head = aborted ? "已中止" : "完成";
    status.textContent = `${head}:成功 ${done}${fail ? `、失敗 ${fail}(可再試)` : ""}`;
    setTimeout(() => { if (status && !running) status.textContent = ""; }, 5000);
  }

  // ── 右鍵選單 ────────────────────────────────────────────────
  let menuEl;
  function ensureMenu() {
    if (menuEl) return;
    menuEl = document.createElement("div");
    menuEl.className = "gbd-ctxmenu";
    menuEl.style.display = "none";
    menuEl.innerHTML = '<button class="gbd-ctx-del"></button><button class="gbd-ctx-clear">取消選取</button>';
    document.body.appendChild(menuEl);
    menuEl.querySelector(".gbd-ctx-del").addEventListener("click", runDelete);
    menuEl.querySelector(".gbd-ctx-clear").addEventListener("click", () => { clearSelection(); hideMenu(); });
  }
  function showMenu(x, y) {
    ensureMenu();
    menuEl.querySelector(".gbd-ctx-del").textContent = `刪除選取 (${selected.size})`;
    menuEl.style.display = "block";
    // 邊界:避免超出視窗
    const w = 180, h = 80;
    menuEl.style.left = Math.min(x, window.innerWidth - w) + "px";
    menuEl.style.top = Math.min(y, window.innerHeight - h) + "px";
  }
  function hideMenu() { if (menuEl) menuEl.style.display = "none"; }

  // ── 底部工具列(關鍵字過濾 + 刪除)──────────────────────────
  let bar;
  function ensureBar() {
    if (bar) return;
    bar = document.createElement("div");
    bar.className = "gbd-bar";
    bar.innerHTML =
      '<button class="gbd-btn gbd-mode" title="開啟後一般左鍵即選取,不用壓 Cmd"></button>' +
      '<span class="gbd-count">0</span>' +
      '<span class="gbd-actions">' +
        '<input class="gbd-filter" type="text" placeholder="關鍵字…" />' +
        '<button class="gbd-btn gbd-match">選符合</button>' +
        '<button class="gbd-btn gbd-clear">清除</button>' +
        '<button class="gbd-btn gbd-del">刪除選取</button>' +
      '</span>' +
      '<button class="gbd-btn gbd-cancel">中止</button>' +
      '<span class="gbd-status"></span>';
    document.body.appendChild(bar);
    const fi = bar.querySelector(".gbd-filter");
    bar.querySelector(".gbd-mode").addEventListener("click", () => setSelectMode(!selectMode));
    bar.querySelector(".gbd-match").addEventListener("click", () => selectByKeyword(fi.value));
    fi.addEventListener("keydown", (e) => { if (e.key === "Enter") selectByKeyword(fi.value); });
    bar.querySelector(".gbd-clear").addEventListener("click", clearSelection);
    bar.querySelector(".gbd-del").addEventListener("click", runDelete);
    bar.querySelector(".gbd-cancel").addEventListener("click", () => { aborted = true; });
    updateBar();
  }
  function updateBar() {
    if (!bar) return;
    bar.querySelector(".gbd-count").textContent = String(selected.size);
    const mode = bar.querySelector(".gbd-mode");
    mode.textContent = selectMode ? "選取模式:開" : "選取模式:關";
    mode.classList.toggle("on", selectMode);
    // 閒置(無選取、非選取模式、沒在刪)→ 收起關鍵字/刪除,只留模式鈕
    bar.classList.toggle("gbd-idle", !running && selected.size === 0 && !selectMode);
    bar.classList.toggle("gbd-running", running);
  }
  function selectByKeyword(kw) {
    const q = (kw || "").trim().toLowerCase();
    if (!q) return;
    let n = 0;
    for (const row of getRows()) {
      if (rowTitle(row).toLowerCase().includes(q)) { selected.add(idOf(row)); n++; }
    }
    applyHighlight(); updateBar();
    const status = bar.querySelector(".gbd-status");
    status.textContent = `符合「${kw.trim()}」:選取 ${n} 筆`;
    setTimeout(() => { if (status && !running) status.textContent = ""; }, 4000);
  }

  // ── 事件綁定(capture 階段搶在 Angular 前面)────────────────
  document.addEventListener("click", (e) => {
    if (menuEl && !e.target.closest(".gbd-ctxmenu")) hideMenu();
    const row = e.target.closest(ROW_SELECTOR);
    if (!row) {
      // 點對話以外的空白處(但不含工具列/右鍵選單)→ 清空選取
      if (selected.size && !e.target.closest(".gbd-bar") && !e.target.closest(".gbd-ctxmenu")) clearSelection();
      return;
    }
    // 選取模式:一般左鍵即選取(不用壓 Cmd),Shift 仍範圍選,擋掉導覽
    if (selectMode) {
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) selectRange(anchorId || idOf(row), idOf(row));
      else { const id = idOf(row); toggle(id); anchorId = id; }
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault(); e.stopPropagation();
      const id = idOf(row); toggle(id); anchorId = id;
    } else if (e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      selectRange(anchorId || idOf(row), idOf(row));
    } else {
      // 一般左鍵:清掉選取、放行導覽
      if (selected.size) clearSelection();
    }
  }, true);

  document.addEventListener("contextmenu", (e) => {
    const row = e.target.closest(ROW_SELECTOR);
    if (!row) { hideMenu(); return; }
    e.preventDefault();
    const id = idOf(row);
    if (!selected.has(id)) { clearSelection(); selected.add(id); anchorId = id; applyHighlight(); updateBar(); }
    showMenu(e.clientX, e.clientY);
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    hideMenu();
    // 非刪除中、焦點不在關鍵字框時,Esc 清空選取(避免打斷我們自己關 dialog 的 Escape)
    if (!running && selected.size && !(e.target && e.target.classList && e.target.classList.contains("gbd-filter"))) {
      clearSelection();
    }
  });
  window.addEventListener("scroll", hideMenu, true);

  // ── 啟動 ────────────────────────────────────────────────────
  function boot() { ensureBar(); ensureMenu(); applyHighlight(); console.log(TAG, `row 命中 ${getRows().length} 筆`); }
  new MutationObserver(() => { if (!running) applyHighlight(); }).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
