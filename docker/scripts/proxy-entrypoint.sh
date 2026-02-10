#!/bin/sh
set -e

# Wait for app services to be ready (optional, helps with startup)
echo "Starting Apache proxy..."

# Execute the main command
exec "$@"
