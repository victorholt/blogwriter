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

echo "Starting Apache proxy..."

# Execute the main command
exec "$@"
