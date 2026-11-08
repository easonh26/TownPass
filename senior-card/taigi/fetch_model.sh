#!/bin/bash
# Fetch the Taigi VITS model + tokens into Flutter assets (build-time).
# Priority: 1) TAIGI_MODEL_PATH (default: repo-root onnx_out/) 2) TAIGI_MODEL_URL
# The 114MB model.onnx is NOT committed to git (GitHub 100MB/file limit).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/assets/models/taigi-vits"
SRC_PATH="${TAIGI_MODEL_PATH:-$ROOT/onnx_out/model.onnx}"
TOK_PATH="${TAIGI_TOKENS_PATH:-$ROOT/onnx_out/tokens.txt}"

mkdir -p "$DEST"

fetch_one() {
  local src="$1" name="$2"
  if [ -f "$DEST/$name" ]; then
    echo "exists: $DEST/$name"
    return 0
  fi
  if [ -f "$src" ]; then
    cp "$src" "$DEST/$name"
    echo "copied: $src -> $DEST/$name"
    return 0
  fi
  return 1
}

if ! fetch_one "$SRC_PATH" "model.onnx"; then
  if [ -n "${TAIGI_MODEL_URL:-}" ]; then
    echo "downloading model from \$TAIGI_MODEL_URL..."
    curl -L --fail -o "$DEST/model.onnx" "$TAIGI_MODEL_URL"
  else
    echo "WARN: model.onnx not found (looked at $SRC_PATH) and \$TAIGI_MODEL_URL unset."
    echo "Taigi TTS will report unavailable at runtime; Mandarin still works."
    exit 0
  fi
fi

fetch_one "$TOK_PATH" "tokens.txt" || {
  echo "WARN: tokens.txt not found at $TOK_PATH; Taigi TTS needs it."
  exit 0
}

cat > "$DEST/NOTICE" <<'EOF'
Taigi (Taiwanese Minnan) VITS model for on-device TTS.
- Model: neurlang/coqui-vits-suisiann-minnan-hokkien (ONNX export by team)
- Source: https://huggingface.co/neurlang/coqui-vits-suisiann-minnan-hokkien
- License: CC-BY-SA-4.0 (model file stays under BY-SA; attribution retained here)
- Dataset: ceciliayl/SuiSiann_raw_tone
EOF

ls -la "$DEST"
