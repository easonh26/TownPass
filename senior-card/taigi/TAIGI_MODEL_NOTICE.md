# 台語 TTS 模型聲明

- 模型：`neurlang/coqui-vits-suisiann-minnan-hokkien`（VITS，22.05 kHz），由團隊匯出為 ONNX（`onnx_out/model.onnx`）
- 來源：https://huggingface.co/neurlang/coqui-vits-suisiann-minnan-hokkien
- 訓練資料集：`ceciliayl/SuiSiann_raw_tone`
- 前端音標：pygoruut 0.6.3 `MinnanHokkien2`（轉換管線見 `make_taigi_db.py`）
- **授權：CC-BY-SA-4.0**。模型檔本身維持 BY-SA（署名＋相同方式分享），不混入本專案 AGPL-3.0 程式碼授權。
  應用程式播放的合成語音用於本服務播報，模型來源如上揭露。
- 取得方式：`./senior-card/taigi/fetch_model.sh`（預設讀 repo 根 `onnx_out/`，或設 `TAIGI_MODEL_URL`）。
  114MB 模型檔不進版控（見根目錄 `.gitignore`）。
