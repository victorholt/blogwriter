#!/usr/bin/env bash

# Build Next.js application

check_docker

info "Building Next.js application..."
dc exec nextjs npm run build

success "Build completed!"
