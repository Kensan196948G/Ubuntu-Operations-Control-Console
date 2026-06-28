# セキュリティ方針

## 前提

このシステムは個人利用の localhost/LAN 向け MVP であり、インターネット直接公開や複数ユーザー権限管理は対象外。

## 必須制御

| 制御 | 方針 |
| --- | --- |
| Allowlist | 設定済み対象と action のみ許可 |
| 任意コマンド | 実装しない |
| 削除系操作 | 実装しない |
| Root 実行 | Web/API は root で動かさない |
| Docker socket | API から直接広範に触らず、Agent に集約 |
| 監査 | 操作結果、IP、User-Agent を記録 |
| ログ行数 | 最大 1000 行に制限 |

## Threat Model

| 脅威 | 対策 |
| --- | --- |
| 未許可対象の操作 | ID と action を allowlist で検証 |
| 任意 shell 実行 | shell 文字列を API 入力から組み立てない |
| 破壊的 Docker 操作 | remove/prune/down -v/exec API を持たない |
| 誤操作 | stop/restart は UI で確認必須 |
| 証跡不足 | operation history と audit logs を永続化 |

## Review Checklist

| チェック | 状態 |
| --- | --- |
| 削除系 endpoint がない | ✅ 実装なし、Web UI にも操作なし |
| 任意 command endpoint がない | ✅ 実装なし |
| allowlist 外 action が拒否される | ✅ `prune` が 403 |
| 拒否操作が監査される | ✅ audit log に failed として記録 |
| ログ行数が 1000 を超えない | ✅ API test で 1001 行を 400 |
| Docker Compose が localhost bind | ✅ `127.0.0.1` bind を `docker compose config` で確認 |

## Residual Risk

| リスク | 対応方針 |
| --- | --- |
| MVP ではログイン認証なし | localhost/LAN 限定を維持し、外部公開前に認証を追加 |
| Agent local backend はホスト権限に依存 | systemd unit、Docker socket、Compose path を allowlist で限定 |
| Docker socket exposure | compose ではコメントアウト、必要時だけ明示的に有効化 |
