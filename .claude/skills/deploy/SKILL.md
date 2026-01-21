---
name: deploy
description: Deploy Clack Track to production via Docker Swarm. Handles branch validation, build, deploy, health checks, and rollback procedures. All commands execute remotely via DOCKER_HOST.
---

# Deploy Clack Track to Production

Deploy the application to production Docker Swarm environment with safety checks and rollback capability.

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
# Load production environment
source .env.production

# Test Docker connection
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker info --format '{{.ServerVersion}}'
```

## Deployment Workflow

### Step 1: Build Production Image

```bash
# Build with production tag
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker build -t clack-track:latest -t clack-track:$(git rev-parse --short HEAD) .

# Verify build succeeded
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker images clack-track:latest --format "{{.ID}} {{.CreatedAt}}"
```

### Step 2: Deploy to Swarm

```bash
# Deploy stack with production compose
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker stack deploy -c docker-compose.prod.yml clack-track

# Wait for service to stabilize (30 seconds)
echo "Waiting for deployment to stabilize..."
sleep 30
```

### Step 3: Health Check Verification

```bash
# Check service status
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ls --filter name=clack-track

# Check replicas are running
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ps clack-track_app --format "{{.CurrentState}}"

# Check recent logs for errors
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service logs clack-track_app --tail 50 --since 2m 2>&1 | grep -i "error\|fail\|exception" || echo "No errors found in recent logs"
```

### Step 4: Verify Application

```bash
# Check container health
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker inspect $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) --format '{{.State.Health.Status}}' 2>/dev/null || echo "No health check configured"

# Test web endpoint if enabled
curl -s -o /dev/null -w "%{http_code}" http://10.100.0.91:3000/health 2>/dev/null || echo "Web endpoint not accessible (may be expected)"
```

## Rollback Procedure

If deployment fails or issues are detected:

### Quick Rollback (Previous Image)

```bash
# Rollback to previous version
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service rollback clack-track_app

# Verify rollback
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ps clack-track_app --format "{{.Image}} {{.CurrentState}}"
```

### Full Stack Rollback

```bash
# Remove current stack
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker stack rm clack-track

# Wait for cleanup
sleep 10

# Redeploy with previous known-good tag
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker stack deploy -c docker-compose.prod.yml clack-track
```

## Environment Variables

All production configuration is in `.env.production`. Key variables:

| Variable | Purpose |
|----------|---------|
| `DOCKER_HOST` | Remote Docker endpoint (`ssh://rbrodkin@10.100.0.91`) |
| `DOCKER_API_VERSION` | Docker API version for compatibility |
| `DATABASE_URL` | MySQL connection string |
| `VESTABOARD_LOCAL_API_KEY` | Vestaboard device authentication |
| `AI_PROVIDER` | AI backend (anthropic/openai) |

## Troubleshooting

For common deployment issues, see [troubleshooting.md](./troubleshooting.md).

## Safety Notes

1. **Never deploy from a dirty working tree** - commit or stash changes first
2. **Always verify branch state** - ensure main has the code you intend to deploy
3. **Check service health after deploy** - don't walk away without verification
4. **Keep rollback commands ready** - have them in clipboard during deploy
5. **Monitor logs during initial deploy** - watch for startup errors
