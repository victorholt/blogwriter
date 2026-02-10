#!/bin/sh
set -e

if [ -f "package.json" ]; then
    echo "Checking dependencies..."
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
fi

exec "$@"
