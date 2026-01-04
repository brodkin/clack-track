#!/bin/bash
# Manage Docker Swarm secrets for Clack Track
#
# Usage:
#   ./secrets.sh create              # Create all secrets from .env.production
#   ./secrets.sh update              # Update existing secrets (removes and recreates)
#   ./secrets.sh list                # List current secrets
#   ./secrets.sh delete              # Delete all clack-track secrets
#   ./secrets.sh rotate <name>       # Rotate a secret using versioned pattern (zero-downtime)
#
# Secret Rotation (Zero-Downtime):
#   The rotate command uses Docker's versioned secret pattern to update secrets
#   without requiring stack removal. It creates a new versioned secret (e.g.,
#   database_password_v2), updates stack.yml, and triggers a service update.
#
#   Example: ./secrets.sh rotate database_password
#   - Detects current version (or defaults to v1 if unversioned)
#   - Creates new secret with incremented version (database_password_v2)
#   - Updates stack.yml to reference the new secret name
#   - Triggers service update to pick up the new secret
#   - Optionally removes the old secret after confirmation

set -e

ENV_FILE=".env.production"
STACK_FILE="stack.yml"
STACK_NAME="clack-track"

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

# Get the current version of a secret by examining stack.yml
# Returns: version number (1, 2, 3...) or 0 if unversioned
get_secret_version() {
    local base_name="$1"

    # Check stack.yml for versioned reference (e.g., database_password_v2)
    # Look for pattern: base_name_v<number>
    local versioned_match
    versioned_match=$(grep -oP "${base_name}_v\K[0-9]+" "$STACK_FILE" 2>/dev/null | sort -n | tail -1)

    if [ -n "$versioned_match" ]; then
        echo "$versioned_match"
        return
    fi

    # Check if the base name (unversioned) exists in stack.yml
    if grep -q "^\s*${base_name}:" "$STACK_FILE" 2>/dev/null || \
       grep -q "^\s*- ${base_name}$" "$STACK_FILE" 2>/dev/null; then
        echo "0"  # Unversioned, will become v1
        return
    fi

    echo "-1"  # Not found
}

# Find services that use a particular secret
get_services_using_secret() {
    local secret_name="$1"
    local services=""

    # Parse stack.yml to find services with this secret
    # This is a simplified check - looks for the secret in service definitions
    local in_service=""
    local in_secrets=false

    while IFS= read -r line; do
        # Detect service name (indented under services:)
        if [[ "$line" =~ ^[[:space:]]{2}([a-zA-Z0-9_-]+):$ ]] && [[ ! "$line" =~ ^[[:space:]]{4} ]]; then
            in_service="${BASH_REMATCH[1]}"
            in_secrets=false
        fi

        # Detect secrets section within a service
        if [[ "$line" =~ ^[[:space:]]+secrets:$ ]]; then
            in_secrets=true
        elif [[ "$line" =~ ^[[:space:]]+[a-z]+:$ ]] && [[ ! "$line" =~ secrets: ]]; then
            in_secrets=false
        fi

        # Check if this secret is listed
        if $in_secrets && [[ "$line" =~ ^[[:space:]]+-[[:space:]]*${secret_name}[[:space:]]*$ ]]; then
            if [ -n "$services" ]; then
                services="$services $in_service"
            else
                services="$in_service"
            fi
        fi
    done < "$STACK_FILE"

    echo "$services"
}

# Update stack.yml to replace old secret name with new secret name
update_stack_yml() {
    local old_name="$1"
    local new_name="$2"

    echo -e "${CYAN}Updating $STACK_FILE...${NC}"

    # Create backup
    cp "$STACK_FILE" "${STACK_FILE}.bak"

    # Replace secret references in service secrets lists (- old_name -> - new_name)
    sed -i "s/^\([[:space:]]*-[[:space:]]*\)${old_name}$/\1${new_name}/" "$STACK_FILE"

    # Replace secret definition in secrets section (old_name: -> new_name:)
    sed -i "s/^\([[:space:]]*\)${old_name}:/\1${new_name}:/" "$STACK_FILE"

    # Also handle file path references like /run/secrets/old_name
    sed -i "s|/run/secrets/${old_name}|/run/secrets/${new_name}|g" "$STACK_FILE"

    echo -e "${GREEN}  ✓ Updated $STACK_FILE (backup: ${STACK_FILE}.bak)${NC}"
}

# Rotate a single secret using Docker's versioned secret pattern
rotate_secret() {
    local secret_name="$1"

    if [ -z "$secret_name" ]; then
        echo -e "${RED}Error: Secret name required${NC}"
        echo "Usage: $0 rotate <secret_name>"
        echo ""
        echo "Available secrets:"
        for name in "${SECRET_MAP[@]}"; do
            echo "  - $name"
        done
        exit 1
    fi

    # Validate secret name is in our known list
    local env_var=""
    for key in "${!SECRET_MAP[@]}"; do
        if [ "${SECRET_MAP[$key]}" == "$secret_name" ]; then
            env_var="$key"
            break
        fi
    done

    # Also check if it's a versioned variant (e.g., database_password_v1)
    local base_name="$secret_name"
    if [[ "$secret_name" =~ ^(.+)_v[0-9]+$ ]]; then
        base_name="${BASH_REMATCH[1]}"
        for key in "${!SECRET_MAP[@]}"; do
            if [ "${SECRET_MAP[$key]}" == "$base_name" ]; then
                env_var="$key"
                break
            fi
        done
    fi

    if [ -z "$env_var" ]; then
        echo -e "${RED}Error: Unknown secret '$secret_name'${NC}"
        echo "Available secrets:"
        for name in "${SECRET_MAP[@]}"; do
            echo "  - $name"
        done
        exit 1
    fi

    echo -e "${GREEN}Rotating secret: $base_name${NC}"
    load_env

    # Get new value from environment
    local new_value="${!env_var}"
    if [ -z "$new_value" ]; then
        echo -e "${RED}Error: No value found for $env_var in $ENV_FILE${NC}"
        exit 1
    fi

    # Determine current version from stack.yml
    local current_version
    current_version=$(get_secret_version "$base_name")

    local old_secret_name
    local new_version
    local new_secret_name

    if [ "$current_version" == "-1" ]; then
        echo -e "${RED}Error: Secret '$base_name' not found in $STACK_FILE${NC}"
        exit 1
    elif [ "$current_version" == "0" ]; then
        # Currently unversioned, will become v1
        old_secret_name="$base_name"
        new_version="1"
        new_secret_name="${base_name}_v1"
        echo -e "${CYAN}  Current: $old_secret_name (unversioned)${NC}"
    else
        # Already versioned, increment
        old_secret_name="${base_name}_v${current_version}"
        new_version=$((current_version + 1))
        new_secret_name="${base_name}_v${new_version}"
        echo -e "${CYAN}  Current: $old_secret_name (version $current_version)${NC}"
    fi

    echo -e "${CYAN}  New: $new_secret_name (version $new_version)${NC}"

    # Check if old secret exists in Docker
    if ! docker secret inspect "$old_secret_name" &>/dev/null; then
        echo -e "${YELLOW}Warning: Old secret '$old_secret_name' not found in Docker${NC}"
        echo -e "${YELLOW}This may be a first-time setup or the secret was already removed${NC}"
    fi

    # Check if new secret already exists
    if docker secret inspect "$new_secret_name" &>/dev/null; then
        echo -e "${YELLOW}Warning: $new_secret_name already exists${NC}"
        read -p "Remove and recreate? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker secret rm "$new_secret_name" 2>/dev/null || true
        else
            echo "Aborted."
            exit 1
        fi
    fi

    # Create new versioned secret
    echo -e "${CYAN}Creating new secret...${NC}"
    echo -n "$new_value" | docker secret create "$new_secret_name" -
    echo -e "${GREEN}  ✓ Created $new_secret_name${NC}"

    # Update stack.yml
    update_stack_yml "$old_secret_name" "$new_secret_name"

    # Find services that use this secret and update them
    local services
    services=$(get_services_using_secret "$new_secret_name")

    if [ -n "$services" ]; then
        echo -e "${CYAN}Updating services to use new secret...${NC}"

        for service in $services; do
            local full_service_name="${STACK_NAME}_${service}"
            echo -e "${CYAN}  Updating service: $full_service_name${NC}"

            # Docker service update with secret rotation
            # --secret-rm removes the old secret, --secret-add adds the new one
            if docker service inspect "$full_service_name" &>/dev/null; then
                # Build the update command
                local update_cmd="docker service update"

                # Only remove old secret if it exists and is different from new
                if [ "$old_secret_name" != "$new_secret_name" ] && \
                   docker secret inspect "$old_secret_name" &>/dev/null; then
                    update_cmd="$update_cmd --secret-rm $old_secret_name"
                fi

                update_cmd="$update_cmd --secret-add source=$new_secret_name,target=$new_secret_name"
                update_cmd="$update_cmd $full_service_name"

                echo -e "${CYAN}  Running: $update_cmd${NC}"
                if eval "$update_cmd"; then
                    echo -e "${GREEN}  ✓ Updated $full_service_name${NC}"
                else
                    echo -e "${RED}  ✗ Failed to update $full_service_name${NC}"
                    echo -e "${YELLOW}  You may need to redeploy the stack: docker stack deploy -c $STACK_FILE $STACK_NAME${NC}"
                fi
            else
                echo -e "${YELLOW}  Service $full_service_name not found (stack may not be deployed)${NC}"
            fi
        done
    else
        echo -e "${YELLOW}No running services found using this secret${NC}"
        echo -e "${CYAN}Redeploy stack to use new secret: docker stack deploy -c $STACK_FILE $STACK_NAME${NC}"
    fi

    # Offer to clean up old secret
    echo ""
    if [ "$old_secret_name" != "$new_secret_name" ] && \
       docker secret inspect "$old_secret_name" &>/dev/null; then
        echo -e "${YELLOW}Old secret '$old_secret_name' still exists.${NC}"
        read -p "Remove old secret? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if docker secret rm "$old_secret_name" 2>/dev/null; then
                echo -e "${GREEN}  ✓ Removed $old_secret_name${NC}"
            else
                echo -e "${YELLOW}  Could not remove $old_secret_name (may still be in use)${NC}"
                echo -e "${YELLOW}  Wait for service update to complete, then run:${NC}"
                echo -e "${YELLOW}  docker secret rm $old_secret_name${NC}"
            fi
        else
            echo -e "${CYAN}Old secret retained. Remove manually when ready:${NC}"
            echo -e "${CYAN}  docker secret rm $old_secret_name${NC}"
        fi
    fi

    echo -e "\n${GREEN}Secret rotation complete!${NC}"
    echo -e "${CYAN}Summary:${NC}"
    echo -e "  Old: $old_secret_name"
    echo -e "  New: $new_secret_name"
    echo -e "  Stack file: $STACK_FILE (backup: ${STACK_FILE}.bak)"
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
    rotate)
        rotate_secret "$2"
        ;;
    *)
        echo "Usage: $0 {create|update|list|delete|rotate}"
        echo ""
        echo "Commands:"
        echo "  create          - Create secrets from .env.production"
        echo "  update          - Remove and recreate all secrets (requires stack removal)"
        echo "  list            - List current Docker secrets"
        echo "  delete          - Delete all clack-track secrets"
        echo "  rotate <name>   - Rotate a secret using versioned pattern (zero-downtime)"
        echo ""
        echo "Secret Rotation (Zero-Downtime):"
        echo "  The rotate command updates secrets without stack removal by using"
        echo "  Docker's versioned secret pattern (e.g., database_password_v1, _v2)."
        echo ""
        echo "  Example: $0 rotate database_password"
        echo ""
        echo "  Available secrets for rotation:"
        for name in "${SECRET_MAP[@]}"; do
            echo "    - $name"
        done
        echo ""
        echo "Requires DOCKER_HOST=ssh://user@host in .env.production"
        exit 1
        ;;
esac
