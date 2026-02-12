#!/usr/bin/env bash

# Renew SSL certificates
# For Let's Encrypt (staging/prod) environments

load_env

ENV="${APP_ENV:-local}"
DOMAIN="${DOMAIN:-blogwriter.test}"
SSL_DIR="${PROJECT_ROOT}/docker/ssl"

if [ "${ENV}" = "local" ]; then
    info "Local environment uses self-signed certificates."
    info "To regenerate, run: ./cli certs --force"
    exit 0
fi

check_docker

info "Renewing Let's Encrypt certificates..."

# Run certbot renew (COMPOSE_PROFILES activates the certbot service)
COMPOSE_PROFILES="${COMPOSE_PROFILES:+${COMPOSE_PROFILES},}certbot" dc run --rm certbot renew

if [ $? -ne 0 ]; then
    error "Certificate renewal failed."
    exit 1
fi

# Copy renewed certs to standard location
LE_LIVE="${SSL_DIR}/letsencrypt/live/${DOMAIN}"
if [ -d "${LE_LIVE}" ]; then
    cp -L "${LE_LIVE}/fullchain.pem" "${SSL_DIR}/${DOMAIN}.crt"
    cp -L "${LE_LIVE}/privkey.pem" "${SSL_DIR}/${DOMAIN}.key"
    cp -L "${LE_LIVE}/chain.pem" "${SSL_DIR}/ca.crt"
    success "Certificates renewed for ${DOMAIN}"
else
    warning "No renewed certificates found. They may not have been due for renewal."
fi

# Reload Apache
info "Reloading Apache..."
dc exec proxy httpd -k graceful
success "Apache reloaded."

echo ""
info "Tip: Add a cron job for automatic renewal:"
echo "  0 3 * * * cd ${PROJECT_ROOT} && ./cli certs-renew >> /var/log/cert-renew.log 2>&1"
