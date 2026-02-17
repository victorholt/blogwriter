#!/usr/bin/env bash

# User management commands

check_docker
load_env

# Use docker-compose defaults if env vars are unset
DB_USER="${POSTGRES_USER:-blogwriter_user}"
DB_NAME="${POSTGRES_DB:-blogwriter_db}"

USER_COMMAND="${1:-}"
shift || true

show_user_help() {
    cat << EOF
User Management Commands:

Usage: ./cli user <command> [options]

Commands:
    set_role       Set a user's role
    set_password   Set a user's password

Examples:
    ./cli user set_role admin@example.com admin
    ./cli user set_role admin@example.com user
    ./cli user set_password admin@example.com newpassword123

EOF
}

show_set_role_help() {
    cat << EOF
Set a user's role.

Usage: ./cli user set_role <email> <role>

Available roles:
    admin    Full access — can manage settings, users, and all blogs
    user     Standard access — can create and manage their own blogs

Examples:
    ./cli user set_role admin@example.com admin
    ./cli user set_role someone@example.com user

EOF
}

show_set_password_help() {
    cat << EOF
Set a user's password (bypasses current password check).

Usage: ./cli user set_password <email> <password>

The password must be at least 8 characters.

Examples:
    ./cli user set_password admin@example.com newpassword123

EOF
}

cmd_set_role() {
    local email="${1:-}"
    local role="${2:-}"

    if [ "$email" = "--help" ] || [ "$email" = "-h" ] || [ -z "$email" ]; then
        show_set_role_help
        return 0
    fi

    if [ -z "$role" ]; then
        error "Missing role. Usage: ./cli user set_role <email> <role>"
        echo ""
        show_set_role_help
        return 1
    fi

    # Validate role
    if [ "$role" != "admin" ] && [ "$role" != "user" ]; then
        error "Invalid role: ${role}"
        echo ""
        show_set_role_help
        return 1
    fi

    info "Setting role for ${email} to '${role}'..."

    local result
    result=$(dc exec -T postgres psql -U "${DB_USER}" -d "${DB_NAME}" -t -A -c \
        "UPDATE users SET role = '${role}', updated_at = NOW() WHERE LOWER(email) = LOWER('${email}') RETURNING email, role;" 2>&1 \
        | grep -v '^UPDATE ' || true)

    if [ -z "$result" ]; then
        error "No user found with email: ${email}"
        return 1
    fi

    local updated_email updated_role
    updated_email=$(echo "$result" | cut -d'|' -f1)
    updated_role=$(echo "$result" | cut -d'|' -f2)
    success "Role for ${updated_email} set to '${updated_role}'"
}

cmd_set_password() {
    local email="${1:-}"
    local password="${2:-}"

    if [ "$email" = "--help" ] || [ "$email" = "-h" ] || [ -z "$email" ]; then
        show_set_password_help
        return 0
    fi

    if [ -z "$password" ]; then
        error "Missing password. Usage: ./cli user set_password <email> <password>"
        echo ""
        show_set_password_help
        return 1
    fi

    if [ ${#password} -lt 8 ]; then
        error "Password must be at least 8 characters."
        return 1
    fi

    info "Setting password for ${email}..."

    # Run inside the api container where bcrypt is available
    local result
    result=$(dc exec -T api node -e "
        const bcrypt = require('bcrypt');
        (async () => {
            const hash = await bcrypt.hash(process.argv[1], 10);
            console.log(hash);
        })();
    " "$password" 2>&1)

    if [ -z "$result" ] || [[ "$result" == *"Error"* ]]; then
        error "Failed to hash password: ${result}"
        return 1
    fi

    local hash="$result"

    local update_result
    update_result=$(dc exec -T postgres psql -U "${DB_USER}" -d "${DB_NAME}" -t -A -c \
        "UPDATE users SET password_hash = '${hash}', updated_at = NOW() WHERE LOWER(email) = LOWER('${email}') RETURNING email;" 2>&1 \
        | grep -v '^UPDATE ' || true)

    if [ -z "$update_result" ]; then
        error "No user found with email: ${email}"
        return 1
    fi

    success "Password updated for ${update_result}"
}

case "${USER_COMMAND}" in
    set_role)
        cmd_set_role "$@"
        ;;
    set_password)
        cmd_set_password "$@"
        ;;
    help|--help|-h|"")
        show_user_help
        ;;
    *)
        error "Unknown user command: ${USER_COMMAND}"
        echo ""
        show_user_help
        exit 1
        ;;
esac
