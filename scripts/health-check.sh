#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8000}"
AGENT_URL="${AGENT_URL:-http://127.0.0.1:8787}"

echo "API health:"
curl --fail --silent --show-error "${API_URL}/api/health"
echo

echo "Agent health:"
curl --fail --silent --show-error "${AGENT_URL}/v1/health"
echo

