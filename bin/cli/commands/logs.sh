#!/usr/bin/env bash

# View container logs

check_docker

SERVICE="${1:-}"
FOLLOW="${2:-}"

if [ "${FOLLOW}" = "-f" ] || [ "${FOLLOW}" = "--follow" ]; then
    FOLLOW_FLAG="-f"
else
    FOLLOW_FLAG=""
fi

if [ -n "${SERVICE}" ]; then
    if service_exists "${SERVICE}"; then
        dc logs ${FOLLOW_FLAG} "${SERVICE}"
    else
        error "Service '${SERVICE}' not found"
        exit 1
    fi
else
    dc logs ${FOLLOW_FLAG}
fi
