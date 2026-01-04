#!/bin/bash
# Deploy Clack Track to Docker Swarm via SSH
#
# Prerequisites:
#   1. SSH key access to your NAS/server
#   2. Docker + Swarm running on remote
#   3. Secrets created via ./secrets.sh create
#
# Usage:
#   ./deploy.sh                        # Uses DOCKER_HOST from .env.production
#   ./deploy.sh ssh://user@nas-ip      # Override DOCKER_HOST
#
# Setup (one-time):
#   1. Configure .env.production with DOCKER_HOST=ssh://user@your-nas-ip
#   2. Run ./secrets.sh create

set -e

STACK_NAME="clack-track"
STACK_FILE="stack.yml"
ENV_FILE=".env.production"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}=== Clack Track Swarm Deployment ===${NC}"

# Load environment file
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Export DOCKER_API_VERSION if set (for older Docker hosts)
if [ -n "$DOCKER_API_VERSION" ]; then
    export DOCKER_API_VERSION
fi

# Allow override from command line
if [ -n "$1" ]; then
    export DOCKER_HOST="$1"
fi

# Verify DOCKER_HOST is set
if [ -z "$DOCKER_HOST" ]; then
    echo -e "${RED}Error: DOCKER_HOST not set${NC}"
    echo ""
    echo "Either:"
    echo "  1. Add DOCKER_HOST=ssh://user@your-nas-ip to .env.production"
    echo "  2. Run: ./deploy.sh ssh://user@your-nas-ip"
    exit 1
fi

echo -e "${CYAN}Using DOCKER_HOST: $DOCKER_HOST${NC}"

# Verify Swarm mode
echo -e "\n${CYAN}Checking Swarm status...${NC}"
if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
    echo -e "${RED}Error: Swarm mode not active on remote${NC}"
    echo "Initialize with: ssh your-nas 'docker swarm init'"
    exit 1
fi
echo -e "${GREEN}✓ Swarm mode active${NC}"

# Check if secrets exist
echo -e "\n${CYAN}Checking secrets...${NC}"
MISSING_SECRETS=0
for secret in database_password vestaboard_api_key vestaboard_api_url; do
    if ! docker secret inspect "$secret" &>/dev/null; then
        echo -e "${RED}  ✗ Missing required secret: $secret${NC}"
        MISSING_SECRETS=1
    fi
done

if [ $MISSING_SECRETS -eq 1 ]; then
    echo -e "\n${RED}Required secrets missing. Run:${NC}"
    echo "  ./secrets.sh create"
    exit 1
fi
echo -e "${GREEN}✓ Required secrets exist${NC}"

# Capture git commit SHA for image tagging
GIT_SHA=$(git rev-parse --short HEAD)
if [ -z "$GIT_SHA" ]; then
    echo -e "${RED}Error: Unable to get git commit SHA${NC}"
    echo "Ensure you are running from a git repository"
    exit 1
fi
export IMAGE_TAG="$GIT_SHA"
echo -e "${CYAN}Git SHA: ${GIT_SHA}${NC}"

# Build the image (happens on remote via SSH)
echo -e "\n${CYAN}Step 1/2: Building image on remote...${NC}"
echo -e "${YELLOW}(Sending build context over SSH - this may take a moment)${NC}"
docker build -t "clack-track:${GIT_SHA}" .

# Also tag as :latest for convenience
docker tag "clack-track:${GIT_SHA}" clack-track:latest
echo -e "${GREEN}Tagged image: clack-track:${GIT_SHA} (also :latest)${NC}"

# Deploy stack with IMAGE_TAG environment variable
echo -e "\n${CYAN}Step 2/2: Deploying stack...${NC}"
docker stack deploy -c "$STACK_FILE" "$STACK_NAME"

# Wait for services to start
echo -e "\n${CYAN}Waiting for services to start...${NC}"
sleep 5

# Show status
echo -e "\n${GREEN}=== Stack Status ===${NC}"
docker stack services "$STACK_NAME"

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "View services:  DOCKER_HOST=$DOCKER_HOST docker stack services $STACK_NAME"
echo -e "View logs:      DOCKER_HOST=$DOCKER_HOST docker service logs -f ${STACK_NAME}_app"
echo -e "Remove stack:   DOCKER_HOST=$DOCKER_HOST docker stack rm $STACK_NAME"
