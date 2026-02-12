#!/usr/bin/env bash

# Guided deployment wizard
# Usage: ./cli deploy

show_deploy_help() {
    echo "Guided Deployment Wizard"
    echo ""
    echo "Usage:"
    echo "  ./cli deploy"
    echo ""
    echo "Walks through the full deployment process:"
    echo "  1. Environment configuration (.env)"
    echo "  2. Build production Docker images"
    echo "  3. Start containers"
    echo "  4. Wait for services to be healthy"
    echo "  5. Initialize database schema"
    echo "  6. SSL certificate setup"
    echo ""
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    show_deploy_help
    exit 0
fi

check_docker

# ── Helpers ──────────────────────────────────────────────────────
step_header() {
    local step_num="$1"
    local step_name="$2"
    echo ""
    echo "─────────────────────────────────────────"
    echo "  Step ${step_num}: ${step_name}"
    echo "─────────────────────────────────────────"
    echo ""
}

wait_for_healthy() {
    local service="$1"
    local max_wait="${2:-120}"
    local elapsed=0

    while [ $elapsed -lt $max_wait ]; do
        local state
        state=$(dc ps --format '{{.Health}}' "${service}" 2>/dev/null || echo "unknown")
        if echo "${state}" | grep -qi "healthy"; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        printf "."
    done
    return 1
}

# ══════════════════════════════════════════════════════════════════
# Step 1: Environment Configuration
# ══════════════════════════════════════════════════════════════════
step_header 1 "Environment Configuration"

load_env
ENV="${APP_ENV:-local}"

if [ -f "${PROJECT_ROOT}/.env" ]; then
    info "Current .env found (APP_ENV=${ENV}, DOMAIN=${DOMAIN:-not set})"
    echo ""
    read -r -p "Reconfigure .env? [y/N]: " reconfig
    if [[ "${reconfig}" =~ ^[Yy]$ ]]; then
        source "${SCRIPT_DIR}/bin/cli/commands/env.sh"
        load_env
        ENV="${APP_ENV:-local}"
    fi
else
    warning "No .env file found. Starting interactive setup..."
    source "${SCRIPT_DIR}/bin/cli/commands/env.sh"
    load_env
    ENV="${APP_ENV:-local}"
fi

if [[ "${ENV}" == "local" ]]; then
    warning "APP_ENV is 'local'. For production deployment, set APP_ENV=prod in .env"
    read -r -p "Continue anyway? [y/N]: " continue_local
    if [[ ! "${continue_local}" =~ ^[Yy]$ ]]; then
        info "Run './cli env' to reconfigure"
        exit 0
    fi
fi

# ══════════════════════════════════════════════════════════════════
# Step 2: Build Production Images
# ══════════════════════════════════════════════════════════════════
step_header 2 "Build Docker Images"

info "Building images for environment: ${ENV}"
echo ""
read -r -p "Build images now? [Y/n]: " do_build
if [[ ! "${do_build}" =~ ^[Nn]$ ]]; then
    dc build
    success "Images built successfully!"
else
    info "Skipping build (using existing images)"
fi

# ══════════════════════════════════════════════════════════════════
# Step 3: Start Containers
# ══════════════════════════════════════════════════════════════════
step_header 3 "Start Containers"

read -r -p "Start containers? [Y/n]: " do_start
if [[ ! "${do_start}" =~ ^[Nn]$ ]]; then
    dc up -d
    success "Containers started!"
else
    info "Skipping start"
fi

# ══════════════════════════════════════════════════════════════════
# Step 4: Wait for Health
# ══════════════════════════════════════════════════════════════════
step_header 4 "Waiting for Services"

SERVICES_TO_CHECK="proxy api nextjs"
if echo "${COMPOSE_PROFILES:-}" | grep -q "db"; then
    SERVICES_TO_CHECK="${SERVICES_TO_CHECK} postgres"
fi

all_healthy=true
for svc in ${SERVICES_TO_CHECK}; do
    printf "  Waiting for %s " "${svc}"
    if wait_for_healthy "${svc}" 120; then
        echo ""
        success "${svc} is healthy"
    else
        echo ""
        warning "${svc} did not become healthy within 120s"
        all_healthy=false
    fi
done

if [ "${all_healthy}" = true ]; then
    success "All services are healthy!"
else
    warning "Some services are not healthy. Check logs: ./cli logs"
fi

# ══════════════════════════════════════════════════════════════════
# Step 5: Database Setup
# ══════════════════════════════════════════════════════════════════
step_header 5 "Database Setup"

info "Push database schema to Postgres (required on first deploy)"
read -r -p "Run 'db push' now? [Y/n]: " do_db
if [[ ! "${do_db}" =~ ^[Nn]$ ]]; then
    dc exec api npm run db:push
    success "Database schema pushed!"
else
    info "Skipping database setup"
    info "Run './cli db push' later to initialize the schema"
fi

# ══════════════════════════════════════════════════════════════════
# Step 6: SSL Certificates
# ══════════════════════════════════════════════════════════════════
step_header 6 "SSL Certificates"

if [[ "${ENV}" != "local" ]]; then
    info "Domain: ${DOMAIN:-not set}"
    info "Make sure DNS for ${DOMAIN:-your domain} points to this server"
    echo ""
    read -r -p "Request Let's Encrypt SSL certificate? [Y/n]: " do_certs
    if [[ ! "${do_certs}" =~ ^[Nn]$ ]]; then
        source "${SCRIPT_DIR}/bin/cli/commands/certs.sh"
    else
        info "Skipping SSL setup"
        info "Run './cli certs' later to get SSL certificates"
    fi
else
    info "Local environment — run './cli certs' for self-signed certificates"
fi

# ══════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════
echo ""
echo "========================================="
echo "  Deployment Complete"
echo "========================================="
echo ""

dc ps

echo ""
if [[ "${ENV}" != "local" && -n "${DOMAIN:-}" ]]; then
    PROTO="http"
    if [ -f "${PROJECT_ROOT}/docker/ssl/${DOMAIN}.crt" ]; then
        PROTO="https"
    fi
    success "Access your app: ${PROTO}://${DOMAIN}"
else
    success "Access your app: http://${DOMAIN:-localhost}:${PROXY_PORT:-8081}"
fi

echo ""
info "Useful commands:"
echo "  ./cli status          # Container status"
echo "  ./cli logs            # View logs"
echo "  ./cli logs api        # View API logs"
echo "  ./cli restart         # Restart all services"
echo "  ./cli certs           # Manage SSL certificates"
echo "  ./cli certs-renew     # Renew Let's Encrypt certs"
echo ""

if [[ "${ENV}" != "local" ]]; then
    warning "Remember to set up a cron job for certificate renewal:"
    echo "  0 3 * * * cd $(pwd) && ./cli certs-renew >> /var/log/blogwriter-certs.log 2>&1"
    echo ""
fi
