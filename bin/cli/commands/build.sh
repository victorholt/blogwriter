#!/usr/bin/env bash

# Build or rebuild containers

check_docker
load_env

SERVICE="${1:-}"

if [ -n "${SERVICE}" ]; then
    if service_exists "${SERVICE}"; then
        info "Building ${SERVICE}..."
        dc build "${SERVICE}"
        success "${SERVICE} built successfully!"
    else
        error "Service '${SERVICE}' not found"
        exit 1
    fi
else
    info "Building all containers..."
    dc build
    success "All containers built successfully!"
fi
