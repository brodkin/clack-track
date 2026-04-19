#!/usr/bin/env bash
# fetch-prompts.sh — Dump all prompt + source context for a generator
#
# Usage: fetch-prompts.sh <generator-id>
#
# Emits (each in its own === section ===):
#   1. User prompt        prompts/user/<id>.txt
#   2. System prompt      prompts/system/major-update-base.txt
#   3. Generator source   src/content/generators/ai/<id>-generator.ts
#   4. Dictionaries       src/content/generators/ai/<id>-dictionaries.ts  (if present)
#   5. Registry entry     block in src/content/registry/register-core.ts referencing the id

set -euo pipefail

GENERATOR_ID="${1:?Usage: fetch-prompts.sh <generator-id>}"
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

emit_section() {
  local title="$1"
  local path="$2"
  echo ""
  echo "=== $title ==="
  if [[ -f "$path" ]]; then
    cat "$path"
  else
    echo "(not found at $path)"
  fi
}

# 1. User prompt (try kebab-case, then underscore fallback)
USER_PROMPT="$PROJECT_ROOT/prompts/user/$GENERATOR_ID.txt"
if [[ ! -f "$USER_PROMPT" ]]; then
  ALT="$PROJECT_ROOT/prompts/user/${GENERATOR_ID//-/_}.txt"
  if [[ -f "$ALT" ]]; then
    USER_PROMPT="$ALT"
  fi
fi
emit_section "User Prompt ($GENERATOR_ID)" "$USER_PROMPT"

# 2. System prompt (shared by all major-update generators)
emit_section "System Prompt (major-update-base)" "$PROJECT_ROOT/prompts/system/major-update-base.txt"

# 3. Generator TypeScript source — holds dictionaries, tier, selection logic
emit_section "Generator Source" "$PROJECT_ROOT/src/content/generators/ai/${GENERATOR_ID}-generator.ts"

# 4. Co-located dictionaries file (only some generators have one)
DICT_FILE="$PROJECT_ROOT/src/content/generators/ai/${GENERATOR_ID}-dictionaries.ts"
if [[ -f "$DICT_FILE" ]]; then
  emit_section "Dictionaries" "$DICT_FILE"
fi

# 5. Registry entry — tier, priority, toolBasedOptions
REGISTRY="$PROJECT_ROOT/src/content/registry/register-core.ts"
echo ""
echo "=== Registry Entry ($GENERATOR_ID) ==="
if [[ -f "$REGISTRY" ]]; then
  if grep -q "id: '$GENERATOR_ID'" "$REGISTRY"; then
    # Grab ~20 lines around the id line for full registration block
    grep -n -B 2 -A 18 "id: '$GENERATOR_ID'" "$REGISTRY"
  else
    echo "(generator id '$GENERATOR_ID' not referenced in register-core.ts)"
  fi
else
  echo "(register-core.ts not found)"
fi
