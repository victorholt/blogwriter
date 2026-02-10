# Apache HTTP Server with proxy modules
FROM httpd:2.4-alpine

# Install required modules (most are already included)
# Enable proxy modules
RUN sed -i 's/#LoadModule proxy_module/LoadModule proxy_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule proxy_http_module/LoadModule proxy_http_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule rewrite_module/LoadModule rewrite_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule ssl_module/LoadModule ssl_module/' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/#LoadModule socache_shmcb_module/LoadModule socache_shmcb_module/' /usr/local/apache2/conf/httpd.conf

# Create vhosts config directory
RUN mkdir -p /usr/local/apache2/conf/vhosts && \
    mkdir -p /usr/local/apache2/conf/ssl && \
    mkdir -p /usr/local/apache2/htdocs/.well-known/acme-challenge

# Copy entrypoint script
COPY docker/scripts/proxy-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["httpd-foreground"]
