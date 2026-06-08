# 婚禮桌次圖 PDF 匯出版型改造計畫書

> 版本：v1.0
> 日期：2026-06-08
> 參考圖：`C:/Users/jerem/Downloads/婚禮桌次位置圖_匯出.png`
> 目的：讓「匯出桌次圖 PDF」自動轉成婚禮卡片式版面；原本 `座位圖` 設計與拖拉操作畫面維持不變。
> 執行規則：每個 Phase 只能使用 `.agents/agents.md` 中的一個角色。

## 0. 目前參考檔案分工

- **角色定義**：`.agents/agents.md`
- **專案資料模型與桌機驗證範圍**：`.agents/context.md`
- **既有 Phase 0 QA matrix / 不變式**：`Plan/best-execution-plan-phase0-qa-baseline-20260604.md`
- **既有匯出契約完成紀錄**：`Plan/best-execution-plan-phase4-export-contract-20260604.md`
- **本次整體 Phase 順序與 Prompt**：`Plan/wedding-floor-pdf-layout-plan-20260608.md`

## 1. 設計讀法

Reading this as: export-only wedding stationery layout for Jeremy & Yuri, with watercolor floral corners, gold typography, clean table-grid hierarchy, leaning toward state-driven print HTML/SVG rather than screenshot capture.

本需求不是重設 `FloorPlan` 操作介面，而是替 `exportFloorPDF()` 建立新的「輸出用版型」。使用者在座位圖頁面仍然用目前深色工具型介面拖拉桌次與賓客；按下「匯出桌次圖」後，print window 內自動產生類似參考圖的 A4 直式婚禮桌次位置圖。

## 2. 核心決策

1. **畫面與匯出解耦**：不修改 `FloorPlan.jsx`、`TableZone.jsx` 的日常操作版面；只改匯出 builder 與必要的 export hook wiring。
2. **維持 state-driven export**：沿用目前 Phase 4 架構，不使用 `html2canvas` / `jspdf`，也不把 live canvas 截圖塞進 PDF。
3. **匯出採自動儀式版型**：桌次在 PDF 中用固定婚禮版型重排，不直接使用 `tablePositions`。`tablePositions` 保留給編輯畫布。
4. **主桌特殊處理**：`1桌` 或 label 含 `主桌` 的桌次在 PDF 上方中央呈現，並顯示主桌賓客名牌。
5. **一般桌自動排序**：其餘桌次以自然桌號排序後排成 4 欄網格，優先支援 20 桌內單頁輸出；超過容量時由 layout model 產生續頁，避免重疊。
6. **參考圖只作視覺依據**：不可把參考 PNG 當整頁背景，因為它含有硬編碼桌次、姓名與日期。花卉、紙張與金色線條要用獨立 print-only 樣式或靜態資產重建。

## 3. 目標版面規格

### 3.1 頁面結構

- A4 portrait，輸出時 `@page { size: A4 portrait; margin: 0; }`，內容容器自行保留安全邊界。
- 背景：暖白紙感，四角淡粉花卉與葉片裝飾，低透明度金色碎點。
- Header：
  - 大字 `Jeremy & Yuri`
  - 主標 `婚 禮 桌 次 位 置 圖`
  - 副標 `WEDDING SEATING CHART`
  - meta：列印日期、共幾桌、來源筆數、實際人數。
- Stage ribbon：`主桌 / 舞台`，置於 header 下方。
- 主桌區：置中圓桌，周圍 10 個座位，已安排者以名牌顯示，空位保留淡金圓點。
- 一般桌區：4 欄網格，自動排入 `2桌` 起的桌次，每桌顯示 `N桌` 與 `已坐 / 10`。
- Legend：底部置中，顯示 `新郎親友 / 新娘親友 / 共同朋友 / 同事 / 其他 / 自訂分類` 的顏色圓點。
- 未分配賓客：若存在未分配 seat-unit，PDF 必須以底部警示或續頁清單顯示，不可靜默遺漏。

### 3.2 資料規則

- PDF 內的 guest count 必須等於 `state.guests.length`。
- 桌次占用數以 `table.guestIds` 中有效 guest ID 為準。
- 已排桌與未分配 guests 都要能在 PDF 內追溯，不得只輸出已安排者。
- 主桌判定順序：
  1. label 完全等於 `主桌`
  2. label 包含 `主桌`
  3. label 可解析為 `1桌`
  4. fallback 為 `tables[0]`
- 桌次排序使用自然排序：數字桌號優先，無數字 label 維持原始順序後置。
- 所有 visible text 必須 HTML escape，避免姓名中的特殊字元破壞 print HTML。
- 匯出日期應用瀏覽器本地日期，不應用 UTC `toISOString()` 造成台灣時區跨日誤差。

### 3.3 視覺限制

- 不新增大型 npm 套件。
- 不在 app 操作介面引入花卉背景或婚禮卡片樣式。
- print HTML 可使用系統中文字體與 cursive fallback；若使用 Google Fonts，必須確認字體載入不會讓 print dialog 在字體完成前觸發。
- 花卉資產若改用圖片，必須放在 `public/export/` 或 `src/assets/`，不可依賴使用者 Downloads 路徑。

## 4. Phase 與角色對應

| 順序 | Phase | 使用角色 | 主責成果 | 狀態 |
| --- | --- | --- | --- | --- |
| 0 | 匯出基線與不變式盤點 | `@qa` | 建立 PDF 匯出 QA matrix、確認目前 state-driven export 契約 | 已完成 |
| 1 | 婚禮版型視覺規格 | `@designer` | 把參考圖轉成可實作的 print-only typography、layout、asset spec | 已完成 |
| 2 | 匯出資料模型與排版演算法 | `@engineer` | 新增或整理 export layout model、主桌判定、自然排序、分頁與測試 | 已完成 |
| 3 | 婚禮版型 print renderer | `@designer` | 實作 print HTML/SVG/CSS 視覺，保持操作畫面不變 | 已完成 |
| 4 | 匯出接線與契約測試 | `@engineer` | 將新 renderer 接到 `exportFloorPDF()`，補 smoke script 與 build/lint | 已完成 |
| 5 | 最終視覺與資料 QA Gate | `@qa` | 驗證 PDF 版面、資料一致性、無 UI 回歸，決定 Approve/Block | 已完成（Approve） |

## 5. Phase 詳細規格

### Phase 0：匯出基線與不變式盤點

角色：`@qa`

目的：在修改前凍結現有匯出契約，避免後續只追求好看卻讓資料錯誤。

必做：

1. 讀取 `.agents/context.md`、`.agents/agents.md`、本計畫書、`Plan/best-execution-plan-phase0-qa-baseline-20260604.md`。
2. 檢查現有 `useExport()`、`floorPrintHTMLBuilder.js`、`exportShared.js`、`printWindow.js` 與 `scripts/check-phase4-export-contract.mjs`。
3. 建立 `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`。
4. 定義至少下列 QA matrix：
   - `PDF-LAYOUT-01`：guest count 與 state 一致。
   - `PDF-LAYOUT-02`：主桌判定正確。
   - `PDF-LAYOUT-03`：20 桌內單頁不重疊。
   - `PDF-LAYOUT-04`：超過 20 桌不重疊或有明確續頁。
   - `PDF-LAYOUT-05`：類別 legend 與目前 guests 類別一致。
   - `PDF-LAYOUT-06`：操作畫面 `FloorPlan` 不受匯出樣式影響。
   - `PDF-LAYOUT-07`：未分配 guests 在 PDF 內有明確提示或清單。
   - `PDF-LAYOUT-08`：姓名、桌名、群組名含 `<`、`&`、`"` 時不破版且不可注入 HTML。

驗收：

- 不修改 `src/`。
- 產出 baseline 文件與 matrix。
- `node scripts/check-phase4-export-contract.mjs` 通過；若失敗，先查 `D:\AI知識庫\lessons\` 再處理或記錄阻塞。

### Phase 1：婚禮版型視覺規格

角色：`@designer`

目的：先把參考圖拆成精確的 print spec，避免後續 engineer 猜視覺。

必做：

1. 讀取本計畫書、Phase 0 baseline、`.agents/context.md`。
2. 建立 `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`。
3. 定義：
   - A4 尺寸、安全邊界、header 高度、stage ribbon 高度。
   - 主桌尺寸、座位 orbit、名牌位置。
   - 一般桌 4 欄網格尺寸、行距、最多單頁桌數。
   - 顏色 token：金色線條、粉色、紫色、綠色、灰色、背景紙色。
   - 花卉裝飾策略：inline SVG/CSS 裝飾或 `public/export/` 靜態資產。
   - 字體策略：中英標題、姓名、桌號與 meta 的 fallback stack。
4. 指定空桌、滿桌、部分入座、長姓名、客製分類的視覺規則。

限制：

- 本 Phase 不改核心資料模型。
- 不把整張參考 PNG 當背景。
- 不修改操作畫面的 dark-mode 工具 UI。

驗收：

- 視覺規格足以讓 Phase 2/3 不再猜尺寸。
- 規格明確寫出若資產缺失時的 fallback。

### Phase 2：匯出資料模型與排版演算法

角色：`@engineer`

目的：先把資料排序、分頁、主桌判定與座標計算做成純函式，再交給 designer 套樣式。

建議範圍：

- `src/utils/floorPrintHTMLBuilder.js`
- 可新增 `src/utils/weddingFloorPrintLayout.js`
- `src/utils/exportShared.js`
- `scripts/check-phase4-export-contract.mjs` 或新增 `scripts/check-wedding-floor-pdf-layout.mjs`

必做：

1. 建立純函式 layout model，例如 `buildWeddingFloorLayoutModel(state)`。
2. 輸出結構至少包含：
   - `meta`
   - `mainTable`
   - `regularTablePages`
   - `legendItems`
   - `categoryVisuals`
   - `warnings`
3. 實作主桌判定、桌次自然排序、有效 guest map、空位補齊、超過 20 桌分頁。
4. 修正或新增本地日期格式化，避免 UTC 跨日。
5. 補 Node smoke，驗證資料計數、排序、主桌與分頁。

限制：

- 不碰 `FloorPlan.jsx` 與拖拉流程。
- 不新增 npm dependencies。
- 不在此 Phase 做大幅視覺 CSS。

驗收：

- `node scripts/check-wedding-floor-pdf-layout.mjs` 或等價 smoke 通過。
- 既有 `node scripts/check-phase4-export-contract.mjs` 通過。
- `npm run lint` 通過。

### Phase 3：婚禮版型 print renderer

角色：`@designer`

目的：用 Phase 1 規格與 Phase 2 layout model 產生參考圖風格的 print HTML/SVG。

建議範圍：

- `src/utils/floorPrintHTMLBuilder.js`
- 可新增 `src/utils/weddingFloorPrintRenderer.js`
- 可新增 `public/export/` 靜態裝飾資產

必做：

1. 實作 A4 portrait print page。
2. Header 顯示 `Jeremy & Yuri`、`婚禮桌次位置圖`、`WEDDING SEATING CHART` 與 meta。
3. 實作 stage ribbon、主桌、一般桌網格、legend。
4. 對主桌與已入座的一般桌顯示姓名名牌；空位維持淡金座位圓點。
5. 長姓名要有截斷或分行策略，不可溢出名牌。
6. 若因空間限制截斷姓名，仍需保留可追溯完整名單的區塊或續頁，不可讓匯出遺漏完整姓名。
7. 花卉裝飾必須是 print-only，不影響 app 操作畫面。

限制：

- 本 Phase 不更動 `App.jsx` 主流程。
- 不改 Firebase / Google Sheets / DnD 邏輯。
- 不讓 PDF renderer 依賴 DOM snapshot。

驗收：

- 產生的 HTML 包含 header、stage、main table、regular tables、legend。
- A4 直式下 20 桌內不重疊。
- `npm run lint` 通過。

### Phase 4：匯出接線與契約測試

角色：`@engineer`

目的：把新 wedding renderer 接到正式「匯出桌次圖」流程，並把測試納入現有 export contract。

建議範圍：

- `src/hooks/useExport.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/printWindow.js`
- `src/components/DashboardHome.jsx`
- `src/components/Toolbar.jsx`
- `scripts/check-phase4-export-contract.mjs`
- `package.json`

必做：

1. 確認 `exportFloorPDF()` 使用新婚禮版型。
2. 若保留舊現場座標版型，需命名清楚，避免使用者混淆；預設匯出採新婚禮版型。
3. 擴充 smoke script：
   - HTML 內有 `Jeremy & Yuri`。
   - meta 統計正確。
   - `主桌 / 舞台` 存在。
   - 類別 legend 完整。
   - 特殊字元姓名有 escape。
   - 未分配 guests 沒有被靜默遺漏。
4. 確認 `openPrintDocument()` one-shot guard 沒退化。
5. 執行 lint/build；若 Vite/Rolldown sandbox `spawn EPERM` 重現，依既有 lesson 用核准方式重跑並記錄。

限制：

- 不新增 `html2canvas` / `jspdf`。
- 不改 Google Sheets sync output schema。
- 不改 Firebase schema。

驗收：

- `node scripts/check-phase4-export-contract.mjs` 通過。
- `npm run lint` 通過。
- `npm run build` 通過或有已知 sandbox EPERM 與成功重跑證據。

### Phase 5：最終視覺與資料 QA Gate

角色：`@qa`

目的：以使用者角度確認 PDF 自動變成參考圖風格，同時證明座位設計畫面未被改壞。

必做：

1. 讀取 Phase 0 baseline、Phase 1 spec、Phase 2-4 完成紀錄。
2. 依 QA matrix 驗證：
   - 10 人硬限制。
   - guest count 完整性。
   - 主桌與一般桌排序。
   - legend 類別顏色。
   - 20 桌範例版面不重疊。
   - 未分配 guests 有提示或清單。
   - 特殊字元姓名不破版。
   - `FloorPlan` 操作畫面樣式不受 print CSS 影響。
3. 使用桌機瀏覽器或可替代的 local print HTML 預覽檢查。
4. 輸出 `Plan/wedding-floor-pdf-layout-phase5-final-qa-20260608.md`。

驗收：

- 結論必須是 `Approve` 或 `Block`。
- 若 Block，列出重現步驟、實際結果、預期結果、相關檔案與建議交回角色。
- 若 Approve，列出驗證證據與剩餘低風險項。

## 6. 風險與對策

| 風險 | 影響 | 對策 |
| --- | --- | --- |
| 參考圖被誤用為背景 | PDF 內容硬編碼、資料錯誤 | 僅抽象視覺，不使用整張 PNG |
| 字體未載入就觸發列印 | 標題樣式跳動 | 使用可靠 fallback，必要時調整 print trigger 延遲 |
| 20 桌以上重疊 | 大型名單輸出不可用 | Phase 2 做分頁 model |
| 長姓名溢出 | 名牌破版 | Phase 3 定義截斷/分行策略 |
| print CSS 汙染 app UI | 操作畫面變形 | CSS 僅存在 print document HTML，不匯入 App CSS |
| 資料好看但不正確 | 場地方拿到錯誤桌次 | Phase 0/4/5 強制 state count 與 export count 一致 |

## 7. 本計畫自審

- 已符合「一個 Phase 一個角色」：Phase 0/5 為 `@qa`，Phase 1/3 為 `@designer`，Phase 2/4 為 `@engineer`。
- 已把視覺設計、資料模型、renderer、接線、QA 拆開，避免同一 Phase 混用角色責任。
- 已明確保留原本座位設計畫面不變。
- 已對應目前專案的 state-driven print export 架構，不引入 screenshot PDF 與大型新依賴。
- 已把 Phase 執行 Prompt 放在文件最後，後續可直接逐 Phase 貼給角色。

## 8. Phase 執行提示詞

以下 Prompt 每次只貼一個 Phase。每個 Phase 完成回報都必須包含：實際修改檔案、跑過的 QA matrix ID、未跑項目與原因、驗證命令與結果、是否仍有 P0/P1、殘留風險與下一個建議 Prompt。Runtime 驗證以桌機 Browser/Chrome 為準；除非另有明確需求，不做 mobile/tablet 視覺驗證。若 Phase 中發現主責角色不適合，必須停止並先修正本計畫，不可混用第二個角色。

### Phase 0 Prompt

使用角色：`@qa`

```text
請以 `.agents/agents.md` 中的 @qa 角色執行 Phase 0：匯出基線與不變式盤點。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`

目標：
- 在不修改產品功能的前提下，盤點目前桌次圖 PDF 匯出契約。
- 確認現有匯出是 state-driven print HTML/SVG，不依賴 live canvas 截圖。
- 建立本次婚禮版型改造的 QA matrix 與不變式。

建議讀取：
- `src/hooks/useExport.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/exportShared.js`
- `src/utils/printWindow.js`
- `scripts/check-phase4-export-contract.mjs`

限制：
- 本 Phase 只能由 @qa 執行。
- 不修改 `src/`。
- 不改 UI、不改資料模型、不新增套件。
- 若遇到錯誤，先搜尋 `D:\AI知識庫\lessons\` 再判斷修復或記錄阻塞。

輸出：
- 建立 `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`。
- 文件中至少包含 PDF-LAYOUT-01 到 PDF-LAYOUT-08 的驗收矩陣。

驗收：
- `node scripts/check-phase4-export-contract.mjs` 通過。
- 明確列出後續 Phase 不可破壞的不變式。
- 完成回報需列出本 Phase 建立的 matrix ID。
```

### Phase 1 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 1：婚禮版型視覺規格。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`

參考圖：
- `C:/Users/jerem/Downloads/婚禮桌次位置圖_匯出.png`

目標：
- 將參考圖拆成可實作的 print-only 規格。
- 定義 A4 portrait、header、stage ribbon、主桌、一般桌網格、legend、花卉裝飾、字體與顏色。
- 明確寫出空桌、滿桌、部分入座、長姓名、自訂分類的視覺處理。

限制：
- 本 Phase 只能由 @designer 執行。
- 不把整張參考 PNG 當背景。
- 不修改 `FloorPlan` 操作畫面。
- 不改 Firebase、Google Sheets、DnD 或核心資料模型。

輸出：
- 建立 `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`。
- 規格必須足以讓 Phase 2/3 直接照尺寸與視覺規則實作。

驗收：
- 規格包含資產缺失 fallback。
- 規格明確區分 print-only 樣式與 app 操作樣式。
- 完成回報需列出對應到 PDF-LAYOUT matrix 的視覺驗收項。
```

### Phase 2 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 2：匯出資料模型與排版演算法。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`

目標：
- 建立 export-only layout model，讓 PDF 可以自動排成婚禮版型。
- 實作主桌判定、桌次自然排序、有效 guest map、空位補齊與超過 20 桌分頁。
- 修正或新增本地日期格式化，避免 UTC 跨日。

建議範圍：
- `src/utils/floorPrintHTMLBuilder.js`
- 可新增 `src/utils/weddingFloorPrintLayout.js`
- `src/utils/exportShared.js`
- `scripts/check-phase4-export-contract.mjs`
- 可新增 `scripts/check-wedding-floor-pdf-layout.mjs`

限制：
- 本 Phase 只能由 @engineer 執行。
- 不碰 `FloorPlan.jsx`、`TableZone.jsx`、拖拉流程。
- 不新增 npm dependencies。
- 不做大幅視覺 CSS。

驗收：
- 新增或更新的 Node smoke 驗證資料計數、主桌、排序、分頁與 HTML escape。
- 既有 `node scripts/check-phase4-export-contract.mjs` 通過。
- `npm run lint` 通過。
- 完成回報需列出跑過哪些 PDF-LAYOUT matrix ID，以及未跑項目原因。
```

### Phase 3 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 3：婚禮版型 print renderer。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- Phase 2 完成紀錄與新增 layout model

目標：
- 使用 Phase 2 的 layout model 產生參考圖風格的 A4 print HTML/SVG。
- Header 顯示 `Jeremy & Yuri`、`婚禮桌次位置圖`、`WEDDING SEATING CHART` 與 meta。
- 實作 stage ribbon、主桌、一般桌 4 欄網格、底部 legend、花卉角落裝飾。
- 已安排賓客要以名牌或清楚標籤顯示；空位保留淡金座位圓點。

建議範圍：
- `src/utils/floorPrintHTMLBuilder.js`
- 可新增 `src/utils/weddingFloorPrintRenderer.js`
- 可新增 `public/export/` print-only 靜態裝飾資產

限制：
- 本 Phase 只能由 @designer 執行。
- 不修改 `App.jsx` 主流程。
- 不改 Firebase、Google Sheets、DnD 邏輯。
- 不讓 renderer 依賴 DOM snapshot。
- print CSS 不可汙染 app 操作畫面。

驗收：
- 產生的 HTML 包含 header、stage、main table、regular tables、legend。
- A4 直式下 20 桌內不重疊。
- 長姓名不溢出名牌。
- `npm run lint` 通過。
- 完成回報需列出跑過哪些 PDF-LAYOUT matrix ID，以及未跑項目原因。
```

### Phase 4 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 4：匯出接線與契約測試。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- Phase 2/3 完成紀錄

目標：
- 將正式 `exportFloorPDF()` 接到新的婚禮版型 renderer。
- 擴充 export smoke，確保輸出資料正確、print one-shot guard 不退化。
- 若保留舊現場座標版型，命名必須清楚；預設「匯出桌次圖」使用新婚禮版型。

建議範圍：
- `src/hooks/useExport.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/printWindow.js`
- `src/components/DashboardHome.jsx`
- `src/components/Toolbar.jsx`
- `scripts/check-phase4-export-contract.mjs`
- `package.json`

限制：
- 本 Phase 只能由 @engineer 執行。
- 不新增 `html2canvas` / `jspdf`。
- 不改 Google Sheets sync output schema。
- 不改 Firebase schema。

驗收：
- `node scripts/check-phase4-export-contract.mjs` 通過。
- 若有 `scripts/check-wedding-floor-pdf-layout.mjs`，也必須通過。
- `npm run lint` 通過。
- `npm run build` 通過；若 sandbox 出現既有 Vite/Rolldown `spawn EPERM`，請依既有 lesson 用核准方式重跑並記錄。
- 完成回報需列出跑過哪些 PDF-LAYOUT matrix ID，以及未跑項目原因。
```

### Phase 5 Prompt

使用角色：`@qa`

```text
請以 `.agents/agents.md` 中的 @qa 角色執行 Phase 5：最終視覺與資料 QA Gate。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- Phase 2、Phase 3、Phase 4 完成紀錄

目標：
- 驗證匯出桌次圖 PDF 已自動轉為參考圖風格。
- 證明原本 `座位圖` 設計與拖拉操作畫面未被改壞。
- 驗證資料一致性：guest count、主桌、一般桌排序、legend、20 桌版面、超過 20 桌處理。

驗證重點：
- 10 人桌硬限制仍成立。
- PDF guest count 等於 app state guest count。
- 主桌判定符合計畫書規則。
- 類別 legend 與 guests 類別一致。
- 20 桌內 A4 直式版面不重疊。
- print CSS 不影響 `FloorPlan` 操作畫面。
- 桌機瀏覽器可正常開啟匯出 print window。

限制：
- 本 Phase 只能由 @qa 執行。
- 不新增功能。
- 不使用 subagent；依 `.agents/agents.md` 的 @qa protocol 分批讀取 source review，runtime verification 另行執行。
- 若 Block，只列重現與交回角色，不直接混入修復。

輸出：
- 建立 `Plan/wedding-floor-pdf-layout-phase5-final-qa-20260608.md`。
- 結論必須是 `Approve` 或 `Block`。
- Approve 時列驗證證據與剩餘低風險項。
- Block 時列重現步驟、實際結果、預期結果、相關檔案與應交回的角色。
```
