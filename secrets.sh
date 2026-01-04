#!/bin/bash
# Manage Docker Swarm secrets for Clack Track
#
# Usage:
#   ./secrets.sh create    # Create all secrets from .env.production
#   ./secrets.sh update    # Update existing secrets (removes and recreates)
#   ./secrets.sh list      # List current secrets
#   ./secrets.sh delete    # Delete all clack-track secrets

set -e

ENV_FILE=".env.production"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Map env var names to secret names
declare -A SECRET_MAP=(
    ["MYSQL_ROOT_PASSWORD"]="database_password"
    ["VESTABOARD_LOCAL_API_KEY"]="vestaboard_api_key"
    ["VESTABOARD_LOCAL_API_URL"]="vestaboard_api_url"
    ["OPENAI_API_KEY"]="openai_api_key"
    ["ANTHROPIC_API_KEY"]="anthropic_api_key"
    ["HOME_ASSISTANT_URL"]="home_assistant_url"
    ["HOME_ASSISTANT_TOKEN"]="home_assistant_token"
    ["VAPID_PUBLIC_KEY"]="vapid_public_key"
    ["VAPID_PRIVATE_KEY"]="vapid_private_key"
    ["VAPID_SUBJECT"]="vapid_subject"
)

load_env() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}Error: $ENV_FILE not found${NC}"
        echo "Copy .env.production.example to .env.production and configure it"
        exit 1
    fi

    # Source the env file
    set -a
    source "$ENV_FILE"
    set +a

    # Export DOCKER_API_VERSION if set (for older Docker hosts)
    if [ -n "$DOCKER_API_VERSION" ]; then
        export DOCKER_API_VERSION
    fi

    # Verify DOCKER_HOST is set
    if [ -z "$DOCKER_HOST" ]; then
        echo -e "${RED}Error: DOCKER_HOST not set in $ENV_FILE${NC}"
        echo "Add: DOCKER_HOST=ssh://user@your-nas-ip"
        exit 1
    fi

    echo -e "${CYAN}Using DOCKER_HOST: $DOCKER_HOST${NC}"
}

create_secrets() {
    echo -e "${GREEN}Creating Docker secrets...${NC}"
    load_env

    for env_var in "${!SECRET_MAP[@]}"; do
        secret_name="${SECRET_MAP[$env_var]}"
        value="${!env_var}"

        if [ -n "$value" ]; then
            # Check if secret already exists
            if docker secret inspect "$secret_name" &>/dev/null; then
                echo -e "${YELLOW}  ⏭ $secret_name already exists (use 'update' to replace)${NC}"
            else
                echo -n "$value" | docker secret create "$secret_name" -
                echo -e "${GREEN}  ✓ Created $secret_name${NC}"
            fi
        else
            echo -e "${YELLOW}  ⏭ Skipping $secret_name (no value for $env_var)${NC}"
        fi
    done

    echo -e "\n${GREEN}Done!${NC}"
}

update_secrets() {
    echo -e "${GREEN}Updating Docker secrets...${NC}"
    echo -e "${YELLOW}Warning: This will remove and recreate secrets.${NC}"
    echo -e "${YELLOW}The stack must be removed first if secrets are in use.${NC}"
    read -p "Continue? (y/N) " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    load_env

    for env_var in "${!SECRET_MAP[@]}"; do
        secret_name="${SECRET_MAP[$env_var]}"
        value="${!env_var}"

        if [ -n "$value" ]; then
            # Remove if exists
            if docker secret inspect "$secret_name" &>/dev/null; then
                docker secret rm "$secret_name" 2>/dev/null || true
                echo -e "${YELLOW}  ✓ Removed old $secret_name${NC}"
            fi

            # Create new
            echo -n "$value" | docker secret create "$secret_name" -
            echo -e "${GREEN}  ✓ Created $secret_name${NC}"
        fi
    done

    echo -e "\n${GREEN}Done! Redeploy the stack to use new secrets.${NC}"
}

list_secrets() {
    echo -e "${GREEN}Docker secrets:${NC}"
    load_env
    docker secret ls
}

delete_secrets() {
    echo -e "${RED}Deleting all clack-track secrets...${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    load_env

    for secret_name in "${SECRET_MAP[@]}"; do
        if docker secret inspect "$secret_name" &>/dev/null; then
            docker secret rm "$secret_name"
            echo -e "${GREEN}  ✓ Deleted $secret_name${NC}"
        fi
    done

    echo -e "\n${GREEN}Done!${NC}"
}

case "${1:-}" in
    create)
        create_secrets
        ;;
    update)
        update_secrets
        ;;
    list)
        list_secrets
        ;;
    delete)
        delete_secrets
        ;;
    *)
        echo "Usage: $0 {create|update|list|delete}"
        echo ""
        echo "Commands:"
        echo "  create  - Create secrets from .env.production"
        echo "  update  - Remove and recreate all secrets"
        echo "  list    - List current Docker secrets"
        echo "  delete  - Delete all clack-track secrets"
        echo ""
        echo "Requires DOCKER_HOST=ssh://user@host in .env.production"
        exit 1
        ;;
esac
