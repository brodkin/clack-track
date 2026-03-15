#!/usr/bin/env bash
# fetch-votes.sh — Pull vote + content data from prod MySQL via Docker
#
# Usage: fetch-votes.sh [days]
#   days: Number of days to look back (default: 60)
#
# Requires: .env.production with DOCKER_HOST and DATABASE_URL
# Outputs: Two result sets separated by "---SEPARATOR---"
#   1. Voted content with vote details (TSV)
#   2. Per-generator totals including unvoted content (TSV)

set -euo pipefail

DAYS="${1:-60}"
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
ENV_FILE="$PROJECT_ROOT/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.production not found at $ENV_FILE" >&2
  exit 1
fi

# Source production environment (sets DOCKER_HOST, DATABASE_URL, etc.)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DOCKER_HOST:-}" ]]; then
  echo "ERROR: DOCKER_HOST not set after sourcing .env.production" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set after sourcing .env.production" >&2
  exit 1
fi

# Parse DATABASE_URL: mysql://user:password@host:port/database
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|mysql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^:]*:\([^@]*\)@.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^/]*/\(.*\)|\1|p')

# Find the running MySQL container in the clack-track_mysql service
MYSQL_CONTAINER=$(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_mysql" | head -1)

if [[ -z "$MYSQL_CONTAINER" ]]; then
  echo "ERROR: No running container found for clack-track_mysql service" >&2
  exit 1
fi

# Helper: run a mysql query inside the prod MySQL container
run_mysql() {
  docker exec "$MYSQL_CONTAINER" \
    mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
    --batch --raw "$@" 2>&1 | grep -av '^\(mysql: \[Warning\]\|Warning:\)'
}

# Detect whether 'reason' column exists in votes table (migration 011 may not be deployed)
HAS_REASON=$(run_mysql --skip-column-names \
  -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='votes' AND COLUMN_NAME='reason';")

if [[ "$HAS_REASON" == "1" ]]; then
  REASON_COL="v.reason AS vote_reason,"
else
  REASON_COL="NULL AS vote_reason,"
fi

SQL_QUERY="
-- Result Set 1: All voted content with full details
-- Text newlines replaced with ' | ' for TSV compatibility
-- Metadata stripped of bulky prompt fields, keeping only dictionary selections
SELECT
  c.id AS content_id,
  REPLACE(c.text, '\n', ' | ') AS content_text,
  c.generatorId AS generator_id,
  c.generatorName AS generator_name,
  c.aiModel AS ai_model,
  c.modelTier AS model_tier,
  c.aiProvider AS ai_provider,
  c.generatedAt AS generated_at,
  c.validationAttempts AS validation_attempts,
  JSON_REMOVE(
    JSON_REMOVE(
      JSON_REMOVE(c.metadata, '$.userPrompt'),
      '$.systemPrompt'),
    '$.failover') AS metadata_selections,
  v.id AS vote_id,
  v.vote_type,
  ${REASON_COL}
  v.created_at AS vote_date
FROM votes v
JOIN content c ON c.id = v.content_id
WHERE v.created_at >= DATE_SUB(NOW(), INTERVAL ${DAYS} DAY)
  AND c.type = 'major'
  AND c.status = 'success'
ORDER BY c.generatorId, v.vote_type, v.created_at DESC;

SELECT '---SEPARATOR---' AS marker;

-- Result Set 2: Per-generator aggregate stats (including unvoted content)
SELECT
  c.generatorId AS generator_id,
  c.generatorName AS generator_name,
  COUNT(DISTINCT c.id) AS total_generations,
  COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN c.id END) AS voted_generations,
  SUM(CASE WHEN v.vote_type = 'good' THEN 1 ELSE 0 END) AS upvotes,
  SUM(CASE WHEN v.vote_type = 'bad' THEN 1 ELSE 0 END) AS downvotes,
  AVG(c.validationAttempts) AS avg_validation_attempts
FROM content c
LEFT JOIN votes v ON v.content_id = c.id
  AND v.created_at >= DATE_SUB(NOW(), INTERVAL ${DAYS} DAY)
WHERE c.generatedAt >= DATE_SUB(NOW(), INTERVAL ${DAYS} DAY)
  AND c.type = 'major'
  AND c.status = 'success'
GROUP BY c.generatorId, c.generatorName
ORDER BY downvotes DESC, upvotes DESC;
"

# Execute the main query
run_mysql -e "$SQL_QUERY"
