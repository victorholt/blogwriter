#!/usr/bin/env bash

# Reload Apache proxy configuration

check_docker

info "Reloading Apache configuration..."
dc exec proxy httpd -k graceful

success "Apache configuration reloaded!"
