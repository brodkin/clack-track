# Deployment Troubleshooting Guide

Common issues and solutions for Clack Track production deployments.

## Prerequisites

**All commands in this guide assume `DOCKER_HOST` is set.** Load and export it first:

```bash
set -a; source .env.production; set +a
echo "DOCKER_HOST=$DOCKER_HOST"  # Verify it's set
```

The `DOCKER_HOST` variable contains the SSH connection to the remote Docker daemon. Get this value from `.env.production` - never hardcode it as it may change.

**Container naming**: Docker Swarm generates container names with random suffixes (e.g., `clack-track_app.1.xyz123abc`). To get the current container ID from a known service name:

```bash
# Get container ID for a service (recommended)
CONTAINER_ID=$(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1)

# Then use it in commands
docker exec $CONTAINER_ID env | grep DATABASE
docker inspect $CONTAINER_ID --format '{{.State.Health.Status}}'
```

Commands below use this pattern or the shorthand `$(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1)`.

## Connection Issues

### SSH Connection Refused

**Symptom**: `ssh: connect to host <ip> port 22: Connection refused`

**Solutions**:

1. Verify the host is reachable (extract IP from DOCKER_HOST):
   ```bash
   # Get host from DOCKER_HOST
   DOCKER_IP=$(echo $DOCKER_HOST | sed 's|ssh://[^@]*@||')
   ping -c 3 $DOCKER_IP
   ```
2. Check SSH service on remote host
3. Verify SSH key is loaded:
   ```bash
   ssh-add -l
   ```
4. Test direct SSH connection (extract user@host from DOCKER_HOST):
   ```bash
   # DOCKER_HOST format is ssh://user@host
   SSH_TARGET=$(echo $DOCKER_HOST | sed 's|ssh://||')
   ssh $SSH_TARGET "echo 'Connection OK'"
   ```

### Docker API Version Mismatch

**Symptom**: `Error response from daemon: client version X.XX is too new`

**Solution**: Set the API version explicitly (check `.env.production` for `DOCKER_API_VERSION`):

```bash
set -a; source .env.production; set +a
docker info
```

### Permission Denied

**Symptom**: `permission denied while trying to connect to the Docker daemon socket`

**Solution**: Ensure remote user is in docker group:

```bash
SSH_TARGET=$(echo $DOCKER_HOST | sed 's|ssh://||')
ssh $SSH_TARGET "groups"
# Should include 'docker'
```

## Service Issues

### Service Won't Start

**Check service status**:

```bash
docker service ps clack-track_app --no-trunc
```

**View detailed error logs**:

```bash
docker service logs clack-track_app --tail 100
```

**Common causes**:

- Missing environment variables
- Database connection failure
- Port already in use
- Image not found

### Container Keeps Restarting

**Check restart count and state**:

```bash
docker service ps clack-track_app --format "{{.Name}} {{.CurrentState}} {{.Error}}"
```

**View logs from crashed container**:

```bash
# Get container ID (even if stopped)
docker ps -a -f name=clack-track_app --format "{{.ID}}"

# View its logs
docker logs <container-id>
```

### Health Check Failing

**Inspect health check configuration**:

```bash
docker inspect clack-track_app --format '{{json .Spec.TaskTemplate.ContainerSpec.Healthcheck}}' | jq .
```

**Check health status**:

```bash
docker inspect $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) --format '{{json .State.Health}}' | jq .
```

## Database Issues

### Database Connection Failed

**Symptom**: `ECONNREFUSED` or `ER_ACCESS_DENIED_ERROR`

**Check MySQL container is running**:

```bash
docker service ps clack-track_mysql
```

**Test database connectivity from app container**:

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) sh -c 'nc -zv mysql 3306'
```

**Verify database credentials**:

```bash
# Check environment variables in container
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) env | grep DATABASE
```

### Migration Issues

**Run migrations manually**:

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) node dist/cli/index.js db:migrate
```

**Check migration status**:

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) npx knex migrate:status --knexfile knexfile.ts
```

### Migration Rollback

**Symptom**: Migration failed partway through, database in inconsistent state

**Check current migration status** (shows applied vs pending migrations):

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) npx knex migrate:status --knexfile knexfile.ts
```

**Rollback the last batch of migrations**:

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) npx knex migrate:rollback --knexfile knexfile.ts
```

**Rollback all migrations** (use with caution):

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) npx knex migrate:rollback --all --knexfile knexfile.ts
```

**Common rollback scenarios**:

- Migration syntax error: Fix migration file, rollback, re-run
- Wrong column type: Rollback, update migration, re-run
- Missing dependency: Install dependency, re-run migration (no rollback needed)

## Network Issues

### Network Not Attachable (Migration Container Fails)

**Symptom**: `network clack-track_clack-network not manually attachable`

This error occurs when running `docker run --network clack-track_clack-network` for migrations.

**Cause**: Docker Swarm overlay networks must have `attachable: true` to allow standalone containers to connect. The docker-compose.prod.yml configures this, but existing networks don't get updated during `docker stack deploy`.

**Solution**: Remove and recreate the stack to rebuild the network:

```bash
# Remove the stack (services will stop)
docker stack rm clack-track

# Wait for full cleanup (network won't delete while services exist)
sleep 15

# Remove the network explicitly if still present
docker network rm clack-track_clack-network 2>/dev/null || true

# Redeploy (creates network with attachable: true)
docker stack deploy -c docker-compose.prod.yml clack-track
```

**Verify network is attachable**:

```bash
docker network inspect clack-track_clack-network --format '{{.Attachable}}'
# Should return: true
```

### Service Can't Reach External APIs

**Test outbound connectivity**:

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) sh -c 'curl -s https://api.anthropic.com/ -o /dev/null -w "%{http_code}"'
```

**Check DNS resolution**:

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) nslookup api.anthropic.com
```

### Vestaboard Connection Issues

**Symptom**: Vestaboard not updating

**Check Vestaboard connectivity** (get URL from `.env.production` VESTABOARD_LOCAL_API_URL):

```bash
# Check the VESTABOARD_LOCAL_API_URL from .env.production
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) env | grep VESTABOARD_LOCAL_API_URL
```

**Verify API key is set**:

```bash
docker exec $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) env | grep VESTABOARD
```

## Secret Management

### Viewing Configured Secrets

**List Docker secrets**:

```bash
docker secret ls
```

**Check which secrets a service uses**:

```bash
docker service inspect clack-track_app --format '{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}' | jq .
```

### Updating Secrets

Docker secrets are immutable. To update:

```bash
# Remove old secret
docker secret rm my_secret

# Create new secret
echo "new-value" | docker secret create my_secret -

# Update service to use new secret
docker service update --secret-rm my_secret --secret-add my_secret clack-track_app
```

## Log Analysis

### View Real-Time Logs

```bash
docker service logs -f clack-track_app
```

### Filter Logs by Time

```bash
# Last 5 minutes
docker service logs clack-track_app --since 5m

# Since specific time
docker service logs clack-track_app --since 2024-01-15T10:00:00
```

### Search for Errors

```bash
docker service logs clack-track_app 2>&1 | grep -i "error\|exception\|fail"
```

## Resource Issues

### Check Resource Usage

```bash
# Container stats
docker stats --no-stream

# Service resource limits
docker service inspect clack-track_app --format '{{json .Spec.TaskTemplate.Resources}}' | jq .
```

### Out of Memory

**Symptom**: Container killed with exit code 137

**Check memory limits**:

```bash
docker inspect $(docker ps -q -f "label=com.docker.swarm.service.name=clack-track_app" | head -1) --format '{{.HostConfig.Memory}}'
```

**View memory usage history**:

```bash
docker stats --no-stream --format "{{.Name}}: {{.MemUsage}}"
```

## Emergency Commands

### Force Remove Everything

**WARNING**: This removes all containers and data!

```bash
# Remove stack completely
docker stack rm clack-track

# Wait for cleanup
sleep 15

# Verify removal
docker service ls
```

### Nuclear Option - Restart Docker

If Docker daemon is unresponsive:

```bash
SSH_TARGET=$(echo $DOCKER_HOST | sed 's|ssh://||')
ssh $SSH_TARGET "sudo systemctl restart docker"
```

## Quick Reference

> **Remember**: Run `source .env.production` before using these commands

| Issue                | First Command to Run                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| Service not starting | `docker service logs clack-track_app --tail 50`                              |
| Connection refused   | `ping -c 3 $(echo $DOCKER_HOST \| sed 's\|ssh://[^@]*@\|\|')`                |
| Container crashing   | `docker service ps clack-track_app --no-trunc`                               |
| Database error       | `docker service ps clack-track_mysql`                                        |
| Memory issues        | `docker stats --no-stream`                                                   |
| Migration failed     | `docker exec $CONTAINER_ID npx knex migrate:status --knexfile knexfile.ts`   |
| Rollback migration   | `docker exec $CONTAINER_ID npx knex migrate:rollback --knexfile knexfile.ts` |
