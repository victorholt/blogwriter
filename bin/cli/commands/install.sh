#!/usr/bin/env bash

# Install npm dependencies in app containers

check_docker

SERVICE="${1:-}"

run_install() {
    local svc="$1"
    info "Installing dependencies in ${svc}..."
    if dc exec "${svc}" npm install; then
        success "${svc} dependencies installed!"
    else
        error "${svc} dependency install failed"
        return 1
    fi
}

if [ -n "${SERVICE}" ]; then
    # Install for a specific service
    if ! service_exists "${SERVICE}"; then
        error "Service '${SERVICE}' not found"
        exit 1
    fi
    run_install "${SERVICE}"
else
    # Install for both api and nextjs
    run_install "api"
    echo ""
    run_install "nextjs"
fi
