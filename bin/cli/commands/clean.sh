#!/usr/bin/env bash

# Remove all project containers, volumes, and local images

check_docker

info "Removing project containers, volumes, and images..."
dc down --volumes --rmi local "$@"

success "Project cleaned successfully!"
