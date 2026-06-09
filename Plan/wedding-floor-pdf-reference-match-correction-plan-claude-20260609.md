# 婚禮桌次圖匯出修正計畫書

> **生產者：Claude (Claude Opus 4.6 Thinking)**
> 日期：2026-06-09
> 狀態：計畫書，待使用者批准後執行
> 不使用角色：`@qa`

## 1. 背景

使用者提供兩張圖：

- 第一張：目前實際匯出結果。
- 第二張：目標參考圖。

本計畫遵守一個 Phase 只對應一個 `.agents/agents.md` 角色。若某 Phase 發現需要其他角色，必須停止並交棒，不得混用角色。

## 2. 差異分析

> [!IMPORTANT]
> 以下每項差異都附上對照說明，確保修正後完全吻合目標圖。

### 差異 1 — 主桌（1桌）座位配置方式

| 當前輸出 | 目標設計 |
|---------|---------|
| 連結線（connector）從圓心射出連接到外側姓名標籤，像心智圖 | **無連結線**。賓客姓名直接排列在圓桌周圍的座位點旁邊，姓名標籤緊貼座位點，無需連結線 |
| 座位點有但被連結線遮蓋 | 座位點清晰可見，空座位為空心圓點 |
| 中央為桌號文字 "1桌 7/10" | 中央有**花卉水彩插圖**（玫瑰花束），桌號 & 座位數不在中央或不顯示在主桌圓內 |

### 差異 2 — 主桌周圍姓名標籤佈局

| 當前輸出 | 目標設計 |
|---------|---------|
| 姓名標籤集中在左右兩側垂直排列（4左、4右），類似 org chart | 姓名標籤均勻**圍繞圓桌**分佈，上、左上、左、左下、下、右下、右、右上等方位各有標籤 |
| 標籤距離桌圓較遠 | 標籤緊貼座位點外側，距離很近 |

### 差異 3 — 一般桌次（2桌 ~ 20桌）排列佈局

| 當前輸出 | 目標設計 |
|---------|---------|
| 只顯示 5 桌（1桌~5桌） | 顯示所有 **20 桌**，整齊排在主桌下方 |
| 桌次大小不一致：主桌很大，2~5桌縮在底部一排 | 主桌稍大但合理，2~20 桌均為等大圓形，排成 **4 欄 × 5 列**的整齊網格 |
| 有姓名標籤的桌次（如2桌）用連結線連姓名 | 每個桌次圓形周圍有 10 個座位點（已入座的為實心色點、未入座的為空心），**無連結線**，有賓客的桌次在座位點旁邊顯示小姓名標籤即可 |

### 差異 4 — 花卉裝飾

| 當前輸出 | 目標設計 |
|---------|---------|
| 四角有小型 SVG 花卉裝飾，但尺寸偏小且不夠華麗 | 四角有**大型水彩玫瑰花卉裝飾**，左上和右上特別大，左下和右下也有大朵花卉，填滿邊角形成華麗的婚禮邊框 |
| 使用 CSS SVG 生成的簡筆花朵 | 使用更寫實的**水彩花卉**風格，有粉紅色玫瑰、綠葉、小花苞 |

### 差異 5 — 座位圖例（Legend）

| 當前輸出 | 目標設計 |
|---------|---------|
| 可能在頁面底部但不夠顯眼 | 明確的**「座位圖例」**區塊，有標題（含裝飾線），下方列出：● 新郎親友（紫）● 新娘親友（粉）● 共同朋友（綠）● 同事（金）● 其他（灰）|

### 差異 6 — 整體間距與比例

| 當前輸出 | 目標設計 |
|---------|---------|
| 主桌佔據頁面過大面積，一般桌擠在底部 | 主桌佔約 25% 面積，一般桌次網格佔 60%，圖例佔 10%，整體比例均衡 |
| 一般桌次間距不均 | 4 欄等間距，行距一致 |

---

## 3. 修正邊界

必須做：

1. 保持正式匯出為 state-driven print HTML/SVG。
2. 第一頁必須是 A4 portrait 構圖，不是橫向 viewport 截圖。
3. 第一頁在 20 桌情境下應完整呈現主桌、2-20 桌與圖例。
4. 所有 wedding print CSS 仍必須限制在 `.wfp-` print document，不污染互動式 `FloorPlan`。

不得做：

1. 不使用 `@qa` Phase。
2. 不把第二張圖或目前截圖當整頁背景。
3. 不重新引入 `html2canvas` / `jspdf`。
4. 不改 Firebase、Google Sheets sync、DnD、互動式 `FloorPlan` 操作畫面。
5. 不為了像參考圖而硬編碼固定姓名、日期或桌次資料。

---

## 4. 受影響檔案

| 檔案 | 角色 | 變更類型 |
|------|------|---------|
| `src/utils/weddingFloorPrintRenderer.js` | @designer | 花卉裝飾重繪、CSS 樣式重構、連結線移除 |
| `src/utils/weddingFloorPrintLayout.js` | @engineer | 佈局模型邏輯、桌次分頁、間距常數 |
| `src/utils/weddingFloorSeatAnnotations.js` | @engineer | 標籤放置策略（去掉 connector、改為圍繞式佈局） |
| `src/utils/floorPrintHTMLBuilder.js` | @engineer | 入口函式微調 |

---

## 5. Phase 總覽

| Phase | 對應角色 | 目的 | 主要輸出 |
| --- | --- | --- | --- |
| Phase 1 | `@designer` | 花卉裝飾升級 & CSS 視覺重構 | 花卉 SVG 重繪、色彩調整、主桌中央花卉、連結線隱藏 |
| Phase 2 | `@engineer` | 佈局引擎重構（間距 & 比例 & 標籤策略） | 移除 connector、標籤環繞式、主桌縮小、4×5 網格 |
| Phase 3 | `@designer` | 渲染整合 & 最終微調 | 比例驗證、花卉不遮擋、座位點效果、列印測試 |

---

## 6. Phase 詳細計畫

### Phase 1 — 花卉裝飾升級 & CSS 視覺重構

**角色**：`@designer`

**目標**：

1. 將四角花卉裝飾從簡筆 SVG 升級為水彩風格的大型花卉裝飾，參照目標圖中左上、右上、左下、右下的大朵玫瑰花叢效果
2. 增大花卉尺寸，讓它們填滿頁面邊角，形成華麗的婚禮邊框
3. 調整 CSS `--wfp-rose-petal`、`--wfp-rose-soft`、`--wfp-leaf-soft` 等色彩變數，讓花朵更接近目標圖的暖粉色水彩感
4. 主桌中央改為花卉水彩圖案（SVG 玫瑰花束），取代純文字桌號
5. 移除連結線（connector）相關的所有 CSS 樣式（`.wfp-seat-connector` 全部設為不顯示或直接移除）

**修改檔案**：

- `src/utils/weddingFloorPrintRenderer.js`：`renderFloralDecorations()` 花卉 SVG 全面重繪、`renderStyles()` CSS 重構、新增主桌中央花卉 SVG
- 連結線 CSS（`.wfp-seat-connector`）opacity 設為 0 或移除渲染

---

### Phase 2 — 佈局引擎重構（間距 & 比例 & 標籤策略）

**角色**：`@engineer`

**目標**：

1. 調整主桌區域尺寸比例：從目前佔據 `130mm × 50mm` 調小為約 `100mm × 42mm`，讓一般桌次有更多空間
2. 調整一般桌次網格起始位置（`gridTop`），從 `111mm` 降低到約 `108mm`，配合主桌區域的縮小
3. 調整一般桌次 cell 尺寸：增大 `width` 和 `height`，確保 4 欄等寬排列，行距一致
4. 調整 `FIRST_PAGE_REGULAR_TABLE_CAPACITY` 為 19（保持不變或微調）確保 20 桌全部能在合理的分頁中顯示
5. 修改 `weddingFloorSeatAnnotations.js` 中的標籤放置策略：
   - 將 `SIDE_SLOT_ORDER` 改為環繞式（上/右上/右/右下/下/左下/左/左上），不再集中在左右兩側
   - 移除 connector 生成邏輯（`connectorForPlacement` 不再呼叫或回傳 null）
   - 標籤直接緊貼座位點外側放置，gap 縮小

**修改檔案**：

- `src/utils/weddingFloorSeatAnnotations.js`：`MAIN_OVERVIEW_GEOMETRY`、`REGULAR_OVERVIEW_GEOMETRY`、`SIDE_SLOT_ORDER`、`connectorForPlacement` 等
- `src/utils/weddingFloorPrintLayout.js`：`FIRST_PAGE_REGULAR_TABLE_CAPACITY`、`buildOverviewProtectedRegions` 間距
- `src/utils/weddingFloorPrintRenderer.js`：`renderSeatConnectors()` 移除或跳過、`renderAnnotatedTable()` 不再呼叫連結線渲染

---

### Phase 3 — 渲染整合 & 微調

**角色**：`@designer`

**目標**：

1. 確認 Phase 1 + Phase 2 的修改整合後，匯出結果與目標圖一致
2. 微調以下視覺細節：
   - 座位圖例（Legend）區塊的位置、標題樣式、間距
   - 主桌座位點 dot 大小與空座位外觀
   - 一般桌次中已入座的座位點顏色飽和度
   - 頁面整體 padding 和 margin
3. 確認花卉裝飾不會遮擋桌次內容
4. 確認所有桌次（1~20）在 A4 紙上清晰可讀
5. 使用瀏覽器列印功能實際測試 PDF 輸出效果

**修改檔案**：

- `src/utils/weddingFloorPrintRenderer.js`：CSS 微調、Legend 樣式修正
- `src/utils/weddingFloorSeatAnnotations.js`：geometry 常數微調

---

## 7. 各 Phase 執行提示詞

以下每次只貼一個 Phase。每個 Phase 一次只能使用指定角色；若發現需要其他角色，停止並回報，不要混用角色。

### Phase 1 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 1：花卉裝飾升級 & CSS 視覺重構。

先讀取 `.agents/context.md` 瞭解專案架構，然後讀取以下檔案：
- `src/utils/weddingFloorPrintRenderer.js`（完整檔案）

你的任務：修改匯出桌次圖的花卉裝飾與視覺樣式。目標是讓輸出更接近婚禮邀請卡的水彩風格。

具體修改：

1. **花卉裝飾升級**（`renderFloralDecorations()`）：
   - 將現有的簡筆 SVG 花朵重繪為更大型、更華麗的水彩風格花卉
   - 左上角：最大朵，含 3-4 朵重疊的粉色玫瑰、綠葉枝條、小花苞，尺寸約 65mm × 60mm
   - 右上角：2-3 朵玫瑰 + 綠葉，尺寸約 55mm × 50mm
   - 左下角：2 朵玫瑰 + 散落花瓣，尺寸約 58mm × 54mm
   - 右下角：最大朵，3-4 朵玫瑰 + 綠葉，尺寸約 68mm × 62mm
   - 花瓣使用多層 ellipse 疊加，每朵花至少 5-6 片花瓣，中心有花蕊圓點
   - 葉子使用橢圓+旋轉，每叢花至少 4-5 片葉子
   - 增加小花苞（小圓 + 小花瓣），分散在主花周圍

2. **色彩調整**（`renderStyles()` 中的 CSS 變數）：
   - `--wfp-rose-petal` 調整為更飽和的暖粉色
   - `--wfp-rose-soft` 調整為淡粉色
   - 新增 `--wfp-rose-deep` 用於花蕊和深色花瓣層
   - `--wfp-leaf-soft` 調淡，讓葉子更像水彩渲染

3. **主桌中央花卉**：
   - 在 `renderTableCore()` 或 `renderMainTable()` 中，為主桌的 `.wfp-table-core--main` 加入一個裝飾性的小型花卉 SVG 作為背景
   - 花卉尺寸約與桌圓直徑相同
   - 桌號文字可以疊在花卉上方或移到花卉下方

4. **連結線隱藏**：
   - 在 CSS 中將 `.wfp-seat-connector` 設為 `display: none`
   - 或將 `.wfp-annotation-connectors` 設為 `display: none`
   - 這樣就不會渲染連結線，但不需要改邏輯檔案（Phase 2 會處理）

不要修改 `weddingFloorPrintLayout.js` 或 `weddingFloorSeatAnnotations.js`，那是 Phase 2 @engineer 的工作。

修改完成後，在終端運行 `npm run dev` 驗證 build 通過。

限制：
- 本 Phase 只能由 @designer 執行。
- 不使用 @qa。

完成回報：
- 列出修改檔案。
- 列出已修正的視覺項目。
- 列出下一 Phase 交給 @engineer 的需求。
```

---

### Phase 2 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 2：佈局引擎重構。

先讀取 `.agents/context.md` 瞭解專案架構，然後讀取以下檔案：
- `src/utils/weddingFloorSeatAnnotations.js`（完整檔案）
- `src/utils/weddingFloorPrintLayout.js`（完整檔案）
- `src/utils/weddingFloorPrintRenderer.js`（只看 renderSeatConnectors 和 renderAnnotatedTable 函式）

你的任務：重構佈局引擎，讓匯出的桌次圖佈局更合理，並移除連結線邏輯。

具體修改：

1. **移除連結線**（`weddingFloorSeatAnnotations.js`）：
   - `connectorForPlacement()` 改為回傳 `null`
   - 或在 `allocatePlacement()` 中不再呼叫 `connectorForPlacement()`，placement 的 connector 設為 null

2. **標籤放置策略改為環繞式**（`weddingFloorSeatAnnotations.js`）：
   - 修改 `SIDE_SLOT_ORDER`，讓 10 個座位的標籤分散到上/右上/右/右下/下/左下/左/左上 8 個方位
   - 每個方位最多放 2 個標籤
   - 標籤應緊貼座位點外側，`labelGap` 縮小為 0.6mm
   - `labelBoxes` 的尺寸微調，讓標籤框不要太大

3. **主桌區域縮小**（`weddingFloorSeatAnnotations.js`）：
   - `MAIN_OVERVIEW_GEOMETRY.groupBox` 從 `{ x:27, y:62, width:130, height:50 }` 調整為更合理的尺寸
   - 目標：主桌圓和標籤佔約頁面上方 30% 的空間

4. **一般桌次網格間距調整**（`weddingFloorSeatAnnotations.js`）：
   - `getRegularTableOverviewGroupBox()` 中調整 cell 大小和間距
   - 確保 4 欄 × 5 列排列，20 桌（含主桌 = 19 桌一般桌）都能放下
   - 行距和列距均等

5. **佈局保護區調整**（`weddingFloorPrintLayout.js`）：
   - `buildOverviewProtectedRegions()` 中的 `main-table-band` 區域要和主桌新尺寸一致
   - `legend` 區域位置和尺寸不變

6. **渲染器清理**（`weddingFloorPrintRenderer.js`）：
   - `renderSeatConnectors()` 改為直接 return ''（空字串）
   - `renderAnnotatedTable()` 不再呼叫 `renderSeatConnectors()`
   - 但保留函式簽名，避免影響其他呼叫端

修改完成後：
- 確認 `npm run dev` build 通過
- 測試匯出功能：在瀏覽器開啟 app → 工具列 → 匯出 → 桌次圖 → 確認佈局合理

限制：
- 本 Phase 只能由 @engineer 執行。
- 不改花卉、字體、顏色等視覺細節。
- 不改 Firebase、Google Sheets、DnD 或互動式 `FloorPlan`。
- 不使用 @qa。

完成回報：
- 列出修改檔案。
- 說明如何避免 screen/preview 上半部裁切。
- 說明主桌與一般桌 geometry 如何支援 Phase 3 視覺。
```

---

### Phase 3 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 3：渲染整合 & 最終微調。

先讀取 `.agents/context.md`，然後讀取以下檔案了解 Phase 1 & 2 的變更結果：
- `src/utils/weddingFloorPrintRenderer.js`（完整檔案）
- `src/utils/weddingFloorSeatAnnotations.js`（只看 geometry 常數）
- `src/utils/weddingFloorPrintLayout.js`（只看分頁常數）

你的任務：最終視覺微調與驗證。Phase 1 已升級花卉裝飾，Phase 2 已重構佈局引擎。現在需要確認兩者整合後的效果是否吻合目標。

請使用 Chrome DevTools 的截圖功能或在瀏覽器中實際操作匯出功能來驗證。

具體檢查與微調：

1. **整體比例檢查**：
   - 使用 app 匯出桌次圖 PDF，截圖確認比例
   - 主桌佔頁面上方約 25-30%
   - 一般桌次 4 × 5 網格佔中間 55-60%
   - 圖例佔底部 10%

2. **花卉裝飾不遮擋內容**：
   - 確認四角花卉不遮擋桌次圓圈或姓名標籤
   - 如有遮擋，微調花卉尺寸或位置（.wfp-floral--* CSS）

3. **座位點視覺效果**：
   - 已入座的座位點要顯示對應分類顏色（紫/粉/綠/金/灰）
   - 空座位為帶虛線邊框的空心圓
   - 座位點大小適中，不被姓名標籤遮住

4. **圖例（Legend）樣式**：
   - 確認「座位圖例」標題有裝飾線
   - 5 個分類顏色圓點 + 文字清晰可見
   - 位置在頁面底部居中

5. **字型與排版**：
   - 'Imperial Script' 字型用於 "Jeremy & Yuri"
   - 'Noto Serif TC' 用於中文標題
   - 'Noto Sans TC' 用於一般文字
   - 確認所有字型在匯出 HTML 中正確載入

6. **列印測試**：
   - 使用瀏覽器列印對話框（Ctrl+P），選 A4，確認列印預覽清晰可讀
   - 確認色彩在列印模式下正確（print-color-adjust: exact）

限制：
- 本 Phase 只能由 @designer 執行。
- 不使用 @qa。

微調完成後，列出已修正落差與仍不同但可接受的項目。
```

---

## 8. 驗證計畫

### 自動驗證

```bash
npm run dev    # 確認 build 通過、無 console error
```

### 手動驗證

1. 開啟 app → 匯入/建立 20 桌測試資料
2. 工具列 → 匯出 → 桌次圖
3. 比對匯出結果與目標圖片
4. 使用 Ctrl+P 確認列印預覽效果
