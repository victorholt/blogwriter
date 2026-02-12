#!/usr/bin/env bash

# Interactive environment configuration
# Usage: ./cli env

ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

show_env_help() {
    echo "Interactive Environment Configuration"
    echo ""
    echo "Usage:"
    echo "  ./cli env"
    echo ""
    echo "Walks you through configuring your .env file."
    echo "If .env already exists, current values are used as defaults."
    echo ""
}

# Help flag
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    show_env_help
    exit 0
fi

# ── Load existing .env values as defaults ────────────────────────
if [ -f "${ENV_FILE}" ]; then
    set -a
    source "${ENV_FILE}"
    set +a
    info "Loading existing .env values as defaults"
fi

# ── Prompt helper ────────────────────────────────────────────────
prompt() {
    local var_name="$1"
    local prompt_text="$2"
    local default_value="$3"
    local is_secret="${4:-false}"

    if [ -n "${default_value}" ]; then
        if [ "${is_secret}" = "true" ]; then
            local display="****${default_value: -4}"
            read -r -p "${prompt_text} [${display}]: " value
        else
            read -r -p "${prompt_text} [${default_value}]: " value
        fi
    else
        read -r -p "${prompt_text}: " value
    fi

    # Use default if empty
    value="${value:-${default_value}}"
    eval "export ${var_name}='${value}'"
}

# ── Generate random token ────────────────────────────────────────
generate_token() {
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32
    fi
}

echo ""
echo "========================================="
echo "  blogwriter - Environment Setup"
echo "========================================="
echo ""

# ── Environment ──────────────────────────────────────────────────
prompt APP_ENV "Environment (local/staging/prod)" "${APP_ENV:-local}"

prompt DOMAIN "Domain" "${DOMAIN:-blogwriter.test}"

# ── Docker ───────────────────────────────────────────────────────
prompt CONTAINER_PREFIX "Container prefix" "${CONTAINER_PREFIX:-blogwriter}"

# ── Database ─────────────────────────────────────────────────────
echo ""
info "Database configuration"
prompt POSTGRES_USER "Postgres user" "${POSTGRES_USER:-blogwriter_user}"
prompt POSTGRES_PASSWORD "Postgres password" "${POSTGRES_PASSWORD:-blogwriter_pass}" true
prompt POSTGRES_DB "Postgres database" "${POSTGRES_DB:-blogwriter_db}"

echo ""
read -r -p "Use external database? (set DATABASE_URL) [y/N]: " use_external_db
if [[ "${use_external_db}" =~ ^[Yy]$ ]]; then
    prompt DATABASE_URL "Database URL" "${DATABASE_URL:-}"
fi

# ── API Keys ─────────────────────────────────────────────────────
echo ""
info "API keys"

# Auto-generate admin token for non-local environments
if [[ "${APP_ENV}" != "local" && "${ADMIN_TOKEN:-dev-admin-token}" == "dev-admin-token" ]]; then
    ADMIN_TOKEN="$(generate_token)"
    info "Generated random ADMIN_TOKEN for ${APP_ENV}"
fi
prompt ADMIN_TOKEN "Admin token" "${ADMIN_TOKEN:-dev-admin-token}" true

prompt OPENROUTER_API_KEY "OpenRouter API key" "${OPENROUTER_API_KEY:-}" true

# ── Next.js ──────────────────────────────────────────────────────
echo ""
info "Next.js configuration"

# Auto-derive for non-local
if [[ "${APP_ENV}" != "local" ]]; then
    DEFAULT_API_URL="https://${DOMAIN}"
else
    DEFAULT_API_URL="${NEXT_PUBLIC_API_URL:-http://blogwriter.test:4444}"
fi
prompt NEXT_PUBLIC_API_URL "Public API URL (browser)" "${DEFAULT_API_URL}"

# ── CORS ─────────────────────────────────────────────────────────
if [[ "${APP_ENV}" != "local" ]]; then
    DEFAULT_CORS="https://${DOMAIN}"
    prompt CORS_ORIGIN "CORS origin" "${CORS_ORIGIN:-${DEFAULT_CORS}}"
fi

# ── Ports (local only) ──────────────────────────────────────────
if [[ "${APP_ENV}" == "local" ]]; then
    echo ""
    info "Local ports"
    prompt PROXY_PORT "Proxy HTTP port" "${PROXY_PORT:-8081}"
    prompt PROXY_SSL_PORT "Proxy HTTPS port" "${PROXY_SSL_PORT:-8444}"
    prompt API_EXTERNAL_PORT "API external port" "${API_EXTERNAL_PORT:-4444}"
    prompt NEXTJS_EXTERNAL_PORT "Next.js external port" "${NEXTJS_EXTERNAL_PORT:-4443}"
fi

# ── SSL ──────────────────────────────────────────────────────────
if [[ "${APP_ENV}" != "local" ]]; then
    echo ""
    info "SSL configuration"
    prompt CERT_EMAIL "Let's Encrypt email" "${CERT_EMAIL:-admin@${DOMAIN}}"
fi

# ── Docker Compose Profiles ─────────────────────────────────────
echo ""
read -r -p "Run Postgres/Valkey containers? (disable for external services) [Y/n]: " run_db
if [[ "${run_db}" =~ ^[Nn]$ ]]; then
    COMPOSE_PROFILES=""
else
    COMPOSE_PROFILES="db"
fi

# ── Write .env file ──────────────────────────────────────────────
echo ""
info "Writing ${ENV_FILE}..."

cat > "${ENV_FILE}" << ENVEOF
# ── Environment ──────────────────────────────────
APP_ENV=${APP_ENV}
DOMAIN=${DOMAIN}

# ── Docker ───────────────────────────────────────
CONTAINER_PREFIX=${CONTAINER_PREFIX}

# ── Database ─────────────────────────────────────
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
ENVEOF

if [ -n "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL=${DATABASE_URL}" >> "${ENV_FILE}"
fi

cat >> "${ENV_FILE}" << ENVEOF

# ── API Keys ─────────────────────────────────────
ADMIN_TOKEN=${ADMIN_TOKEN}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}

# ── Next.js (build-time) ────────────────────────
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENVEOF

if [ -n "${CORS_ORIGIN:-}" ]; then
    cat >> "${ENV_FILE}" << ENVEOF

# ── CORS ─────────────────────────────────────────
CORS_ORIGIN=${CORS_ORIGIN}
ENVEOF
fi

if [[ "${APP_ENV}" == "local" ]]; then
    cat >> "${ENV_FILE}" << ENVEOF

# ── Ports (local dev only) ──────────────────────
PROXY_PORT=${PROXY_PORT:-8081}
PROXY_SSL_PORT=${PROXY_SSL_PORT:-8444}
API_EXTERNAL_PORT=${API_EXTERNAL_PORT:-4444}
NEXTJS_EXTERNAL_PORT=${NEXTJS_EXTERNAL_PORT:-4443}
ENVEOF
fi

if [ -n "${CERT_EMAIL:-}" ]; then
    cat >> "${ENV_FILE}" << ENVEOF

# ── SSL ──────────────────────────────────────────
CERT_EMAIL=${CERT_EMAIL}
ENVEOF
fi

cat >> "${ENV_FILE}" << ENVEOF

# ── Docker Compose Profiles ─────────────────────
COMPOSE_PROFILES=${COMPOSE_PROFILES}
ENVEOF

echo ""
success ".env file written successfully!"
echo ""

if [[ "${APP_ENV}" == "local" ]]; then
    info "Next: ./cli up"
else
    info "Next: ./cli deploy  (or ./cli build && ./cli up)"
fi
echo ""
