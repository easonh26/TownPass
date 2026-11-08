# 2026 台北城市通黑客松 - 樂齡點通 (敬老卡優惠與交通路網整合應用)

## 專案介紹
本專案為參與 **2026 台北城市通黑客松** 開發之應用服務。主要目標是針對「銀髮族」，提供易讀、圖像化的城市指引服務。我們重點關注交通與生活設施，將大台北地區的多元交通運具與場館設施整合，並特別串接了敬老卡的扣點規則，幫助使用者快速掌握出行與優惠資訊。微服務專案位於/senior-card中


## 實作功能 

*   **多運具與場館資料整合**：
    *   整合「運動、景點、娛樂、醫療場所」等場域資訊。
    *   整合大台北地區交通路網，包含公車、捷運 (含淡海/安坑輕軌)、臺鐵、貓空纜車。

*   **敬老卡優惠試算與顯示**：
    *   明確列出各項交通工具與場館的「敬老悠遊卡」單次最高扣點點數，提供最精準的出行預算參考。

*   **在地化離線資料庫 (`venues.db`)**：
    *   透過 Python 腳本動態與手動混合作業，將各類場館與交通節點轉換為 `venues.db` SQLite 檔案。
*   **敬老卡點數與優惠地圖**：
使用 TypeScript 、OpenStreetMap 與 Leaflet 建立互動地圖，整合敬老卡適用場館、地理位置及優惠資訊。
*   **高齡友善語音朗讀(國語、台語)**：
使用 Web Speech API 實作文字轉語音功能，以及使用 Coqui VITS SuíSiann 模型，將台羅拼音作為輸入腳本進行文字轉語音輸出 ，協助長者理解資訊。
*   **臺北通原生整合**：
透過 window.flutterObject.postMessage 實現 Web 與 Flutter App 的雙向訊息交換。


*   使用 Vue 3 建立互動介面，透過 Flutter WebView 與臺北通 App 進行資料交換。

*   使用 TypeScript 、OpenStreetMap 與 Leaflet 建立互動地圖，整合敬老卡適用場館、地理位置及優惠資訊。

*   使用 Web Speech API 實作文字轉語音功能，協助長者理解資訊。
*   採用 Vue 3 + Vite + TS 建立響應式介面原型。



## 系統架構與技術棧 
Base URL（經 nginx 同源代理）：`/api`

### GET /api/health

json
{ "status": "ok", "time": "2026-11-07T13:31:57Z" }

DB 無法開啟時回 503。

### GET /api/v1/places

依類別查離使用者最近的場所（由近到遠）。

| 參數 | 必填 | 說明 |
|---|---|---|
| category | 是 | 交通 / 娛樂 / 運動 / `醫療`（對應 `main_category`） |
| lat | 是 | 緯度（-90～90） |
| lng | 是 | 經度（-180～180） |
| limit | 否 | 預設 20，上限 50 |
| subcategory | 否 | 僅 category=交通 有效：`公車` / `捷運`（含機場捷運）/ 臺鐵 / 貓空纜車 |
| lang | 否 | taigi 時查台語庫，回傳加 `namePhonemes`（`places/{id}` 另加 `benefitsPhonemes`）；缺台語庫 → 503 |

演算法：SQL bounding-box 粗篩 → C# Haversine 精算排序 →
半徑自動擴張（0.5 → 1 → 2 → 5 → 10 km）→ 同站名 300m 內合併。

json
{
  "radiusMeters": 1000,
  "items": [{
    "id": "V001", "name": "中山運動中心", "subCategory": "運動中心",
    "address": "臺北市…", "lat": 25.0548, "lng": 121.5216,
    "points": 50, "discountInfo": "1.游泳…",
    "distanceMeters": 486
  }]
}

錯誤：`category` 非法或經緯度超範圍 → 400；`subcategory` 非法或用於非交通類 → 400。

### GET /api/v1/places/{id}

單一場所詳細（含 `benefits[]`，由 discount_info 以 `。` 切分）。
`lat`/`lng` 可省略，省略時 distanceMeters 為 null。

json
{
  "id": "V001", "name": "中山運動中心", "subCategory": "運動中心",
  "address": "臺北市…", "lat": 25.0548, "lng": 121.5216,
  "points": 50, "discountInfo": "1.游泳…", "distanceMeters": 486,
  "benefits": ["1.游泳池每次使用扣50點。", "2.健身房…。"]
}

找不到 → 404。


## 參考資料與 API 來源 (References)
本專案的資料收集與開發，感謝以下公開資料平台與黑客松官方指南的支援：
1.  **2026 台北城市通黑客松入門指引**：
    *   遵循官方「政府端」與「市民端」六大評估面向進行功能設計。

2.  **[TDX 運輸資料流通服務平臺 (Transport Data eXchange)](https://tdx.transportdata.tw/)**：
    *   用於串接大台北捷運與輕軌 (https://tdx.transportdata.tw/api/basic/v2/Rail/Metro/Station/TRTC?$format=JSON)。
    *   用於串接臺鐵北部車站 (https://tdx.transportdata.tw/api/basic/v3/Rail/TRA/Station?$format=JSON)。
    *   用於串接大台北市區公車站牌 (https://tdx.transportdata.tw/api/basic/v2/Bus/Station/City/{city}?$format=JSON)。

    *   其他地址是Google Map 和 台北市資料大平台
(https://data.taipei/dataset/detail?id=b7c8e724-1e98-45ee-a0bd-f3840623ed97)。

3.  **臺北市政府社會局 - 敬老悠遊卡使用範圍與扣點規定**：
    *   [敬老卡/愛心卡搭乘大眾運輸及場館設施優惠說明](https://dosw.gov.taipei/cp.aspx?n=59C18B4C973AED21)
    *   依此規則為基底，定義貓空纜車(每次扣50點)、臺鐵(單趟最高扣150點)等扣點邏輯。

4. **台灣媠聲 - 台語文字轉語音的模型**
(https://github.com/i3thuan5/SuiSiann-KauTui)
https://huggingface.co/neurlang/coqui-vits-suisiann-minnan-hokkien)
    * 模型發布者：neurlang
    * 授權聲明：依 CC BY-SA 4.0 授權條款使用，該授權允許商業及非商業使用、重製與改作，但使用者須遵守姓名標示及相同方式分享等授權條件。


5. **縮放、拖曳及顯示店家位置的互動式地圖** 
* OpenStreetMap
(https://www.openstreetmap.org/?utm_source=chatgpt.com#map=18/25.116444/121.534498&layers=N)
    * 授權聲明：OpenStreetMap 地圖資料採用 Open Data Commons Open Database License（ODbL 1.0），使用時須標示 OpenStreetMap 及其貢獻者來源。


* Leaflet
(https://leafletjs.com/?utm_source=chatgpt.com)
    * 授權聲明：Leaflet 採用 BSD 2-Clause License，允許免費使用、修改及應用於商業專案，但須保留相關著作權及授權聲明。


6. 地圖封面圖
    * 內政部國土測繪中心（NLSC）
(https://www.nlsc.gov.tw/)

7. 語音朗讀服務：Web Speech API 透過瀏覽器內建的 speechSynthesis 實作文字轉語音
(https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
8. 字型資源：Google Fonts — Noto Sans TC：開源字型（SIL Open Font License 1.1）。
(https://fonts.google.com/noto/specimen/Noto+Sans+TC/license?preview.script=Hant)




# What is Town Pass?

Town Pass is an open-source project developed by the Taipei City Government. With the growth of smart cities, the demand for digitalization in city management and citizen services continues to rise. As we enter a new digital era, our goal is to involve citizens in the process, combining third-party expertise and innovation to make digital life in Taipei more convenient.

Town Pass is not just an application; it is an open community project. Through open-source, every citizen can participate in the ideation, development, and optimization of the application. This not only enhances citizen engagement and satisfaction but also leverages collective intelligence to continuously improve the application, making it truly serve the people. Furthermore, we hope that various municipalities can widely adopt the open-source framework of Town Pass, integrate it with their existing municipal service systems, and quickly have their own applications to enhance digital governance.

Open source is a key driver of technological progress and social development. Through open-source, Town Pass will become an ever-evolving platform, attracting developers from all backgrounds to contribute. We welcome experts to submit code, report issues, provide suggestions, and even develop new features and creative ideas, working together to perfect Town Pass as we advance toward a smart city.

# Getting Started

We highly recommend to read through our [document](https://tpe-guideline.web.app/en/docs/) for more detail.

Here are some quick setup guide.

## Requirement

- [Flutter](https://docs.flutter.dev/get-started/install) or [FVM](https://fvm.app/documentation/getting-started/installation)
- [XCode](https://developer.apple.com/xcode/) (for iOS)
- [Android SDK](https://developer.android.com/studio/index.html) (for Android, with or without Android Studio)

## Build the Project

1. Get the packages project needed:

   ``` bash
   flutter pub get
   ```

2. Generate additional needed dart code for the project.

   ``` bash
   dart run build_runner build
   ```

3. You are all set now, Run the project from your IDE or the through the command line:

   ``` bash
   flutter run
   ```
