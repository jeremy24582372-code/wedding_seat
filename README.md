# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Firebase Realtime Database Rules

目前 Firebase console 的測試模式規則：

```json
{
  "rules": {
    ".read": "now < 1779897600000",
    ".write": "now < 1779897600000"
  }
}
```

`1779897600000` 是台灣時間 `2026-05-28 00:00`。到期後，Realtime Database 會開始拒絕前端同步請求。

本專案的 RTDB 正式規則維護在 `database.rules.json`。部署前先執行：

```bash
npm run rules:check
```

確認通過後部署到 `wedding-seat-bc8c8`：

```bash
npm run rules:deploy
```

這份規則會拒絕根節點與未知路徑，只開放目前 app 實際使用的 `/wedding-seating`，並檢查座位資料的基本 schema。注意：目前前端只有 `PasswordGate`，沒有 Firebase Auth；因此這是「不破壞現有流程」的最小安全化，不是完整身分驗證。若要真正限制只有授權人員可讀寫，下一步要加入 Firebase Auth 或後端 proxy。

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
