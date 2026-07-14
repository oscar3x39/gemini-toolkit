// Gemini Bulk Delete — content script
// Selector 與刪除流程對照開源 Gemini Mass Delete (MIT, sinadalvand) 驗證過,
// 重新實作。核心 selector 用 Gemini 的 data-test-id(穩定);刪除/確認再加
// aria-label 與文字 fallback(多語系)。刪除採 bottom-up + 等 DOM 移除確認。

(() => {
  "use strict";
  const TAG = "[GeminiBulkDelete]";

  // ── 驗證過的 selector ───────────────────────────────────────
  const ROW_SELECTOR = 'gem-nav-list-item[data-test-id="conversation"]';
  const ROW_FALLBACKS = ['[data-test-id="conversation"]']; // 保險:Gemini 若改自訂元素名
  const ACTIONS_BTN = [
    '[data-test-id="actions-menu-button"]',
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

  // 等元素可互動(可見且未 disabled),含文字 fallback
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

  // Angular Material 選單常需真實 pointer 事件,單純 .click() 打不開
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

  // ── 刪除單筆:走原生 三點選單 → 刪除 → 確認,等 DOM 移除確認 ──
  async function deleteOneRow(item) {
    let btn = querySel(ACTIONS_BTN, item);
    if (!btn) { // more_vert icon fallback(語言無關)
      for (const b of item.querySelectorAll("button")) {
        const icon = b.querySelector("mat-icon");
        if (icon && (icon.getAttribute("fonticon") === "more_vert" ||
                     (icon.textContent || "").includes("more_vert"))) { btn = b; break; }
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
    if (!dialog) return false; // 沒確認框就當作已刪(少數情況)
    const confirm = await waitForElement(CONFIRM_BTN, dialog, 3000, "confirm");
    if (!confirm) { pressEscape(); return false; }
    simulateClick(confirm);

    // 等該 row 從 DOM 移除(最多 5s),確認真的刪掉才算成功
    for (let i = 0; i < 50; i++) {
      if (!document.body.contains(item) || item.offsetParent === null) return true;
      await delay(100);
    }
    pressEscape(); // 卡住就關掉 dialog,避免擋住下一筆
    return false;
  }

  // ── UI ──────────────────────────────────────────────────────
  function decorateRows() {
    for (const row of getRows()) {
      if (row.querySelector(":scope > .gbd-check")) continue;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "gbd-check";
      cb.title = "選取以批次刪除";
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", updateBar);
      if (getComputedStyle(row).position === "static") row.style.position = "relative";
      row.appendChild(cb);
    }
  }

  let bar;
  function ensureBar() {
    if (bar) return;
    bar = document.createElement("div");
    bar.className = "gbd-bar";
    bar.innerHTML =
      '<span class="gbd-count">0</span>' +
      '<input class="gbd-filter" type="text" placeholder="關鍵字…" />' +
      '<button class="gbd-btn gbd-match">選符合</button>' +
      '<button class="gbd-btn gbd-all">全選</button>' +
      '<button class="gbd-btn gbd-clear">清除</button>' +
      '<button class="gbd-btn gbd-del">刪除選取</button>' +
      '<span class="gbd-status"></span>';
    document.body.appendChild(bar);
    const filterInput = bar.querySelector(".gbd-filter");
    bar.querySelector(".gbd-match").addEventListener("click", () => selectByKeyword(filterInput.value));
    filterInput.addEventListener("keydown", (e) => { if (e.key === "Enter") selectByKeyword(filterInput.value); });
    bar.querySelector(".gbd-all").addEventListener("click", () => setAll(true));
    bar.querySelector(".gbd-clear").addEventListener("click", () => setAll(false));
    bar.querySelector(".gbd-del").addEventListener("click", runDelete);
  }

  const checkedBoxes = () => document.querySelectorAll(".gbd-check:checked");
  function setAll(v) { for (const cb of document.querySelectorAll(".gbd-check")) cb.checked = v; updateBar(); }

  // 取對話標題文字(排除我們注入的 checkbox)
  function rowTitle(row) {
    const cb = row.querySelector(":scope > .gbd-check");
    if (cb) cb.setAttribute("aria-hidden", "true");
    return (row.textContent || "").replace(/\s+/g, " ").trim();
  }

  // 選取標題含關鍵字的對話(不分大小寫;累加,不會清掉既有選取)
  function selectByKeyword(kw) {
    const q = (kw || "").trim().toLowerCase();
    if (!q) return;
    let n = 0;
    for (const row of getRows()) {
      const cb = row.querySelector(":scope > .gbd-check");
      if (cb && rowTitle(row).toLowerCase().includes(q)) { cb.checked = true; n++; }
    }
    updateBar();
    const status = bar.querySelector(".gbd-status");
    status.textContent = `符合「${kw.trim()}」:選取 ${n} 筆`;
    setTimeout(() => { if (status && !running) status.textContent = ""; }, 4000);
  }
  function updateBar() { if (bar) bar.querySelector(".gbd-count").textContent = String(checkedBoxes().length); }

  let running = false;
  async function runDelete() {
    if (running) return;
    // bottom-up:刪除會位移後續 row,由下往上最安全
    const targets = Array.from(checkedBoxes()).map((cb) => cb.closest(ROW_SELECTOR) || cb.parentElement).reverse();
    if (!targets.length) return;
    if (!confirm(`確定刪除 ${targets.length} 筆對話?此動作無法復原。`)) return;

    running = true;
    document.body.classList.add("gbd-deleting");
    const status = bar.querySelector(".gbd-status");
    let done = 0, fail = 0;
    for (let i = 0; i < targets.length; i++) {
      status.textContent = `刪除中 ${i + 1}/${targets.length}…`;
      (await deleteOneRow(targets[i])) ? done++ : fail++;
      await delay(400);
    }
    document.body.classList.remove("gbd-deleting");
    updateBar();
    status.textContent = `完成:成功 ${done}${fail ? `、失敗 ${fail}(可再試一次)` : ""}`;
    running = false;
    setTimeout(() => { if (status) status.textContent = ""; }, 5000);
  }

  // ── 啟動:側欄動態載入 → MutationObserver 持續補 checkbox ────
  function boot() {
    ensureBar();
    decorateRows();
    console.log(TAG, `row 命中 ${getRows().length} 筆`);
  }
  new MutationObserver(() => { if (!running) decorateRows(); }).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
