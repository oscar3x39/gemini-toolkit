# Gemini Toolkit

> 多選、批次刪除 Google Gemini 側欄對話,操作像檔案總管一樣自然。**純本地執行、零外連、無額外權限**。

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/oscar3x39/gemini-toolkit/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

English → [README.md](README.md)

Gemini 一筆一筆刪對話很痛——每筆都要點三下加一個確認框。Gemini Toolkit 加上真正的多選,一次清掉幾十筆。

---

## 功能

- **檔案總管式多選** — Cmd/Ctrl 點擊逐個選、Shift 點擊範圍選,或開「選取模式」直接單擊即選。
- **右鍵刪除** — 右鍵任一對話 →「刪除選取 (N)」。
- **關鍵字過濾** — 輸入關鍵字按「選符合」,標題含該字的對話全被選起來。
- **就地確認** — 刪除鈕旁彈出小視窗(不是突兀的原生 alert),**Enter 確定 / Esc 取消**。
- **刪除中可中止** — 長批次隨時喊停。
- **閱讀模式** — 左下「閱讀」鈕一鍵切換:字級/行距對照 Medium:正文 22px / 1.8 行距、內容欄預設滿版(一屏看更多行)、段距 1.2em、標題留白、行內 code 提高對比、改用系統字體(PingFang),輸入框壓扁。右鍵該鈕可調寬度(滿版 / 1400 / 1100 / 760)/字級(18–26)/字體(系統 / Google Sans / 宋體),設定會記住。
- **選取不怕重繪** — 用對話 id 記錄而非 DOM 元素,捲動或 Gemini 重繪側欄都不會掉。

---

## 安裝

### 方式 A — 用 Release(推薦)

1. 到 [最新 Release](https://github.com/oscar3x39/gemini-toolkit/releases/latest) 下載 `gemini-toolkit.zip` 並解壓。
2. Chrome 開 `chrome://extensions`(Edge / Brave / Arc 等 Chromium 瀏覽器皆可)。
3. 打開右上角的**開發者模式 / Developer mode**。
4. 點**載入未封裝項目 / Load unpacked**,選解壓後的資料夾。
5. 開 <https://gemini.google.com>,展開左側對話列表。

### 方式 B — 從原始碼

```bash
git clone https://github.com/oscar3x39/gemini-toolkit.git
```

然後照方式 A 的步驟 2–5,選 clone 下來的資料夾。

> 每次更新後,到 `chrome://extensions` 點擴充卡片上的 **↻ 重新整理** icon,再重整 Gemini 分頁。

---

## 用法

**選取對話**

| 動作 | 效果 |
|---|---|
| 切換**選取模式**(左下工具列)| 一般左鍵即選取,不用壓鍵。狀態會記住,重載仍保留。 |
| **Cmd/Ctrl + 左鍵** | 逐個加選 / 取消(模式關著時用;平常左鍵照樣開對話)。 |
| **Shift + 左鍵** | 從上一個選到這個,中間全選。 |
| **右鍵**任一對話 | 跳出「刪除選取 (N)」。 |
| 點空白處,或按 **Esc** | 清空選取。 |

選中的對話會藍色高亮。

**刪除**

1. 選好要刪的。
2. 右鍵 →「刪除選取」,或按右下紅色**刪除選取**鈕。
3. 按鈕旁彈出確認小視窗 — **Enter 確定 / Esc 取消**。
4. 它會逐筆走 Gemini 原生「⋮ 選單 → 刪除 → 確認」流程。按**中止**可提前停下。

**關鍵字過濾** — 在框裡打字按「選符合」(或 Enter),標題含該字的對話全被選起來(不分大小寫、累加)。適合一次清掉整個主題的舊對話。

---

## 運作原理

Selector 與刪除流程對照真實 Gemini DOM,並與開源 [Gemini Mass Delete](https://github.com/sinadalvand/GeminiMassDeleteExtension)(MIT)交叉驗證:

- **用穩定的 `data-test-id`** — `gem-nav-list-item[data-test-id="conversation"]`(row)、`actions-menu-button`、`delete-button`、`confirm-button`,不是 Angular 亂數 class。刪除/確認再加 `aria-label` 與文字 fallback(多語系)。
- **`simulateClick`** 派 `mouseover/mousedown/mouseup + click`,因為 Angular Material 選單常常不理單純的 `.click()`。
- **bottom-up 刪除** — 刪除會位移 DOM,所以由下往上刪。
- **等 DOM 真的移除**(最多 5s)才算成功;卡住就派 `Escape`,避免一筆卡死整批。
- **id-based 選取**(`/app/<id>`),重繪不掉選。

若 Gemini 改了 row 結構,console 會印 `row 命中 0 筆`;在 `content.js` 的 `ROW_FALLBACKS` 補候選即可。

---

## 已知限制

- **無法按日期篩選。** Gemini 側欄的對話 row 不含任何時間戳,只有標題、置頂 icon、選單與對話 id。要按日期得攔內部 API,不適合放這種輕量工具。實務上越下面越舊,用 Shift 從某筆點到底最快。

---

## 隱私

- 只在 `https://gemini.google.com` 生效。
- **無** `host_permissions`、**無**背景頁、**完全無**任何網路請求。
- 只讀側欄 DOM、驅動 Gemini 自己的刪除 UI,跟你手動做的一模一樣。

---

## 致謝

Selector 與刪除流程參考 sinadalvand 的 [Gemini Mass Delete](https://github.com/sinadalvand/GeminiMassDeleteExtension)(MIT)。

## 授權

[MIT](LICENSE)
