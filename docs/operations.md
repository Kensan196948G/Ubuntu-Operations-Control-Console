# 運用手順

## 起動

```bash
cp .env.example .env
editor .env  # UOCC_OPERATOR_TOKEN をランダムな長い値へ変更
docker compose up --build
```

## 停止

```bash
docker compose down
```

## 復旧

| 障害 | 復旧手順 |
| --- | --- |
| Web UI 停止 | `docker compose restart web` |
| API 停止 | `docker compose restart api` |
| DB 停止 | `docker compose restart db` |
| Agent 停止 | `sudo systemctl restart uocc-agent` |
| Console 全体停止 | SSH でログインし `docker compose up -d` |

## ログ確認

```bash
docker compose logs -f web
docker compose logs -f api
docker compose logs -f db
```

API の target log レスポンスは `LOG_REDACTION_ENABLED=true` が既定です。`password`、`token`、`secret`、`Authorization`、`Bearer` 形式の値は `[REDACTED]` に置換されます。

## バックアップ対象

| 対象 | 理由 |
| --- | --- |
| `.env` | 接続設定 |
| `config/*.yaml` | allowlist とアプリ設定 |
| DB volume | 操作履歴と監査ログ |

## リリース前確認

```bash
docker compose config
docker compose build
docker compose up -d
```

## 検証済み一時起動

既存ポートを避けて検証する場合:

```bash
UOCC_OPERATOR_TOKEN=verify-token UOCC_WEB_PORT=33100 docker compose -p uocc_verify up -d
curl http://127.0.0.1:33100/ops-api/health
docker compose -p uocc_verify down -v
```

ローカル Node.js v25 では Next/SWC の Wasm memory error が発生する場合があるため、リリースビルド確認は Docker の Node 22 環境で行う。

API と Agent は host port に公開しない。直接確認が必要な場合は `docker compose exec api ...` または Web proxy `/ops-api` を使う。
