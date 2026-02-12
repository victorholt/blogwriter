#!/usr/bin/env bash

# Renew SSL certificates
# For Let's Encrypt (staging/prod) environments

load_env

ENV="${APP_ENV:-local}"
DOMAIN="${DOMAIN:-blogwriter.test}"

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

# Copy renewed certs from letsencrypt volume to ssl-certs volume (inside container)
info "Copying renewed certificates to SSL volume..."
COMPOSE_PROFILES="${COMPOSE_PROFILES:+${COMPOSE_PROFILES},}certbot" dc run --rm --entrypoint sh certbot -c \
    "if [ -d /etc/letsencrypt/live/${DOMAIN} ]; then \
         cp -L /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/ssl-output/${DOMAIN}.crt && \
         cp -L /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/ssl-output/${DOMAIN}.key && \
         cp -L /etc/letsencrypt/live/${DOMAIN}/chain.pem /etc/ssl-output/ca.crt && \
         echo 'Certificates copied'; \
     else \
         echo 'No renewed certificates found (may not have been due for renewal)'; \
     fi"

# Restart proxy to pick up new certs
info "Restarting proxy..."
dc restart proxy
success "Certificate renewal complete."

echo ""
info "Tip: For automatic renewal, start the auto-renewal service:"
echo "  COMPOSE_PROFILES=auto-renew ./cli up certbot-renew"
