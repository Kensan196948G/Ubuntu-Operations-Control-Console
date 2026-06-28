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
| Agent local backend | endpoint 前段だけでなく backend 内でも action/target/suffix を検証 |
| API/Agent公開 | Docker Compose では host port を公開しない |
| Web認証 | Web UI と `/ops-api` proxy は login session cookie を必須化 |
| Operator token | Web proxy が server-side token を注入し、API は mutating action で検証 |
| Origin check | API は mutating action の `Origin` を allowlist 検証 |
| 監査 | 操作結果、IP、User-Agent を記録 |
| ログ行数 | 最大 1000 行に制限 |
| ログ秘匿 | API レスポンスで一般的な secret/token/header を `[REDACTED]` に置換 |

## Threat Model

| 脅威 | 対策 |
| --- | --- |
| 未許可対象の操作 | ID と action を allowlist で検証 |
| Agent endpoint 直叩き | Agent 側でも allowlist から target を復元し caller-supplied target details を信用しない |
| 任意 shell 実行 | shell 文字列を API 入力から組み立てない |
| Backend 直呼び/将来変更 | local backend 内で systemd/Docker/Compose action と対象名を固定検証 |
| 未認証の UI/API proxy access | middleware と proxy route の両方で session cookie を検証 |
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
| ログ内の secret/token が秘匿される | ✅ API test で password/token/Authorization Bearer を確認 |
| Docker Compose が localhost bind | ✅ `127.0.0.1` bind を `docker compose config` で確認 |
| API/Agent が host 非公開 | ✅ 一時 stack で未公開ポート接続拒否を確認 |
| Agent allowlist bypass 防止 | ✅ spoofed target name を Agent 自身の allowlist 値へ復元 |
| Agent local backend direct-call 防御 | ✅ disable/bad container/down -v を unit test で拒否確認 |
| Compose path escape 防止 | ✅ `Path.is_relative_to()` で検証 |
| Mutating action token | ✅ token なし 401、bad Origin 403 |
| Web auth session | ✅ Node auth tests で署名、期限切れ、改ざん、redirect sanitization を確認 |

## Residual Risk

| リスク | 対応方針 |
| --- | --- |
| 単一 operator password 方式 | 複数ユーザー・権限分離が必要な場合は IdP/reverse proxy auth を追加 |
| Agent local backend はホスト権限に依存 | systemd unit、Docker socket、Compose path、backend 内 action を allowlist/固定ルールで限定 |
| Docker socket exposure | compose ではコメントアウト、必要時だけ明示的に有効化 |
| ログは未知形式の機密情報を含み得る | 既知パターンは redaction 済み。認証・非公開API・最小権限を継続 |
