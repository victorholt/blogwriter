#!/usr/bin/env bash

# View Apache proxy logs

check_docker

info "Apache Proxy Logs:"
echo ""
dc logs -f proxy
