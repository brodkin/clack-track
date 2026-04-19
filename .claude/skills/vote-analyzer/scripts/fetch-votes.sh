#!/usr/bin/env bash
# fetch-votes.sh — Pull vote + content data from prod MySQL via Docker
#
# Usage: fetch-votes.sh [days] [sample-per-generator]
#   days: Number of days to look back (default: 60)
#   sample-per-generator: Recent content rows per generator in set 3 (default: 15)
#
# Requires: .env.production with DOCKER_HOST and DATABASE_URL
# Outputs: Four TSV result sets separated by "---SEPARATOR---":
#   1. Voted content with full details (ground-truth verdicts)
#   2. Per-generator aggregates including failover split
#   3. Recent content samples per generator (voted or not) — body-of-work view
#   4. Downvote reasons only, user-verbatim (empty if column not deployed)

set -euo pipefail

DAYS="${1:-60}"
SAMPLE_PER_GEN="${2:-15}"
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
  REASONS_QUERY="
SELECT
  v.created_at AS vote_date,
  c.generatorId AS generator_id,
  REPLACE(c.text, '\n', ' | ') AS content_text,
  v.reason AS vote_reason
FROM votes v
JOIN content c ON c.id = v.content_id
WHERE v.created_at >= DATE_SUB(NOW(), INTERVAL ${DAYS} DAY)
  AND v.vote_type = 'bad'
  AND v.reason IS NOT NULL
  AND v.reason != ''
  AND c.type = 'major'
  AND c.status = 'success'
ORDER BY v.created_at DESC;
"
else
  REASON_COL="NULL AS vote_reason,"
  # Emit an empty result set with matching columns so downstream parsing is stable
  REASONS_QUERY="SELECT NULL AS vote_date, NULL AS generator_id, NULL AS content_text, NULL AS vote_reason WHERE FALSE;"
fi

SQL_QUERY="
-- Set 1: All voted content with full details
SELECT
  c.id AS content_id,
  REPLACE(c.text, '\n', ' | ') AS content_text,
  c.generatorId AS generator_id,
  c.generatorName AS generator_name,
  c.aiModel AS ai_model,
  c.modelTier AS model_tier,
  c.aiProvider AS ai_provider,
  c.failedOver AS failed_over,
  c.generatedAt AS generated_at,
  c.validationAttempts AS validation_attempts,
  JSON_REMOVE(
    JSON_REMOVE(
      JSON_REMOVE(c.metadata, '\$.userPrompt'),
      '\$.systemPrompt'),
    '\$.failover') AS metadata_selections,
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

-- Set 2: Per-generator aggregates, including failover split
SELECT
  c.generatorId AS generator_id,
  c.generatorName AS generator_name,
  COUNT(DISTINCT c.id) AS total_generations,
  COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN c.id END) AS voted_generations,
  SUM(CASE WHEN v.vote_type = 'good' THEN 1 ELSE 0 END) AS upvotes,
  SUM(CASE WHEN v.vote_type = 'bad' THEN 1 ELSE 0 END) AS downvotes,
  SUM(CASE WHEN v.vote_type = 'bad' AND c.failedOver = 1 THEN 1 ELSE 0 END) AS downvotes_on_failover,
  SUM(CASE WHEN c.failedOver = 1 THEN 1 ELSE 0 END) AS failover_generations,
  AVG(c.validationAttempts) AS avg_validation_attempts
FROM content c
LEFT JOIN votes v ON v.content_id = c.id
  AND v.created_at >= DATE_SUB(NOW(), INTERVAL ${DAYS} DAY)
WHERE c.generatedAt >= DATE_SUB(NOW(), INTERVAL ${DAYS} DAY)
  AND c.type = 'major'
  AND c.status = 'success'
GROUP BY c.generatorId, c.generatorName
ORDER BY downvotes DESC, upvotes DESC;

SELECT '---SEPARATOR---' AS marker;

-- Set 3: Recent content samples per generator (voted or not)
-- ROW_NUMBER windowed per generator so small generators aren't starved.
-- This is the body-of-work view that makes pattern analysis possible.
SELECT content_id, generator_id, generator_name, content_text,
       ai_provider, ai_model, model_tier, failed_over, validation_attempts,
       generated_at, metadata_selections
FROM (
  SELECT
    c.id AS content_id,
    c.generatorId AS generator_id,
    c.generatorName AS generator_name,
    REPLACE(c.text, '\n', ' | ') AS content_text,
    c.aiProvider AS ai_provider,
    c.aiModel AS ai_model,
    c.modelTier AS model_tier,
    c.failedOver AS failed_over,
    c.validationAttempts AS validation_attempts,
    c.generatedAt AS generated_at,
    JSON_REMOVE(
      JSON_REMOVE(
        JSON_REMOVE(c.metadata, '\$.userPrompt'),
        '\$.systemPrompt'),
      '\$.failover') AS metadata_selections,
    ROW_NUMBER() OVER (PARTITION BY c.generatorId ORDER BY c.generatedAt DESC) AS rn
  FROM content c
  WHERE c.generatedAt >= DATE_SUB(NOW(), INTERVAL ${DAYS} DAY)
    AND c.type = 'major'
    AND c.status = 'success'
) ranked
WHERE rn <= ${SAMPLE_PER_GEN}
ORDER BY generator_id, generated_at DESC;

SELECT '---SEPARATOR---' AS marker;

-- Set 4: Downvote reasons only (user-written, ground truth)
${REASONS_QUERY}
"

run_mysql -e "$SQL_QUERY"
