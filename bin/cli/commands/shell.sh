#!/usr/bin/env bash

# Open a shell in a container

check_docker

SERVICE="${1:-}"

if [ -z "${SERVICE}" ]; then
    error "Service name required"
    echo "Usage: shell <service>"
    exit 1
fi

if ! service_exists "${SERVICE}"; then
    error "Service '${SERVICE}' not found"
    exit 1
fi

info "Opening shell in ${SERVICE}..."

# Try bash first, fallback to sh
if dc exec "${SERVICE}" bash --version > /dev/null 2>&1; then
    dc exec "${SERVICE}" bash
else
    dc exec "${SERVICE}" sh
fi
