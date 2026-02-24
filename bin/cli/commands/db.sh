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
    info        Show database connection info and table stats
    sync        Generate migrations from schema + apply them (most common)
    migrate     Run pending migrations
    generate    Generate migrations from schema changes
    push        Push schema changes directly (no migration files)

Examples:
    ./cli db info
    ./cli db sync
    ./cli db migrate
    ./cli db generate
    ./cli db push

EOF
}

case "${DB_COMMAND}" in
    info)
        info "Querying database info..."
        dc exec api node -e '
            const { Pool } = require("pg");
            let url = process.env.DATABASE_URL || "";
            const masked = url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:*****@");
            // Sanitize: URL-encode user/pass to handle special chars (e.g. <, >, @)
            const m = url.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.+)@(.+)$/);
            if (m) {
                const [, proto, rawUser, rawPass, rest] = m;
                url = proto + encodeURIComponent(decodeURIComponent(rawUser)) + ":" + encodeURIComponent(decodeURIComponent(rawPass)) + "@" + rest;
            }
            const isLocal = url.includes("@localhost") || url.includes("@postgres:");
            const pool = new Pool({
                connectionString: url,
                ssl: isLocal ? false : { rejectUnauthorized: false },
                connectionTimeoutMillis: 5000,
            });
            (async () => {
                try {
                    console.log("");
                    console.log("  Connection:  " + masked);
                    console.log("");

                    const ver = await pool.query("SELECT version()");
                    const verStr = ver.rows[0].version.match(/PostgreSQL [\d.]+/)?.[0] || ver.rows[0].version;
                    console.log("  Server:      " + verStr);

                    const db = await pool.query("SELECT current_database()");
                    console.log("  Database:    " + db.rows[0].current_database);

                    const size = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
                    console.log("  Size:        " + size.rows[0].size);

                    const tables = await pool.query(
                        "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename", ["public"]
                    );
                    console.log("  Tables:      " + tables.rows.length);
                    console.log("");

                    for (const t of tables.rows) {
                        const c = await pool.query("SELECT COUNT(*) as n FROM \"" + t.tablename + "\"");
                        const count = c.rows[0].n;
                        const pad = t.tablename.padEnd(32);
                        console.log("  " + pad + count + " rows");
                    }
                    console.log("");
                    await pool.end();
                } catch (err) {
                    console.error("  Error: " + err.message);
                    process.exit(1);
                }
            })();
        '
        ;;
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
