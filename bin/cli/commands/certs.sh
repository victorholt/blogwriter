#!/usr/bin/env bash

# SSL Certificate management command
# Usage: ./cli certs [--domain=<domain>] [--days=<days>] [--force] [--email=<email>] [--staging-le]

# ============================================================================
# Help
# ============================================================================

show_cert_help() {
    echo "Generate SSL Certificates"
    echo ""
    echo "Usage:"
    echo "  ./cli certs [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --domain=<domain>  Domain to generate cert for (default: blogwriter.test)"
    echo "  --days=<days>      Certificate validity in days (default: 365, local only)"
    echo "  --force            Regenerate existing certificates"
    echo "  --email=<email>    Email for Let's Encrypt registration (staging/prod)"
    echo "  --staging-le       Use Let's Encrypt staging server (for testing)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Behavior by environment (APP_ENV):"
    echo "  local              Self-signed CA + domain certificate (openssl)"
    echo "  staging/prod       Let's Encrypt certificate via certbot"
    echo ""
    echo "Examples:"
    echo "  ./cli certs                                   # Local: self-signed for blogwriter.test"
    echo "  ./cli certs --force                           # Regenerate certificates"
    echo "  ./cli certs --email=admin@example.com         # Staging/Prod: Let's Encrypt"
    echo "  ./cli certs --staging-le                      # Test with LE staging server"
    echo ""
    echo "Notes:"
    echo "  - Local: Creates a CA and signs domain certs. macOS Keychain trust optional."
    echo "  - Staging/Prod: Uses certbot with HTTP-01 challenge (proxy must be running)."
    echo "  - After generating, rebuild proxy: ./cli build proxy && ./cli restart proxy"
    echo ""
}

# ============================================================================
# Parse Arguments
# ============================================================================

load_env

DOMAIN="${DOMAIN:-blogwriter.test}"
DAYS="365"
FORCE=""
EMAIL="${CERT_EMAIL:-admin@${DOMAIN}}"
LE_STAGING=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --domain=*)
            DOMAIN="${1#*=}"
            shift
            ;;
        --days=*)
            DAYS="${1#*=}"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --email=*)
            EMAIL="${1#*=}"
            shift
            ;;
        --staging-le)
            LE_STAGING="true"
            shift
            ;;
        -h|--help)
            show_cert_help
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_cert_help
            exit 1
            ;;
    esac
done

SSL_DIR="${PROJECT_ROOT}/docker/ssl"
ENV="${APP_ENV:-local}"

mkdir -p "${SSL_DIR}"

# ============================================================================
# Local: Self-signed CA + Domain Certificate
# ============================================================================

generate_self_signed() {
    # Check if openssl is available
    if ! command -v openssl &> /dev/null; then
        error "openssl is not installed. Please install it and try again."
        exit 1
    fi

    CA_KEY="${SSL_DIR}/ca.key"
    CA_CERT="${SSL_DIR}/ca.crt"

    # Step 1: Create local Certificate Authority (CA)
    if [ -f "${CA_KEY}" ] && [ -f "${CA_CERT}" ] && [ -z "${FORCE}" ]; then
        info "Using existing Certificate Authority"
    else
        info "Creating local Certificate Authority..."

        openssl genrsa -out "${CA_KEY}" 4096 2>/dev/null

        openssl req -x509 -new -nodes \
            -key "${CA_KEY}" \
            -sha256 \
            -days 1825 \
            -out "${CA_CERT}" \
            -subj "/C=US/ST=Local/L=Local/O=blogwriter Dev CA/CN=blogwriter Local CA"

        if [ $? -ne 0 ]; then
            error "Failed to create Certificate Authority."
            exit 1
        fi

        success "Certificate Authority created"
    fi

    # Step 2: Generate domain certificate signed by our CA
    DOMAIN_KEY="${SSL_DIR}/${DOMAIN}.key"
    DOMAIN_CERT="${SSL_DIR}/${DOMAIN}.crt"
    DOMAIN_CSR="${SSL_DIR}/${DOMAIN}.csr"
    DOMAIN_EXT="${SSL_DIR}/${DOMAIN}.ext"

    if [ -f "${DOMAIN_KEY}" ] && [ -f "${DOMAIN_CERT}" ] && [ -z "${FORCE}" ]; then
        warning "Certificate for ${DOMAIN} already exists. Use --force to regenerate."
        exit 0
    fi

    info "Generating certificate for ${DOMAIN}..."

    openssl genrsa -out "${DOMAIN_KEY}" 2048 2>/dev/null

    openssl req -new \
        -key "${DOMAIN_KEY}" \
        -out "${DOMAIN_CSR}" \
        -subj "/C=US/ST=Local/L=Local/O=blogwriter/CN=${DOMAIN}"

    cat > "${DOMAIN_EXT}" << EXTEOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = *.${DOMAIN}
DNS.3 = localhost
IP.1 = 127.0.0.1
EXTEOF

    openssl x509 -req \
        -in "${DOMAIN_CSR}" \
        -CA "${CA_CERT}" \
        -CAkey "${CA_KEY}" \
        -CAcreateserial \
        -out "${DOMAIN_CERT}" \
        -days "${DAYS}" \
        -sha256 \
        -extfile "${DOMAIN_EXT}" 2>/dev/null

    if [ $? -ne 0 ]; then
        error "Failed to generate domain certificate."
        exit 1
    fi

    rm -f "${DOMAIN_CSR}" "${DOMAIN_EXT}" "${SSL_DIR}/ca.srl"

    success "SSL certificate generated for ${DOMAIN}"
    echo ""
    info "CA Certificate:     ${CA_CERT}"
    info "Domain Certificate: ${DOMAIN_CERT}"
    info "Domain Private Key: ${DOMAIN_KEY}"
    echo ""

    # macOS Keychain trust (optional)
    if [[ "$(uname)" == "Darwin" ]]; then
        echo ""
        read -p "Add CA to macOS Keychain for browser trust? [y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            info "Adding CA certificate to macOS Keychain (requires sudo)..."
            sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CA_CERT}"
            if [ $? -eq 0 ]; then
                success "CA added to Keychain. Browsers will trust ${DOMAIN} certificates."
            else
                warning "Failed to add CA to Keychain. You can do it manually:"
                echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CA_CERT}"
            fi
        else
            info "Skipping Keychain trust. To manually trust later:"
            echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CA_CERT}"
        fi
    fi

    echo ""
    info "To apply certificates, rebuild and restart the proxy:"
    echo "  ./cli build proxy && ./cli restart proxy"
    echo ""
    warning "These are self-signed certificates for local development only."
}

# ============================================================================
# Auto-renewal service
# ============================================================================

start_auto_renewal() {
    # Check if certbot-renew container is already running
    if dc ps --format '{{.State}}' certbot-renew 2>/dev/null | grep -qi "running"; then
        info "Auto-renewal service is already running"
        return
    fi

    echo ""
    read -r -p "Start auto-renewal service (checks every 12 hours)? [Y/n]: " start_renewal
    if [[ "${start_renewal}" =~ ^[Nn]$ ]]; then
        info "Skipping auto-renewal. To renew manually: ./cli certs-renew"
        warning "Certificates expire in 90 days."
        return
    fi

    info "Starting certbot auto-renewal service..."
    COMPOSE_PROFILES="${COMPOSE_PROFILES:+${COMPOSE_PROFILES},}auto-renew,certbot" dc up -d certbot-renew

    if [ $? -eq 0 ]; then
        success "Auto-renewal service started"
        info "Checks for renewal every 12 hours"
        info "Proxy auto-reloads within 1 hour of cert change"
    else
        warning "Failed to start auto-renewal service."
        info "To start manually: COMPOSE_PROFILES=auto-renew ./cli up certbot-renew"
    fi
}

# ============================================================================
# Staging/Prod: Let's Encrypt via Certbot
# ============================================================================

generate_letsencrypt() {
    check_docker

    # Verify proxy is running (needed for HTTP-01 challenge)
    if ! dc ps --format '{{.State}}' proxy 2>/dev/null | grep -qi "running"; then
        error "Proxy must be running for Let's Encrypt HTTP-01 challenge."
        info "Start the proxy first: ./cli up proxy"
        exit 1
    fi

    info "Requesting Let's Encrypt certificate for ${DOMAIN}..."

    # Build certbot arguments
    local certbot_args="certonly --webroot -w /var/www/certbot"
    certbot_args="${certbot_args} --email ${EMAIL} --agree-tos --no-eff-email"
    certbot_args="${certbot_args} -d ${DOMAIN}"

    # Use LE staging server for testing
    if [ -n "${LE_STAGING}" ]; then
        certbot_args="${certbot_args} --staging"
        warning "Using Let's Encrypt STAGING server (certs will NOT be trusted)"
    fi

    # Force renewal
    if [ -n "${FORCE}" ]; then
        certbot_args="${certbot_args} --force-renewal"
    fi

    # Run certbot via docker compose (COMPOSE_PROFILES activates the certbot service)
    # Docker auto-creates the host directory for the volume mount
    COMPOSE_PROFILES="${COMPOSE_PROFILES:+${COMPOSE_PROFILES},}certbot" dc run --rm certbot ${certbot_args}

    if [ $? -ne 0 ]; then
        error "Let's Encrypt certificate request failed."
        info "Make sure:"
        echo "  - Port 80 is accessible from the internet"
        echo "  - DNS for ${DOMAIN} points to this server"
        echo "  - Proxy is running: ./cli up proxy"
        exit 1
    fi

    # Copy certs from letsencrypt volume to ssl-certs volume (inside container)
    info "Copying certificates to SSL volume..."
    COMPOSE_PROFILES="${COMPOSE_PROFILES:+${COMPOSE_PROFILES},}certbot" dc run --rm --entrypoint sh certbot -c \
        "cp -L /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/ssl-output/${DOMAIN}.crt && \
         cp -L /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/ssl-output/${DOMAIN}.key && \
         cp -L /etc/letsencrypt/live/${DOMAIN}/chain.pem /etc/ssl-output/ca.crt"

    if [ $? -ne 0 ]; then
        error "Failed to copy certificates to SSL volume."
        exit 1
    fi
    success "Let's Encrypt certificates installed for ${DOMAIN}"

    # Restart proxy to pick up new certs (full restart re-evaluates IfFile directives)
    info "Restarting proxy..."
    dc restart proxy
    success "Proxy restarted with new certificates."

    echo ""
    info "Certificates stored in Docker volume: ssl-certs"
    info "Renew with: ./cli certs-renew"
    echo ""

    # Start auto-renewal service
    start_auto_renewal
}

# ============================================================================
# Execute based on environment
# ============================================================================

case "${ENV}" in
    local)
        info "Environment: local (self-signed certificates)"
        generate_self_signed
        ;;
    staging|prod)
        info "Environment: ${ENV} (Let's Encrypt)"
        generate_letsencrypt
        ;;
    *)
        error "Unknown environment: ${ENV}"
        info "Set APP_ENV in your .env file to: local, staging, or prod"
        exit 1
        ;;
esac
