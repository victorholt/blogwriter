#!/usr/bin/env bash

# Common utilities for CLI commands

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

success() {
    echo -e "${GREEN}✓${NC} $*"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

error() {
    echo -e "${RED}✗${NC} $*" >&2
}

# Docker Compose wrapper (environment-aware)
dc() {
    local compose_files="-f ${PROJECT_ROOT}/docker/compose/docker-compose.yml"

    # Determine environment from APP_ENV
    local env="${APP_ENV:-local}"

    case "${env}" in
        local)
            if [ -f "${PROJECT_ROOT}/docker/compose/docker-compose.override.yml" ]; then
                compose_files="$compose_files -f ${PROJECT_ROOT}/docker/compose/docker-compose.override.yml"
            fi
            ;;
        staging)
            if [ -f "${PROJECT_ROOT}/docker/compose/docker-compose.staging.yml" ]; then
                compose_files="$compose_files -f ${PROJECT_ROOT}/docker/compose/docker-compose.staging.yml"
            fi
            ;;
        prod)
            if [ -f "${PROJECT_ROOT}/docker/compose/docker-compose.prod.yml" ]; then
                compose_files="$compose_files -f ${PROJECT_ROOT}/docker/compose/docker-compose.prod.yml"
            fi
            ;;
    esac

    local env_file=""
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        env_file="--env-file ${PROJECT_ROOT}/.env"
    fi
    docker compose $env_file $compose_files "$@"
}

# Check if docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Load environment variables
load_env() {
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        set -a
        source "${PROJECT_ROOT}/.env"
        set +a
    else
        warning ".env file not found. Using defaults."
    fi
}

# Update or add a key=value in the .env file
# Usage: set_env_var <KEY> <VALUE>
set_env_var() {
    local key="$1"
    local value="$2"
    local env_file="${PROJECT_ROOT}/.env"

    if [ ! -f "$env_file" ]; then
        echo "${key}=${value}" > "$env_file"
        return
    fi

    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
        # Update existing key (macOS-compatible sed)
        sed -i '' "s|^${key}=.*|${key}=${value}|" "$env_file"
    else
        # Append new key
        echo "${key}=${value}" >> "$env_file"
    fi
}

# Check if a port is available. If in use, prompt the user for a new port.
# Skips ports held by our own project containers.
# Usage: check_port <port> <SERVICE_NAME> <ENV_VAR_NAME>
check_port() {
    local port="$1"
    local service="$2"
    local env_var="$3"
    local prefix="${CONTAINER_PREFIX:-blogwriter}"
    local pid

    pid=$(lsof -ti :"$port" 2>/dev/null)
    if [ -z "$pid" ]; then
        return 0
    fi

    # If the port is held by one of our own running containers, that's fine
    local container
    container=$(docker ps --filter "publish=$port" --filter "name=${prefix}-" --format '{{.Names}}' 2>/dev/null)
    if [ -n "$container" ]; then
        return 0
    fi

    local owner
    owner=$(lsof -i :"$port" -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print $1}')
    warning "Port $port ($service) is already in use by ${owner:-unknown}"

    # Prompt for a new port
    while true; do
        read -r -p "  Enter a new port for $service (or 'q' to abort): " new_port
        if [ "$new_port" = "q" ]; then
            return 1
        fi
        # Validate it's a number
        if ! [[ "$new_port" =~ ^[0-9]+$ ]]; then
            error "  Invalid port number"
            continue
        fi
        # Check the new port is free
        if lsof -ti :"$new_port" > /dev/null 2>&1; then
            error "  Port $new_port is also in use"
            continue
        fi
        # Good — save to .env and export for this session
        set_env_var "$env_var" "$new_port"
        export "$env_var=$new_port"
        success "  $service port set to $new_port (saved to .env)"
        return 0
    done
}

# Check all project ports for conflicts, prompting to fix any that are in use.
check_all_ports() {
    local ok=true
    check_port "${VALKEY_EXTERNAL_PORT:-6380}" "VALKEY" "VALKEY_EXTERNAL_PORT" || ok=false
    check_port "${POSTGRES_EXTERNAL_PORT:-5432}" "POSTGRES" "POSTGRES_EXTERNAL_PORT" || ok=false
    check_port "${API_EXTERNAL_PORT:-4444}" "API" "API_EXTERNAL_PORT" || ok=false
    check_port "${NEXTJS_EXTERNAL_PORT:-4443}" "NEXTJS" "NEXTJS_EXTERNAL_PORT" || ok=false

    if [ "$ok" = false ]; then
        echo ""
        error "Aborting due to unresolved port conflicts."
        return 1
    fi
    return 0
}

# Get list of service names
get_services() {
    dc config --services
}

# Check if service exists
service_exists() {
    local service="$1"
    get_services | grep -q "^${service}$"
}
