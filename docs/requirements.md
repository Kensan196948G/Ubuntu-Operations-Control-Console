# Ubuntu Ops Control Console 要件定義

## 目的

個人利用の Ubuntu サーバ上で稼働する systemd サービス、Docker コンテナ、Docker Compose プロジェクトを、Web UI から安全かつ見やすく制御・監視できる運用管理システムを構築する。

## 利用者

| 利用者 | 想定 |
| --- | --- |
| Ubuntu サーバ管理者 | 自宅サーバ、検証サーバを管理する個人 |
| Docker 利用者 | 複数コンテナや Compose プロジェクトを運用する個人 |

## 認証方針

MVP ではログイン認証は実装しない。代わりに以下を必須制約とする。

| 制約 | 内容 |
| --- | --- |
| 公開範囲 | インターネットへ直接公開しない |
| 初期 bind | localhost または LAN 内のみ |
| 操作対象 | allowlist 登録済み対象のみ |
| 操作内容 | 危険操作は禁止 |
| 監査 | すべての操作を監査ログへ記録 |

## 機能要件

| 領域 | 要件 |
| --- | --- |
| Dashboard | ホスト名、OS、uptime、CPU、メモリ、ディスク、Docker/systemd 概要、異常表示 |
| systemd | allowlist unit の一覧、状態、start/stop/restart、journal ログ |
| Docker | allowlist container の一覧、状態、start/stop/restart、docker logs |
| Compose | 登録済み project の一覧、ps、logs、restart |
| Logs | 対象選択、行数選択、自動更新、キーワードフィルタ、エラー強調 |
| Operations | 実行日時、対象、操作、結果、実行時間、エラー |
| Audit Logs | 操作日時、種別、対象、IP、User-Agent、結果、エラー |

## MVP 完了条件

| 条件 | 判定 |
| --- | --- |
| Docker Compose で Web/API/DB を起動できる | ✅ 一時 stack `uocc_verify` で確認 |
| Web UI からダッシュボードを表示できる | ✅ `GET /` HTML と API dashboard を確認 |
| systemd unit の状態を表示できる | ✅ demo agent 経由で allowlist unit を確認 |
| Docker container の状態を表示できる | ✅ demo agent 経由で allowlist container を確認 |
| Docker logs を表示できる | ✅ bounded logs API を確認 |
| allowlist 登録済み対象だけ restart できる | ✅ API contract test で確認 |
| 操作履歴を確認できる | ✅ API contract test で確認 |
| 監査ログを確認できる | ✅ 成功/拒否監査を確認 |
| 削除系操作が実装されていない | ✅ endpoint/UI とも未実装 |
| 任意コマンド実行ができない | ✅ endpoint 未実装、Agent は固定引数のみ |
| CI で主要ゲートを検証できる | ✅ Release Gate workflow を追加 |
| API/Agent が直接公開されない | ✅ Compose で internal expose のみ |
