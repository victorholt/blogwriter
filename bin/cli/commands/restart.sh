#!/usr/bin/env bash

# Restart containers

check_docker

SERVICE="${1:-}"

if [ -n "${SERVICE}" ]; then
    if service_exists "${SERVICE}"; then
        info "Restarting ${SERVICE}..."
        dc restart "${SERVICE}"
        success "${SERVICE} restarted successfully!"
    else
        error "Service '${SERVICE}' not found"
        exit 1
    fi
else
    info "Restarting all containers..."
    dc restart
    success "All containers restarted successfully!"
fi
