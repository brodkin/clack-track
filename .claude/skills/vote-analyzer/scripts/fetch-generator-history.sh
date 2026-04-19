#!/usr/bin/env bash
# fetch-generator-history.sh — Show recent git changes for every file that
# can cause a generator's output to change.
#
# Usage: fetch-generator-history.sh <generator-id> [since-date]
#   generator-id: e.g. "daily-roast", "one-star-review"
#   since-date:   ISO date to look back from (default: 180 days ago).
#                 Callers should pass a date older than the analysis window
#                 so commits before the window are still visible.
#
# Checks (in order):
#   1. User prompt         prompts/user/<id>.txt
#   2. Generator source    src/content/generators/ai/<id>-generator.ts
#   3. Dictionaries        src/content/generators/ai/<id>-dictionaries.ts  (if exists)
#   4. Registry entry      src/content/registry/register-core.ts           (filtered to id)
#   5. System prompt       prompts/system/major-update-base.txt
#
# For each: per-file last-modified date, commit subjects since <since-date>,
# and the diff of the most recent commit in the window.

set -euo pipefail

GENERATOR_ID="${1:?Usage: fetch-generator-history.sh <generator-id> [since-date]}"
SINCE="${2:-$(date -d '180 days ago' +%Y-%m-%d 2>/dev/null || date -v-180d +%Y-%m-%d)}"

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

PROMPT_FILE="prompts/user/${GENERATOR_ID}.txt"
SOURCE_FILE="src/content/generators/ai/${GENERATOR_ID}-generator.ts"
DICT_FILE="src/content/generators/ai/${GENERATOR_ID}-dictionaries.ts"
REGISTRY_FILE="src/content/registry/register-core.ts"
SYSTEM_PROMPT="prompts/system/major-update-base.txt"

# Files to scan in full (existence-checked below)
FILES=("$PROMPT_FILE" "$SOURCE_FILE")
[[ -f "$DICT_FILE" ]] && FILES+=("$DICT_FILE")
FILES+=("$SYSTEM_PROMPT")

for FILE in "${FILES[@]}"; do
  if [[ ! -f "$FILE" ]]; then
    echo "=== $FILE: NOT FOUND ==="
    echo ""
    continue
  fi

  LAST_COMMIT=$(git log -1 --format="%H %ai %s" -- "$FILE" 2>/dev/null || echo "no history")

  echo "=== $FILE ==="
  echo "Last modified: $LAST_COMMIT"
  echo ""

  RECENT=$(git log --since="$SINCE" --format="%ai | %s" -- "$FILE" 2>/dev/null)
  if [[ -n "$RECENT" ]]; then
    echo "Changes since $SINCE:"
    echo "$RECENT"
    echo ""
    LAST_SHA=$(git log -1 --format="%H" --since="$SINCE" -- "$FILE" 2>/dev/null)
    if [[ -n "$LAST_SHA" ]]; then
      echo "Most recent change diff:"
      git diff "${LAST_SHA}~1..${LAST_SHA}" -- "$FILE" 2>/dev/null || echo "(first commit, no parent diff)"
      echo ""
    fi
  else
    echo "No changes since $SINCE"
    echo ""
  fi
done

# Registry entry: scan register-core.ts commits, but only keep those whose
# diff actually touches lines mentioning this generator id. Unrelated edits
# to the file (other generators) would otherwise pollute the signal.
echo "=== $REGISTRY_FILE (filtered to '$GENERATOR_ID') ==="
if [[ ! -f "$REGISTRY_FILE" ]]; then
  echo "NOT FOUND"
  echo ""
else
  MATCHED_COMMITS=$(git log --since="$SINCE" --format="%H %ai | %s" -- "$REGISTRY_FILE" 2>/dev/null | \
    while IFS= read -r line; do
      SHA="${line%% *}"
      if git show "$SHA" -- "$REGISTRY_FILE" 2>/dev/null | grep -q "'$GENERATOR_ID'"; then
        echo "$line"
      fi
    done)

  if [[ -n "$MATCHED_COMMITS" ]]; then
    echo "Registry changes touching '$GENERATOR_ID' since $SINCE:"
    echo "$MATCHED_COMMITS" | cut -d' ' -f2-
    echo ""
    LATEST_REG_SHA=$(echo "$MATCHED_COMMITS" | head -1 | awk '{print $1}')
    if [[ -n "$LATEST_REG_SHA" ]]; then
      echo "Most recent registry diff:"
      git diff "${LATEST_REG_SHA}~1..${LATEST_REG_SHA}" -- "$REGISTRY_FILE" 2>/dev/null || \
        echo "(first commit, no parent diff)"
      echo ""
    fi
  else
    echo "No registry changes touching '$GENERATOR_ID' since $SINCE"
    echo ""
  fi
fi
