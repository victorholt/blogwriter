#!/usr/bin/env bash

# Stop all containers

check_docker

info "Stopping containers..."
dc down "$@"

success "Containers stopped successfully!"
