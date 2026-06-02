# 自動排座主桌與同行錨點修正紀錄

> 日期：2026-06-02  
> 主責角色：`@engineer`  
> 範圍：修正 auto-seat preview 將同行排到 1 桌，以及預設不應使用 1 桌主桌的問題。

## 問題

- 使用者已將 `謝嘉宇` 安排到 `2桌`。
- 自動排座預覽在 `謝嘉宇 同行1` 未分配時，可能建議 `未分配 → 1桌`。
- `1桌` 是主桌，預設自動排座不應排入一般賓客。

## 根因

`guestGroups` 會先於 `partyRows` 建立 auto-seat 分組。當規則設定為保留既有安排時，已在桌上的主要賓客不屬於候選移動名單，原本程式只用候選成員推算群組偏好桌，導致 planner 看不到 `謝嘉宇` 已在 `2桌` 的脈絡。

在 `category-first` 策略下，如果 `1桌` 已有較多同分類賓客，排序可能把同行排到 `1桌`。

## 修正

- `src/utils/autoSeatPlanner.js`
  - 同桌群組改用完整群組成員推算 `preferredTableIds`。
  - 新增 `anchorTableIds`：若同行已有成員在桌上，未分配成員只能補到錨點桌。
  - `guestGroups.preference = same-table` 強制同桌分組。
  - `guestGroups.preference = nearby` 會讓候選成員優先參考同群組已安排成員所在桌。
  - `guestGroups.preference = separate` 會避免同群組成員被 auto-seat 放進同桌。
  - `1桌` / `主桌` 從自動排座候選桌排除。
  - auto-seat 新增桌次時跳過 `1桌`。
  - 錨點桌容量不足或錨點桌是主桌時列入 blocked，不拆到其他桌。

## 驗證

- Focused smoke：`謝嘉宇` 在 `2桌`、`謝嘉宇 同行1` 未分配、`category-first` 策略、`1桌` 有更多同分類賓客時，預覽結果為 `謝嘉宇 同行1：未分配 → 2桌`。
- Focused smoke：一般未分配賓客在 `1桌` 與 `2桌` 都空時，預覽結果為 `2桌`。
- Focused smoke：`separate` 群組中已安排成員在 `2桌` 時，未分配成員會避開 `2桌` 與主桌。

## Review

修正放在純 planner 層，沒有新增 UI 狀態或 Firebase schema。預設主桌保留給手動安排；auto-seat 仍會尊重既有座位，但不會自動把新候選補入主桌。群組偏好現在會影響自動排座，不再只是群組頁面的人工註記。
