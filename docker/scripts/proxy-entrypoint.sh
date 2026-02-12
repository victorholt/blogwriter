#!/bin/sh
set -e

# If DOMAIN is set (production/staging), generate configs from templates via envsubst.
# In local dev, the override compose file volume-mounts the hardcoded configs instead.
if [ -n "$DOMAIN" ]; then
    echo "Generating Apache config for domain: ${DOMAIN}"
    # Whitelist only ${DOMAIN} so Apache's own %{HTTP_HOST}, %{REQUEST_URI} etc. are preserved
    envsubst '${DOMAIN}' \
        < /usr/local/apache2/conf/templates/httpd.conf.template \
        > /usr/local/apache2/conf/httpd.conf
    envsubst '${DOMAIN}' \
        < /usr/local/apache2/conf/templates/httpd-vhosts.conf.template \
        > /usr/local/apache2/conf/vhosts/httpd-vhosts.conf
fi

# Watch for certificate changes and gracefully reload Apache
if [ -n "$DOMAIN" ]; then
    (
        CERT="/usr/local/apache2/conf/ssl/${DOMAIN}.crt"
        LAST_MOD=""
        while true; do
            sleep 3600
            if [ -f "$CERT" ]; then
                CURRENT_MOD=$(stat -c %Y "$CERT" 2>/dev/null || true)
                if [ -n "$LAST_MOD" ] && [ -n "$CURRENT_MOD" ] && [ "$CURRENT_MOD" != "$LAST_MOD" ]; then
                    echo "[$(date)] Certificate change detected, reloading Apache..."
                    httpd -k graceful
                fi
                LAST_MOD="$CURRENT_MOD"
            fi
        done
    ) &
fi

echo "Starting Apache proxy..."

# Execute the main command
exec "$@"
