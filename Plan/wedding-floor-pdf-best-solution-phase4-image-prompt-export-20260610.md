# 婚禮桌次圖匯出最佳解 Phase 4 設計圖檔與 AI Prompt 匯出

日期：2026-06-10
執行角色：`@engineer`
狀態：Phase 4 完成
來源計畫：`Plan/wedding-floor-pdf-best-solution-plan-20260609.md`

## 1. 目標

本 Phase 新增座位圖設計畫面的圖檔匯出與 AI 生圖提示詞匯出。PNG / SVG / PDF 共用 Phase 1-3 的 source-position layout model 與 `buildWeddingFloorDesignSvg()`，避免圖檔匯出與正式 PDF 產生不同桌位或姓名位置。

## 2. 修改檔案

- `src/utils/floorDesignImageExport.js`
  - 新增 `buildFloorDesignSvgExport(state, options)`。
  - 使用 `buildFloorDesignLayoutModel()` 建立共用 layout signature。
  - 使用 `buildWeddingFloorDesignSvg()` 輸出同一份 A4 portrait SVG。
  - 新增 SVG Blob 與 PNG canvas render helper；PNG 使用瀏覽器內建 `Image + canvas.toBlob()`，不新增 dependency。
- `src/utils/floorDesignPromptBuilder.js`
  - 新增 `buildFloorDesignPrompt(state, layoutModel)` 與 `buildFloorDesignPromptExport()`。
  - Prompt 明確要求保留桌位、姓名靠近座位點、不可新增/刪除/改名，並描述 A4 直式、水彩粉玫瑰、金色字體與 ribbon。
- `src/hooks/useExport.js`
  - 新增 `exportFloorDesignSVG()`。
  - 新增 `exportFloorDesignPNG()`。
  - 新增 `exportFloorDesignPrompt()`。
- `src/components/Toolbar.jsx`
  - 匯出選單新增：
    - `座位圖設計圖 PNG`
    - `座位圖設計圖 SVG`
    - `AI 生圖提示詞`
- `src/components/DashboardHome.jsx`
  - 總覽主要操作新增 `匯出設計圖`。
  - 快速操作新增 `AI 生圖提示詞`。
- `src/App.jsx`
  - 將新增匯出 handler 接到總覽與座位圖工具列。

## 3. 新增匯出項目

匯出選單現在包含：

- `桌次圖 PDF`：正式列印 PDF。
- `座位圖設計圖 PNG`：高解析設計圖檔。
- `座位圖設計圖 SVG`：可檢查/再加工的向量圖。
- `AI 生圖提示詞`：搭配 PNG/SVG 交給 AI 生圖工具使用。

## 4. 輸出檔名格式

- `婚禮桌次設計圖_YYYY-MM-DD.png`
- `婚禮桌次設計圖_YYYY-MM-DD.svg`
- `婚禮桌次AI生成提示詞_YYYY-MM-DD.txt`

## 5. AI Prompt 核心內容

Prompt 必含以下英文約束：

- `preserve exact table layout and relative positions from the attached reference image`
- `keep all names close to their corresponding seat dots`
- `do not invent, remove, or rename guests`
- `A4 portrait wedding seating chart`
- `watercolor blush rose floral corners`
- `elegant gold typography and ribbon`

Prompt 也會帶出 layout signature、source canvas、export frame、各桌相對位置與已入座姓名，並補充中文提醒：不要重排成固定網格、不要把姓名移到側邊列表。

## 6. Review

- 沒有新增 `html2canvas` / `jspdf` / 大型 dependency。
- 沒有改 Firebase、Google Sheets 或 DnD state flow。
- PNG/SVG 與 PDF 共用 `buildFloorDesignLayoutModel()` + `buildWeddingFloorDesignSvg()`。
- Dashboard 也同步提供設計圖與 prompt 入口，避免只有座位圖工具列能使用。

## 7. Phase 5 交接

Phase 5 應新增 contract smoke，檢查：

- PNG/SVG export 內含同一個 `layoutSignature`。
- Prompt 與 SVG 使用同一個 layout model signature。
- SVG 不含 `完整座位標註見第`、`wfp-detail-reference`、舊 `1850 x 2400` viewBox。
- SVG label / connector / seat dot 數量與 source-position model 一致。
