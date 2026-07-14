# Gemini Toolkit

Gemini 側欄增強工具集。純本地 content script、**零外連、無額外權限**(只在 `gemini.google.com` 生效)。

目前功能:對話多選批次刪除、關鍵字過濾選取。之後可擴充(prompt 管理、快捷鍵、匯出等)。

## 安裝(未打包,開發者模式)

1. Chrome 開 `chrome://extensions`
2. 右上角開「開發者模式 / Developer mode」
3. 點「載入未封裝項目 / Load unpacked」→ 選這個資料夾
4. 打開 <https://gemini.google.com>,展開左側對話列表

## 用法

選取(像檔案總管的多選):

- **Cmd/Ctrl + 左鍵**:逐個加選 / 取消。平常左鍵照樣開對話,不影響。
- **Shift + 左鍵**:從上一個選到這個,中間全選。
- 選中的對話會**藍色高亮**。
- **右鍵**任一對話 → 跳出「刪除選取 (N)」→ 點它就整批刪。

其他:

- 左下工具列:關鍵字框 + `選符合` / `清除` / `刪除選取`(顯示已選數量)。
- **關鍵字過濾**:輸入字串按 `選符合`(或 Enter),自動選取標題含該字的對話(不分大小寫、累加)。適合清「特定主題」的一整批舊對話。
- 刪除 → 二次確認 → 逐筆走 Gemini 原生「三點選單 → 刪除 → 確認」流程。

選取以對話 id(`href` 的 `/app/<id>`)記錄,Gemini 重繪側欄時選取不會掉。

## 設計說明(為什麼這樣寫)

Selector 與刪除流程對照開源 [Gemini Mass Delete](https://github.com/sinadalvand/GeminiMassDeleteExtension)(MIT, sinadalvand)驗證後重新實作:

- **用 Gemini 的 `data-test-id` 當主 selector**:`gem-nav-list-item[data-test-id="conversation"]`(row)、`actions-menu-button`、`delete-button`、`confirm-button` 都是穩定屬性,不是 Angular 亂數 class。刪除/確認再加 `aria-label` 與文字 fallback(多語系)。
- **`simulateClick`**:派 `mouseover/mousedown/mouseup + click`,因為 Angular Material 選單常吃真實 pointer 事件,單純 `.click()` 打不開。
- **bottom-up 刪除**:由下往上刪,避免刪除位移 DOM 影響後續 row。
- **等 DOM 真的移除才算成功**(最多 5s),不是盲等固定秒數;卡住就派 `Escape` 關掉 dialog,避免一筆卡死整批。
- 若日後 Gemini 改結構、row 抓不到 → console 會印 `row 命中 0 筆`,在 `ROW_FALLBACKS` 補候選即可。

## 已知限制 / 之後可擴充

- 若 Gemini 改了 row 結構且候選全失效 → console 會提示,補候選即可。
- 目前刪除是「模擬點原生 UI」,不是打 API;好處是行為與手動一致、不怕動到未公開端點,壞處是速度受 UI 動畫節奏限制(`DELAY` 可調)。
- **無法做日期篩選**:Gemini 側欄的對話 row 裡不含任何時間戳(只有標題、置頂 icon、選單、對話 id),沒有可讀的日期資料。要日期得攔內部 API,不適合放這種輕量工具。
- 可擴充方向:排除置頂只選其餘、刪除前匯出對話標題備份、快捷鍵全選。
