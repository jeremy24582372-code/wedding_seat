# 婚禮桌次圖 PDF 版型 Phase 1 視覺規格

日期：2026-06-08  
角色：`.agents/agents.md` 的 `@designer`  
範圍：婚禮版型視覺規格，不修改產品程式碼  
參考圖：`C:/Users/jerem/Downloads/婚禮桌次位置圖_匯出.png`

## Design Read

Reading this as: export-only wedding stationery layout for Jeremy & Yuri, with watercolor floral corners, warm paper, fine gold lines, clear table hierarchy, and print-only HTML/SVG rendering that does not touch the dark-mode seating workspace.

本 Phase 只定義可實作規格。後續 Phase 2 應建立 export-only layout model，Phase 3 再依本文件實作 print renderer。操作畫面 `FloorPlan`、拖拉互動、Firebase、Google Sheets 與核心資料模型都不在本 Phase 範圍內。

## Sources Read

本 Phase 規格依下列來源建立：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- 參考圖 `C:/Users/jerem/Downloads/婚禮桌次位置圖_匯出.png`
- 現有 export 相關檔案：`src/utils/floorPrintHTMLBuilder.js`、`src/utils/exportShared.js`、`src/utils/constants.js`、`src/design-tokens.css`

## Output Contract

| 項目 | 規格 |
| --- | --- |
| 預設輸出 | A4 portrait，`210mm x 297mm` |
| Print setup | `@page { size: A4 portrait; margin: 0; }`，由 page container 自行留安全邊界 |
| Page container | `.wfp-page { width: 210mm; min-height: 297mm; position: relative; overflow: hidden; }` |
| 內容安全邊界 | 左右 `13mm`，上方 `8mm`，下方 `8mm` |
| 第一頁容量 | 1 個主桌區 + 最多 19 個一般桌 slot，合計 20 桌內單頁 |
| 續頁容量 | 每頁最多 20 個一般桌 slot；續頁用 compact header，不重複主桌區 |
| 完整名單 | 若任何姓名在圖上被截斷、折疊或只以 `+N 位` 呈現，必須在同一份 PDF 後續區塊列出完整姓名 |
| 未分配賓客 | 第一頁底部顯示警示摘要；完整未分配名單放在後續區塊或續頁 |
| 樣式隔離 | 所有 CSS 內嵌於 print document HTML，不匯入 `App.css` 或 `design-tokens.css` |

## First Page Layout

以 millimeter 作為主要規格，Phase 3 可用 CSS mm 單位或在 SVG viewBox 中換算為同等比例座標。

| 區塊 | X / W | Y / H | 說明 |
| --- | --- | --- | --- |
| Decorative corners | 可出血到頁面邊緣 | 全頁 | 花卉可超出安全邊界，但不可壓住文字或 table grid |
| Header | `13mm / 184mm` | `9mm / 44mm` | 品牌名、主標、副標、meta |
| Stage ribbon | `61mm / 88mm` | `57mm / 10mm` | `主桌 / 舞台`，置中 |
| Main table band | `40mm / 130mm` | `70mm / 44mm` | 主桌圓桌與最多 10 個姓名名牌 |
| Regular grid | `13mm / 184mm` | `119mm / 138mm` | 4 欄 x 5 列，第一頁最多 19 個一般桌 |
| Legend divider | `35mm / 140mm` | `264mm / 8mm` | `座位圖例` 標題與金色細線 |
| Legend items | `35mm / 140mm` | `274mm / 10mm` | 類別圓點與文字，置中 |
| Warning strip | `13mm / 184mm` | `285mm / 6mm` | 只有未分配或截斷名單時顯示；沒有 warning 時保留空白呼吸感 |

視覺重心必須與參考圖一致：header 大而輕，stage ribbon 作為中軸，主桌是唯一大型圓桌，一般桌小而規律。不要把一般桌做成與主桌同等視覺重量。

## Header Typography

| Element | Text | Size | Weight / Style | Color token | Placement |
| --- | --- | --- | --- | --- | --- |
| Couple mark | `Jeremy & Yuri` | `31pt` | script / calligraphy, normal | `--wfp-gold-ink` | 置中，line-height `0.95` |
| Chinese title | `婚 禮 桌 次 位 置 圖` | `15pt` | `500`，字距 `0.42em` | `--wfp-brown-ink` | couple mark 下方 `4mm` |
| English subtitle | `WEDDING SEATING CHART` | `8.5pt` | `500`，字距 `0.36em` | `--wfp-gold-ink` | Chinese title 下方 `1.8mm` |
| Meta | `列印日期：YYYY-MM-DD ｜ 共 N 桌 ｜ 來源筆數：N 筆 ｜ 實際人數：N 位` | `8pt` | `400` | `--wfp-muted-ink` | subtitle 下方 `3mm` |

Header 左右可加短金線與小愛心裝飾，但必須是 print-only inline SVG 或 CSS pseudo element。愛心高度上限 `3mm`，不可使用 emoji。

## Stage Ribbon

| 項目 | 規格 |
| --- | --- |
| Ribbon body | `88mm x 10mm`，中心淡金漸層，外框 `1px` |
| Ribbon tail | 左右各 `8mm`，可用 CSS border 或 SVG polygon |
| Text | `主桌 / 舞台`，`12pt`，字距 `0.18em`，`--wfp-brown-ink` |
| Shadow | 僅用非常淡的 inset highlight，不使用重陰影 |
| Fallback | 若 SVG polygon 不可用，退化為單一圓角淡金矩形 |

## Main Table

主桌是本版型唯一允許完整姓名名牌圍繞的桌次。Phase 2 必須依下列順序判定主桌，Phase 3 只消費 layout model：

1. `table.label` 完全等於 `主桌`。
2. `table.label` 包含 `主桌`。
3. `table.label` 可解析為 `1桌`。
4. 若以上皆不成立，fallback 使用 `state.tables[0]`。

| Element | Size / Position | Style |
| --- | --- | --- |
| Main center | 直徑 `24mm` | 暖白填色，金色 `1.2px` 外框，中心可放小型花卉 SVG |
| Seat orbit | 座位中心半徑 `20mm` | 不畫完整 orbit 線，避免太重 |
| Seat dot | 直徑 `6.2mm` | 依類別色填色，外框 `--wfp-gold-line`；空位為透明紙色圓點 |
| Nameplate | `22mm x 7mm` 到 `28mm x 7mm` | 圓角 pill，白底，類別色外框，淡陰影或無陰影 |
| Nameplate count | 最多 10 個 | 左側 4 個、右側 4 個、上方 1 個、下方 1 個；依座位角度自動對齊 |
| Empty seats | 保留淡金空圓點 | 不顯示座號，避免婚禮版面工具感過重 |

主桌姓名顯示規則：

- 2 到 4 個中文字：單行置中。
- 5 到 6 個中文字：允許縮小到 `6.5pt` 或兩行。
- 超過 6 個中文字、含英數或特殊符號較長時：名牌內顯示前段加 `…`，完整姓名必須出現在「完整桌次名單」。
- 名牌文字不可超出 pill，Phase 3 必須使用 `overflow-wrap: anywhere` 或 SVG text 分行策略。
- 類別色以邊框與 seat dot 同步，不用大面積高飽和底色。

## Regular Table Grid

第一頁一般桌區採 4 欄 x 5 列。主桌不佔一般桌 slot，所以 `2桌` 到 `20桌` 剛好 19 個 slot。

| Grid parameter | Value |
| --- | --- |
| Grid X / W | `13mm / 184mm` |
| Column count | 4 |
| Column gap | `10mm` |
| Column width | `38.5mm` |
| Row count | 5 |
| Row gap | `4mm` |
| Row height | `24.4mm` |
| Table group max size | `28mm x 24mm` |
| Center table diameter | `12.8mm` |
| Seat orbit radius | `10.5mm` |
| Seat dot diameter | `4.8mm` |

一般桌內容層級：

1. 桌號，`9.5pt`，`--wfp-brown-ink`，字重 `600`。
2. Occupancy，`7pt`，格式 `3 / 10`。
3. 10 個座位圓點，已入座用類別色，空位用 `--wfp-empty-seat-fill`。
4. 若該桌 1 到 3 位，允許在 table group 左側或右側顯示迷你名牌。
5. 若該桌 4 位以上，圖上不硬塞全部姓名，顯示 seat dots + count，完整姓名放在後續「完整桌次名單」。

一般桌狀態：

| State | Visual rule |
| --- | --- |
| Empty table | 中心白紙色，金色細框，10 個空位淡金圓點，occupancy `0 / 10` |
| Partial table | 已入座 seat dots 依類別上色；中心仍保持白紙色 |
| Full table | 中心淡金填色 `--wfp-full-table-fill`，外框提高到 `1.3px`，occupancy 使用 `--wfp-gold-ink` |
| Overflow input | 正常 state 不應超過 10；若資料異常，該桌顯示 warning badge `資料需檢查`，不可畫出第 11 個座位 |
| Custom label | 無數字桌名維持原文字，若超過 5 個中文字則縮小或兩行 |

## Continuation Pages

超過第一頁容量時必須產生續頁，不得壓縮到重疊。

| Page type | Content |
| --- | --- |
| Regular-table continuation | Compact header `Jeremy & Yuri ｜ 婚禮桌次位置圖 ｜ 第 X 頁`，4 欄 x 5 列，每頁最多 20 桌 |
| Full guest index | 以 4 欄文字清單列出每桌完整姓名，含主桌、一般桌與未分配；每欄使用桌次小標與姓名列表 |
| Warning page | 若未分配很多或特殊字元測試資料很多，放在 guest index 最前或最後，標題為 `未分配賓客` |

完整桌次名單樣式應比桌次圖低調，但必須可讀。建議使用 `7.5pt` 到 `8pt`，行高 `1.45`，每桌最多一個細金外框小區塊。不要使用卡片陰影。

## Color Tokens

Phase 3 應在 print document 的局部 `:root` 或 `.wfp-page` 中定義以下 CSS custom properties。這些 token 僅屬於 print HTML，不加入 app 全域 `design-tokens.css`，除非未來另開 design-token phase。

```css
.wfp-page {
  --wfp-paper: oklch(98.4% 0.014 82);
  --wfp-paper-warm: oklch(96.8% 0.022 78);
  --wfp-gold-line: oklch(68% 0.086 78);
  --wfp-gold-ink: oklch(47% 0.095 74);
  --wfp-brown-ink: oklch(30% 0.045 58);
  --wfp-muted-ink: oklch(52% 0.035 58);
  --wfp-rose-petal: oklch(83% 0.075 20);
  --wfp-rose-soft: oklch(94% 0.035 18);
  --wfp-leaf: oklch(58% 0.064 145);
  --wfp-leaf-soft: oklch(82% 0.042 145);
  --wfp-empty-seat-fill: oklch(98% 0.01 78 / 0.72);
  --wfp-full-table-fill: oklch(94% 0.038 78);
  --wfp-warning: oklch(55% 0.13 35);
}
```

Category colors should continue to come from the existing category system so the PDF legend matches the app data semantics. Phase 3 may map `getCategoryVisual(category)` into print-local variables:

| Category | Print role |
| --- | --- |
| 新郎親友 | Purple dot / border, matching current groom visual |
| 新娘親友 | Rose dot / border, matching current bride visual |
| 共同朋友 | Green dot / border |
| 同事 | Gold dot / border |
| 其他 | Neutral gray dot / border |
| Custom category | Stable fallback from existing hash palette; legend label must show the custom category name |

Required mapping from `getCategoryVisual(category)`:

| Source field | Print-local usage |
| --- | --- |
| `visual.label` | Legend label and full index category label |
| `visual.printColor` | Legend dot fill and compact index marker |
| `visual.floorBorder` | Seat dot stroke and nameplate border |
| `visual.floorBackground` | Seat dot fill when higher contrast than `printColor` is needed |
| `visual.isBuiltin` | Built-in categories render before custom categories |

The visible category set must be generated from current guests, not hardcoded to only built-in categories.

## Floral Decoration Strategy

Preferred implementation for Phase 3:

1. Use print-only inline SVG decorative groups for the four corners.
2. Each corner group is abstract watercolor style: layered petal ellipses, leaf paths, and low-opacity gold dots.
3. Place decorations behind content with `z-index: 0`; content wrapper uses `z-index: 1`.
4. Top-left and bottom-right are larger floral clusters; top-right and bottom-left are lighter leaf clusters.

Recommended corner sizes:

| Corner | Size | Position |
| --- | --- | --- |
| Top-left | `50mm x 46mm` | `left: -3mm; top: -2mm` |
| Top-right | `42mm x 40mm` | `right: -2mm; top: -1mm` |
| Bottom-left | `56mm x 52mm` | `left: -4mm; bottom: -5mm` |
| Bottom-right | `58mm x 54mm` | `right: -4mm; bottom: -5mm` |

Fallback rules:

- If no SVG decorative helper exists, use CSS radial gradients and simple leaf ellipses.
- If print color support is poor, decorations may disappear; layout and data must remain fully usable.
- Do not use `C:/Users/jerem/Downloads/婚禮桌次位置圖_匯出.png` as a background.
- If Phase 3 chooses static assets, place them under `public/export/` with descriptive names, for example `wedding-floral-corner-top-left.svg`; missing assets must fall back to inline SVG.

## Font Strategy

Print HTML is isolated, so it cannot assume app CSS has already loaded. Phase 3 should include font stacks inside the print document.

| Role | Preferred stack | Fallback rule |
| --- | --- | --- |
| Couple mark | `'Imperial Script', 'Great Vibes', 'Times New Roman', cursive` | If Google Font fails, use serif italic fallback and slightly reduce size to `28pt` |
| Chinese title | `'Noto Serif TC', 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', serif` | If serif unavailable, use Noto Sans TC or Microsoft JhengHei with increased letter spacing |
| Table labels | `'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', system-ui, sans-serif` | Must remain readable without remote font |
| Meta / index | `'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', system-ui, sans-serif` | Prefer tabular numeric alignment where supported |

If Google Fonts are loaded in the print window, Phase 4 must ensure print trigger waits for `document.fonts.ready` or a bounded fallback timer. Do not block printing indefinitely on remote font load.

## Legend

Legend sits at the bottom of the first page unless a warning strip is needed. It must include every category currently present in `state.guests`, plus built-in categories when useful for consistency.

| Element | Spec |
| --- | --- |
| Divider line | Two `55mm` gold lines with a small diamond or heart in the center |
| Title | `座位圖例`，`9pt`，letter spacing `0.16em` |
| Dot | `4.2mm` diameter，category color |
| Label | `7.5pt`，`--wfp-brown-ink` |
| Layout | Centered flex row, gap `8mm`; wraps to second row only on continuation or index pages |

If custom categories exceed available width, group them after built-ins and allow a second legend row. Do not shrink text below `6.8pt`.

## Data And Text Edge Cases

| Case | Visual rule | Matrix |
| --- | --- | --- |
| Long guest name | Nameplate clamps or wraps; full name appears in guest index | PDF-LAYOUT-01, PDF-LAYOUT-08 |
| Long table label | Center table text wraps to two lines or shrinks; full label appears in index | PDF-LAYOUT-02, PDF-LAYOUT-08 |
| Empty table | Show full 10 empty seats and `0 / 10` | PDF-LAYOUT-03 |
| Full table | Use subtle full state, never add 11th seat | PDF-LAYOUT-01, PDF-LAYOUT-03 |
| Unassigned guest | Warning strip plus full list in index | PDF-LAYOUT-01, PDF-LAYOUT-07 |
| Custom category | Stable color dot and label in legend | PDF-LAYOUT-05 |
| Special characters | All visible text must be HTML escaped before entering HTML or SVG | PDF-LAYOUT-08 |
| Missing floral asset | Use inline/CSS fallback; layout remains unchanged | PDF-LAYOUT-03, PDF-LAYOUT-06 |

## Print-only Isolation Rules

- Do not modify `FloorPlan.jsx`, `TableZone.jsx`, `GuestCard.jsx`, `App.css`, or `design-tokens.css` for this visual direction unless a later phase explicitly changes scope.
- Print CSS must live in the generated HTML returned by `buildFloorPrintHTML()` or a renderer helper used only by that function.
- Decorative selectors should be namespaced with `.wfp-`.
- Do not rely on live DOM screenshot, canvas capture, `html2canvas`, or `jspdf`.
- Do not read `state.tablePositions` for wedding layout positioning. Wedding PDF layout is automatic and export-only.
- The existing one-shot print guard in `printWindow.js` must remain compatible with font loading and fallback timers.

## Phase 2 Handoff

Phase 2 should create a layout model that provides Phase 3 with data in this shape or an equivalent shape:

```js
{
  meta: {
    exportDate,
    tableCount,
    partyRowCount,
    guestCount,
    pageCount
  },
  mainTable: {
    table,
    seats,
    fullNameIndexRequired
  },
  regularTablePages: [
    {
      pageNumber,
      tables: [
        {
          table,
          seats,
          occupancy,
          displayNameplates,
          requiresFullIndex
        }
      ]
    }
  ],
  legendItems,
  fullGuestIndex,
  unassignedGuests,
  warnings
}
```

`displayNameplates` for general tables should only include sparse callouts that fit the chart. `fullGuestIndex` is the source of truth for complete names whenever chart labels are abbreviated.

## PDF-LAYOUT Coverage

| ID | Phase 1 visual decision |
| --- | --- |
| PDF-LAYOUT-01 | Defines full guest index and unassigned handling so PDF can account for every `state.guests` item |
| PDF-LAYOUT-02 | Reserves a dedicated main-table band and nameplate orbit for the selected main table |
| PDF-LAYOUT-03 | Defines exact A4 first-page regions, 4 x 5 grid, and one-page 20-table capacity |
| PDF-LAYOUT-04 | Defines continuation pages with 20 regular-table slots per page |
| PDF-LAYOUT-05 | Requires legend generation from current guest categories and stable custom category fallback |
| PDF-LAYOUT-06 | Locks all wedding styling to print HTML with `.wfp-` namespace and no app CSS imports |
| PDF-LAYOUT-07 | Requires warning strip plus complete unassigned guest list |
| PDF-LAYOUT-08 | Requires escaped visible text and full-name index for clipped names |

## Review

- Phase 1 does not modify product source files and intentionally avoids implementation logic.
- The visual spec is detailed enough for Phase 2 to build deterministic layout data and for Phase 3 to render the wedding stationery style without guessing dimensions.
- The spec preserves the existing desktop-only app target and print-window export architecture.
- Remaining work belongs to Phase 2 and Phase 3: layout model, local-date fix, renderer implementation, smoke tests, and final print preview QA.
