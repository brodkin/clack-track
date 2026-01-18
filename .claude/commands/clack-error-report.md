---
allowed-tools:
  - Bash(docker version)
  - Bash(docker ps*)
  - Bash(docker exec*)
  - Bash(set*)
  - Bash(source*)
---

# Clack Track Error Report

Generate a diagnostic error report from the production database for the last 7 days.

## Instructions

You will connect to the production MySQL database and analyze content generation errors. All commands source `.env.production` to load credentials directly into the shell environment, avoiding exposure in command output.

### Step 1: Verify Docker Connection

Source the production environment and verify Docker connectivity:

```bash
set -a && source .env.production && set +a && docker version --format '{{.Server.Version}}'
```

If this fails, stop and report the connection error to the user.

### Step 2: Identify MySQL Container

Find the MySQL container name (varies by deployment type):

```bash
set -a && source .env.production && set +a && docker ps --filter "name=mysql" --format "{{.Names}}"
```

This returns the actual container name (e.g., `clack-track_mysql.1.abc123` for Swarm). Use this in subsequent queries.

### Step 3: Run Diagnostic Queries

Execute queries against the `clack_track` database. The pattern sources credentials so the password is never visible in command output:

```bash
set -a && source .env.production && set +a && docker exec {CONTAINER} mysql -u root -p"$MYSQL_ROOT_PASSWORD" clack_track -e "{QUERY}"
```

Replace `{CONTAINER}` with the container name from Step 2.

Run these diagnostic queries against the `content` table:

#### Query 1: Total Error Count (last 7 days)

```sql
SELECT COUNT(*) as total_errors FROM content WHERE status = 'failed' AND generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY);
```

#### Query 2: Generator Error Analysis

```sql
SELECT generatorId, generatorName, COUNT(*) as error_count, GROUP_CONCAT(DISTINCT errorType SEPARATOR ', ') as error_types, MAX(generatedAt) as last_error FROM content WHERE status = 'failed' AND generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY generatorId, generatorName ORDER BY error_count DESC;
```

#### Query 3: Error Type Distribution

```sql
SELECT errorType, COUNT(*) as count, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content WHERE status = 'failed' AND generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)), 1) as percentage, COUNT(DISTINCT generatorId) as affected_generators FROM content WHERE status = 'failed' AND generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY errorType ORDER BY count DESC;
```

#### Query 4: Provider Failure Analysis

```sql
SELECT aiProvider, COUNT(*) as failures, SUM(CASE WHEN failedOver = 1 THEN 1 ELSE 0 END) as failovers, ROUND(SUM(CASE WHEN failedOver = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as failover_pct FROM content WHERE status = 'failed' AND generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY aiProvider ORDER BY failures DESC;
```

#### Query 5: Failover Success Analysis

```sql
SELECT primaryProvider as failed_provider, aiProvider as fallback_provider, COUNT(*) as failover_attempts, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as succeeded FROM content WHERE failedOver = 1 AND generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY primaryProvider, aiProvider;
```

#### Query 6: Recent Errors (Last 10)

```sql
SELECT generatedAt, generatorId, generatorName, errorType, LEFT(errorMessage, 200) as error_snippet, aiProvider, aiModel, failedOver, primaryProvider FROM content WHERE status = 'failed' AND generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY generatedAt DESC LIMIT 10;
```

#### Query 7: Success Rate by Generator (context)

```sql
SELECT generatorId, generatorName, COUNT(*) as total, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures, ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as success_rate FROM content WHERE generatedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY generatorId, generatorName ORDER BY failures DESC;
```

### Step 4: Generate Report

Format the results into a structured diagnostic report with these sections:

1. **Summary** - Time range, total errors, overall error rate
2. **Generator Error Analysis** - Table showing which generators fail most
3. **Error Type Distribution** - Table of error types with counts and percentages
4. **Provider Failures** - Comparison of OpenAI vs Anthropic failures and failover stats
5. **Success Rate by Generator** - Context showing overall reliability
6. **Recent Errors** - Last 10 errors with timestamps and details
7. **Recommendations** - Actionable insights based on patterns (e.g., rate limiting issues, authentication problems, specific generators needing attention)

### Output Format Example

```markdown
## Clack Track Error Report

**Time Range:** Last 7 days (Jan 11 - Jan 18, 2026)
**Total Errors:** 47 | **Total Generations:** 1,234 | **Error Rate:** 3.8%

### Generator Error Analysis

| Generator        | Name             | Errors | Error Types                  | Last Error   |
| ---------------- | ---------------- | ------ | ---------------------------- | ------------ |
| weather-forecast | Weather Forecast | 18     | RateLimitError, TimeoutError | Jan 18 14:32 |

### Error Type Distribution

| Error Type     | Count | %   | Affected Generators |
| -------------- | ----- | --- | ------------------- |
| RateLimitError | 28    | 60% | 3                   |

### Provider Failures

| Provider | Failures | Failovers | Failover % |
| -------- | -------- | --------- | ---------- |
| openai   | 32       | 15        | 47%        |

### Success Rate by Generator

| Generator        | Total | Successes | Failures | Success Rate |
| ---------------- | ----- | --------- | -------- | ------------ |
| weather-forecast | 500   | 482       | 18       | 96.4%        |

### Recent Errors

1. **Jan 18 14:32** - weather-forecast (Weather Forecast)
   - Error: RateLimitError
   - Provider: openai (gpt-4.1-mini)
   - Message: Rate limit exceeded...
   - Failover: Yes (from openai)

### Recommendations

Based on the error patterns:

1. **Rate Limiting**: [specific recommendations]
2. **Authentication**: [if applicable]
3. **Generator Issues**: [specific generator recommendations]
```

## Notes

- Credentials are sourced from `.env.production` and passed via environment variables to avoid exposure in command history or output
- If Docker connection fails, verify SSH access to the host specified in `DOCKER_HOST`
- If queries return empty results, there may be no errors in the last 7 days (good news!)
