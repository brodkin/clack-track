#!/usr/bin/env bash
# fetch-generator-history.sh — Show recent git changes for a generator's files
#
# Usage: fetch-generator-history.sh <generator-id> [since-date]
#   generator-id: e.g. "daily-roast", "one-star-review"
#   since-date: ISO date to look back from (default: 90 days ago)
#
# Checks: user prompt, generator source, and system prompt
# Outputs: per-file last-modified date, commit messages, and diffs

set -euo pipefail

GENERATOR_ID="${1:?Usage: fetch-generator-history.sh <generator-id> [since-date]}"
SINCE="${2:-$(date -d '90 days ago' +%Y-%m-%d 2>/dev/null || date -v-90d +%Y-%m-%d)}"

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# Files to check for this generator
PROMPT_FILE="prompts/user/${GENERATOR_ID}.txt"
SOURCE_FILE="src/content/generators/ai/${GENERATOR_ID}-generator.ts"
SYSTEM_PROMPT="prompts/system/major-update-base.txt"

for FILE in "$PROMPT_FILE" "$SOURCE_FILE" "$SYSTEM_PROMPT"; do
  if [[ ! -f "$FILE" ]]; then
    echo "=== $FILE: NOT FOUND ==="
    echo ""
    continue
  fi

  # Get last commit date and message for this file
  LAST_COMMIT=$(git log -1 --format="%H %ai %s" -- "$FILE" 2>/dev/null || echo "no history")

  echo "=== $FILE ==="
  echo "Last modified: $LAST_COMMIT"
  echo ""

  # Show commits since the lookback date
  RECENT=$(git log --since="$SINCE" --format="%ai | %s" -- "$FILE" 2>/dev/null)
  if [[ -n "$RECENT" ]]; then
    echo "Changes since $SINCE:"
    echo "$RECENT"
    echo ""
    # Show the actual diff for the most recent commit
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
