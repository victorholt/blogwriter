#!/usr/bin/env bash

# Start all containers

check_docker
load_env

ENV="${APP_ENV:-local}"

# Force-remove stale containers (Created/Exited) to prevent port conflicts.
# `docker rm -f` is used instead of `docker compose rm` because compose rm
# cannot release port bindings held by containers stuck in "Created" state.
PREFIX="${CONTAINER_PREFIX:-blogwriter}"
stale=$(docker ps -a --filter "name=${PREFIX}-" --filter "status=created" --filter "status=exited" -q 2>/dev/null)
if [ -n "$stale" ]; then
    warning "Removing stale containers to avoid port conflicts..."
    docker rm -f $stale 2>/dev/null
fi

# Check for port conflicts before starting (local only — prod doesn't expose ports)
if [ "${ENV}" = "local" ]; then
    check_all_ports || exit 1
fi

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
