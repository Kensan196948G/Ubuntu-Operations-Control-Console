WebUI専用仕様書案

```md
# Ubuntu Ops Control Console WebUI仕様書

## 1. UIコンセプト

本システムのWebUIは、個人用サーバ運用に必要な状態確認と安全な操作を、視覚的に分かりやすく行うための管理コンソールとする。

目指す印象:

- 暗すぎない
- 業務システム感を出しすぎない
- 情報が詰まりすぎていない
- 状態が一目で分かる
- 危険操作が分かりやすい
- ログが読みやすい

避ける印象:

- デフォルトHTML感
- Bootstrapを置いただけの画面
- 白背景に表だけ
- ボタンだらけ
- 重要度が分からない
- 余白がない
- 文字サイズが小さすぎる

## 2. 画面レイアウト

### 2.1 基本構成

```text
┌──────────────────────────────────────┐
│ Header                               │
├───────────────┬──────────────────────┤
│ Sidebar       │ Main Content          │
│               │                      │
│ Navigation    │ Page Title            │
│               │ Summary Cards         │
│               │ Tables / Logs         │
│               │                      │
└───────────────┴──────────────────────┘
````

### 2.2 Header

表示項目:

* システム名
* ホスト名
* 接続状態
* 最終更新時刻

例:

```text
Ubuntu Ops Control Console    Host: ubuntu-home    Agent: Online    Updated: 21:35:10
```

### 2.3 Sidebar

メニュー:

* Dashboard
* systemd
* Docker
* Compose
* Logs
* Operations
* Audit Logs
* Settings

## 3. デザイン方針

### 3.1 カラールール

| 用途   | 表示         |
| ---- | ---------- |
| 正常   | 緑系バッジ      |
| 警告   | 黄系バッジ      |
| 異常   | 赤系バッジ      |
| 停止   | グレー系バッジ    |
| 実行中  | 青系バッジ      |
| 危険操作 | 赤系ボタン      |
| 通常操作 | 落ち着いた色のボタン |

### 3.2 角丸・余白

* カードは角丸を使う
* カード間に十分な余白を入れる
* 表は詰め込みすぎない
* ログ画面は等幅フォントを使う

### 3.3 フォント

* 通常テキスト: system-ui
* ログ表示: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas

## 4. 画面仕様

## 4.1 Dashboard

目的:

ホストと主要サービスの状態を一目で確認する。

表示内容:

* Host Status Card
* CPU Usage Card
* Memory Usage Card
* Disk Usage Card
* Docker Summary Card
* systemd Summary Card
* Recent Operations
* Alerts

### Dashboardカード例

```text
┌──────────────┐
│ CPU Usage    │
│ 23%          │
│ Normal       │
└──────────────┘
```

### Alerts表示

異常がある場合だけ表示する。

例:

```text
Warning
- docker.service is inactive
- rsp-api container exited
```

## 4.2 systemd画面

目的:

許可済みsystemd unitの状態確認と限定操作を行う。

表示項目:

* Display Name
* Unit Name
* Status
* Active State
* Sub State
* Last Changed
* Actions

操作:

* View Logs
* Start
* Stop
* Restart

表示ルール:

* running / active は緑
* inactive はグレー
* failed は赤
* restart は確認必須
* stop は確認必須

## 4.3 Docker画面

目的:

Dockerコンテナの状態確認と限定操作を行う。

表示項目:

* Container Name
* Image
* Status
* Uptime
* Ports
* CPU
* Memory
* Actions

操作:

* View Logs
* Start
* Stop
* Restart

表示ルール:

* running は緑
* exited はグレー
* restarting は青
* unhealthy は赤
* stop / restart は確認必須

## 4.4 Compose画面

目的:

登録済みDocker Composeプロジェクトの状態確認を行う。

表示項目:

* Project Name
* Path
* Compose File
* Services
* Running
* Stopped
* Actions

操作:

* ps
* logs
* restart

MVPでは以下を表示しない。

* down
* down -v
* remove volumes
* prune

## 4.5 Logs画面

目的:

systemd / Docker / Compose のログを読みやすく表示する。

機能:

* 対象選択
* 表示行数選択
* 自動更新ON/OFF
* キーワードフィルタ
* エラー行ハイライト

ログ表示:

```text
[2026-06-28 21:35:10] INFO  service started
[2026-06-28 21:35:12] WARN  retrying connection
[2026-06-28 21:35:15] ERROR failed to connect database
```

## 4.6 Operations画面

目的:

操作履歴を確認する。

表示項目:

* Started At
* Target Type
* Target Name
* Action
* Status
* Duration
* Error

ステータス表示:

* success: 緑
* failed: 赤
* running: 青

## 4.7 Audit Logs画面

目的:

認証なし構成でも、いつ・どこから・何をしたか確認できるようにする。

表示項目:

* Created At
* IP Address
* Event Type
* Target
* Action
* Result
* User-Agent

## 5. 確認ダイアログ仕様

### restart確認

```text
Restart container?

Target:
rsp-api

This operation may temporarily interrupt the service.

[Cancel] [Restart]
```

### stop確認

```text
Stop service?

Target:
docker.service

This may affect running containers.

[Cancel] [Stop]
```

### 危険操作のルール

* stop は赤系ボタン
* restart は通常より目立つが赤すぎない
* delete / prune / remove はボタン自体を作らない

## 6. UIコンポーネント

共通コンポーネント:

* AppShell
* Header
* Sidebar
* PageTitle
* StatusBadge
* MetricCard
* DataTable
* ActionButton
* ConfirmDialog
* LogViewer
* EmptyState
* ErrorBanner
* LoadingSkeleton

## 7. レスポンシブ対応

個人用のためPCブラウザ優先。

対応優先度:

1. Desktop
2. Tablet
3. Mobile

Mobileでは操作ボタンを最小化し、状態確認を中心にする。

## 8. Codex向けUI実装指示

* Tailwind CSSを使用する
* shadcn/ui風のカード・ボタン・テーブル構成にする
* 余白を十分に取る
* 表だけの画面にしない
* Dashboardにはカードを使う
* ログビューアは黒背景または濃色背景の等幅フォントにする
* 状態はバッジで表示する
* 操作ボタンは右端にまとめる
* 危険操作は確認ダイアログを必須にする
* 削除系操作ボタンは実装しない

````
