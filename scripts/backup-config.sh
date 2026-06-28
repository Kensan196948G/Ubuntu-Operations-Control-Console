#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-${ROOT_DIR}/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "${BACKUP_DIR}"
tar -czf "${BACKUP_DIR}/uocc-config-${STAMP}.tar.gz" -C "${ROOT_DIR}" config .env.example docker-compose.yml

echo "${BACKUP_DIR}/uocc-config-${STAMP}.tar.gz"

