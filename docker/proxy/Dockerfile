# Apache HTTP Server with proxy modules
FROM httpd:2.4-alpine

# Install envsubst for config templating
RUN apk add --no-cache gettext

# Enable proxy modules
RUN sed -i 's/#LoadModule proxy_module/LoadModule proxy_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule proxy_http_module/LoadModule proxy_http_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule rewrite_module/LoadModule rewrite_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule ssl_module/LoadModule ssl_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule socache_shmcb_module/LoadModule socache_shmcb_module/' /usr/local/apache2/conf/httpd.conf

# Create directories
RUN mkdir -p /usr/local/apache2/conf/vhosts && \
    mkdir -p /usr/local/apache2/conf/ssl && \
    mkdir -p /usr/local/apache2/conf/templates && \
    mkdir -p /usr/local/apache2/htdocs/.well-known/acme-challenge

# Copy config templates (used in production via envsubst)
COPY docker/proxy/httpd.conf.template /usr/local/apache2/conf/templates/httpd.conf.template
COPY docker/proxy/httpd-vhosts.conf.template /usr/local/apache2/conf/templates/httpd-vhosts.conf.template

# Copy entrypoint script
COPY docker/scripts/proxy-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["httpd-foreground"]
