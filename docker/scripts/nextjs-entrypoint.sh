#!/bin/sh
set -e

# Install dependencies if package.json changed
if [ -f "package.json" ]; then
    echo "Checking for dependency changes..."

    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    else
        echo "Dependencies up to date"
    fi
fi

# Execute the main command
exec "$@"
