import { useMemo, useState } from 'react';
import {
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
  parseModNamesListText,
  searchModsByQuery,
  shouldHideMod,
  smartFixAssembly,
  type CheckerTier,
} from '../utils/modLogic.ts';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FolderOpen,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { matchJarFilenamesToMods } from '../utils/jarMatcher.ts';

interface CheckerTabProps {
  checkedModIds: string[];
  setCheckedModIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  showDescriptions: boolean;
  onOpenDetail: (mod: ModItem) => void;
}

export function CheckerTab({
  checkedModIds,
  setCheckedModIds,
  showDescriptions,
  onOpenDetail,
}: CheckerTabProps) {
  const [tierFilter, setTierFilter] = useState<'all' | CheckerTier>('all');
  const [viewMode, setViewMode] = useState<'tree' | 'status'>('tree');
  const [addSearch, setAddSearch] = useState('');
  const [includeIncompatibleSearch, setIncludeIncompatibleSearch] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

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

  const searchMatches = useMemo(() => {
    if (!addSearch.trim()) return { visible: [] as ModItem[], hiddenCount: 0 };
    const candidates = searchModsByQuery(addSearch, 28);
    const compatible: ModItem[] = [];
    const incompatible: ModItem[] = [];

    for (const m of candidates) {
      const hidden = shouldHideMod(m, checkedSet, undefined, {
        hideIncompatible: true,
        hideUselessCovered: true,
      });
      if (hidden) {
        incompatible.push(m);
      } else {
        compatible.push(m);
      }
    }

    if (includeIncompatibleSearch || compatible.length === 0) {
      return {
        visible: [...compatible, ...incompatible].slice(0, 12),
        hiddenCount: 0,
      };
    }
    return {
      visible: compatible.slice(0, 12),
      hiddenCount: incompatible.length,
    };
  }, [addSearch, checkedSet, includeIncompatibleSearch]);

  const rowByModId = useMemo(() => new Map(rows.map(r => [r.mod.id, r])), [rows]);

  const treeNodes = useMemo(() => {
    const filteredIds = filteredRows.map(r => r.mod.id);
    return organizeAssemblyTree(filteredIds);
  }, [filteredRows]);

  const parsedImport = useMemo(() => {
    if (!importText.trim()) return { matchedIds: [], unmatchedLines: [] };
    return parseModNamesListText(importText);
  }, [importText]);

  const handleCopyPlainNamesList = () => {
    const text = formatModNamesListText(checkedModIds);
    navigator.clipboard.writeText(text);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 1800);
  };

  const handleApplyImport = (mode: 'replace' | 'merge') => {
    if (parsedImport.matchedIds.length === 0) return;
    if (mode === 'replace') {
      setCheckedModIds(parsedImport.matchedIds);
    } else {
      setCheckedModIds(prev => Array.from(new Set([...prev, ...parsedImport.matchedIds])));
    }
    setImportText('');
    setImportOpen(false);
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

  const renderCheckerRow = (
    r: (typeof rows)[number],
    opts: {
      isChild?: boolean;
      relationLabel?: string;
      rootIndex?: number;
      childCount?: number;
      isCollapsed?: boolean;
      onToggleCollapse?: () => void;
    }
  ) => {
    const { mod, tier, reason, viaBridge } = r;
    const updatedLabel = getModUpdatedLabel(mod);
    const showLine = tier === 'red' || tier === 'yellow' || showDescriptions;

    return (
      <div
        key={mod.id}
        data-active="true"
        data-status={tier}
        className={`mod-row flex items-center justify-between gap-3 ${
          opts.isChild ? 'pl-10 pr-4 bg-[var(--surface-sub)]/60' : 'px-4'
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {!opts.isChild && opts.rootIndex !== undefined && (
            <span className="text-[11px] font-mono text-[var(--ink-3)] w-5 text-right shrink-0 tabular-nums mt-0.5">
              {opts.rootIndex}.
            </span>
          )}
          {opts.isChild && (
            <span className="text-xs font-mono text-[var(--accent-text)] w-5 text-right shrink-0 mt-0.5">
              ↳
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                type="button"
                onClick={() => onOpenDetail(mod)}
                className="text-sm font-semibold text-[var(--ink-1)] hover:text-[var(--accent-text)] text-left truncate"
              >
                {mod.name}
              </button>
              {opts.isChild && opts.relationLabel && (
                <span className="text-[11px] text-[var(--accent-text)]">{opts.relationLabel}</span>
              )}
              <span className="text-[11px] text-[var(--ink-3)]">{mod.platform}</span>
              {updatedLabel && (
                <span className="text-[11px] text-[var(--ink-3)] font-mono">· {updatedLabel}</span>
              )}
              {viaBridge && (
                <span className="text-[11px] text-[var(--accent-text)]">{viaBridge}</span>
              )}
            </div>
            {showLine && (
              <p
                className={`text-xs truncate mt-0.5 ${
                  tier === 'red'
                    ? 'text-[var(--hl-red-text)] font-medium'
                    : tier === 'yellow'
                      ? 'text-[var(--hl-yellow-text)] font-medium'
                      : 'text-[var(--ink-2)]'
                }`}
              >
                {tier === 'green' || tier === 'lime' ? mod.description : reason}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!opts.isChild && opts.childCount !== undefined && opts.childCount > 0 && opts.onToggleCollapse && (
            <button
              type="button"
              onClick={opts.onToggleCollapse}
              className="inline-flex items-center gap-1 px-2 py-1 ui-control bg-[var(--surface-control)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)] text-[11px] font-medium tabular-nums"
            >
              {opts.isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Аддоны ({opts.childCount})</span>
            </button>
          )}
          <a
            href={mod.curseforgeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 ui-control text-[var(--ink-3)] hover:text-[#E05327] hover:bg-[var(--surface-hover)] transition-colors"
            title="CurseForge"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setCheckedModIds(prev => prev.filter(id => id !== mod.id))}
            className="p-1.5 ui-control text-[var(--ink-3)] hover:text-[var(--hl-red-text)] hover:bg-[var(--hl-red-bg)] transition-colors"
            title="Убрать"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="ui-block relative z-20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-base font-bold text-[var(--ink-1)] tracking-tight">Чекер сборки</h2>
            <span className="text-xs font-mono text-[var(--ink-2)] tabular-nums">
              {counts.total} модов
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {window.desktopAPI?.isDesktop && (
              <button
                type="button"
                onClick={handleScanDesktopFolder}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 ui-control text-xs font-medium bg-[var(--hl-blue-bg)] hover:bg-[var(--surface-hover)] border border-[var(--hl-blue-border)] text-[var(--hl-blue-text)] transition-colors whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Папка mods
              </button>
            )}
            {hasAnyIssues && (
              <button
                type="button"
                onClick={() => setCheckedModIds(smartFixAssembly(checkedModIds))}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 ui-control text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white transition-colors whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Исправить
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyPlainNamesList}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 ui-control text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {copiedList ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedList ? 'Скопировано' : 'Скопировать списком'}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(v => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 ui-control text-xs font-semibold border transition-colors whitespace-nowrap ${
                importOpen
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border-[var(--border-line)] text-[var(--ink-1)]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Импортировать списком
            </button>
            <button
              type="button"
              onClick={() => setCheckedModIds([])}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 ui-control text-xs font-medium bg-[var(--surface-sub)] hover:bg-[var(--hl-red-bg)] border border-[var(--border-line)] hover:border-[var(--hl-red-border)] text-[var(--ink-2)] hover:text-[var(--hl-red-text)] disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Очистить
            </button>
          </div>
        </div>

        {/* Inline Import Panel */}
        {importOpen && (
          <div className="p-3 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--ink-1)]">
                Вставьте список модов (по строкам, через запятую или .jar имена)
              </span>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--ink-2)]"
                aria-label="Закрыть импорт"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={5}
              placeholder={'Emberbium\nNvidium\nFerriteCore\nModernFix'}
              aria-label="Список модов для импорта"
              className="w-full p-2.5 bg-[var(--surface-solid)] border border-[var(--border-line)] ui-control text-xs font-mono text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)] resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-[var(--ink-2)]">
                Распознано: <strong className="text-[var(--hl-green-text)] font-mono">{parsedImport.matchedIds.length}</strong>
                {parsedImport.unmatchedLines.length > 0 && (
                  <span className="ml-2 text-[var(--hl-yellow-text)]">
                    · не найдено ({parsedImport.unmatchedLines.length}): {parsedImport.unmatchedLines.slice(0, 3).join(', ')}
                    {parsedImport.unmatchedLines.length > 3 ? '…' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={parsedImport.matchedIds.length === 0}
                  onClick={() => handleApplyImport('merge')}
                  className="px-3 py-1.5 ui-control bg-[var(--surface-control)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-xs font-medium text-[var(--ink-1)] disabled:opacity-40"
                >
                  Добавить к текущей
                </button>
                <button
                  type="button"
                  disabled={parsedImport.matchedIds.length === 0}
                  onClick={() => handleApplyImport('replace')}
                  className="px-3 py-1.5 ui-control bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold disabled:opacity-40"
                >
                  Заменить сборку
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Counters & Purpose-Aware Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2.5 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { k: 'all', label: `Все (${counts.total})` },
              { k: 'green', label: `Зелёные (${counts.green})` },
              { k: 'lime', label: `Светло-зелёные (${counts.lime})` },
              { k: 'yellow', label: `Жёлтые (${counts.yellow})` },
              { k: 'red', label: `Красные (${counts.red})` },
            ].map(btn => (
              <button
                key={btn.k}
                type="button"
                onClick={() => setTierFilter(btn.k as 'all' | CheckerTier)}
                className={`px-2.5 py-1 ui-control text-xs font-medium tabular-nums border transition-colors whitespace-nowrap ${
                  tierFilter === btn.k
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold'
                    : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                  viewMode === 'tree'
                    ? 'bg-[var(--surface-control)] text-[var(--ink-1)] font-semibold'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                Мод → Аддоны
              </button>
              <button
                type="button"
                onClick={() => setViewMode('status')}
                className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                  viewMode === 'status'
                    ? 'bg-[var(--surface-control)] text-[var(--ink-1)] font-semibold'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                По статусу
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                placeholder="Добавить мод по названию или назначению..."
                aria-label="Добавить мод по названию или назначению"
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)]"
              />
              {addSearch.trim() && (
                <div className="absolute right-0 left-0 top-full mt-1 z-30 bg-[var(--surface-solid)] border border-[var(--border-line)] ui-control shadow-2xl divide-y divide-[var(--border-soft)] max-h-72 overflow-y-auto">
                  {searchMatches.visible.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-[var(--ink-2)]">Ничего не найдено</div>
                  ) : (
                    searchMatches.visible.map(s => {
                      const inBuild = checkedSet.has(s.id);
                      const restriction = getModRestrictionBadge(s, checkedSet);
                      const statusTier = getCheckerTier(s, analysis.conflictingIdSet).tier;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setCheckedModIds(prev =>
                              prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                            );
                          }}
                          data-active={inBuild ? 'true' : 'false'}
                          data-status={statusTier}
                          className="mod-row w-full px-3 text-left flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[var(--ink-1)] truncate">
                                {s.name}
                              </span>
                              <span className="text-[10px] text-[var(--ink-3)] truncate">
                                {s.groupTitle || s.category}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--ink-2)] truncate">
                              {restriction ? restriction.text : s.description}
                            </div>
                          </div>
                          {inBuild ? (
                            <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-[var(--hl-green-text)] shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                  {searchMatches.hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIncludeIncompatibleSearch(true)}
                      className="w-full px-3 py-1.5 text-[11px] text-[var(--accent-text)] hover:bg-[var(--surface-hover)] text-left font-medium"
                    >
                      Показать также скрытые / несовместимые ({searchMatches.hiddenCount})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Presets quick strip */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-[var(--ink-3)] mr-0.5">Сборки:</span>
          {MOD_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setCheckedModIds([...preset.modIds])}
              className="px-2 py-0.5 ui-control border bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:border-[var(--hl-blue-border)] transition-colors whitespace-nowrap"
            >
              {preset.name.split('(')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {/* Conflict / Warning Explanation Banner */}
      {hasAnyIssues && (
        <div
          className={`ui-block p-3.5 space-y-2 ${
            analysis.conflicts.length > 0 || redWarnings.length > 0
              ? 'border-[var(--hl-red-border)]'
              : 'border-[var(--hl-yellow-border)]'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs font-semibold ${
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
            <span>
              {analysis.conflicts.length > 0 || redWarnings.length > 0
                ? `Конфликты и ошибки: ${analysis.conflicts.length + redWarnings.length}`
                : `Замечания: ${yellowWarnings.length}`}
            </span>
          </div>
          <div className="space-y-1.5">
            {analysis.conflicts.map((c, idx) => (
              <div key={idx} className="bg-[var(--hl-red-bg)] border border-[var(--hl-red-border)] ui-control px-3 py-2 text-xs">
                <span className="font-semibold text-[var(--hl-red-text)]">{c.matchedNames.join(' + ')}:</span>{' '}
                <span className="text-[var(--ink-1)]">{c.rule.recommendation}</span>
              </div>
            ))}
            {redWarnings.map((w, idx) => (
              <div key={`rw-${idx}`} className="bg-[var(--hl-red-bg)] border border-[var(--hl-red-border)] ui-control px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span className="text-[var(--hl-red-text)]">{w.message}</span>
                {w.fixModIds && (
                  <button
                    type="button"
                    onClick={() => setCheckedModIds(prev => Array.from(new Set([...prev, ...w.fixModIds!])))}
                    className="shrink-0 px-2 py-0.5 ui-control bg-[#059669] hover:bg-[#047857] text-white font-medium"
                  >
                    Добавить
                  </button>
                )}
              </div>
            ))}
            {yellowWarnings.map((w, idx) => (
              <div key={`yw-${idx}`} className="bg-[var(--hl-yellow-bg)] border border-[var(--hl-yellow-border)] ui-control px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span className="text-[var(--hl-yellow-text)]">{w.message}</span>
                {w.fixModIds && (
                  <button
                    type="button"
                    onClick={() => setCheckedModIds(prev => Array.from(new Set([...prev, ...w.fixModIds!])))}
                    className="shrink-0 px-2 py-0.5 ui-control bg-[var(--surface-control)] border border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)] font-medium"
                  >
                    Добавить
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="ui-block overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--ink-2)]">
            Список пуст. Добавьте моды в «Клипание сборок», через поиск или импортом списком.
          </div>
        ) : viewMode === 'tree' ? (
          <div className="divide-y divide-[var(--border-soft)]">
            {treeNodes.map((node, idx) => {
              const parentRow = rowByModId.get(node.parent.id);
              if (!parentRow) return null;
              const isCollapsed = Boolean(collapsedNodes[node.parent.id]);
              return (
                <div key={node.parent.id}>
                  {renderCheckerRow(parentRow, {
                    rootIndex: idx + 1,
                    childCount: node.children.length,
                    isCollapsed,
                    onToggleCollapse:
                      node.children.length > 0
                        ? () =>
                            setCollapsedNodes(prev => ({
                              ...prev,
                              [node.parent.id]: !isCollapsed,
                            }))
                        : undefined,
                  })}
                  {node.children.length > 0 && !isCollapsed && (
                    <div className="divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
                      {node.children.map(ch => {
                        const childRow = rowByModId.get(ch.mod.id);
                        if (!childRow) return null;
                        return renderCheckerRow(childRow, {
                          isChild: true,
                          relationLabel: ch.relationLabel,
                        });
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {filteredRows.map(r => renderCheckerRow(r, {}))}
          </div>
        )}
      </div>
    </div>
  );
}
