#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "uninstall-agent.sh must be run as root" >&2
  exit 1
fi

systemctl disable --now uocc-agent.service 2>/dev/null || true
rm -f /etc/systemd/system/uocc-agent.service
systemctl daemon-reload

echo "uocc-agent service removed. Config remains in /etc/uocc-agent and files remain in /opt/uocc-agent."

