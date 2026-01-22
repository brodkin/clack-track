# Deploying Clack Track

Deploy to a Docker Swarm host (NAS, VM, etc.) directly from your devcontainer using SSH.

## Quick Start

Use the `/deploy` skill in Claude Code for guided deployment:

```
/deploy
```

The skill provides:

- Pre-flight checks (branch state, environment validation)
- Step-by-step build and deploy commands
- Health check verification
- Rollback procedures

## Manual Deployment

If you prefer manual deployment:

### Prerequisites

- Docker Swarm active on your target host
- SSH key access to the host
- Your SSH user in the `docker` group on the remote host

### Steps

```bash
# 1. Configure production environment
cp .env.production.example .env.production

# 2. Edit .env.production - set at minimum:
#    - DOCKER_HOST=ssh://user@your-nas-ip
#    - VESTABOARD_LOCAL_API_KEY
#    - VESTABOARD_LOCAL_API_URL
#    - OPENAI_API_KEY (or ANTHROPIC_API_KEY)
#    - MYSQL_ROOT_PASSWORD

# 3. Load and export production environment
set -a; source .env.production; set +a

# 4. Create secrets on Swarm (one-time)
./secrets.sh create

# 5. Build and deploy
docker build -t clack-track:latest .
docker stack deploy -c docker-compose.prod.yml clack-track
```

## Architecture

```
Devcontainer                         NAS Docker Swarm
+--------------------+               +----------------------------+
| Source code        |               | Secrets (encrypted):       |
| docker-compose     |---SSH-------->|   +-- database_password    |
| .env.production    |  DOCKER_HOST  |   +-- vestaboard_api_key   |
| /deploy skill      |               |   +-- openai_api_key       |
+--------------------+               |   +-- ...                  |
                                     |                            |
  Build context sent                 | Services:                  |
  over SSH, image                    |   +-- clack-track_app      |
  built on remote                    |   +-- clack-track_mysql    |
                                     |                            |
                                     | Volumes:                   |
                                     |   +-- mysql_data           |
                                     +----------------------------+
```

## Useful Commands

All commands require `DOCKER_HOST` set (load from `.env.production`):

```bash
# Load environment
set -a; source .env.production; set +a

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

See the `/deploy` skill's troubleshooting section for common issues and solutions:

```
/deploy
```

Or check `.claude/skills/deploy/troubleshooting.md` directly.

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
