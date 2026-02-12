#!/usr/bin/env bash

# Run TypeScript type checking across all services
# Usage: ./cli typecheck [service]

check_docker
load_env

SERVICE="${1:-}"
FAILED=false

run_typecheck() {
    local svc="$1"
    local cmd="$2"
    info "Type-checking ${svc}..."
    if dc exec "${svc}" sh -c "${cmd}" 2>&1; then
        success "${svc} passed"
    else
        error "${svc} has type errors"
        FAILED=true
    fi
    echo ""
}

if [ -n "${SERVICE}" ]; then
    case "${SERVICE}" in
        api)
            run_typecheck api "npx tsc --noEmit"
            ;;
        nextjs)
            run_typecheck nextjs "npx tsc --noEmit"
            ;;
        *)
            error "Unknown service: ${SERVICE}. Use 'api' or 'nextjs'."
            exit 1
            ;;
    esac
else
    run_typecheck api "npx tsc --noEmit"
    run_typecheck nextjs "npx tsc --noEmit"
fi

if [ "${FAILED}" = true ]; then
    error "Type checking failed. Fix errors before deploying."
    exit 1
else
    success "All type checks passed!"
fi
