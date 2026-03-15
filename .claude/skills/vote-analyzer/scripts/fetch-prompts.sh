#!/usr/bin/env bash
# fetch-prompts.sh — Read the user prompt file for a given generator ID
#
# Usage: fetch-prompts.sh <generator-id>
#   Maps generator IDs (e.g. "daily-roast") to prompt files in prompts/user/
#
# Outputs: The prompt file content to stdout

set -euo pipefail

GENERATOR_ID="${1:?Usage: fetch-prompts.sh <generator-id>}"
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
PROMPTS_DIR="$PROJECT_ROOT/prompts/user"

# Map generator ID to prompt filename (most are direct kebab-to-kebab)
PROMPT_FILE="$PROMPTS_DIR/$GENERATOR_ID.txt"

if [[ -f "$PROMPT_FILE" ]]; then
  echo "=== User Prompt: $GENERATOR_ID ==="
  cat "$PROMPT_FILE"
  exit 0
fi

# Some generators have different file names than their IDs
# Try common variations
VARIATIONS=(
  "$PROMPTS_DIR/${GENERATOR_ID//-/_}.txt"
  "$PROMPTS_DIR/${GENERATOR_ID}.txt"
)

for variant in "${VARIATIONS[@]}"; do
  if [[ -f "$variant" ]]; then
    echo "=== User Prompt: $GENERATOR_ID ($(basename "$variant")) ==="
    cat "$variant"
    exit 0
  fi
done

echo "No user prompt file found for generator '$GENERATOR_ID'" >&2
echo "Available prompts:" >&2
ls "$PROMPTS_DIR"/*.txt 2>/dev/null | xargs -I{} basename {} .txt >&2
exit 1
