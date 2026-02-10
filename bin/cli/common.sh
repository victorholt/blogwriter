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

# Get list of service names
get_services() {
    dc config --services
}

# Check if service exists
service_exists() {
    local service="$1"
    get_services | grep -q "^${service}$"
}
