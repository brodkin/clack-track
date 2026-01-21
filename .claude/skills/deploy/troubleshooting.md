# Deployment Troubleshooting Guide

Common issues and solutions for Clack Track production deployments.

## Connection Issues

### SSH Connection Refused

**Symptom**: `ssh: connect to host 10.100.0.91 port 22: Connection refused`

**Solutions**:
1. Verify the host is reachable:
   ```bash
   ping -c 3 10.100.0.91
   ```
2. Check SSH service on remote host
3. Verify SSH key is loaded:
   ```bash
   ssh-add -l
   ```
4. Test direct SSH connection:
   ```bash
   ssh rbrodkin@10.100.0.91 "echo 'Connection OK'"
   ```

### Docker API Version Mismatch

**Symptom**: `Error response from daemon: client version X.XX is too new`

**Solution**: Set the API version explicitly:
```bash
export DOCKER_API_VERSION=1.44
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker info
```

### Permission Denied

**Symptom**: `permission denied while trying to connect to the Docker daemon socket`

**Solution**: Ensure remote user is in docker group:
```bash
ssh rbrodkin@10.100.0.91 "groups"
# Should include 'docker'
```

## Service Issues

### Service Won't Start

**Check service status**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ps clack-track_app --no-trunc
```

**View detailed error logs**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service logs clack-track_app --tail 100
```

**Common causes**:
- Missing environment variables
- Database connection failure
- Port already in use
- Image not found

### Container Keeps Restarting

**Check restart count and state**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ps clack-track_app --format "{{.Name}} {{.CurrentState}} {{.Error}}"
```

**View logs from crashed container**:
```bash
# Get container ID (even if stopped)
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -a -f name=clack-track_app --format "{{.ID}}"

# View its logs
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker logs <container-id>
```

### Health Check Failing

**Inspect health check configuration**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker inspect clack-track_app --format '{{json .Spec.TaskTemplate.ContainerSpec.Healthcheck}}' | jq .
```

**Check health status**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker inspect $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) --format '{{json .State.Health}}' | jq .
```

## Database Issues

### Database Connection Failed

**Symptom**: `ECONNREFUSED` or `ER_ACCESS_DENIED_ERROR`

**Check MySQL container is running**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ps clack-track_mysql
```

**Test database connectivity from app container**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker exec $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) sh -c 'nc -zv mysql 3306'
```

**Verify database credentials**:
```bash
# Check environment variables in container
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker exec $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) env | grep DATABASE
```

### Migration Issues

**Run migrations manually**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker exec $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) npm run migrate
```

## Network Issues

### Service Can't Reach External APIs

**Test outbound connectivity**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker exec $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) sh -c 'curl -s https://api.anthropic.com/ -o /dev/null -w "%{http_code}"'
```

**Check DNS resolution**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker exec $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) nslookup api.anthropic.com
```

### Vestaboard Connection Issues

**Symptom**: Vestaboard not updating

**Check Vestaboard connectivity**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker exec $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) sh -c 'curl -s http://10.100.152.193:7000/ -o /dev/null -w "%{http_code}"'
```

**Verify API key is set**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker exec $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) env | grep VESTABOARD
```

## Secret Management

### Viewing Configured Secrets

**List Docker secrets**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker secret ls
```

**Check which secrets a service uses**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service inspect clack-track_app --format '{{json .Spec.TaskTemplate.ContainerSpec.Secrets}}' | jq .
```

### Updating Secrets

Docker secrets are immutable. To update:

```bash
# Remove old secret
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker secret rm my_secret

# Create new secret
echo "new-value" | DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker secret create my_secret -

# Update service to use new secret
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service update --secret-rm my_secret --secret-add my_secret clack-track_app
```

## Log Analysis

### View Real-Time Logs

```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service logs -f clack-track_app
```

### Filter Logs by Time

```bash
# Last 5 minutes
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service logs clack-track_app --since 5m

# Since specific time
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service logs clack-track_app --since 2024-01-15T10:00:00
```

### Search for Errors

```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service logs clack-track_app 2>&1 | grep -i "error\|exception\|fail"
```

## Resource Issues

### Check Resource Usage

```bash
# Container stats
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker stats --no-stream

# Service resource limits
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service inspect clack-track_app --format '{{json .Spec.TaskTemplate.Resources}}' | jq .
```

### Out of Memory

**Symptom**: Container killed with exit code 137

**Check memory limits**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker inspect $(DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker ps -q -f name=clack-track_app) --format '{{.HostConfig.Memory}}'
```

**View memory usage history**:
```bash
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker stats --no-stream --format "{{.Name}}: {{.MemUsage}}"
```

## Emergency Commands

### Force Remove Everything

**WARNING**: This removes all containers and data!

```bash
# Remove stack completely
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker stack rm clack-track

# Wait for cleanup
sleep 15

# Verify removal
DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ls
```

### Nuclear Option - Restart Docker

If Docker daemon is unresponsive:

```bash
ssh rbrodkin@10.100.0.91 "sudo systemctl restart docker"
```

## Quick Reference

| Issue | First Command to Run |
|-------|---------------------|
| Service not starting | `DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service logs clack-track_app --tail 50` |
| Connection refused | `ping -c 3 10.100.0.91` |
| Container crashing | `DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ps clack-track_app --no-trunc` |
| Database error | `DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker service ps clack-track_mysql` |
| Memory issues | `DOCKER_HOST=ssh://rbrodkin@10.100.0.91 docker stats --no-stream` |
