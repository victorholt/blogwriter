#!/usr/bin/env bash

# Execute a command in a container

check_docker

SERVICE="${1:-}"
shift || true

if [ -z "${SERVICE}" ]; then
    error "Service name required"
    echo "Usage: exec <service> <command>"
    exit 1
fi

if ! service_exists "${SERVICE}"; then
    error "Service '${SERVICE}' not found"
    exit 1
fi

dc exec "${SERVICE}" "$@"
