import { useMemo, useState } from 'react';
import {
  MODS_DATABASE,
  MOD_PRESETS,
  type ModItem,
} from '../data/modsData.ts';
import {
  analyzeSelection,
  formatModNamesListText,
  getCheckerTier,
  getModRestrictionBadge,
  getModUpdatedLabel,
  getRecipeBridgeStatus,
  organizeAssemblyTree,
  shouldHideMod,
  smartFixAssembly,
  type CheckerTier,
} from '../utils/modLogic.ts';
import {
  ExternalLink,
  FolderOpen,
  Search,
  Plus,
  X,
  Copy,
  Check,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  Wand2,
} from 'lucide-react';
import { matchJarFilenamesToMods } from '../utils/jarMatcher.ts';

interface CheckerTabProps {
  checkedModIds: string[];
  setCheckedModIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  onOpenDetail: (mod: ModItem) => void;
}

export function CheckerTab({ checkedModIds, setCheckedModIds, onOpenDetail }: CheckerTabProps) {
  const [tierFilter, setTierFilter] = useState<'all' | CheckerTier>('all');
  const [viewMode, setViewMode] = useState<'tree' | 'status'>('tree');
  const [addSearch, setAddSearch] = useState('');
  const [hideIncompatibleSuggestions, setHideIncompatibleSuggestions] = useState(true);
  const [copiedList, setCopiedList] = useState(false);

  const checkedSet = useMemo(() => new Set(checkedModIds), [checkedModIds]);
  const analysis = useMemo(() => analyzeSelection(checkedModIds), [checkedModIds]);

  const warningMap = useMemo(() => {
    const map = new Map<string, { severity: 'red' | 'yellow'; messages: string[] }>();
    for (const w of analysis.warnings) {
      const prev = map.get(w.modId);
      const sev = prev?.severity === 'red' || w.severity === 'red' ? 'red' : 'yellow';
      const msgs = prev ? [...prev.messages, w.message] : [w.message];
      map.set(w.modId, { severity: sev, messages: msgs });
    }
    return map;
  }, [analysis.warnings]);

  const rows = useMemo(() => {
    return analysis.selectedMods
      .map(mod => {
        const w = warningMap.get(mod.id);
        const checker = getCheckerTier(mod, analysis.conflictingIdSet, w?.severity);
        const bridge = getRecipeBridgeStatus(mod, checkedSet);
        return {
          mod,
          tier: checker.tier,
          label: checker.label,
          reason: w?.messages[0] || checker.reason,
          viaBridge: bridge.compatible ? bridge.viaBridge : undefined,
        };
      })
      .sort((a, b) => {
        const order: Record<CheckerTier, number> = { red: 0, yellow: 1, lime: 2, green: 3 };
        return order[a.tier] - order[b.tier] || a.mod.name.localeCompare(b.mod.name, 'ru');
      });
  }, [analysis.selectedMods, analysis.conflictingIdSet, warningMap, checkedSet]);

  const counts = useMemo(() => {
    let green = 0;
    let lime = 0;
    let yellow = 0;
    let red = 0;
    for (const r of rows) {
      if (r.tier === 'green') green++;
      else if (r.tier === 'lime') lime++;
      else if (r.tier === 'yellow') yellow++;
      else red++;
    }
    return { green, lime, yellow, red, total: rows.length };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (tierFilter === 'all') return rows;
    return rows.filter(r => r.tier === tierFilter);
  }, [rows, tierFilter]);

  const addSuggestions = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    if (!q) return [];
    return MODS_DATABASE.filter(m => {
      if (checkedSet.has(m.id)) return false;
      const matches =
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.bestAlternative && m.bestAlternative.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(q)));
      if (!matches) return false;
      if (
        hideIncompatibleSuggestions &&
        shouldHideMod(m, checkedSet, undefined, { hideIncompatible: true, hideUselessCovered: true })
      ) {
        return false;
      }
      return true;
    }).slice(0, 8);
  }, [addSearch, checkedSet, hideIncompatibleSuggestions]);

  const rowByModId = useMemo(() => new Map(rows.map(r => [r.mod.id, r])), [rows]);

  const hierarchicalRows = useMemo(() => {
    const filteredIds = filteredRows.map(r => r.mod.id);
    const tree = organizeAssemblyTree(filteredIds);
    const out: Array<{
      row: (typeof rows)[number];
      isChild: boolean;
      relationLabel?: string;
      rootIndex?: number;
      childCount?: number;
    }> = [];
    tree.forEach((node, idx) => {
      const parentRow = rowByModId.get(node.parent.id);
      if (parentRow) {
        out.push({
          row: parentRow,
          isChild: false,
          rootIndex: idx + 1,
          childCount: node.children.length,
        });
      }
      for (const ch of node.children) {
        const childRow = rowByModId.get(ch.mod.id);
        if (childRow) {
          out.push({
            row: childRow,
            isChild: true,
            relationLabel: ch.relationLabel,
          });
        }
      }
    });
    return out;
  }, [filteredRows, rowByModId]);

  const displayRows = useMemo(() => {
    if (viewMode === 'tree') return hierarchicalRows;
    return filteredRows.map(row => ({
      row,
      isChild: false,
      relationLabel: undefined as string | undefined,
      rootIndex: undefined as number | undefined,
      childCount: undefined as number | undefined,
    }));
  }, [viewMode, hierarchicalRows, filteredRows]);

  const handleCopyPlainNamesList = () => {
    const text = formatModNamesListText(checkedModIds);
    navigator.clipboard.writeText(text);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 1800);
  };

  const handleScanDesktopFolder = async () => {
    if (!window.desktopAPI?.scanModsFolder) return;
    const res = await window.desktopAPI.scanModsFolder();
    if (res.canceled) return;
    const { matchedIds } = matchJarFilenamesToMods(res.jarFiles);
    if (matchedIds.length > 0) {
      setCheckedModIds(matchedIds);
    }
  };

  const redWarnings = analysis.warnings.filter(w => w.severity === 'red');
  const yellowWarnings = analysis.warnings.filter(w => w.severity === 'yellow');
  const hasAnyIssues = analysis.conflicts.length > 0 || analysis.warnings.length > 0;

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--ink-1)] tracking-tight">Чекер сборки</h2>
            <p className="text-xs text-[var(--ink-2)] mt-0.5">
              Зелёный — стабильно · Жёлтый — нюансы / условно · Красный — конфликт или плацебо.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {window.desktopAPI?.isDesktop && (
              <button
                onClick={handleScanDesktopFolder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--hl-blue-bg)] hover:bg-[var(--surface-hover)] border border-[var(--hl-blue-border)] text-[var(--hl-blue-text)] transition-colors whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Папка mods
              </button>
            )}
            {hasAnyIssues && (
              <button
                onClick={() => setCheckedModIds(smartFixAssembly(checkedModIds))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white transition-colors whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Исправить конфликты
              </button>
            )}
            <button
              onClick={handleCopyPlainNamesList}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {copiedList ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedList ? 'Список скопирован' : 'Скопировать списком'}
            </button>
            <button
              onClick={() => setCheckedModIds([])}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--surface-sub)] hover:bg-[var(--hl-red-bg)] border border-[var(--border-line)] hover:border-[var(--hl-red-border)] text-[var(--ink-1)] hover:text-[var(--hl-red-text)] disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Очистить
            </button>
          </div>
        </div>

        {/* Preset quick-load buttons (only the 2 main builds) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-[var(--ink-2)] mr-1">Основные сборки:</span>
          {MOD_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => setCheckedModIds([...preset.modIds])}
              className="px-2.5 py-1 rounded text-xs font-medium border bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-1)] hover:border-[var(--hl-blue-border)] hover:bg-[var(--hl-blue-bg)] transition-colors whitespace-nowrap"
            >
              {preset.name.split('(')[0].trim()}
            </button>
          ))}
        </div>

        {/* 4-tier filter counters + Add mod search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold tabular-nums transition-colors whitespace-nowrap ${
                tierFilter === 'all'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-sub)] border border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
            >
              Все ({counts.total})
            </button>
            <button
              onClick={() => setTierFilter('green')}
              className={`px-2.5 py-1 rounded text-xs font-medium tabular-nums border transition-colors whitespace-nowrap ${
                tierFilter === 'green'
                  ? 'bg-[var(--hl-green-bg)] text-[var(--hl-green-text)] border-[var(--hl-green-border)] font-semibold'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--hl-green-text)] hover:border-[var(--hl-green-border)]'
              }`}
            >
              Стабильно ({counts.green})
            </button>
            <button
              onClick={() => setTierFilter('lime')}
              className={`px-2.5 py-1 rounded text-xs font-medium tabular-nums border transition-colors whitespace-nowrap ${
                tierFilter === 'lime'
                  ? 'bg-[var(--hl-lime-bg)] text-[var(--hl-lime-text)] border-[var(--hl-lime-border)] font-semibold'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--hl-lime-text)] hover:border-[var(--hl-lime-border)]'
              }`}
            >
              Норма ({counts.lime})
            </button>
            <button
              onClick={() => setTierFilter('yellow')}
              className={`px-2.5 py-1 rounded text-xs font-medium tabular-nums border transition-colors whitespace-nowrap ${
                tierFilter === 'yellow'
                  ? 'bg-[var(--hl-yellow-pill)] text-[var(--hl-yellow-text)] border-[var(--hl-yellow-border)] font-semibold'
                  : 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)]'
              }`}
            >
              Условно / жёлтые ({counts.yellow})
            </button>
            <button
              onClick={() => setTierFilter('red')}
              className={`px-2.5 py-1 rounded text-xs font-medium tabular-nums border transition-colors whitespace-nowrap ${
                tierFilter === 'red'
                  ? 'bg-[var(--hl-red-pill)] text-[var(--hl-red-text)] border-[var(--hl-red-border)] font-semibold'
                  : 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)] text-[var(--hl-red-text)]'
              }`}
            >
              Конфликт / красные ({counts.red})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md p-0.5 text-xs">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                  viewMode === 'tree'
                    ? 'bg-[var(--surface-control)] text-[var(--ink-1)] font-semibold shadow-xs'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                Мод → Аддоны
              </button>
              <button
                onClick={() => setViewMode('status')}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                  viewMode === 'status'
                    ? 'bg-[var(--surface-control)] text-[var(--ink-1)] font-semibold shadow-xs'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                По статусу
              </button>
            </div>

            <button
              onClick={() => setHideIncompatibleSuggestions(v => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                hideIncompatibleSuggestions
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
              title="Скрывать несовместимые с текущим списком и полностью перекрытые моды"
            >
              {hideIncompatibleSuggestions ? <EyeOff className="w-3.5 h-3.5 text-[var(--accent-text)]" /> : <Eye className="w-3.5 h-3.5" />}
              {hideIncompatibleSuggestions ? 'Только совм.' : 'Все в поиске'}
            </button>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                placeholder="Добавить мод по названию..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)] focus:bg-[var(--surface-control)]"
              />
              {addSuggestions.length > 0 && (
                <div className="absolute right-0 left-0 top-full mt-1 z-30 bg-[var(--surface-solid)] border border-[var(--border-line)] rounded-md shadow-xl divide-y divide-[var(--border-soft)] max-h-64 overflow-y-auto">
                  {addSuggestions.map(s => {
                    const restriction = getModRestrictionBadge(s, checkedSet);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setCheckedModIds(prev => (prev.includes(s.id) ? prev : [...prev, s.id]));
                          setAddSearch('');
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--surface-hover)] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--ink-1)] truncate">{s.name}</div>
                          <div className="text-[10px] text-[var(--ink-2)] truncate">
                            {restriction ? (
                              <span
                                className={
                                  restriction.tone === 'red'
                                    ? 'text-[var(--hl-red-text)] font-semibold'
                                    : restriction.tone === 'amber'
                                      ? 'text-[var(--hl-yellow-text)] font-semibold'
                                      : 'text-[var(--accent-text)]'
                                }
                              >
                                {restriction.text}
                              </span>
                            ) : (
                              `${s.statusLabel} · ${s.platform}`
                            )}
                          </div>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-[var(--hl-green-text)] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conflict / Warning Explanation Banner */}
      {hasAnyIssues && (
        <div
          className={`bg-[var(--surface-panel)] backdrop-blur-md border rounded-lg p-4 space-y-2.5 ${
            analysis.conflicts.length > 0 || redWarnings.length > 0
              ? 'border-[var(--hl-red-border)]'
              : 'border-[var(--hl-yellow-border)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className={`flex items-center gap-2 text-sm font-semibold ${
                analysis.conflicts.length > 0 || redWarnings.length > 0
                  ? 'text-[var(--hl-red-text)]'
                  : 'text-[var(--hl-yellow-text)]'
              }`}
            >
              {analysis.conflicts.length > 0 || redWarnings.length > 0 ? (
                <ShieldAlert className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              {analysis.conflicts.length > 0 || redWarnings.length > 0
                ? `Обнаружены конфликты и ошибки (${analysis.conflicts.length + redWarnings.length})`
                : `Обнаружены лишние или перекрытые моды (${yellowWarnings.length})`}
            </div>
          </div>
          <div className="space-y-2">
            {analysis.conflicts.map((c, idx) => (
              <div key={idx} className="bg-[var(--hl-red-bg)] border border-[var(--hl-red-border)] rounded-md p-3 text-xs space-y-1">
                <div className="font-semibold text-[var(--hl-red-text)]">
                  {c.rule.title}: <span className="text-[var(--ink-1)]">{c.matchedNames.join(' + ')}</span>
                </div>
                <p className="text-[var(--ink-2)]">{c.rule.explanation}</p>
                <p className="text-[var(--hl-green-text)] font-medium">Решение: {c.rule.recommendation}</p>
              </div>
            ))}
            {redWarnings.map((w, idx) => (
              <div key={`rw-${idx}`} className="bg-[var(--hl-red-bg)] border border-[var(--hl-red-border)] rounded-md p-3 text-xs flex items-center justify-between gap-3">
                <span className="text-[var(--hl-red-text)] font-medium">{w.message}</span>
                {w.fixModIds && (
                  <button
                    onClick={() =>
                      setCheckedModIds(prev => Array.from(new Set([...prev, ...w.fixModIds!])))
                    }
                    className="shrink-0 px-2.5 py-1 rounded bg-[#059669] hover:bg-[#047857] text-white font-medium"
                  >
                    Добавить нужное
                  </button>
                )}
              </div>
            ))}
            {yellowWarnings.map((w, idx) => (
              <div key={`yw-${idx}`} className="bg-[var(--hl-yellow-bg)] border border-[var(--hl-yellow-border)] rounded-md p-3 text-xs flex items-center justify-between gap-3">
                <span className="text-[var(--hl-yellow-text)] font-medium">{w.message}</span>
                {w.fixModIds && (
                  <button
                    onClick={() =>
                      setCheckedModIds(prev => Array.from(new Set([...prev, ...w.fixModIds!])))
                    }
                    className="shrink-0 px-2.5 py-1 rounded bg-[var(--surface-control)] hover:bg-[var(--hl-yellow-pill)] border border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)] font-medium"
                  >
                    Добавить базу
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--ink-2)]">
            Список пуст. Загрузите сборку выше или добавьте моды через поиск.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {displayRows.map(({ row: { mod, tier, label, reason, viaBridge }, isChild, relationLabel, rootIndex, childCount }) => {
              const updatedLabel = getModUpdatedLabel(mod);
              const rowAccent =
                tier === 'red'
                  ? 'bg-[var(--hl-red-bg)] hover:bg-[var(--hl-red-hover)]'
                  : tier === 'yellow'
                    ? 'bg-[var(--hl-yellow-bg)] hover:bg-[var(--hl-yellow-hover)]'
                    : isChild
                      ? 'bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)]'
                      : 'hover:bg-[var(--surface-hover)]';
              const badgeCls =
                tier === 'green'
                  ? 'bg-[var(--hl-green-bg)] text-[var(--hl-green-text)] border-[var(--hl-green-border)]'
                  : tier === 'lime'
                    ? 'bg-[var(--hl-lime-bg)] text-[var(--hl-lime-text)] border-[var(--hl-lime-border)]'
                    : tier === 'yellow'
                      ? 'bg-[var(--hl-yellow-pill)] text-[var(--hl-yellow-text)] border-[var(--hl-yellow-border)]'
                      : 'bg-[var(--hl-red-pill)] text-[var(--hl-red-text)] border-[var(--hl-red-border)]';
              const Icon =
                tier === 'green' || tier === 'lime'
                  ? CheckCircle2
                  : tier === 'yellow'
                    ? AlertTriangle
                    : ShieldAlert;

              return (
                <div
                  key={mod.id}
                  className={`py-2.5 flex items-center justify-between gap-3 transition-colors ${rowAccent} ${
                    isChild ? 'pl-10 pr-4' : 'px-4'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {!isChild && rootIndex !== undefined && (
                      <span className="text-[11px] font-mono text-[var(--ink-3)] w-5 text-right shrink-0 tabular-nums">
                        {rootIndex}.
                      </span>
                    )}
                    {isChild && (
                      <span className="text-xs font-mono text-[var(--accent-text)] w-5 text-right shrink-0">
                        ↳
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 w-40 justify-center ${badgeCls}`}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      {label}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <button
                          onClick={() => onOpenDetail(mod)}
                          className="text-sm font-semibold text-[var(--ink-1)] hover:text-[var(--accent-text)] text-left truncate"
                        >
                          {mod.name}
                        </button>
                        {isChild && relationLabel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--hl-blue-bg)] border border-[var(--hl-blue-border)] text-[var(--hl-blue-text)] font-medium">
                            {relationLabel}
                          </span>
                        )}
                        {!isChild && childCount !== undefined && childCount > 0 && (
                          <span className="text-[11px] text-[var(--ink-2)] font-medium">
                            +{childCount} аддонов
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--ink-2)]">{mod.platform}</span>
                        {updatedLabel && (
                          <span className="text-[11px] text-[var(--ink-3)] font-mono">· обн. {updatedLabel}</span>
                        )}
                        {viaBridge && (
                          <span className="text-[11px] text-[var(--accent-text)] font-medium">{viaBridge}</span>
                        )}
                      </div>
                      {tier !== 'green' && (
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            tier === 'red'
                              ? 'text-[var(--hl-red-text)] font-medium'
                              : tier === 'lime'
                                ? 'text-[var(--hl-lime-text)]'
                                : 'text-[var(--hl-yellow-text)] font-medium'
                          }`}
                        >
                          {reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={mod.curseforgeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--surface-control)] hover:bg-[#E05327] border border-[var(--border-line)] hover:border-[#E05327] text-[var(--ink-1)] hover:text-white transition-colors"
                      title="Открыть на CurseForge"
                    >
                      CurseForge
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => setCheckedModIds(prev => prev.filter(id => id !== mod.id))}
                      className="p-1.5 rounded text-[var(--ink-3)] hover:text-[var(--hl-red-text)] hover:bg-[var(--hl-red-bg)] transition-colors"
                      title="Убрать из списка"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
