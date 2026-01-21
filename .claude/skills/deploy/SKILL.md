---
name: deploy
description: Deploy Clack Track to production via Docker Swarm. Handles branch validation, build, deploy, health checks, and rollback procedures. All commands execute remotely via DOCKER_HOST.
---

# Deploy Clack Track to Production

Deploy the application to production Docker Swarm environment with safety checks and rollback capability.

## Prerequisites

### Load Production Environment

**All deployment commands require `DOCKER_HOST` to be set.** Load it from `.env.production`:

```bash
# Load production environment (REQUIRED before any docker commands)
source .env.production

# Verify DOCKER_HOST is set
echo "DOCKER_HOST=$DOCKER_HOST"
```

The `DOCKER_HOST` variable in `.env.production` contains the SSH connection string to the remote Docker daemon. This value may change over time - always source from the env file rather than hardcoding.

## Pre-Flight Checks

Before deploying, validate the current state:

### 1. Check Branch State

```bash
# Verify you're on main branch
git branch --show-current

# Check if main is behind develop
git fetch origin
BEHIND_COUNT=$(git rev-list --count main..origin/develop 2>/dev/null || echo "0")
echo "Main is $BEHIND_COUNT commits behind develop"
```

**If main is behind develop**, prompt the user:

> Main branch is X commits behind develop. Do you want to:
> 1. Merge develop into main first (recommended)
> 2. Deploy current main anyway
> 3. Cancel deployment

### 2. Verify Production Environment

```bash
# Ensure environment is loaded
source .env.production

# Test Docker connection
docker info --format '{{.ServerVersion}}'
```

## Deployment Workflow

> **Note**: All `docker` commands below assume `DOCKER_HOST` is set via `source .env.production`

### Step 1: Build Production Image

```bash
# Build with production tag
docker build -t clack-track:latest -t clack-track:$(git rev-parse --short HEAD) .

# Verify build succeeded
docker images clack-track:latest --format "{{.ID}} {{.CreatedAt}}"
```

### Step 2: Deploy to Swarm

```bash
# Deploy stack with production compose
docker stack deploy -c docker-compose.prod.yml clack-track

# Wait for service to stabilize (30 seconds)
echo "Waiting for deployment to stabilize..."
sleep 30
```

### Step 3: Health Check Verification

```bash
# Check service status
docker service ls --filter name=clack-track

# Check replicas are running
docker service ps clack-track_app --format "{{.CurrentState}}"

# Check recent logs for errors
docker service logs clack-track_app --tail 50 --since 2m 2>&1 | grep -i "error\|fail\|exception" || echo "No errors found in recent logs"
```

### Step 4: Verify Application

```bash
# Check container health status
# Note: Use -f name= for substring match (container names include random suffixes like clack-track_app.1.xyz123)
docker inspect $(docker ps -q -f name=clack-track_app | head -1) --format '{{.State.Health.Status}}' 2>/dev/null || echo "No health check configured"
```

## Rollback Procedure

If deployment fails or issues are detected:

### Quick Rollback (Previous Image)

```bash
# Rollback to previous version
docker service rollback clack-track_app

# Verify rollback
docker service ps clack-track_app --format "{{.Image}} {{.CurrentState}}"
```

### Full Stack Rollback

```bash
# Remove current stack
docker stack rm clack-track

# Wait for cleanup
sleep 10

# Redeploy with previous known-good tag
docker stack deploy -c docker-compose.prod.yml clack-track
```

## Environment Variables

All production configuration is stored in `.env.production`. Key variables:

| Variable | Purpose |
|----------|---------|
| `DOCKER_HOST` | Remote Docker endpoint (SSH connection string) |
| `DOCKER_API_VERSION` | Docker API version for compatibility |
| `DATABASE_URL` | MySQL connection string |
| `VESTABOARD_LOCAL_API_KEY` | Vestaboard device authentication |
| `AI_PROVIDER` | AI backend (anthropic/openai) |

**Important**: Always load environment via `source .env.production` before running deployment commands. Never hardcode connection strings or credentials.

## Troubleshooting

For common deployment issues, see [troubleshooting.md](./troubleshooting.md).

## Safety Notes

1. **Always source .env.production first** - all docker commands require DOCKER_HOST
2. **Never deploy from a dirty working tree** - commit or stash changes first
3. **Always verify branch state** - ensure main has the code you intend to deploy
4. **Check service health after deploy** - don't walk away without verification
5. **Keep rollback commands ready** - have them in clipboard during deploy
6. **Monitor logs during initial deploy** - watch for startup errors
