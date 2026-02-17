#!/usr/bin/env bash

# Change the project domain
# Usage: ./cli domain [new-domain]

show_domain_help() {
    echo "Change the project domain"
    echo ""
    echo "Usage:"
    echo "  ./cli domain                  # Show current domain"
    echo "  ./cli domain <new-domain>     # Set new domain"
    echo ""
    echo "What it updates:"
    echo "  1. .env — DOMAIN, NEXT_PUBLIC_API_URL, CORS_ORIGIN, CERT_EMAIL"
    echo "  2. Apache proxy configs, docker-compose defaults"
    echo "  3. Frontend API fallback URLs, CLI script defaults, .env.example"
    echo ""
    echo "After changing the domain you'll need to:"
    echo "  ./cli certs            # Generate SSL certs for the new domain"
    echo "  ./cli build nextjs     # Rebuild Next.js (NEXT_PUBLIC_API_URL is build-time)"
    echo "  ./cli up               # Restart containers"
    echo ""
    echo "Examples:"
    echo "  ./cli domain myblog.test"
    echo "  ./cli domain store.example.com"
    echo ""
}

# Help flag
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    show_domain_help
    exit 0
fi

# ── Load current .env ────────────────────────────────────────────
ENV_FILE="${PROJECT_ROOT}/.env"

if [ ! -f "${ENV_FILE}" ]; then
    error ".env file not found. Run ./cli env first."
    exit 1
fi

set -a
source "${ENV_FILE}"
set +a

# Detect current domain: .env → httpd.conf → fallback
if [ -n "${DOMAIN:-}" ]; then
    OLD_DOMAIN="${DOMAIN}"
elif [ -f "${PROJECT_ROOT}/docker/proxy/httpd.conf" ]; then
    OLD_DOMAIN=$(grep -m1 '^ServerName ' "${PROJECT_ROOT}/docker/proxy/httpd.conf" | awk '{print $2}')
fi
OLD_DOMAIN="${OLD_DOMAIN:-blogwriter.test}"

# ── No argument: show current domain ─────────────────────────────
if [ -z "${1:-}" ]; then
    echo ""
    info "Current domain: ${OLD_DOMAIN}"
    echo ""
    echo "  DOMAIN=${OLD_DOMAIN}"
    echo "  NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-not set}"
    echo ""
    info "Run ./cli domain <new-domain> to change it"
    echo ""
    exit 0
fi

NEW_DOMAIN="$1"

# ── Validate ──────────────────────────────────────────────────────
if [ "${NEW_DOMAIN}" = "${OLD_DOMAIN}" ]; then
    info "Domain is already ${OLD_DOMAIN}. Nothing to do."
    exit 0
fi

# Basic validation
if [[ "${NEW_DOMAIN}" == *" "* || "${NEW_DOMAIN}" == *"/"* || "${NEW_DOMAIN}" == *":"* ]]; then
    error "Invalid domain: ${NEW_DOMAIN} (no spaces, slashes, or colons)"
    exit 1
fi

echo ""
echo "  Old domain: ${OLD_DOMAIN}"
echo "  New domain: ${NEW_DOMAIN}"
echo ""

# ── 1. Update .env ────────────────────────────────────────────────
info "Updating .env..."

# Update DOMAIN
set_env_var "DOMAIN" "${NEW_DOMAIN}"

# Update NEXT_PUBLIC_API_URL — replace old domain with new, preserving scheme and port
CURRENT_API_URL="${NEXT_PUBLIC_API_URL:-https://${OLD_DOMAIN}}"
NEW_API_URL="${CURRENT_API_URL//${OLD_DOMAIN}/${NEW_DOMAIN}}"
set_env_var "NEXT_PUBLIC_API_URL" "${NEW_API_URL}"
success "  NEXT_PUBLIC_API_URL → ${NEW_API_URL}"

# Update CORS_ORIGIN if set
if [ -n "${CORS_ORIGIN:-}" ]; then
    NEW_CORS="${CORS_ORIGIN//${OLD_DOMAIN}/${NEW_DOMAIN}}"
    set_env_var "CORS_ORIGIN" "${NEW_CORS}"
    success "  CORS_ORIGIN → ${NEW_CORS}"
fi

# Update CERT_EMAIL if it contains the old domain
if [ -n "${CERT_EMAIL:-}" ]; then
    if [[ "${CERT_EMAIL}" == *"${OLD_DOMAIN}"* ]]; then
        NEW_CERT_EMAIL="${CERT_EMAIL//${OLD_DOMAIN}/${NEW_DOMAIN}}"
        set_env_var "CERT_EMAIL" "${NEW_CERT_EMAIL}"
        success "  CERT_EMAIL → ${NEW_CERT_EMAIL}"
    fi
fi

success "  DOMAIN → ${NEW_DOMAIN}"

# ── 2. Update local Apache proxy configs ──────────────────────────
PROXY_DIR="${PROJECT_ROOT}/docker/proxy"

update_file() {
    local file="$1"
    local filename
    filename=$(basename "$file")

    if [ ! -f "$file" ]; then
        return
    fi

    if grep -q "${OLD_DOMAIN}" "$file" 2>/dev/null; then
        # macOS-compatible sed
        sed -i '' "s|${OLD_DOMAIN}|${NEW_DOMAIN}|g" "$file"
        success "  ${filename} updated"
    fi
}

info "Updating project files..."

# Apache proxy configs (local dev)
update_file "${PROXY_DIR}/httpd.conf"
update_file "${PROXY_DIR}/httpd-vhosts.conf"
update_file "${PROXY_DIR}/httpd-vhosts-dev.conf"

# Docker compose defaults
update_file "${PROJECT_ROOT}/docker/compose/docker-compose.yml"

# Frontend API fallback URLs
update_file "${PROJECT_ROOT}/apps/nextjs/lib/api.ts"
update_file "${PROJECT_ROOT}/apps/nextjs/lib/admin-api.ts"
update_file "${PROJECT_ROOT}/apps/nextjs/lib/auth-api.ts"
update_file "${PROJECT_ROOT}/apps/nextjs/lib/blog-api.ts"
update_file "${PROJECT_ROOT}/apps/nextjs/stores/app-settings-store.ts"

# CLI script defaults
update_file "${PROJECT_ROOT}/bin/cli/commands/env.sh"
update_file "${PROJECT_ROOT}/bin/cli/commands/certs.sh"
update_file "${PROJECT_ROOT}/bin/cli/commands/certs-renew.sh"

# .env.example
update_file "${PROJECT_ROOT}/.env.example"

# ── 3. Summary ────────────────────────────────────────────────────
echo ""
success "Domain changed: ${OLD_DOMAIN} → ${NEW_DOMAIN}"
echo ""

# Detect what the user needs to do next
NEEDS_CERTS=false
NEEDS_BUILD=false
NEEDS_RESTART=false

# Check if certs exist for old domain but not new
SSL_DIR="${PROJECT_ROOT}/docker/ssl"
if [ -d "${SSL_DIR}" ] && [ -f "${SSL_DIR}/${OLD_DOMAIN}.crt" ] && [ ! -f "${SSL_DIR}/${NEW_DOMAIN}.crt" ]; then
    NEEDS_CERTS=true
fi

# Next.js always needs rebuild (NEXT_PUBLIC_API_URL is build-time)
NEEDS_BUILD=true
NEEDS_RESTART=true

info "Next steps:"
if [ "${NEEDS_CERTS}" = true ]; then
    echo "  1. ./cli certs            # Generate SSL certs for ${NEW_DOMAIN}"
    echo "  2. ./cli build nextjs     # Rebuild (NEXT_PUBLIC_API_URL changed)"
    echo "  3. ./cli up               # Restart containers"
else
    echo "  1. ./cli build nextjs     # Rebuild (NEXT_PUBLIC_API_URL changed)"
    echo "  2. ./cli up               # Restart containers"
fi

# Hosts file reminder for local domains
if [[ "${NEW_DOMAIN}" == *.test || "${NEW_DOMAIN}" == *.local || "${NEW_DOMAIN}" == *.localhost ]]; then
    echo ""
    warning "Don't forget to add ${NEW_DOMAIN} to your /etc/hosts:"
    echo "  127.0.0.1  ${NEW_DOMAIN}"
fi

echo ""
