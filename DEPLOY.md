# Deploying Clack Track

Deploy to a Docker Swarm host (NAS, VM, etc.) directly from your devcontainer using SSH.

## Prerequisites

- Docker Swarm active on your target host
- SSH key access to the host
- Your SSH user in the `docker` group on the remote host

## Quick Start

```bash
# 1. Configure production environment
cp .env.production.example .env.production

# 2. Edit .env.production - set at minimum:
#    - DOCKER_HOST=ssh://user@your-nas-ip
#    - VESTABOARD_LOCAL_API_KEY
#    - VESTABOARD_LOCAL_API_URL
#    - OPENAI_API_KEY (or ANTHROPIC_API_KEY)
#    - MYSQL_ROOT_PASSWORD

# 3. Create secrets on Swarm (one-time)
./secrets.sh create

# 4. Deploy
./deploy.sh
```

## Architecture

```
Devcontainer                         NAS Docker Swarm
┌────────────────────┐               ┌────────────────────────────┐
│ Source code        │               │ Secrets (encrypted):       │
│ stack.yml          │───SSH────────▶│   ├─ database_password     │
│ .env.production    │  DOCKER_HOST  │   ├─ vestaboard_api_key    │
│ deploy.sh          │               │   ├─ openai_api_key        │
└────────────────────┘               │   └─ ...                   │
                                     │                            │
  Build context sent                 │ Services:                  │
  over SSH, image                    │   ├─ clack-track_app       │
  built on remote                    │   └─ clack-track_mysql     │
                                     │                            │
                                     │ Volumes:                   │
                                     │   └─ mysql_data            │
                                     └────────────────────────────┘
```

## How It Works

The deployment uses `DOCKER_HOST=ssh://user@host` to run Docker commands on the remote host:

1. **Build**: Source code is sent over SSH, image is built on the NAS
2. **Secrets**: Created once, stored encrypted in Swarm
3. **Deploy**: Stack deployed via `docker stack deploy`

No Docker daemon needed locally - just the Docker CLI and SSH access.

## Ongoing Deployments

After initial setup, deploying updates is a single command:

```bash
./deploy.sh
```

This will:

1. Send build context to the NAS over SSH
2. Build the Docker image on the NAS
3. Update the running stack

## Managing Secrets

Secrets are encrypted and stored in Docker Swarm, not on the filesystem.

```bash
# List secrets
./secrets.sh list

# Update secrets (requires removing the stack first)
DOCKER_HOST=ssh://user@nas docker stack rm clack-track
./secrets.sh update
./deploy.sh

# Delete all secrets
./secrets.sh delete
```

## Useful Commands

All commands require `DOCKER_HOST` set (loaded from `.env.production` or exported):

```bash
# Export for convenience (or commands will load from .env.production)
export DOCKER_HOST=ssh://user@your-nas-ip

# View running services
docker stack services clack-track

# View app logs (follow mode)
docker service logs -f clack-track_app

# View database logs
docker service logs -f clack-track_mysql

# Restart the app service
docker service update --force clack-track_app

# Remove the entire stack
docker stack rm clack-track

# Check service health
docker service ps clack-track_app
```

## Configuration

### Required in .env.production

| Variable                                | Description                                              |
| --------------------------------------- | -------------------------------------------------------- |
| `DOCKER_HOST`                           | SSH connection to NAS (e.g., `ssh://user@192.168.1.100`) |
| `MYSQL_ROOT_PASSWORD`                   | Database password (becomes a secret)                     |
| `VESTABOARD_LOCAL_API_KEY`              | Vestaboard API key (becomes a secret)                    |
| `VESTABOARD_LOCAL_API_URL`              | Vestaboard device URL (becomes a secret)                 |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | AI provider key (becomes a secret)                       |

### Optional Configuration

| Variable               | Default               | Description                           |
| ---------------------- | --------------------- | ------------------------------------- |
| `AI_PROVIDER`          | `openai`              | AI provider (`openai` or `anthropic`) |
| `TZ`                   | `America/Los_Angeles` | Timezone                              |
| `UPDATE_INTERVAL`      | `60`                  | Content update interval (minutes)     |
| `LOG_LEVEL`            | `info`                | Logging level                         |
| `HOME_ASSISTANT_URL`   | -                     | Home Assistant URL (optional)         |
| `HOME_ASSISTANT_TOKEN` | -                     | HA access token (optional)            |

## Troubleshooting

### "Permission denied" on docker commands

Your SSH user needs to be in the `docker` group on the NAS:

```bash
# On the NAS
sudo usermod -aG docker your-username
# Log out and back in
```

### "Swarm not active" error

```bash
# Initialize Swarm on the NAS (via SSH)
ssh user@your-nas "docker swarm init"
```

### Service won't start

```bash
# Check service status
docker service ps clack-track_app --no-trunc

# Check logs for errors
docker service logs clack-track_app
```

### Build is slow

The entire build context is sent over SSH. To speed this up:

1. Ensure `.dockerignore` excludes unnecessary files
2. Consider using a local Docker registry

### SSH connection issues

```bash
# Test SSH connection
ssh user@your-nas-ip "docker info"

# If using non-standard port
DOCKER_HOST=ssh://user@nas-ip:2222
```

### Home Assistant connection fails with .local hostname

Docker containers cannot resolve `.local` mDNS hostnames (e.g., `homeassistant.local`). This is a fundamental limitation of how Docker networking handles multicast DNS.

**Symptoms:**

- `ENOTFOUND homeassistant.local` errors in logs
- Home Assistant integration fails to connect
- Works fine outside Docker but fails inside container

**Solutions:**

1. **Use IP address** (recommended):

   ```bash
   # In .env.production or secrets
   HOME_ASSISTANT_URL=http://10.100.0.10:8123
   ```

2. **Use a proper DNS hostname** (if available):
   ```bash
   HOME_ASSISTANT_URL=http://ha.example.com:8123
   ```

**Finding your Home Assistant IP:**

```bash
# From a machine that can resolve mDNS
ping homeassistant.local
# Note the IP address in the response

# Or check your router's DHCP leases
# Or in Home Assistant: Settings → System → Network
```

**Note:** If you update the `HOME_ASSISTANT_URL` secret, you must remove and redeploy the stack for the change to take effect (see [Managing Secrets](#managing-secrets)).

## SSH Key Setup

For passwordless deployment, set up SSH keys:

```bash
# Generate key if needed (in devcontainer)
ssh-keygen -t ed25519

# Copy to NAS
ssh-copy-id user@your-nas-ip

# Test
ssh user@your-nas-ip "docker info"
```
