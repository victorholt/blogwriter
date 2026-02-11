#!/usr/bin/env bash

# Database management commands (Drizzle ORM)

check_docker
load_env

DB_COMMAND="${1:-}"
shift || true

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
        dc exec api npm run db:generate
        success "Migration files generated!"
        info "Running database migrations..."
        dc exec api npm run db:migrate
        success "Migrations completed!"
        ;;
    migrate)
        info "Running database migrations..."
        dc exec api npm run db:migrate
        success "Migrations completed!"
        ;;
    generate)
        info "Generating migration files from schema..."
        dc exec api npm run db:generate
        success "Migration files generated!"
        ;;
    push)
        info "Pushing schema changes directly..."
        dc exec api npm run db:push
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
