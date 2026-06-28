#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/uocc-agent"
CONFIG_DIR="/etc/uocc-agent"
SERVICE_FILE="/etc/systemd/system/uocc-agent.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "install-agent.sh must be run as root" >&2
  exit 1
fi

if ! id -u uocc-agent >/dev/null 2>&1; then
  useradd --system --home-dir "${INSTALL_DIR}" --shell /usr/sbin/nologin uocc-agent
fi

install -d -o uocc-agent -g uocc-agent "${INSTALL_DIR}" "${CONFIG_DIR}"
rm -rf "${INSTALL_DIR}/src"
cp -a "${ROOT_DIR}/agent/src" "${INSTALL_DIR}/src"
cp "${ROOT_DIR}/agent/requirements.txt" "${INSTALL_DIR}/requirements.txt"

python3 -m venv "${INSTALL_DIR}/.venv"
"${INSTALL_DIR}/.venv/bin/pip" install --upgrade pip
"${INSTALL_DIR}/.venv/bin/pip" install -r "${INSTALL_DIR}/requirements.txt"

if [[ ! -f "${CONFIG_DIR}/allowlist.yaml" ]]; then
  cp "${ROOT_DIR}/config/allowlist.example.yaml" "${CONFIG_DIR}/allowlist.yaml"
fi

cat > "${CONFIG_DIR}/uocc-agent.env" <<EOF
PYTHONPATH=${INSTALL_DIR}/src
ALLOWLIST_PATH=${CONFIG_DIR}/allowlist.yaml
AGENT_BACKEND=demo
LOG_DEFAULT_LINES=200
LOG_MAX_LINES=1000
EOF

cp "${ROOT_DIR}/agent/systemd/uocc-agent.service" "${SERVICE_FILE}"
chown -R uocc-agent:uocc-agent "${INSTALL_DIR}"
systemctl daemon-reload
systemctl enable --now uocc-agent.service

echo "uocc-agent installed. Edit ${CONFIG_DIR}/uocc-agent.env and set AGENT_BACKEND=local after permissions are configured."
