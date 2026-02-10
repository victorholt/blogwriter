#!/usr/bin/env bash

# Start all containers

check_docker
load_env

info "Starting containers..."
dc up -d "$@"

success "Containers started successfully!"
info "Run './cli status' to see container status"
info "Run './cli logs' to view logs"
