#!/usr/bin/env bash
# Capture iPhone screenshots for App Store Connect (6.7" display).
# Usage: ./scripts/app-store-capture-screenshots.sh
#
# Before running:
# 1. Boot Simulator or run Fin$ol from Xcode on iPhone 16 Pro Max simulator
# 2. Log in to the app (or open https://fin-sol-pied.vercel.app in Safari on simulator)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/app-store/screenshots/6.7-inch"
DEVICE="${SIM_DEVICE:-iPhone 16 Pro Max}"

mkdir -p "$OUT"

boot_sim() {
  if ! xcrun simctl list devices booted | grep -q Booted; then
    echo "Booting $DEVICE..."
    xcrun simctl boot "$DEVICE" 2>/dev/null || true
    open -a Simulator
    sleep 3
  fi
}

boot_sim

SCREENS=(
  "01-dashboard:لوحة التحكم / Dashboard"
  "02-transactions:المعاملات / Transactions"
  "03-savings:الادخار / Savings"
  "04-salary:الراتب / Salary"
  "05-showcase:التقرير السنوي / Annual report"
)

echo ""
echo "Fin\$ol — App Store screenshot capture"
echo "Output: $OUT"
echo ""
echo "Open the app (or Safari → fin-sol-pied.vercel.app) and LOG IN first."
echo ""

for entry in "${SCREENS[@]}"; do
  file="${entry%%:*}"
  label="${entry##*:}"
  echo "→ Navigate to: $label"
  echo "  Press Enter when ready..."
  read -r
  path="$OUT/${file}.png"
  xcrun simctl io booted screenshot "$path"
  echo "  Saved: $path"
  echo ""
done

echo "Done. Upload PNGs from:"
echo "  $OUT"
echo ""
echo "App Store Connect → iOS App Version 1.0 → Screenshots → iPhone 6.7\" Display"
echo ""
wc -c "$OUT"/*.png 2>/dev/null | head -5 || true
