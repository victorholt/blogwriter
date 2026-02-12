#!/usr/bin/env bash

# Start all containers

check_docker
load_env

ENV="${APP_ENV:-local}"

# In non-local environments, auto-build production images before starting
if [ "${ENV}" != "local" ]; then
    info "Environment: ${ENV} — building production images..."
    dc build
fi

info "Starting containers..."
dc up -d "$@"

success "Containers started successfully!"
info "Run './cli status' to see container status"
info "Run './cli logs' to view logs"
