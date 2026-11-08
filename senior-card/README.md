# 敬老卡優惠場所查詢（senior-card）

2026 臺北秋季程式設計節 · 城市通微服務大黑客松參賽作品。
在 TownPass App「服務頁 / 熱門」以 WebView 開啟的微服務：
查詢台北市敬老卡點數可用場所（交通 / 娛樂 / 運動 / 醫療），
依使用者目前位置由近到遠列表顯示，點選看詳細資訊與靜態地圖。
全程零滑動、大字大鈕、可選語音朗讀，方便長者操作。

## 架構

```text
TownPass App（服務頁 / 熱門 → TPWebView）
  ↕ flutterObject bridge（location 內建；tts_* 自訂 Handler）
https://cdf19.twread.net/
  → Cloudflare Tunnel → cloudflared 容器 → nginx(web:80)
      ├─ /      Vue 3 + Vite + TS 單頁應用
      └─ /api   ASP.NET Core 10 API → venues.db（唯讀，bake 進 image）
```

## 目錄

```text
senior-card/
├─ web/        前端（P0 語音 → P1 分類 → P2 列表 → P3 詳細）
├─ api/        後端（/api/health、/api/v1/places、/api/v1/places/{id}）
├─ deploy/     docker-compose.yml、nginx.conf、.env.example
├─ docs/       api.md、architecture.md、demo-script.md
└─ ref/        設計稿 HTML + venues.db（原始素材，保留對照）
```

## 本機開發

```bash
# 1. 後端 + 前端容器（不需 tunnel token）
cd senior-card/deploy
docker compose up -d --build web api
curl http://localhost:8080/api/health

# 2. 前端 dev（另開終端，API 會被 proxy 到 localhost:8080）
cd senior-card/web
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TS 檢查
npm run build      # 生產 build（給 Docker 用）
```

## 正式部署（需要 Cloudflare Tunnel token）

```bash
cp senior-card/deploy/.env.example senior-card/deploy/.env
# 把 tunnel token 填入 senior-card/deploy/.env 的 CLOUDFLARE_TUNNEL_TOKEN
# Cloudflare 後台 Public hostname：cdf19.twread.net → http://web:80

cd senior-card/deploy
docker compose up -d --build
curl https://cdf19.twread.net/api/health
```

## App 端（TownPass fork 內的修改）

- `assets/svg/icon_senior.svg`：服務圖示（build_runner 已產生）
- `lib/util/tp_constant.dart`：`kMicroserviceUrl`（可用 `--dart-define=MICROSERVICE_URL=` 覆寫）
- `lib/page/city_service/model/my_service_model.dart`：新增 `seniorCard`
- `lib/page/city_service/model/trending_service_model.dart`：熱門新增一筆
- `lib/service/senior_tts_service.dart` + `lib/util/web_message_handler/tp_tts_message_handler.dart`：
  新增 `tts_check` / `tts_speak` / `tts_stop` Handler（`flutter_tts`，MIT）
- `android/app/src/main/AndroidManifest.xml`：補 `INTERNET` 權限（release 必備）

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter build apk --debug --dart-define=MICROSERVICE_URL=https://cdf19.twread.net/
```

## 資料來源

- 場所資料：隊伍自行整理 `venues.db`（14,387 筆，敬老卡合作場所）。
  核心欄位（名稱 / 類別 / 地址 / 座標 / 扣點 / 扣點詳情）皆為自行整理；
  無第三方開放資料集。
- 台語音標庫：`api/data/venues_taigi.db`（`venues.db` 副本＋`name_phonemes` /
  `discount_phonemes`，由 `senior-card/taigi/make_taigi_db.py` 以 pygoruut 0.6.3
  `MinnanHokkien2` 轉寫產生，詳見 `senior-card/taigi/`）。
  未能轉寫的 68 筆（OOV 清單見 `oov_review.md`）台語模式自動降級國語。
- 地圖圖資：內政部國土測繪中心「臺灣通用電子地圖」WMTS
  （`https://wmts.nlsc.gov.tw/wmts`，免申請開放介接），
  備援 Esri World Street Map（皆標註 attribution）。

## 第三方套件與授權

| 套件 | 授權 |
|---|---|
| Vue 3、Vite、TypeScript | MIT |
| Leaflet | BSD-2-Clause |
| ASP.NET Core、Microsoft.Data.Sqlite | MIT |
| SQLite | Public Domain |
| nginx | BSD-2-Clause |
| cloudflared | Apache-2.0（Cloudflare Tunnel 免費方案） |
| flutter_tts（App 端 TTS） | MIT |
| flutter_onnxruntime（App 端台語 VITS 推論） | MIT |
| audioplayers（App 端台語音檔播放） | MIT |
| pygoruut 0.6.3（僅筆電 build-time 音標轉換，未進 App） | 見 PyPI（開源） |
| TownPass 本體 | GPL-3.0（本作品整體以 AGPL-3.0 釋出，見 LICENSE） |

## 台語 TTS 模型揭露

- 模型：`neurlang/coqui-vits-suisiann-minnan-hokkien`（VITS，22050 Hz），
  由團隊匯出為 ONNX（`onnx_out/model.onnx`，114MB，不進版控；
  詳見 `senior-card/taigi/TAIGI_MODEL_NOTICE.md`）。
- 授權：**CC-BY-SA-4.0**（模型檔維持 BY-SA，署名如上）。
- 執行方式：**裝置端 onnxruntime 推論**，無雲端/遠端模型呼叫；
  音標由 build-time 預算（venues_taigi.db＋前端碎片），執行期零聯網。
- 模型檔大於 GitHub 單檔上限：`fetch_model.sh` 在 build 前抓入
  `assets/models/taigi-vits/`（預設讀 repo 根 `onnx_out/`）。

## AI 使用聲明

- 開發階段：有使用雲端 AI 工具協助撰寫程式與文件（競賽允許）。
- 執行階段：**未使用 LLM 推論**（無雲端模型呼叫）。
  語音朗讀使用裝置內建 TTS 引擎（Android TextToSpeech / iOS AVSpeech），
  台語語音使用裝置端 VITS 聲學模型（onnxruntime，見上）；
  皆於手機上完成，非雲端 AI 推論。

## Demo 流程（2 分鐘）

1. App「服務」→「熱門」→「敬老卡優惠場所查詢」（0:00–0:15）
2. P0 選「是」（語音朗讀啟動）（0:15–0:30）
3. P1 點「交通」→ P2 顯示最近場所、距離、扣點（0:30–1:10）
4. 點第一列 → P3 靜態地圖 + 優惠翻頁（1:10–1:40）
5. 技術一句話：同源 nginx + ASP.NET + SQLite 唯讀庫、NLSC 圖資、裝置端 TTS（1:40–2:00）

## 授權

本作品以 GNU AGPL-3.0 釋出，見 `LICENSE`。
