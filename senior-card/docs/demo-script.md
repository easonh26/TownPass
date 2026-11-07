# Demo 腳本（2 分鐘，實機，不用簡報）

## 事前檢查（上台前）

- [ ] Demo 手機：已安裝當日 build 的 App、已允許定位權限
- [ ] 部署主機：`docker compose ps` 三個容器皆 healthy/running
- [ ] `curl https://cdf19.twread.net/api/health` 回 `{"status":"ok"}`
- [ ] 手機開 App → 服務 → 熱門 → 敬老卡，可載入 P0
- [ ] 主機接電源、關閉休眠（macOS：`caffeinate -dims`）；備用手機 + 行動熱點就緒

## 台上流程

| 時間 | 動作 | 台詞要點 |
|---|---|---|
| 0:00 | App「服務」→「熱門」→ 點「敬老卡優惠場所查詢」 | 一句話題目：幫長者找敬老卡點數可用場所 |
| 0:15 | P0 點「是」 | 語音朗讀啟動，之後每頁自動播報 |
| 0:30 | P1 點「交通」 | 依目前位置找最近场所 |
| 0:45 | P2 展示列表：名稱 / 距離 / 扣點，翻到第 2 頁 | 零滑動，只有點選 |
| 1:15 | 點一列進 P3：靜態地圖 + 圖釘、地址、扣點、優惠翻頁 | 地圖用國土測繪中心圖資 |
| 1:40 | 技術 20 秒 | Vue SPA + 同源 ASP.NET API + SQLite 唯讀庫；語音走裝置端 TTS；全開源套件 |

## 備案

- 網路不穩：手機切行動熱點；服務本身除地圖圖磚外不依賴外部網路
- Tunnel 斷線：`docker compose restart cloudflared`，URL 不變（named tunnel）
- App 閃退：備用手機同版本 App 直接接手
