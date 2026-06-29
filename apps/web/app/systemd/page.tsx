"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Search, X } from "lucide-react";
import { getSystemdCatalog, getSystemdUnitFile, runAction, saveSystemdUnitFile } from "@/lib/api";
import type { ActionName, SystemdUnit, SystemdUnitFile } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { ActionButton, LogsLink } from "@/components/ui/actions";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

type UnitCategory = "all" | "allowed" | "prohibited";
type SearchField =
  | "all"
  | "displayName"
  | "description"
  | "unitName"
  | "unitId"
  | "categoryLabel"
  | "categoryValue"
  | "loadLabel"
  | "loadValue"
  | "activeLabel"
  | "activeValue"
  | "subLabel"
  | "subValue"
  | "lastChangedLabel"
  | "lastChangedValue"
  | "actions";
type BreakdownGroup = {
  title: string;
  field: SearchField;
  items: BreakdownItem[];
};
type BreakdownItem = {
  label: string;
  query: string;
  count: number;
};
type EditState = {
  unit: SystemdUnit;
  file?: SystemdUnitFile;
  content: string;
  loading: boolean;
  saving: boolean;
  error?: string;
};

const categoryOptions: Array<{ value: UnitCategory; label: string }> = [
  { value: "all", label: "全Unit" },
  { value: "allowed", label: "管理可能Unit" },
  { value: "prohibited", label: "対象外Unit" }
];

const searchFieldOptions: Array<{ value: SearchField; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "displayName", label: "表示名" },
  { value: "description", label: "説明" },
  { value: "unitName", label: "Unit 名" },
  { value: "unitId", label: "Unit ID" },
  { value: "categoryLabel", label: "区分（表示）" },
  { value: "categoryValue", label: "区分（内部値）" },
  { value: "loadLabel", label: "Load（表示）" },
  { value: "loadValue", label: "Load（実値）" },
  { value: "activeLabel", label: "Active（表示）" },
  { value: "activeValue", label: "Active（実値）" },
  { value: "subLabel", label: "Sub（表示）" },
  { value: "subValue", label: "Sub（実値）" },
  { value: "lastChangedLabel", label: "最終変更（表示）" },
  { value: "lastChangedValue", label: "最終変更（原文）" },
  { value: "actions", label: "操作権限" }
];

export default function SystemdPage() {
  const [allUnits, setAllUnits] = useState<SystemdUnit[]>([]);
  const [allowedUnits, setAllowedUnits] = useState<SystemdUnit[]>([]);
  const [prohibitedUnits, setProhibitedUnits] = useState<SystemdUnit[]>([]);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState<string>();
  const [selectedCategory, setSelectedCategory] = useState<UnitCategory>("all");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [query, setQuery] = useState("");

  const load = () =>
    getSystemdCatalog().then((result) => {
      setAllUnits(result.data.allUnits);
      setAllowedUnits(result.data.allowedUnits);
      setProhibitedUnits(result.data.prohibitedUnits);
      setError(result.fromFallback ? result.error : undefined);
    });

  useEffect(() => {
    void load();
  }, []);

  const handleAction = (unit: SystemdUnit, action: ActionName) => {
    const execute = async () => {
      setBusy(`${unit.id}:${action}`);
      const result = await runAction("systemd", unit.id, action);
      setBusy(undefined);
      setConfirm(null);
      setError(result.fromFallback ? `API に接続できず操作できませんでした: ${result.error}` : undefined);
      await load();
    };

    if (action === "stop" || action === "restart" || action === "delete") {
      setConfirm({
        title:
          action === "stop"
            ? "サービスを停止しますか？"
            : action === "delete"
              ? "Unit を削除しますか？"
              : "サービスを再起動しますか？",
        target: unit.unitName,
        detail:
          action === "stop"
            ? "このサービスに依存する処理へ影響する可能性があります。"
            : action === "delete"
              ? "許可リストで削除が明示された /etc/systemd/system 配下の Unit のみ削除できます。削除後は daemon-reload を実行します。"
              : "この操作により、サービスが一時的に中断する可能性があります。",
        confirmLabel: action === "stop" ? "停止" : action === "delete" ? "削除" : "再起動",
        variant: action === "restart" ? "warning" : "danger",
        onConfirm: execute
      });
      return;
    }

    void execute();
  };

  const handleEdit = (unit: SystemdUnit) => {
    setEdit({ unit, content: "", loading: true, saving: false });
    void getSystemdUnitFile(unit.id).then((result) => {
      setEdit({
        unit,
        file: result.data,
        content: result.data.content,
        loading: false,
        saving: false,
        error: result.fromFallback ? result.error : result.data.error
      });
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    setEdit({ ...edit, saving: true, error: undefined });
    const result = await saveSystemdUnitFile(edit.unit.id, edit.content);
    if (result.fromFallback) {
      setEdit({ ...edit, saving: false, error: `保存できませんでした: ${result.error}` });
      return;
    }
    setEdit(null);
    await load();
  };

  const categoryUnits = useMemo(
    () => selectCategoryUnits(selectedCategory, allUnits, allowedUnits, prohibitedUnits),
    [allUnits, allowedUnits, prohibitedUnits, selectedCategory]
  );
  const targetUnits = useMemo(
    () => filterUnitsBySelectedField(categoryUnits, searchField),
    [categoryUnits, searchField]
  );
  const selectedUnits = useMemo(
    () => filterUnits(targetUnits, query, searchField),
    [targetUnits, query, searchField]
  );
  const breakdownGroups = useMemo(
    () => buildBreakdownGroups(categoryUnits, searchField),
    [categoryUnits, searchField]
  );
  const searching = query.trim().length > 0;
  const selectedTitle = categoryOptions.find((option) => option.value === selectedCategory)?.label ?? "全Unit";
  const selectedSearchTarget = selectedSearchFieldLabel(searchField);
  const finalResultTitle = `検索結果: ${selectedTitle}`;

  return (
    <>
      <PageTitle title="systemd" description="実ホストの Unit を全件取得し、Unit ファイルの編集と削除を実行できます。" />
      <ErrorBanner message={error} />
      <Panel title="検索" className="mb-5">
        <div className="grid gap-3 md:grid-cols-[180px_220px_minmax(240px,1fr)_auto] md:items-end">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-normal text-console-muted">大項目検索（カテゴリ）</span>
            <select
              className="mt-1 h-10 w-full rounded-md border border-console-line bg-white px-3 text-sm text-console-ink"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as UnitCategory)}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-normal text-console-muted">中項目検索（選択対象）</span>
            <select
              className="mt-1 h-10 w-full rounded-md border border-console-line bg-white px-3 text-sm text-console-ink"
              value={searchField}
              onChange={(event) => setSearchField(event.target.value as SearchField)}
            >
              {searchFieldOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 flex-1">
            <span className="text-xs font-semibold uppercase tracking-normal text-console-muted">小項目検索（キーワード）</span>
            <span className="mt-1 flex h-10 items-center gap-2 rounded-md border border-console-line bg-white px-3">
              <Search className="h-4 w-4 shrink-0 text-console-muted" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-console-ink outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`${selectedSearchFieldLabel(searchField)}で検索`}
              />
            </span>
          </label>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-console-line bg-white px-3 text-sm font-medium text-console-ink hover:bg-console-bg disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setQuery("")}
            disabled={!searching}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            クリア
          </button>
        </div>
      </Panel>
      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <SearchStageCard label="大項目検索結果" detail={selectedTitle} value={categoryUnits.length} total={allUnits.length} />
        <SearchStageCard label="中項目検索結果" detail={selectedSearchTarget} value={targetUnits.length} total={categoryUnits.length} />
        <SearchStageCard
          label="小項目検索結果"
          detail={searching ? query : "未入力"}
          value={selectedUnits.length}
          total={targetUnits.length}
        />
      </section>
      <Panel
        title="中項目分類結果"
        action={<span className="text-sm font-medium text-console-muted">分類を選ぶと小項目検索へ反映</span>}
        className="mb-5"
      >
        <BreakdownGroups
          groups={breakdownGroups}
          onSelect={(field, queryValue) => {
            setSearchField(field);
            setQuery(queryValue);
          }}
        />
      </Panel>

      <Panel
        title={finalResultTitle}
        action={<span className="text-sm font-medium text-console-muted">{selectedUnits.length} 件</span>}
      >
        <SystemdTable units={selectedUnits} busy={busy} onAction={handleAction} onEdit={handleEdit} />
      </Panel>
      <ConfirmDialog state={confirm} busy={Boolean(busy)} onClose={() => setConfirm(null)} />
      <UnitEditDialog
        state={edit}
        onChange={(content) => setEdit((current) => current ? { ...current, content } : current)}
        onSave={saveEdit}
        onClose={() => setEdit(null)}
      />
    </>
  );
}

function BreakdownGroups({
  groups,
  onSelect
}: {
  groups: BreakdownGroup[];
  onSelect: (field: SearchField, queryValue: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-console-line bg-console-bg px-5 py-6">
        <p className="font-medium text-console-ink">この選択対象は分類表示なし</p>
        <p className="mt-1 text-sm text-console-muted">キーワード検索で対象項目の内容を直接検索します。</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.title} className="rounded-md border border-console-line bg-console-bg p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-console-ink">{group.title}</h3>
            <span className="text-xs text-console-muted">{group.items.length} 分類</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <button
                key={`${group.title}:${item.query}`}
                className="inline-flex items-center gap-2 rounded-md border border-console-line bg-white px-3 py-2 text-left text-sm text-console-ink hover:bg-[#fff7ed]"
                type="button"
                onClick={() => onSelect(group.field, item.query)}
              >
                <span className="font-medium">{item.label}</span>
                <span className="rounded bg-console-bg px-2 py-0.5 text-xs font-semibold text-console-muted">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchStageCard({ label, detail, value, total }: { label: string; detail: string; value: number; total: number }) {
  return (
    <div className="rounded-lg border border-console-line bg-white px-5 py-4 shadow-panel">
      <p className="text-xs font-semibold text-console-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-console-ink">{detail}</p>
      <p className="mt-2 text-2xl font-semibold text-console-ink">{value}</p>
      <p className="mt-1 text-xs text-console-muted">全 {total} 件中</p>
    </div>
  );
}

function SystemdTable({
  units,
  busy,
  onAction,
  onEdit
}: {
  units: SystemdUnit[];
  busy?: string;
  onAction: (unit: SystemdUnit, action: ActionName) => void;
  onEdit: (unit: SystemdUnit) => void;
}) {
  const headers = ["表示名", "Unit 名", "区分", "Load", "Active", "Sub", "Unit file", "最終変更", "操作"];

  return (
    <DataTable
      headers={headers}
      emptyTitle="systemd unit はありません"
      rows={units.map((unit) => {
        const common = [
          <div key="name" className="max-w-[360px] whitespace-normal break-words">
            <p className="font-medium">{unit.displayName}</p>
            {unit.description ? <p className="mt-1 text-xs text-console-muted">{unit.description}</p> : null}
          </div>,
          <span key="unit" className="block max-w-[300px] whitespace-normal break-all font-mono text-xs">{unit.unitName}</span>,
          <StatusBadge
            key="category"
            value={unit.allowed ? "success" : "inactive"}
            label={unit.allowed ? "管理可能" : "対象外"}
            className="whitespace-nowrap"
          />,
          <StatusBadge key="load" value={unit.loadState ?? unit.status} />,
          <StatusBadge key="active" value={unit.activeState} className="whitespace-nowrap" />,
          unit.subState,
          <span key="fragment" className="block max-w-[260px] whitespace-normal break-all font-mono text-xs">
            {unit.fragmentPath ?? unit.unitFileState ?? "-"}
          </span>,
          formatDateTime(unit.lastChanged)
        ];

        return [
          ...common,
          <div key="actions" className="flex flex-wrap justify-end gap-2">
            <LogsLink type="systemd" id={unit.id} />
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-console-line bg-white px-3 text-sm font-medium text-console-ink hover:bg-console-bg disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onEdit(unit)}
              disabled={!unit.editable}
              title="編集"
              type="button"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">編集</span>
            </button>
            {controlActions().map((action) => (
              <ActionButton
                key={action}
                action={action}
                onClick={() => onAction(unit, action)}
                disabled={busy === `${unit.id}:${action}`}
              />
            ))}
          </div>
        ];
      })}
    />
  );
}

function controlActions(): ActionName[] {
  return ["start", "stop", "restart", "delete"];
}

function UnitEditDialog({
  state,
  onChange,
  onSave,
  onClose
}: {
  state: EditState | null;
  onChange: (content: string) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  if (!state) return null;
  const disabled = state.loading || state.saving || state.file?.editable === false;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/75 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-console-line bg-white shadow-2xl">
        <div className="border-b border-console-line p-5">
          <h2 className="text-lg font-semibold text-console-ink">Unit ファイル編集</h2>
          <p className="mt-1 break-all font-mono text-xs text-console-muted">
            {state.file?.fragmentPath ?? state.unit.fragmentPath ?? state.unit.unitName}
          </p>
          {state.error ? <p className="mt-2 text-sm font-medium text-red-700">{state.error}</p> : null}
        </div>
        <div className="min-h-0 flex-1 p-5">
          {state.loading ? (
            <div className="rounded-md border border-console-line bg-console-bg px-4 py-8 text-center text-sm text-console-muted">
              読み込み中...
            </div>
          ) : (
            <textarea
              className="h-[56vh] w-full resize-none rounded-md border border-console-line bg-[#0f172a] p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-amber-400"
              value={state.content}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
              disabled={state.file?.editable === false}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-console-line px-5 py-4">
          <button
            className="rounded-md border border-console-line bg-white px-4 py-2 text-sm font-medium text-console-ink hover:bg-console-bg"
            onClick={onClose}
            disabled={state.saving}
            type="button"
          >
            キャンセル
          </button>
          <button
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onSave}
            disabled={disabled}
            type="button"
          >
            {state.saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function selectCategoryUnits(
  category: UnitCategory,
  allUnits: SystemdUnit[],
  allowedUnits: SystemdUnit[],
  prohibitedUnits: SystemdUnit[]
) {
  if (category === "allowed") return allowedUnits;
  if (category === "prohibited") return prohibitedUnits;
  return allUnits;
}

function filterUnitsBySelectedField(units: SystemdUnit[], field: SearchField) {
  if (field === "all") return units;
  return units.filter((unit) => fieldValues(unit, field).some((value) => normalizeSearchText(String(value ?? "")).length > 0));
}

function buildBreakdownGroups(units: SystemdUnit[], field: SearchField): BreakdownGroup[] {
  if (field === "all") {
    return [
      categoryBreakdown(units, "区分", "categoryLabel"),
      statusBreakdown(units, "Load", "loadValue", (unit) => unit.loadState ?? unit.status),
      statusBreakdown(units, "Active", "activeValue", (unit) => unit.activeState),
      statusBreakdown(units, "Sub", "subValue", (unit) => unit.subState)
    ];
  }

  if (field === "categoryLabel" || field === "categoryValue") return [categoryBreakdown(units, "区分", field)];
  if (field === "loadLabel" || field === "loadValue") {
    return [statusBreakdown(units, "Load", field, (unit) => unit.loadState ?? unit.status)];
  }
  if (field === "activeLabel" || field === "activeValue") {
    return [statusBreakdown(units, "Active", field, (unit) => unit.activeState)];
  }
  if (field === "subLabel" || field === "subValue") {
    return [statusBreakdown(units, "Sub", field, (unit) => unit.subState)];
  }
  if (field === "actions") return [actionsBreakdown(units)];

  return [];
}

function categoryBreakdown(units: SystemdUnit[], title: string, field: SearchField): BreakdownGroup {
  const allowed = units.filter((unit) => unit.allowed).length;
  const prohibited = units.length - allowed;
  return {
    title,
    field,
    items: [
      {
        label: "管理可能",
        query: field === "categoryValue" ? "allowed" : "管理可能",
        count: allowed
      },
      {
        label: "対象外",
        query: field === "categoryValue" ? "prohibited" : "対象外",
        count: prohibited
      }
    ].filter((item) => item.count > 0)
  };
}

function statusBreakdown(
  units: SystemdUnit[],
  title: string,
  field: SearchField,
  pickValue: (unit: SystemdUnit) => string | undefined
): BreakdownGroup {
  const counts = new Map<string, number>();
  for (const unit of units) {
    const value = rawStatus(pickValue(unit)) ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return {
    title,
    field,
    items: Array.from(counts.entries())
      .map(([value, count]) => ({
        label: statusBreakdownLabel(value),
        query: field.endsWith("Label") ? statusLabel(value) ?? value : value,
        count
      }))
      .sort(compareBreakdownItems)
  };
}

function actionsBreakdown(units: SystemdUnit[]): BreakdownGroup {
  const counts = new Map<string, number>();
  for (const unit of units) {
    const actions = unit.actions?.length ? unit.actions : ["操作権限なし"];
    for (const action of actions) counts.set(action, (counts.get(action) ?? 0) + 1);
  }

  return {
    title: "操作権限",
    field: "actions",
    items: Array.from(counts.entries())
      .map(([value, count]) => ({ label: actionLabel(value), query: value, count }))
      .sort(compareBreakdownItems)
  };
}

function compareBreakdownItems(left: BreakdownItem, right: BreakdownItem) {
  if (right.count !== left.count) return right.count - left.count;
  return left.label.localeCompare(right.label, "ja");
}

function filterUnits(units: SystemdUnit[], query: string, field: SearchField) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return units;

  return units.filter((unit) => fieldValues(unit, field).some((value) => searchCandidates(value).some((candidate) => candidate.includes(normalized))));
}

function fieldValues(unit: SystemdUnit, field: SearchField) {
  const categoryLabel = unit.allowed ? "管理可能" : "対象外";
  const categoryValue = unit.allowed ? "allowed" : "prohibited";
  const values: Record<Exclude<SearchField, "all">, Array<string | undefined>> = {
    displayName: [unit.displayName],
    description: [unit.description],
    unitName: [unit.unitName],
    unitId: [unit.id],
    categoryLabel: [categoryLabel],
    categoryValue: [categoryValue, unit.controlCategory],
    loadLabel: [statusLabel(unit.loadState ?? unit.status), unit.loadState ?? unit.status],
    loadValue: [rawStatus(unit.loadState), rawStatus(unit.status)],
    activeLabel: [statusLabel(unit.activeState), unit.activeState],
    activeValue: [rawStatus(unit.activeState)],
    subLabel: [statusLabel(unit.subState), unit.subState],
    subValue: [rawStatus(unit.subState)],
    lastChangedLabel: [formatDateTime(unit.lastChanged)],
    lastChangedValue: [unit.lastChanged],
    actions: unit.actions ?? []
  };

  if (field !== "all") return values[field];
  return Object.values(values).flat();
}

function rawStatus(value?: string) {
  return value ? String(value).trim() : undefined;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function searchCandidates(value?: string) {
  if (!value) return [];
  const normalized = normalizeSearchText(String(value));
  return [
    normalized,
    normalized.replaceAll("_", "-"),
    normalized.replaceAll("-", "_"),
    normalized.replaceAll("-", ""),
    normalized.replaceAll("_", "")
  ];
}

function selectedSearchFieldLabel(field: SearchField) {
  return searchFieldOptions.find((option) => option.value === field)?.label ?? "すべて";
}

function statusBreakdownLabel(value: string) {
  const label = statusLabel(value);
  return label && label !== value ? `${label} (${value})` : value;
}

function actionLabel(value: string) {
  const labels: Record<string, string> = {
    stop: "停止",
    restart: "再起動",
    delete: "削除"
  };
  return labels[value] ?? value;
}

function statusLabel(value?: string) {
  const normalized = normalizeSearchText(value ?? "");
  const labels: Record<string, string> = {
    active: "稼働中",
    running: "実行中",
    success: "成功",
    healthy: "正常",
    warning: "警告",
    inactive: "停止中",
    exited: "終了",
    stopped: "停止中",
    failed: "失敗",
    error: "エラー",
    unhealthy: "異常",
    critical: "重大",
    restarting: "再起動中",
    "exit-code": "異常終了",
    created: "作成済み",
    pending: "処理待ち",
    unknown: "不明"
  };
  return labels[normalized] ?? value;
}
