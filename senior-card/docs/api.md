# senior-card API

Base URL（經 nginx 同源代理）：`/api`

## GET /api/health

```json
{ "status": "ok", "time": "2026-11-07T13:31:57Z" }
```

DB 無法開啟時回 503。

## GET /api/v1/places

依類別查離使用者最近的場所（由近到遠）。

| 參數 | 必填 | 說明 |
|---|---|---|
| `category` | 是 | `交通` / `娛樂` / `運動` / `醫療`（對應 `main_category`） |
| `lat` | 是 | 緯度（-90～90） |
| `lng` | 是 | 經度（-180～180） |
| `limit` | 否 | 預設 20，上限 50 |

演算法：SQL bounding-box 粗篩 → C# Haversine 精算排序 →
半徑自動擴張（0.5 → 1 → 2 → 5 → 10 km）→ 同站名 300m 內合併。

```json
{
  "radiusMeters": 1000,
  "items": [{
    "id": "V001", "name": "中山運動中心", "subCategory": "運動中心",
    "address": "臺北市…", "lat": 25.0548, "lng": 121.5216,
    "points": 50, "discountInfo": "1.游泳…",
    "distanceMeters": 486
  }]
}
```

錯誤：`category` 非法或經緯度超範圍 → 400。

## GET /api/v1/places/{id}

單一場所詳細（含 `benefits[]`，由 `discount_info` 以 `。` 切分）。
`lat`/`lng` 可省略，省略時 `distanceMeters` 為 null。

```json
{
  "id": "V001", "name": "中山運動中心", "subCategory": "運動中心",
  "address": "臺北市…", "lat": 25.0548, "lng": 121.5216,
  "points": 50, "discountInfo": "1.游泳…", "distanceMeters": 486,
  "benefits": ["1.游泳池每次使用扣50點。", "2.健身房…。"]
}
```

找不到 → 404。

## 運維

- Rate limit：每 IP 每分鐘 120 次（429 節流）。
- DB 唯讀開啟（`Mode=ReadOnly`），容器無狀態，不需 volume 備份。
- 健康檢查：`curl -f http://localhost:8080/api/health`（compose healthcheck 已設）。
