# 交接文件（給下一個 agent）

> 專案：敬老卡優惠場所查詢（2026 臺北秋季程式設計節 · 城市通微服務大黑客松）
> 最後更新：2026-11-08。本文是現況快照，先讀完再動手。

## 1. 一句話架構

```text
TownPass App（服務頁 / 熱門 → TPWebView，URL 由 MICROSERVICE_URL 決定）
  ↕ flutterObject bridge：location（內建）、tts_check/speak/stop（自訂）
https://cdf19.twread.net/ （Cloudflare Tunnel named tunnel）
  → cloudflared 容器 → nginx (web:80)
      ├─ /      Vue 3 + Vite + TS SPA（P0→P1→P2→P3，零滑動）
      └─ /api   ASP.NET Core 10 → venues.db（唯讀，bake 進 image）
```

## 2. 目錄與關鍵檔案

```text
TownPass fork 根目錄
├─ lib/util/tp_constant.dart              # kMicroserviceUrl（dart-define 可覆寫）、kMicroserviceTitle
├─ lib/page/city_service/model/my_service_model.dart        # 新增 seniorCard
├─ lib/page/city_service/model/trending_service_model.dart  # 熱門新增一筆
├─ lib/service/senior_tts_service.dart                      # 原生 TTS（flutter_tts MIT）
├─ lib/util/web_message_handler/tp_tts_message_handler.dart # tts_check/speak/stop
├─ lib/util/web_message_handler/tp_web_message_listener.dart# Handler 註冊處
├─ android/app/src/main/AndroidManifest.xml                  # 已補 INTERNET（release 必備）
├─ android/app/src/debug/AndroidManifest.xml                 # 僅 debug：usesCleartextTraffic（連筆電測試用）
├─ assets/svg/icon_senior.svg                                # 服務圖示
├─ pubspec.yaml                                              # 新增 flutter_tts ^4.2.5
├─ senior-card/
│  ├─ HANDOFF.md          # 本文件
│  ├─ README.md / LICENSE(AGPL-3.0) / docs/{api,demo-script}.md
│  ├─ web/                # Vue 前端（src/views 下 4 頁＋composables＋bridge）
│  ├─ api/                # ASP.NET 後端（Program.cs、Venues.cs、Models.cs、data/venues.db）
│  └─ deploy/             # docker-compose.yml、nginx.conf、.env.example、.env（token，不進版控）
├─ ref/                   # 設計稿 HTML（p0/p1-p2/p1-p2(2)/p3）＋ venues.db（.gitignore 排除，不提交）
└─ data/                  # 隊伍原始 CSV/DB（.gitignore 排除，不提交）
```

## 3. 環境與帳號資訊

- 本機：macOS arm64；flutter 3.47.8（直接安裝，無 fvm）；node 26；dotnet SDK 10.0.302；Docker Desktop＋compose v5。
- 實機：Pixel 6a（`adb` 在 `~/Library/Android/sdk/platform-tools`，PATH 預設沒有，每次開 shell 要 export）。
- 公開網址：`https://cdf19.twread.net/`（user 自有域名，Cloudflare 後台 Public hostname → `http://web:80`）。
- Tunnel token：在 `senior-card/deploy/.env`（已填，不可 commit，有 `.gitignore` 保護）。
- DB：`ref/venues.db`（14,387 筆，唯讀）；`api/data/venues.db` 是同一檔案的建置用拷貝。

## 4. 已完成＋已驗證（勿重做）

| 項目 | 驗證方式 |
|---|---|
| API `/api/v1/places`（bbox＋Haversine＋半徑擴張 0.5→10km＋同名 300m 合併） | curl 真實 DB：合併有效（dup=0）、400/404 正常 |
| Vue 四頁＋TTS＋NLSC 地圖＋翻頁 | 實機 WebView 截圖＋logcat（TTS 4 段 completed、真實天母定位） |
| App 服務註冊（服務頁＋熱門＋強制標題＋圖示） | 實機截圖 |
| tunnel 全流量 | curl 公開網址 200，正式 URL 版 APK 已裝機 |
| P3 不滑動修正（固定 100dvh 殼＋地圖 clamp＋文字區彈性） | 已部署，**待手機重進驗證**（見 §6.1） |

## 5. 待辦（按順序做）

### 5.0 先收尾：git 提交（user 自己 commit，只要提醒他）

```bash
git add .gitignore senior-card/api/data/venues.db
git commit -m "fix: gitignore 錨定根目錄，補提交 Docker 建置用的 venues.db"
```

背景：`.gitignore` 的 `data/` 曾誤殺 `senior-card/api/data/venues.db`
（pattern 會匹配任意層級），已改為錨定式 `/data/`、`/ref/`。
沒有這個 db，別台機器 `docker compose --build` 會失敗。

### 5.1 P3 新版面驗證（手機需關閉重進 WebView 才會載入新 CSS）

user 重進服務後截圖確認 P3 頁腳無需滑動可見。

### 5.2 七個問題實作（user 已確認方案，編號採「每頁重來 1–5」）

1. **P0 查詢餘額無反應**：原因＝`open_link` 在 App 內開 WebView 載入 easycard 站（驗證碼/JS 相容性差）且無回傳。
   解＝新增 `open_external` Handler（`lib/util/web_message_handler/` 新檔，
   用現有 `url_launcher` 以系統瀏覽器開啟，回 bool），`VoiceView.openBalance` 改打它。
   需重 build APK（原生改動）。
2. **P1–P2 編號**：分類鈕加 `1.`–`4.`；列表列加當頁編號；語音「首筆詳細、其餘編號＋名稱」。
   改 `CategoryView.vue`、`ResultListView.vue`。
3. **P0 自動語音詢問**：`VoiceView.vue` 的 `onMounted` 直接 `speak('是否開啟語音朗讀？')`，
   並補 `onBeforeUnmount → stop()`。注意 iOS Web Speech 首屏無手勢可能靜音（可接受退化）。
4. **P2 五列滿版**：`.list{flex:1}`＋`.row{flex:1}` 等分剩餘高度、垂直置中；樣式 only。
5. **P3 地圖→OSM 導航（外部瀏覽器）**：URL
   `https://www.openstreetmap.org/directions?from={uLat},{uLng}&to={lat},{lng}#map=16/{lat}/{lng}`
   （from/to 參數已驗證為官方支援；無定位時省略 from）。
   App 內走問題 1 的 `open_external`；提示字改「點擊地圖規劃路線 →」。改 `DetailView.vue`。
6. **P1 加上一頁**：`CategoryView.vue` 頂欄加 `‹` 回 P0（in-flow 導航，不離開服務）。
   當初拿掉的是「離開型」返回鍵，此項不衝突。
7. **語音腳本集中化**：新建 `web/src/voice/scripts.ts`，把散在四個 view 的約 11 句中文
   （P0 問句/確認、分類提示含數字、列表摘要＋翻頁、空/錯提示、詳細＋翻頁）全部收斂，
   view 只呼叫函式。

### 5.3 實作後驗證清單（adb）

```bash
export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"
adb reverse tcp:8080 tcp:8080   # 僅本機測試用；tunnel 版不需要
```

- 餘額→系統瀏覽器開啟 easycard 頁；logcat 有 `open_external` 送達。
- 重進自動聽到問句；P1 有 `‹` 且可回 P0 重播。
- 列表 1–5 編號、翻頁重來；短螢幕 5 列滿版（截圖）。
- 地圖點擊→瀏覽器 OSM 導航頁，起訖點正確。
- 全程 logcat 無 bridge error；TTS 各頁完成（`TTS : Utterance ... completed`）。

## 6. 已知坑（必讀，省時間）

1. **adb 點不進服務頁的列**：`adb shell input tap` 對服務頁清單列長期無效（tab 欄可點、pinned 可點、手指可點）。
   驗證時請 user 用手指點進服務，之後 WebView 內的 HTML 按鈕 adb 可點。
2. **WebView 不重載舊 bundle**：Vite 產物檔名含 hash，SPA 載入後不會自動更新；
   前端改完重部署後，必須關閉重進 WebView 才能看到新版。
3. **Cloudflare 注入驗證腳本**：曾在回傳 HTML 看到 `/cdn-cgi/challenge-platform` 注入，
   代表帳號 Bot 防護在挑戰此 hostname。已請 user 關閉該 hostname 的 Bot Fight Mode；
   若 WebView 載入異常先查這個。
4. **`.gitignore` 錨定**：`data/`、`ref/` 必須寫成 `/data/`、`/ref/`，
   否則會誤殺 `senior-card/api/data/venues.db`（§5.0 的教訓）。
5. **TTS 超時**：`tts_speak`  web 端 timeout 10 分鐘、原生端同值；換頁/關閉必 `stop()`。
6. **合併規則**：同站名＋相距 <300m 只留最近一筆（呈現層處理，DB 未動）。
7. **DB 唯讀**：API 以 `Mode=ReadOnly` 開檔，容器無狀態，不需 volume/備份。
8. **Demo 用 debug APK 即可**（已驗證流程）；release 簽署另行處理。
9. **授權紅線**：地圖只能用 NLSC（主）/Esri（備援）；執行期禁用雲端 AI；
   新套件只選 MIT/BSD/Apache；提交授權 AGPL-3.0（`senior-card/LICENSE`）。

## 7. 已鎖定的需求決策（勿推翻，除非 user 改口）

- P0 每次進入都問語音開關；列表取 20 筆（5 筆一頁）；優惠 2 條一頁；
  同名合併；頁內離開型返回鍵全拿（用 App 原生 X）；底圖 NLSC 為主；
  編號每頁重來 1–5；P2/P3 保留 in-flow 返回；DB 不加欄位不改內容。
