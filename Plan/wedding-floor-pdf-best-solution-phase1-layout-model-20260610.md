# 婚禮桌次圖匯出最佳解 Phase 1 Source-Position Layout Model

日期：2026-06-10
執行角色：`@engineer`
狀態：Phase 1 完成
來源計畫：`Plan/wedding-floor-pdf-best-solution-plan-20260609.md`

## 1. 目標

本 Phase 建立正式匯出用的 source-position layout model，確保桌位以互動式「座位圖」中的 `state.tablePositions` 為 source of truth，而不是重新排成固定婚禮 grid。

## 2. 修改檔案

- `src/utils/floorDesignLayoutModel.js`
  - 新增 `buildFloorDesignLayoutModel(state, options)`。
  - 輸出 `sourceCanvas`、`contentFrame`、`positionTransform`、`breathingScale`、`tables[].sourcePosition`、`tables[].printPosition`、`tables[].relativePositionSignature`、`layoutSignature`。
  - 桌位來源優先使用 `state.tablePositions[table.id]`；只有缺少或無效時才使用 `defaultTablePosition(index)`。
  - 保留每桌 `seatDots` 與 seat/guest payload，供 Phase 2 seat-local label solver 接續使用。
- `scripts/check-floor-design-layout.mjs`
  - 新增 source-position layout smoke。
  - 驗證有 `tablePositions` 時不 fallback、不依桌號排序、不產生 `regularTablePages` 固定 grid。
  - 驗證任兩桌 source/print distance ratio 在 Phase 0 規格的 `1%` 容許範圍內。
  - 驗證 missing position 才使用 `defaultTablePosition(index)`。
  - 驗證 `breathingScale` 後仍保持整體桌距比例。

## 3. 桌位比例保留方式

模型先把每桌的 wrapper 左上角座標解析成 source center。解析規則與既有 `FloorPlan.jsx` 一致：

```txt
positions?.[table.id] ?? defaultTablePosition(index)
```

所有 table center 之後只經過同一套幾何轉換：

```txt
source center
  -> centroid-based uniform breathing
  -> uniform scale
  -> translate into A4 contentFrame
```

因此不會依桌號排序、不會建立 4x5 grid，也不會針對單桌做局部拉伸。

## 4. Breathing Scale 規則

`breathingScale` 以全部桌心的 centroid 為中心，對所有桌心套用同一個比例：

```txt
breathed = centroid + (source - centroid) * breathingScale
```

接著再用同一個 uniform fit scale 放入 A4 content frame。這會保留整體桌距比例；若 Phase 2 因跨桌姓名碰撞需要放寬桌距，只能調整此全域參數，不可局部移動單一桌。

## 5. 驗證結果

已通過：

```txt
node scripts/check-floor-design-layout.mjs
npm run check:phase4-export-contract
```

結果：

- `Floor design source-position layout checks passed`
- `Phase 4 export contract checks passed`

## 6. Phase 2 交接

Phase 2 可直接使用 `buildFloorDesignLayoutModel()` 的：

- `tables[].printPosition`
- `tables[].seatDots[]`
- `positionTransform`
- `breathingScale`
- `layoutSignature`

Phase 2 應在此模型上加入 seat-local label solver，並繼續禁止：

- `完整座位標註見第 N 頁`
- `wfp-detail-reference`
- summary-only table mode
- 長距離 connector
