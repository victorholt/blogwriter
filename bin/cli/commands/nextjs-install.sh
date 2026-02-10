#!/usr/bin/env bash

# Install Next.js dependencies

check_docker

info "Installing Next.js dependencies..."
dc exec nextjs npm install

success "Dependencies installed!"
