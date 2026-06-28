#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
API_URL="${API_URL:-${WEB_URL}/ops-api}"

echo "Web-proxied API health:"
curl --fail --silent --show-error "${API_URL}/health"
echo

if [[ -n "${AGENT_URL:-}" ]]; then
  echo "Agent health:"
  curl --fail --silent --show-error "${AGENT_URL}/v1/health"
  echo
fi
