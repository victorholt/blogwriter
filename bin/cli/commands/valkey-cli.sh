#!/usr/bin/env bash

# Open Valkey CLI

check_docker

info "Opening Valkey CLI..."
dc exec valkey valkey-cli
