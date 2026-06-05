#!/usr/bin/env bash
# Print all App Store Connect fields for copy-paste.
# Usage: ./scripts/app-store-print.sh [field]
#   ./scripts/app-store-print.sh description   # copy one field
#   ./scripts/app-store-print.sh               # print all

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
META="$ROOT/app-store/metadata"

copy() {
  if command -v pbcopy >/dev/null 2>&1; then
    pbcopy
    echo "  (copied to clipboard)"
  fi
}

print_field() {
  local label="$1"
  local file="$2"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  cat "$file"
  echo ""
}

case "${1:-all}" in
  name)           cat "$META/ar/name.txt" | copy ;;
  subtitle)       cat "$META/ar/subtitle.txt" | copy ;;
  promotional)    cat "$META/ar/promotional_text.txt" | copy ;;
  description)    cat "$META/ar/description.txt" | copy ;;
  keywords)       cat "$META/ar/keywords.txt" | copy ;;
  release_notes)  cat "$META/ar/release_notes.txt" | copy ;;
  support_url)    cat "$META/urls/support_url.txt" | copy ;;
  marketing_url)  cat "$META/urls/marketing_url.txt" | copy ;;
  privacy_url)    cat "$META/urls/privacy_url.txt" | copy ;;
  copyright)      cat "$META/copyright.txt" | copy ;;
  review)         cat "$ROOT/app-store/review/demo_account.txt" ;;
  privacy)        cat "$ROOT/app-store/compliance/app-privacy.md" ;;
  encryption)     cat "$ROOT/app-store/compliance/encryption.txt" ;;
  content-rights) cat "$ROOT/app-store/compliance/content-rights.txt" ;;
  all)
    print_field "NAME (App name — or keep المحاسب الصادق)" "$META/ar/name.txt"
    print_field "SUBTITLE" "$META/ar/subtitle.txt"
    print_field "PROMOTIONAL TEXT (170 chars max)" "$META/ar/promotional_text.txt"
    print_field "DESCRIPTION" "$META/ar/description.txt"
    print_field "KEYWORDS (100 chars max, comma-separated)" "$META/ar/keywords.txt"
    print_field "SUPPORT URL" "$META/urls/support_url.txt"
    print_field "MARKETING URL" "$META/urls/marketing_url.txt"
    print_field "COPYRIGHT" "$META/copyright.txt"
    print_field "WHAT'S NEW / Release Notes" "$META/ar/release_notes.txt"
    print_field "APP REVIEW — Demo account" "$ROOT/app-store/review/demo_account.txt"
    echo "Privacy URL (App Information): $(cat "$META/urls/privacy_url.txt")"
    echo ""
    echo "Quick copy commands:"
    echo "  npm run app-store:copy -- description"
    echo "  npm run app-store:copy -- keywords"
    echo "  npm run app-store:screenshots"
    ;;
  *)
    echo "Unknown field: $1"
    echo "Fields: name subtitle promotional description keywords release_notes"
    echo "        support_url marketing_url privacy_url copyright review privacy encryption content-rights all"
    exit 1
    ;;
esac
