#!/usr/bin/env bash

# ./cli version — View or bump the project version
#
# Usage:
#   ./cli version              Show current version
#   ./cli version patch        Bump patch  (0.0.1 → 0.0.2)
#   ./cli version minor        Bump minor  (0.0.1 → 0.1.0)
#   ./cli version major        Bump major  (0.0.1 → 1.0.0)
#   ./cli version set 1.2.3    Set explicit version

VERSION_FILE="${PROJECT_ROOT}/VERSION"

if [[ ! -f "$VERSION_FILE" ]]; then
    echo "0.0.0" > "$VERSION_FILE"
fi

CURRENT=$(tr -d '[:space:]' < "$VERSION_FILE")

bump_version() {
    local version="$1"
    local part="$2"

    IFS='.' read -r major minor patch <<< "$version"
    major="${major:-0}"
    minor="${minor:-0}"
    patch="${patch:-0}"

    case "$part" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

SUB="${1:-}"

case "$SUB" in
    "")
        info "Current version: ${CURRENT}"
        ;;
    patch|minor|major)
        NEW=$(bump_version "$CURRENT" "$SUB")
        echo "$NEW" > "$VERSION_FILE"
        success "Version bumped: ${CURRENT} → ${NEW}"
        ;;
    set)
        NEW="${2:-}"
        if [[ -z "$NEW" ]]; then
            error "Usage: ./cli version set <version>"
            exit 1
        fi
        if [[ ! "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            error "Invalid version format. Expected: X.Y.Z (e.g. 1.2.3)"
            exit 1
        fi
        echo "$NEW" > "$VERSION_FILE"
        success "Version set: ${CURRENT} → ${NEW}"
        ;;
    *)
        error "Unknown subcommand: ${SUB}"
        echo ""
        echo "Usage:"
        echo "  ./cli version              Show current version"
        echo "  ./cli version patch        Bump patch  (0.0.1 → 0.0.2)"
        echo "  ./cli version minor        Bump minor  (0.0.1 → 0.1.0)"
        echo "  ./cli version major        Bump major  (0.0.1 → 1.0.0)"
        echo "  ./cli version set 1.2.3    Set explicit version"
        exit 1
        ;;
esac
