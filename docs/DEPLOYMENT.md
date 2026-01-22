# Deployment Guide

This guide covers deploying Clack Track to Docker Swarm. The system uses Git SHA-based image tagging for reliable version management and rolling updates.

## Quick Start

Use the `/deploy` skill in Claude Code for guided deployment:

```
/deploy
```

The skill provides pre-flight checks, step-by-step commands, health verification, and rollback procedures.

## Overview

The deployment workflow uses:

1. **`/deploy` skill** - Interactive deployment guide with pre-flight checks and health verification
2. **secrets.sh** - Manages Docker secrets for sensitive configuration values
3. **docker-compose.prod.yml** - Docker Swarm stack configuration defining services, networks, and volumes

## Prerequisites

### Required Infrastructure

- **Docker Swarm Cluster** - A Docker host with Swarm mode enabled
  - Can be a single-node Swarm (sufficient for home use)
  - Minimum 1GB RAM recommended for the application stack
- **SSH Access** - Key-based SSH access to the Swarm manager node
  - Password authentication is not supported by the scripts
- **Git Repository** - The deployment uses git commit SHAs for image tagging

### Local Requirements

- Bash shell (Linux, macOS, or WSL on Windows)
- Git (for commit SHA tagging)
- SSH client with key access configured

### Verify Prerequisites

```bash
# Check SSH access to your Docker host
ssh user@your-nas-ip 'docker info'

# Check if Swarm is active
ssh user@your-nas-ip 'docker info | grep Swarm'
# Expected output: Swarm: active

# If Swarm is not active, initialize it:
ssh user@your-nas-ip 'docker swarm init'
```

## Initial Deployment (First-Time Setup)

### Step 1: Configure Environment

Copy the example production configuration and customize it:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` with your values:

```bash
# Required: SSH connection to your Docker host
DOCKER_HOST=ssh://user@192.168.1.50

# Required: Database password (will be stored as Docker secret)
MYSQL_ROOT_PASSWORD=your-secure-password

# Required: Vestaboard credentials
VESTABOARD_LOCAL_API_KEY=your-local-api-key
VESTABOARD_LOCAL_API_URL=http://192.168.1.100:7000

# Required: AI Provider (choose one)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Optional: Home Assistant integration
# HOME_ASSISTANT_URL=ws://homeassistant.local:8123/api/websocket
# HOME_ASSISTANT_TOKEN=your-long-lived-access-token

# Application settings
TZ=America/Los_Angeles
UPDATE_INTERVAL=60
LOG_LEVEL=info
```

### Step 2: Create Docker Secrets

Before deploying, create the Docker secrets that store sensitive values:

```bash
./secrets.sh create
```

**Expected Output:**

```
Using DOCKER_HOST: ssh://user@192.168.1.50
Creating Docker secrets...
  ✓ Created database_password
  ✓ Created vestaboard_api_key
  ✓ Created vestaboard_api_url
  ✓ Created openai_api_key
  ⏭ Skipping anthropic_api_key (no value for ANTHROPIC_API_KEY)
  ⏭ Skipping home_assistant_url (no value for HOME_ASSISTANT_URL)
  ⏭ Skipping home_assistant_token (no value for HOME_ASSISTANT_TOKEN)

Done!
```

### Step 3: Deploy the Stack

Use the `/deploy` skill for guided deployment, or run manually:

```bash
# Load production environment
set -a; source .env.production; set +a

# Build and deploy
docker build -t clack-track:latest -t clack-track:$(git rev-parse --short HEAD) .
docker stack deploy -c docker-compose.prod.yml clack-track

# Wait for services to stabilize
echo "Waiting for deployment to stabilize..."
sleep 30
```

**Expected Output:**

```
Creating network clack-track_clack-network
Creating service clack-track_mysql
Creating service clack-track_app
```

### Step 4: Verify Deployment

Check that services are running:

```bash
# Set DOCKER_HOST for convenience
export DOCKER_HOST=ssh://user@192.168.1.50

# Check service status
docker stack services clack-track

# View application logs
docker service logs -f clack-track_app

# Check service health
docker inspect --format='{{json .Status.ContainerStatus.Health}}' \
  $(docker service ps clack-track_app -q --no-trunc | head -1)
```

Access the web interface at `http://your-nas-ip:3030`

## Image Tagging and Rolling Updates

### How Image Tagging Works

The deployment system uses Git commit SHAs for image tags:

1. Build captures the current Git commit SHA (short form, 7 characters)
2. Builds the image with tag `clack-track:<sha>` (e.g., `clack-track:a1b2c3d`)
3. Also tags as `clack-track:latest` for convenience
4. Deploys the stack with the SHA-tagged image

**Benefits:**

- Every deployment is traceable to a specific commit
- Rollback is trivial - just redeploy with a previous commit's SHA
- No ambiguity about what code is running in production

### Deploying Updates

To deploy a new version, use the `/deploy` skill or run manually:

```bash
# Pull latest code
git pull origin main

# Load environment and deploy
set -a; source .env.production; set +a
docker build -t clack-track:latest -t clack-track:$(git rev-parse --short HEAD) .
docker stack deploy -c docker-compose.prod.yml clack-track
```

The Swarm performs a rolling update:

1. Creates new container with the new image
2. Waits for health check to pass
3. Routes traffic to new container
4. Removes old container

**Rolling Update Configuration (from stack.yml):**

```yaml
update_config:
  parallelism: 1 # Update one task at a time
  delay: 10s # Wait 10 seconds between updates
  failure_action: rollback # Automatic rollback on failure
```

### Deploying a Specific Version

To deploy a specific Git commit:

```bash
# Checkout the specific commit
git checkout a1b2c3d

# Load environment and deploy
set -a; source .env.production; set +a
docker build -t clack-track:latest -t clack-track:$(git rev-parse --short HEAD) .
docker stack deploy -c docker-compose.prod.yml clack-track

# Return to main branch
git checkout main
```

## Secret Rotation

### Overview

The `secrets.sh rotate` command provides zero-downtime secret rotation using Docker's versioned secret pattern. It:

1. Creates a new versioned secret (e.g., `database_password_v1`)
2. Updates `stack.yml` to reference the new secret
3. Triggers a service update to use the new secret
4. Optionally removes the old secret

### Step-by-Step Rotation

**Step 1: Update the Secret Value**

Edit `.env.production` with the new secret value:

```bash
# Example: rotating database password
MYSQL_ROOT_PASSWORD=new-secure-password
```

**Step 2: Run the Rotation Command**

```bash
./secrets.sh rotate database_password
```

**Expected Output:**

```
Rotating secret: database_password
Using DOCKER_HOST: ssh://user@192.168.1.50
  Current: database_password (unversioned)
  New: database_password_v1 (version 1)
Creating new secret...
  ✓ Created database_password_v1
Updating stack.yml...
  ✓ Updated stack.yml (backup: stack.yml.bak)
Updating services to use new secret...
  Updating service: clack-track_app
  Running: docker service update --secret-rm database_password --secret-add source=database_password_v1,target=database_password_v1 clack-track_app
  ✓ Updated clack-track_app
  Updating service: clack-track_mysql
  ✓ Updated clack-track_mysql

Old secret 'database_password' still exists.
Remove old secret? (y/N) y
  ✓ Removed database_password

Secret rotation complete!
Summary:
  Old: database_password
  New: database_password_v1
  Stack file: stack.yml (backup: stack.yml.bak)
```

### Available Secrets for Rotation

```bash
./secrets.sh rotate
# Shows available secrets:
#   - database_password
#   - vestaboard_api_key
#   - vestaboard_api_url
#   - openai_api_key
#   - anthropic_api_key
#   - home_assistant_url
#   - home_assistant_token
#   - vapid_public_key
#   - vapid_private_key
#   - vapid_subject
```

### Subsequent Rotations

Each rotation increments the version number:

```
database_password     → database_password_v1
database_password_v1  → database_password_v2
database_password_v2  → database_password_v3
```

**Important:** Commit `stack.yml` after rotation to preserve the secret version:

```bash
git add stack.yml
git commit -m "chore: rotate database_password to v1"
```

## Rollback Procedures

### Automatic Rollback

Docker Swarm automatically rolls back failed deployments when configured with:

```yaml
update_config:
  failure_action: rollback
```

If a new container fails its health check:

1. Swarm stops the update
2. Reverts to the previous working container
3. Logs the failure

**View Rollback Status:**

```bash
docker service inspect clack-track_app --pretty | grep -A 5 "UpdateStatus"
```

### Manual Rollback to Previous Image

To manually rollback to a previous version:

**Method 1: Redeploy from Previous Commit**

```bash
# Find the previous working commit
git log --oneline -10

# Checkout that commit
git checkout abc1234

# Load environment and deploy
set -a; source .env.production; set +a
docker build -t clack-track:latest -t clack-track:$(git rev-parse --short HEAD) .
docker stack deploy -c docker-compose.prod.yml clack-track

# Return to main
git checkout main
```

**Method 2: Force Update to Specific Image Tag**

```bash
export DOCKER_HOST=ssh://user@192.168.1.50

# List available images
docker images clack-track --format '{{.Tag}}'

# Update service to previous image
docker service update --image clack-track:previous-sha clack-track_app
```

### Database Rollback Considerations

The MySQL service persists data in a Docker volume (`mysql_data`). Database rollback requires separate handling:

- **Schema changes** - May require manual migration scripts
- **Data loss prevention** - Take backups before deployments that modify the database

**Backup Database:**

```bash
export DOCKER_HOST=ssh://user@192.168.1.50

# Find MySQL container
MYSQL_CONTAINER=$(docker ps -q --filter name=clack-track_mysql)

# Create backup
docker exec $MYSQL_CONTAINER mysqldump -u root -p"$(cat /run/secrets/database_password)" clack_track > backup.sql
```

### Complete Stack Removal (Last Resort)

For a complete restart:

```bash
export DOCKER_HOST=ssh://user@192.168.1.50

# Remove the stack (preserves volumes and secrets)
docker stack rm clack-track

# Wait for removal to complete
sleep 10

# Redeploy using /deploy skill or manually
set -a; source .env.production; set +a
docker build -t clack-track:latest .
docker stack deploy -c docker-compose.prod.yml clack-track
```

**Warning:** This causes downtime. Use only when rolling updates fail.

## Troubleshooting

### Connection Errors

**Error:** `Error: DOCKER_HOST not set`

**Cause:** Missing or invalid DOCKER_HOST configuration.

**Solution:**

```bash
# Set in .env.production
echo 'DOCKER_HOST=ssh://user@192.168.1.50' >> .env.production

# Then load it before running docker commands
set -a; source .env.production; set +a
```

---

**Error:** `Permission denied (publickey)`

**Cause:** SSH key not configured or not authorized.

**Solution:**

```bash
# Copy your SSH key to the remote host
ssh-copy-id user@192.168.1.50

# Verify access
ssh user@192.168.1.50 'echo success'
```

---

**Error:** `Swarm mode not active on remote`

**Cause:** Docker Swarm not initialized.

**Solution:**

```bash
ssh user@192.168.1.50 'docker swarm init'
```

### Secret Errors

**Error:** `Required secrets missing`

**Cause:** Secrets not created before deployment.

**Solution:**

```bash
./secrets.sh create
```

---

**Error:** `secret 'xyz' is in use by service` (when removing secrets)

**Cause:** Cannot remove a secret while a service is using it.

**Solution:** Use `./secrets.sh rotate` for zero-downtime rotation, or:

```bash
# Stop the stack first
docker stack rm clack-track
./secrets.sh delete
./secrets.sh create

# Redeploy
set -a; source .env.production; set +a
docker build -t clack-track:latest .
docker stack deploy -c docker-compose.prod.yml clack-track
```

### Build Errors

**Error:** `Sending build context over SSH... (hangs or timeout)`

**Cause:** Large build context or slow network connection.

**Solution:**

```bash
# Check .dockerignore is present
cat .dockerignore

# Ensure node_modules is excluded
echo 'node_modules' >> .dockerignore

# Check build context size
du -sh .
```

---

**Error:** `npm ci failed` during build

**Cause:** Package lock out of sync or dependency issues.

**Solution:**

```bash
# Regenerate package-lock.json locally
rm -rf node_modules package-lock.json
npm install

# Commit and redeploy
git add package-lock.json
git commit -m "fix: regenerate package-lock.json"

# Redeploy using /deploy skill or manually
set -a; source .env.production; set +a
docker build -t clack-track:latest .
docker stack deploy -c docker-compose.prod.yml clack-track
```

### Service Failures

**Symptom:** Service shows `0/1` replicas

**Diagnosis:**

```bash
export DOCKER_HOST=ssh://user@192.168.1.50

# Check service status
docker service ps clack-track_app --no-trunc

# View recent logs
docker service logs clack-track_app --tail 100

# Check events
docker events --filter service=clack-track_app
```

---

**Error:** `Health check failed` in logs

**Cause:** Application not responding on port 3000.

**Solution:**

```bash
# Check if the app is actually listening
docker exec $(docker ps -q --filter name=clack-track_app) \
  node -e "fetch('http://localhost:3000/').then(r=>console.log(r.status))"

# Check environment variables are set
docker exec $(docker ps -q --filter name=clack-track_app) env | grep -E "NODE_ENV|DATABASE|VESTABOARD"
```

---

**Error:** `ECONNREFUSED` to mysql

**Cause:** MySQL container not ready or network issue.

**Solution:**

```bash
# Check MySQL service status
docker service ps clack-track_mysql

# Check MySQL logs
docker service logs clack-track_mysql --tail 50

# Verify network connectivity
docker exec $(docker ps -q --filter name=clack-track_app) ping -c 1 mysql
```

### API Version Mismatch

**Error:** `Error response from daemon: client version X.XX is too new`

**Cause:** Local Docker client newer than remote Docker daemon.

**Solution:** Add API version to `.env.production`:

```bash
# Match the server's API version
DOCKER_API_VERSION=1.41
```

## Environment Configuration Reference

### Required Variables

| Variable                   | Description                          | Example                     |
| -------------------------- | ------------------------------------ | --------------------------- |
| `DOCKER_HOST`              | SSH connection to Docker Swarm host  | `ssh://user@192.168.1.50`   |
| `MYSQL_ROOT_PASSWORD`      | Database root password               | `secure-password-here`      |
| `VESTABOARD_LOCAL_API_KEY` | Vestaboard API key                   | `abc123...`                 |
| `VESTABOARD_LOCAL_API_URL` | Vestaboard device URL                | `http://192.168.1.100:7000` |
| `AI_PROVIDER`              | AI backend (`openai` or `anthropic`) | `openai`                    |
| `OPENAI_API_KEY`           | OpenAI API key (if using OpenAI)     | `sk-...`                    |
| `ANTHROPIC_API_KEY`        | Anthropic API key (if using Claude)  | `sk-ant-...`                |

### Optional Variables

| Variable               | Description                          | Default               |
| ---------------------- | ------------------------------------ | --------------------- |
| `TZ`                   | Timezone for the container           | `America/Los_Angeles` |
| `UPDATE_INTERVAL`      | Content update interval (sec)        | `60`                  |
| `LOG_LEVEL`            | Logging verbosity                    | `info`                |
| `DOCKER_API_VERSION`   | Docker API version (for older hosts) | (auto-detect)         |
| `HOME_ASSISTANT_URL`   | Home Assistant WebSocket URL         | (disabled)            |
| `HOME_ASSISTANT_TOKEN` | Home Assistant access token          | (disabled)            |
| `WEATHER_ENTITY`       | Home Assistant weather entity        | `weather.apple`       |

## Operations Reference

### Common Commands

```bash
# Set DOCKER_HOST for convenience
export DOCKER_HOST=ssh://user@192.168.1.50

# View stack services
docker stack services clack-track

# View application logs (follow)
docker service logs -f clack-track_app

# View MySQL logs
docker service logs clack-track_mysql --tail 100

# Scale service (if needed)
docker service scale clack-track_app=2

# Force service restart
docker service update --force clack-track_app

# Remove stack (preserves volumes)
docker stack rm clack-track
```

### Monitoring

```bash
# Real-time service status
watch -n 5 'docker stack services clack-track'

# Container resource usage
docker stats $(docker ps -q --filter name=clack-track)

# Health check status
docker inspect --format='{{json .Status.ContainerStatus.Health.Status}}' \
  $(docker service ps clack-track_app -q --no-trunc | head -1)
```

## Security Best Practices

### Secrets

- **Never commit `.env.production`** - It contains sensitive values
- **Use `secrets.sh rotate`** for regular credential rotation (recommended: 90 days)
- **Commit `stack.yml`** after rotation to track secret versions
- **Keep backups** of `.env.production` in a secure location

### Network

- **Expose only port 3030** - The stack uses an overlay network for internal communication
- **Consider a reverse proxy** (nginx, Traefik) for HTTPS termination
- **Restrict SSH access** - Use key-based auth and disable password login

### Updates

- **Subscribe to security advisories** for Node.js and MySQL
- **Rebuild images regularly** to pick up base image security patches:
  ```bash
  docker build --pull -t clack-track:$(git rev-parse --short HEAD) .
  ```

## Summary Checklist

### First Deployment

- [ ] SSH key access configured to Docker host
- [ ] Docker Swarm initialized on remote host
- [ ] `.env.production` created from example
- [ ] Required values configured (DOCKER_HOST, Vestaboard, AI provider)
- [ ] `./secrets.sh create` completed
- [ ] Deployment completed (use `/deploy` skill or manual commands)
- [ ] Web interface accessible at `http://host:3030`
- [ ] Application logs show no errors

### Regular Updates

- [ ] Pull latest code: `git pull`
- [ ] Run deployment using `/deploy` skill or manual commands
- [ ] Verify services healthy: `docker stack services clack-track`
- [ ] Check logs for errors: `docker service logs clack-track_app`

### Secret Rotation

- [ ] Update value in `.env.production`
- [ ] Run rotation: `./secrets.sh rotate <secret_name>`
- [ ] Verify services restarted with new secret
- [ ] Commit updated `stack.yml`
- [ ] Remove old secret when prompted (or manually later)
