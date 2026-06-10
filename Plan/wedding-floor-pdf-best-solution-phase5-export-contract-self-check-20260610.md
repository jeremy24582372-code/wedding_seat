# 婚禮桌次圖匯出最佳解 Phase 5 Export Contract Self-Check

日期：2026-06-10
執行角色：`@engineer`
狀態：Phase 5 完成
來源計畫：`Plan/wedding-floor-pdf-best-solution-plan-20260609.md`

## 1. 目標

本 Phase 建立防退化 smoke，防止後續改動讓桌位重新變成固定 grid、姓名遠離座位、detail reference 回歸，或讓 PNG/SVG/prompt 與 PDF 使用不同 layout model。

## 2. 修改檔案

- `scripts/check-floor-design-export.mjs`
  - 新增 Phase 4/5 image + prompt export contract。
  - 驗證 SVG 檔名、PNG 檔名、prompt 檔名。
  - 驗證 source table distance ratio 與 print distance ratio 一致。
  - 驗證有 `tablePositions` 時全部使用 stored positions，不依桌號排序成固定 grid。
  - 驗證 SVG 內含 `wfp-design-svg` 與 source-position `layoutSignature`。
  - 驗證 SVG label / connector / seat dot 數量與 model 一致。
  - 驗證特殊字元姓名已 escape；長姓名允許被 renderer 拆成多個 `<tspan>`。
  - 驗證 prompt 包含 Phase 4 要求的必備英文短語。
- `scripts/check-phase4-export-contract.mjs`
  - 擴充既有官方匯出 contract，加入設計圖 SVG 與 AI prompt signature 檢查。
- `package.json`
  - 新增 `npm run check:floor-design-layout`。
  - 新增 `npm run check:floor-design-export`。

## 3. 自檢命令結果

已通過：

```txt
npm run check:floor-design-layout
npm run check:floor-design-export
npm run check:phase4-export-contract
npm run check:floor-pdf-renderer
npm run check:floor-pdf-layout
npm run lint
git diff --check
npm run build
```

結果：

- `Floor design source-position layout checks passed`
- `Floor design image and prompt export checks passed`
- `Phase 4 export contract checks passed`
- `Wedding floor print renderer checks passed`
- `Wedding floor PDF layout model checks passed`
- `npm run lint` 通過。
- `git diff --check` 無 whitespace error；只有既有 LF/CRLF 提醒。
- sandbox 內 `npm run build` 因 Vite/Rolldown `spawn EPERM` 失敗；同一命令升權後通過，僅保留既有 chunk-size warning。

## 4. Browser Smoke

環境：

- URL：`http://127.0.0.1:5185/wedding_seat/`
- Viewport：Browser 預設桌機寬度，DOM 回報 `clientWidth = 1274`
- Firebase：隔離 Vite config + 安全 envDir，頁面顯示 `本機模式`

互動流程：

```txt
app loads -> password gate -> overview -> 前往座位圖 -> 匯出選單 -> 新增匯出項目可見
```

證據：

- transformed `/wedding_seat/src/firebase.js` 的 `import.meta.env` 只含 `VITE_PASSWORD_HASH`，沒有實際 Firebase URL。
- 登入後畫面顯示 `本機模式`。
- 匯出選單可見項目：
  - `匯出 JSON`
  - `匯出 Excel`
  - `座位清單 PDF`
  - `桌次圖 PDF`
  - `座位圖設計圖 PNG`
  - `座位圖設計圖 SVG`
  - `AI 生圖提示詞`
- Console 沒有相關 error/warn；只有預期的本機模式 Firebase warning。
- Browser screenshot API `Page.captureScreenshot` timeout，符合既有 Browser 截圖限制；DOM/console/互動證據已通過。
- dev server 已清理，`5185` port 停止 listen。

## 5. Review

- 本 Phase 是 `@engineer` self-check，沒有建立或使用 `@qa` phase。
- 新 smoke 使用 source-position model 作 canonical，不回到舊 `regularTablePages` grid 檢查。
- SVG 特殊字元檢查改為允許 `<tspan>` 分行，避免把 renderer 的合法換行誤判為 escaping 失敗。
- 沒有新增 dependency，沒有修改 Firebase / Google Sheets / DnD。

## 6. 仍需注意

- Browser 截圖 API 在本次環境 timeout；未取得截圖檔，但 DOM、console、HTTP、本機模式與互動檢查已通過。
- AI prompt 是輔助美化素材，不是正式資料來源；正式 PNG/SVG/PDF 仍由 state-driven model 產生。
