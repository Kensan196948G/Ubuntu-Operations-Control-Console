# Web UI 仕様

## コンセプト

個人用サーバ運用に必要な状態確認と安全な操作を、視覚的に分かりやすく行う管理コンソール。

| 目指す印象 | 避ける印象 |
| --- | --- |
| 状態が一目で分かる | デフォルト HTML 感 |
| ログが読みやすい | 白背景に表だけ |
| 危険操作が分かりやすい | ボタンだらけ |
| 暗すぎない | 余白がない |

## レイアウト

```text
Header
├─ Sidebar navigation
└─ Main content
   ├─ Page title
   ├─ Summary cards
   └─ Tables / Logs / Dialogs
```

## 画面

| 画面 | 主な内容 |
| --- | --- |
| Dashboard | Host/CPU/Memory/Disk/Docker/systemd/Alerts/Recent Operations |
| systemd | Unit 一覧、状態、ログ、start/stop/restart |
| Docker | Container 一覧、状態、ログ、start/stop/restart |
| Compose | Project 一覧、ps、logs、restart |
| Logs | 対象選択、行数、auto refresh、filter、error highlight |
| Operations | 操作履歴 |
| Audit Logs | 監査ログ |
| Settings | API 接続、allowlist 概要、安全境界 |

## UI ルール

| 用途 | 表示 |
| --- | --- |
| 正常 | 緑系 badge |
| 警告 | 黄系 badge |
| 異常 | 赤系 badge |
| 停止 | グレー系 badge |
| 実行中 | 青系 badge |
| 危険操作 | 確認 dialog 必須 |

削除、prune、remove、exec に相当する操作ボタンは作らない。
