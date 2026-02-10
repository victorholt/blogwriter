#!/usr/bin/env bash

# Open PostgreSQL shell

check_docker
load_env

info "Opening PostgreSQL shell..."
dc exec postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
