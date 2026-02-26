#!/bin/sh
set -e

# Install dependencies if package-lock.json changed or node_modules is missing.
# Uses package-lock.json because npm installs in a running container update the
# lock file (via the bind mount) but do not touch package.json.
if [ -f "package.json" ]; then
    echo "Checking for dependency changes..."

    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    else
        echo "Dependencies up to date"
    fi
fi

# Execute the main command
exec "$@"
