# Development Loop

## Loop 1

| Phase | Evidence | Result |
| --- | --- | --- |
| Monitor | 仕様書3ファイル、GitHub remote、既存 Project 一覧、作業ツリーを確認 | 実装基盤が未作成だった |
| Development | Web/API/Agent/DB/Config/Scripts/Docs の MVP を構築 | 完了 |
| Verify | `pytest` 3件、Web lint/typecheck/audit、`docker compose build`、一時 stack 起動、API/Web/proxy/監査ログ確認 | 合格 |
| Improvement | Web compose service 追加、Route Handler 型修正、Docker `npm ci` 化、拒否操作監査、README/docs 更新 | 完了 |

## Verification Evidence

| Gate | Command / Evidence | Result |
| --- | --- | --- |
| API contract | `PYTHONPATH=apps/api /tmp/uocc-verify/bin/python -m pytest apps/api/tests -q` | 3 passed |
| Python compile | `py_compile` for `apps/api` and `agent/src` | passed |
| Web lint | `npm run lint` | passed |
| Web typecheck | `npm run typecheck` | passed |
| Web audit | `npm audit --audit-level=high` | 0 vulnerabilities |
| Compose config | `docker compose config` | passed |
| Compose build | `docker compose build` / `docker compose build web` | passed |
| Runtime health | temporary `uocc_verify` stack on ports 33100/33101/33102 | Web/API/DB/Agent up |
| API health | `GET /api/health` | `database=ok`, `agent=demo` |
| Web | `GET /` on temporary Web port | HTML returned |
| Proxy | `GET /ops-api/health` | API health returned |
| Security negative test | `POST /api/docker/containers/rsp-api/actions/prune` | 403 and audit log recorded |
| Logs | `GET /api/logs?target_type=systemd&target_id=ssh&lines=3` | bounded demo logs returned |

## Decision Log

| 日付 | 判断 | 理由 |
| --- | --- | --- |
| 2026-06-28 | FastAPI + Next.js + Docker Compose を採用 | 仕様書の推奨構成と一致し、個人運用MVPに対して軽量 |
| 2026-06-28 | 初期MVPでは認証未実装、localhost/LAN 前提で開始 | 要件定義のMVP範囲に一致 |
| 2026-06-28 | Web login/session を追加 | non-LAN/public deployment 前の最低限の公開面保護として必要 |
| 2026-06-28 | 削除系・任意コマンド API は作らない | セキュリティ要件を満たすため |
| 2026-06-28 | Docker Node 22 build をリリース検証の正とする | ホスト Node 25 では Next/SWC Wasm memory error が発生するため |

## Loop 2

| Phase | Evidence | Result |
| --- | --- | --- |
| Monitor | PR #5 は draft、CodeRabbit は draft のため review skip、Project #35 は #3 CI が Todo | CI と security hardening が次の最大ギャップ |
| Development | Release Gate workflow、API operator token/Origin、Agent allowlist enforcement、API/Agent internal-only compose、requirements split、standalone Web image | 完了 |
| Verify | `pytest` 6件、Web lint/typecheck/audit、Compose config/build、一時 stack 起動、proxy action/拒否監査、API/Agent非公開確認 | 合格 |
| Improvement | Security review Critical/High/Low の主要項目を修正し、README/docs/Project/PR 更新へ反映 | 完了 |

## Loop 2 Verification Evidence

| Gate | Command / Evidence | Result |
| --- | --- | --- |
| API/Agent tests | `PYTHONPATH=apps/api:agent/src /tmp/uocc-verify2/bin/python -m pytest apps/api/tests -q` | 6 passed |
| Python compile | `compileall -q apps/api/uocc_api agent/src/uocc_agent` | passed |
| Web lint/typecheck | `npm run lint && npm run typecheck` | passed |
| Web audit | `npm audit --audit-level=high` | 0 vulnerabilities |
| Compose config/build | `UOCC_OPERATOR_TOKEN=... docker compose config/build` | passed |

## Loop 4

| Phase | Evidence | Result |
| --- | --- | --- |
| Monitor | Project #4 の real Ubuntu host backend hardening が Todo。local backend 単体では action 名の二重防御が不足 | backend 内 hardening が必要 |
| Development | local backend に action allowlist、systemd unit 名検証、Docker container 名検証、Compose suffix/path 検証を追加 | 完了 |
| Verify | `pytest` 9件、非破壊 host status (`systemctl show ssh.service`)、Docker container 一覧確認 | 合格 |
| Improvement | security/operations/README に host-backed Agent checklist と backend 内防御を反映 | 完了 |

## Loop 4 Verification Evidence

| Gate | Command / Evidence | Result |
| --- | --- | --- |
| API/Agent tests | `PYTHONPATH=apps/api:agent/src /tmp/uocc-verify2/bin/python -m pytest apps/api/tests agent/src -q` | 9 passed |
| Python compile | `compileall -q apps/api/uocc_api agent/src/uocc_agent` | passed |
| Host systemd status | `systemctl show ssh.service --property=Id,ActiveState,LoadState --no-page` | loaded / active |
| Host Docker status | `docker ps --format ...` | listed running containers |

## Loop 5

| Phase | Evidence | Result |
| --- | --- | --- |
| Monitor | Project #2 の non-LAN/public deployment 前 authentication が Todo | Web 公開面の認証が必要 |
| Development | Web login/logout、署名付き HttpOnly session、middleware protection、`/ops-api` proxy 二重検証、auth unit tests を追加 | 完了 |
| Verify | Web lint/typecheck/auth tests、Release Gate auth test step、temporary stack auth flow | 合格 |
| Improvement | README/security/operations docs と `.env.example` に login/session secret を反映 | 完了 |

## Loop 5 Verification Evidence

| Gate | Command / Evidence | Result |
| --- | --- | --- |
| Web lint/typecheck | `npm run lint && npm run typecheck` | passed |
| Web auth tests | `npm run test:auth` | 3 passed |
| Runtime unauth root | `GET /` on temporary Web port | 307 redirect to login |
| Runtime unauth proxy | `GET /ops-api/health` without cookie | 401 |
| Runtime login | `POST /auth/login` with configured password | 303 + session cookie |
| Runtime auth proxy | `GET /ops-api/health` with session cookie | 200 |
| Runtime proxy | `GET /ops-api/health` on temporary Web port | passed |
| Mutating action | `POST /ops-api/systemd/units/ssh/actions/restart` | 200 via proxy token |
| Negative action | `POST /ops-api/docker/containers/rsp-api/actions/prune` | 403 and audit log recorded |
| Exposure | temporary ports `33101` and `33102` for API/Agent | connection refused |

## Loop 3

| Phase | Evidence | Result |
| --- | --- | --- |
| Monitor | Security review の残タスクとして operational log の機密値露出を確認 | redaction が未実装 |
| Development | API log response に password/token/secret/Authorization/Bearer の redaction を追加し、`LOG_REDACTION_ENABLED` を Compose/env に追加 | 完了 |
| Verify | `pytest` 7件、Web lint/typecheck/audit、Compose config/build | 合格 |
| Improvement | README/security/operations docs を redaction 済みに更新 | 完了 |

## Loop 3 Verification Evidence

| Gate | Command / Evidence | Result |
| --- | --- | --- |
| API/Agent tests | `PYTHONPATH=apps/api:agent/src /tmp/uocc-verify2/bin/python -m pytest apps/api/tests agent/src -q` | 7 passed |
| Python compile | `compileall -q apps/api/uocc_api agent/src/uocc_agent` | passed |
| Web lint/typecheck | `npm run lint && npm run typecheck` | passed |
| Web audit | `npm audit --audit-level=high` | 0 vulnerabilities |
| Compose config/build | `UOCC_OPERATOR_TOKEN=... docker compose config/build` | passed |
