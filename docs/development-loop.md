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
| 2026-06-28 | 認証は未実装、localhost/LAN 前提を維持 | 要件定義のMVP範囲に一致 |
| 2026-06-28 | 削除系・任意コマンド API は作らない | セキュリティ要件を満たすため |
| 2026-06-28 | Docker Node 22 build をリリース検証の正とする | ホスト Node 25 では Next/SWC Wasm memory error が発生するため |
