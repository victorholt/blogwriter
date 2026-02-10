#!/usr/bin/env bash

# Show container status

check_docker

info "Container Status:"
echo ""
dc ps
