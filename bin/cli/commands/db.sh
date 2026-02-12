#!/usr/bin/env bash

# Database management commands (Drizzle ORM)

check_docker
load_env

DB_COMMAND="${1:-}"
shift || true

ENV="${APP_ENV:-local}"

# In non-local environments, drizzle-kit is only in the migrations stage
# Use a one-off container from the api-migrations service
run_drizzle() {
    local npm_script="$1"
    if [ "${ENV}" = "local" ]; then
        dc exec api npm run "${npm_script}"
    else
        COMPOSE_PROFILES="${COMPOSE_PROFILES:+${COMPOSE_PROFILES},}tools" dc run --build --rm api-migrations npm run "${npm_script}"
    fi
}

show_db_help() {
    cat << EOF
Database Commands (Drizzle ORM):

Usage: ./cli db <command>

Commands:
    sync        Generate migrations from schema + apply them (most common)
    migrate     Run pending migrations
    generate    Generate migrations from schema changes
    push        Push schema changes directly (no migration files)

Examples:
    ./cli db sync
    ./cli db migrate
    ./cli db generate
    ./cli db push

EOF
}

case "${DB_COMMAND}" in
    sync)
        info "Generating migration files from schema..."
        run_drizzle db:generate
        success "Migration files generated!"
        info "Running database migrations..."
        run_drizzle db:migrate
        success "Migrations completed!"
        ;;
    migrate)
        info "Running database migrations..."
        run_drizzle db:migrate
        success "Migrations completed!"
        ;;
    generate)
        info "Generating migration files from schema..."
        run_drizzle db:generate
        success "Migration files generated!"
        ;;
    push)
        info "Pushing schema changes directly..."
        run_drizzle db:push
        success "Schema pushed!"
        ;;
    help|--help|-h|"")
        show_db_help
        ;;
    *)
        error "Unknown db command: ${DB_COMMAND}"
        echo ""
        show_db_help
        exit 1
        ;;
esac
