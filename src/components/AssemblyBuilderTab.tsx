import { useMemo, useState } from 'react';
import {
  MODS_DATABASE,
  MOD_GROUPS,
  MOD_PRESETS,
  type ModItem,
} from '../data/modsData.ts';
import {
  INITIAL_BUILDER_PREFS,
  MOD_BY_ID,
  evaluateAssemblyHealth,
  getCheckerTier,
  getModEffectivenessScore,
  getModRestrictionBadge,
  getModSuperseder,
  isModIncompatibleWithSelection,
  isUnsupportedOnForge,
  removeModsCascade,
  smartFixAssembly,
  toggleModSmart,
  type AssemblyPreferences,
  type CheckerTier,
} from '../utils/modLogic.ts';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  RotateCcw,
  Search,
  ShieldAlert,
  Unlock,
  Wand2,
  X,
} from 'lucide-react';

interface AssemblyBuilderTabProps {
  selectedIds: string[];
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  prefs: AssemblyPreferences;
  setPrefs: (updater: AssemblyPreferences | ((prev: AssemblyPreferences) => AssemblyPreferences)) => void;
  showDescriptions: boolean;
}

type BuilderSort = 'smart' | 'green-first' | 'alpha';
type BuilderSection = 'all' | 'optimization' | 'recipes';

interface ModHighlightInfo {
  status: CheckerTier;
  reason: string;
  isIncompatible: boolean;
  isSupersededOrDanger: boolean;
}

export function AssemblyBuilderTab({
  selectedIds,
  setSelectedIds,
  prefs,
  setPrefs,
  showDescriptions,
}: AssemblyBuilderTabProps) {
  const [actionNotice, setActionNotice] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const [sortMode, setSortMode] = useState<BuilderSort>('smart');
  const [builderSection, setBuilderSection] = useState<BuilderSection>('all');
  const [slotSearch, setSlotSearch] = useState('');
  const [strictExclusive, setStrictExclusive] = useState(true);
  const [expandedAddons, setExpandedAddons] = useState<Record<string, boolean>>({});
  const [expandedHidden, setExpandedHidden] = useState<Record<string, boolean>>({});

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const analysis = useMemo(() => evaluateAssemblyHealth(selectedIds), [selectedIds]);

  const warningByMod = useMemo(() => {
    const map = new Map<string, { severity: 'red' | 'yellow'; messages: string[] }>();
    for (const w of analysis.warnings) {
      const prev = map.get(w.modId);
      const severity = prev?.severity === 'red' || w.severity === 'red' ? 'red' : 'yellow';
      map.set(w.modId, { severity, messages: prev ? [...prev.messages, w.message] : [w.message] });
    }
    return map;
  }, [analysis.warnings]);

  const highlightByModId = useMemo(() => {
    const map = new Map<string, ModHighlightInfo>();
    for (const mod of MODS_DATABASE) {
      const w = warningByMod.get(mod.id);
      const checker = getCheckerTier(mod, analysis.conflictingIdSet, w?.severity);
      const restriction = getModRestrictionBadge(mod, selectedSet, prefs);
      const superseder = getModSuperseder(mod, selectedSet, prefs, true);
      const isIncompatible = isModIncompatibleWithSelection(mod, selectedSet, prefs);
      const isSupersededOrDanger =
        mod.status === 'danger' || isUnsupportedOnForge(mod) || superseder !== null;

      let status: CheckerTier = checker.tier;
      let reason = mod.description;

      if (checker.tier === 'red' || isIncompatible || isUnsupportedOnForge(mod) || restriction?.tone === 'red') {
        status = 'red';
        reason =
          w?.messages[0] ||
          (restriction?.tone === 'red' ? restriction.text : null) ||
          (isIncompatible ? 'Конфликт или не работает на Forge.' : null) ||
          checker.reason;
      } else if (
        checker.tier === 'yellow' ||
        Boolean(mod.coveredBy) ||
        superseder !== null ||
        restriction?.tone === 'amber'
      ) {
        status = 'yellow';
        reason =
          w?.messages[0] ||
          (mod.coveredBy ? `Встроено в ${mod.coveredBy}.` : null) ||
          (superseder ? `${superseder.reason}.` : null) ||
          (restriction?.tone === 'amber' ? restriction.text : null) ||
          checker.reason;
      } else if (restriction?.tone === 'sky') {
        reason = restriction.text;
      }

      map.set(mod.id, {
        status,
        reason,
        isIncompatible,
        isSupersededOrDanger,
      });
    }
    return map;
  }, [analysis.conflictingIdSet, warningByMod, selectedSet, prefs]);

  const missingSlotGroupIds = useMemo(
    () => new Set(analysis.missingCoreSlots.map(s => s.groupId)),
    [analysis.missingCoreSlots]
  );

  const handleLoadCorePreset = (presetId: string) => {
    const preset = MOD_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setSelectedIds([...preset.modIds]);
    setActionNotice({
      text: `${preset.name.split('(')[0].trim()} (${preset.modIds.length})`,
      tone: 'info',
    });
  };

  const handleFullReset = () => {
    setSelectedIds([]);
    setPrefs({ ...INITIAL_BUILDER_PREFS, focusModId: null });
    setSlotSearch('');
    setBuilderSection('all');
    setSortMode('smart');
    setExpandedAddons({});
    setExpandedHidden({});
    setActionNotice(null);
  };

  const handleToggleMod = (mod: ModItem) => {
    const res = toggleModSmart(selectedIds, mod.id, { strict: strictExclusive, prefs });
    setSelectedIds(res.nextIds);
    setActionNotice(res.notice ? { text: res.notice, tone: res.noticeTone } : null);
  };

  const handleFixIssues = () => {
    const fixed = smartFixAssembly(selectedIds, prefs);
    setSelectedIds(fixed);
    setActionNotice({ text: 'Конфликты и зависимости исправлены.', tone: 'info' });
  };

  const handleQuickSelectSlotLeader = (leaderId: string, memberIds: string[]) => {
    let next = selectedIds;
    if (strictExclusive) {
      const res = toggleModSmart(
        selectedIds.includes(leaderId) ? selectedIds : selectedIds.filter(id => !memberIds.includes(id)),
        leaderId,
        { strict: true, prefs }
      );
      next = res.nextIds;
    } else if (!selectedIds.includes(leaderId)) {
      next = [...selectedIds, leaderId];
    }
    setSelectedIds(next);
  };

  const handleClearSlot = (memberIds: string[]) => {
    if (!strictExclusive) {
      setSelectedIds(selectedIds.filter(id => !memberIds.includes(id)));
      return;
    }
    const res = removeModsCascade(selectedIds, memberIds);
    setSelectedIds(res.nextIds);
  };

  const visibleGroups = useMemo(() => {
    const q = slotSearch.trim().toLowerCase();
    return MOD_GROUPS.filter(group => {
      const isRecipeGroup = group.id === 'recipes-jei';
      if (builderSection === 'optimization' && isRecipeGroup) return false;
      if (builderSection === 'recipes' && !isRecipeGroup) return false;
      if (!q) return true;
      if (group.title.toLowerCase().includes(q) || group.description.toLowerCase().includes(q)) return true;
      return group.memberIds.some(id => {
        const m = MOD_BY_ID.get(id);
        if (!m) return false;
        return (
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          Boolean(m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
        );
      });
    });
  }, [slotSearch, builderSection]);

  const sortMods = (mods: ModItem[], leaderId: string, addonIds: string[]) => {
    const addonSet = new Set(addonIds);
    const tierScore: Record<CheckerTier, number> = { green: 30, lime: 20, yellow: 10, red: -100 };
    return [...mods].sort((a, b) => {
      if (sortMode === 'alpha') return a.name.localeCompare(b.name, 'ru');
      if (sortMode === 'green-first') {
        const hlA = highlightByModId.get(a.id)?.status ?? 'yellow';
        const hlB = highlightByModId.get(b.id)?.status ?? 'yellow';
        return tierScore[hlB] - tierScore[hlA] || getModEffectivenessScore(b) - getModEffectivenessScore(a);
      }
      const rank = (m: ModItem) => (m.id === leaderId ? 2000 : addonSet.has(m.id) ? 1200 : 0);
      return rank(b) + getModEffectivenessScore(b) - (rank(a) + getModEffectivenessScore(a));
    });
  };

  const optimizationGroups = useMemo(
    () => visibleGroups.filter(g => g.id !== 'recipes-jei'),
    [visibleGroups]
  );
  const recipeGroups = useMemo(
    () => visibleGroups.filter(g => g.id === 'recipes-jei'),
    [visibleGroups]
  );

  const issueCount = analysis.conflicts.length + analysis.warnings.length;
  const q = slotSearch.trim().toLowerCase();

  const renderModRow = (
    mod: ModItem,
    group: (typeof MOD_GROUPS)[number],
    options: {
      isAddonChild?: boolean;
      isCoreExclusive?: boolean;
      hasExclusiveConflict?: boolean;
      addonsToggle?: { count: number; activeCount: number; open: boolean; onToggle: () => void };
      hiddenInlineToggle?: { count: number; open: boolean; onToggle: () => void };
    }
  ) => {
    const isSelected = selectedSet.has(mod.id);
    const hl = highlightByModId.get(mod.id);
    const status: CheckerTier =
      options.hasExclusiveConflict && options.isCoreExclusive && isSelected
        ? 'red'
        : hl?.status ?? 'green';
    const showReasonLine = status === 'red' || status === 'yellow' || showDescriptions;

    return (
      <div
        key={mod.id}
        data-active={isSelected ? 'true' : 'false'}
        data-status={status}
        className={`mod-row flex items-center justify-between gap-2 ${
          options.isAddonChild ? 'pl-9 pr-4 bg-[var(--surface-sub)]/60' : 'px-4'
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {options.isAddonChild && (
            <span className="text-xs font-mono text-[var(--ink-3)] mt-0.5 shrink-0 select-none">↳</span>
          )}
          <label className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer">
            <input
              type={strictExclusive && options.isCoreExclusive ? 'radio' : 'checkbox'}
              name={strictExclusive && options.isCoreExclusive ? `group-${group.id}` : undefined}
              checked={isSelected}
              onChange={() => handleToggleMod(mod)}
              className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0 mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-semibold text-[var(--ink-1)]">{mod.name}</span>
                {mod.platform.includes('Sinytra') && (
                  <span className="text-[10px] font-mono text-[var(--ink-3)]">Sinytra</span>
                )}
              </div>
              {showReasonLine && hl?.reason && (
                <p
                  className={`text-[11px] truncate mt-0.5 ${
                    status === 'red'
                      ? 'text-[var(--hl-red-text)]'
                      : status === 'yellow'
                        ? 'text-[var(--hl-yellow-text)]'
                        : 'text-[var(--ink-2)]'
                  }`}
                  title={hl.reason}
                >
                  {hl.reason}
                </p>
              )}
            </div>
          </label>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {options.addonsToggle && (
            <button
              type="button"
              onClick={options.addonsToggle.onToggle}
              aria-expanded={options.addonsToggle.open}
              className={`inline-flex items-center gap-1 px-2 py-1 ui-control border text-[11px] font-medium transition-colors whitespace-nowrap tabular-nums ${
                options.addonsToggle.open
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-control)] hover:bg-[var(--surface-hover)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
              title="Раскрыть или скрыть аддоны"
            >
              {options.addonsToggle.open ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>
                Аддоны ({options.addonsToggle.activeCount > 0 ? `${options.addonsToggle.activeCount}/` : ''}
                {options.addonsToggle.count})
              </span>
            </button>
          )}

          {options.hiddenInlineToggle && (
            <button
              type="button"
              onClick={options.hiddenInlineToggle.onToggle}
              aria-expanded={options.hiddenInlineToggle.open}
              className={`inline-flex items-center gap-1 px-2 py-1 ui-control border text-[11px] font-medium transition-colors whitespace-nowrap tabular-nums ${
                options.hiddenInlineToggle.open
                  ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)]'
                  : 'bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border-[var(--border-line)] text-[var(--ink-3)] hover:text-[var(--ink-1)]'
              }`}
              title="Раскрыть или скрыть несовместимые и скрытые варианты"
            >
              {options.hiddenInlineToggle.open ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>{options.hiddenInlineToggle.open ? 'Скрыть' : `Скрытые (${options.hiddenInlineToggle.count})`}</span>
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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Laconic Workbench Header */}
      <div className="ui-block relative z-20 p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-bold text-[var(--ink-1)] tracking-tight">Клипание сборок</h2>
            <span className="text-xs font-mono text-[var(--ink-2)] tabular-nums">
              {selectedIds.length} модов
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {MOD_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadCorePreset(preset.id)}
                className="px-2.5 py-1 ui-control bg-[var(--surface-sub)] hover:bg-[var(--hl-blue-bg)] border border-[var(--border-line)] hover:border-[var(--hl-blue-border)] text-[var(--ink-1)] text-xs font-medium transition-colors whitespace-nowrap"
              >
                {preset.name.split('(')[0].trim()}
              </button>
            ))}

            {issueCount > 0 && (
              <button
                type="button"
                onClick={handleFixIssues}
                className="inline-flex items-center gap-1 px-2.5 py-1 ui-control bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Исправить ({issueCount})
              </button>
            )}

            <button
              type="button"
              onClick={handleFullReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 ui-control bg-[var(--surface-sub)] hover:bg-[var(--hl-red-bg)] border border-[var(--border-line)] hover:border-[var(--hl-red-border)] text-[var(--ink-2)] hover:text-[var(--hl-red-text)] text-xs font-medium transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сброс
            </button>
          </div>
        </div>

        {/* Compact Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control p-0.5 text-xs">
              {[
                { k: 'all', label: 'Все' },
                { k: 'optimization', label: 'Оптимизация' },
                { k: 'recipes', label: 'JEI / EMI' },
              ].map(sec => (
                <button
                  key={sec.k}
                  type="button"
                  onClick={() => setBuilderSection(sec.k as BuilderSection)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                    builderSection === sec.k
                      ? 'bg-[var(--accent)] text-white font-semibold'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div className="relative w-56 max-w-full">
              <Search className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={slotSearch}
                onChange={e => setSlotSearch(e.target.value)}
                placeholder="Найти слот или мод..."
                className="w-full pl-8 pr-2.5 py-1 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control px-1 py-0.5">
              <ArrowUpDown className="w-3 h-3 text-[var(--ink-3)] mx-1" />
              {[
                { k: 'smart', label: 'Порядок' },
                { k: 'green-first', label: 'Надёжные' },
                { k: 'alpha', label: 'А–Я' },
              ].map(s => (
                <button
                  key={s.k}
                  type="button"
                  onClick={() => setSortMode(s.k as BuilderSort)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    sortMode === s.k
                      ? 'bg-[var(--surface-control)] text-[var(--ink-1)] font-semibold'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStrictExclusive(v => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 ui-control text-xs font-medium border transition-colors whitespace-nowrap ${
                strictExclusive
                  ? 'bg-[var(--hl-green-bg)] border-[var(--hl-green-border)] text-[var(--hl-green-text)]'
                  : 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)]'
              }`}
            >
              {strictExclusive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {strictExclusive ? '1 мод на слот' : 'Свободно'}
            </button>
          </div>
        </div>

        {actionNotice && (
          <div
            className={`ui-control px-3 py-1.5 text-xs flex items-center justify-between gap-2 border ${
              actionNotice.tone === 'warn'
                ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)]'
                : 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
            }`}
          >
            <span>{actionNotice.text}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="p-0.5 rounded hover:bg-[var(--surface-hover)] shrink-0"
              aria-label="Скрыть уведомление"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Full-Width Slots */}
      {visibleGroups.length === 0 ? (
        <div className="ui-block p-8 text-center text-xs text-[var(--ink-2)]">
          Ничего не найдено.
        </div>
      ) : (
        <div className="space-y-5">
          {[
            { key: 'optimization', title: '01 · Оптимизация', groups: optimizationGroups },
            { key: 'recipes', title: '02 · JEI / EMI', groups: recipeGroups },
          ]
            .filter(sec => sec.groups.length > 0)
            .map(sec => (
              <section key={sec.key} className="space-y-2.5" data-slot-section={sec.key}>
                <div className="flex items-baseline gap-2 px-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-2)]">{sec.title}</h3>
                  <span className="text-xs font-mono text-[var(--ink-3)] tabular-nums">({sec.groups.length})</span>
                </div>

                <div className="space-y-2.5">
                  {sec.groups.map(group => {
                    const addonSet = new Set(group.addonIds);
                    const allMembers = group.memberIds
                      .map(id => MOD_BY_ID.get(id))
                      .filter((m): m is ModItem => Boolean(m));
                    const sortedMembers = sortMods(allMembers, group.leaderId, group.addonIds);

                    const corePool = sortedMembers.filter(m => !addonSet.has(m.id));
                    const addonPool = sortedMembers.filter(m => addonSet.has(m.id));

                    const isHiddenItem = (m: ModItem) => {
                      if (selectedSet.has(m.id)) return false;
                      const hl = highlightByModId.get(m.id);
                      return Boolean(hl?.isIncompatible || hl?.isSupersededOrDanger);
                    };

                    // Primary core rows: leader + active core mods + clean non-hidden core variants (if search matches or clean alternative)
                    const primaryCoreMods = corePool.filter(m => {
                      if (selectedSet.has(m.id) || m.id === group.leaderId) return true;
                      if (isHiddenItem(m)) return false;
                      if (
                        q &&
                        (m.name.toLowerCase().includes(q) ||
                          (m.tags && m.tags.some(t => t.toLowerCase().includes(q))))
                      ) {
                        return true;
                      }
                      const hl = highlightByModId.get(m.id);
                      return hl?.status === 'green' || hl?.status === 'lime';
                    });

                    const primaryCoreIdSet = new Set(primaryCoreMods.map(m => m.id));
                    const compatibleAddons = addonPool.filter(m => !isHiddenItem(m));

                    const hiddenOrIncompatibleMods = sortedMembers.filter(m => {
                      if (primaryCoreIdSet.has(m.id)) return false;
                      if (compatibleAddons.some(a => a.id === m.id)) return false;
                      return true;
                    });

                    const selectedInGroup = group.memberIds.filter(id => selectedSet.has(id));
                    const corePoolIds = group.memberIds.filter(id => !addonSet.has(id));
                    const selectedInCore = corePoolIds.filter(id => selectedSet.has(id));
                    const hasExclusiveConflict = group.exclusive && selectedInCore.length > 1;
                    const isMissingCore = missingSlotGroupIds.has(group.id);

                    const addonsOpen = Boolean(expandedAddons[group.id]) || (q.length > 0 && compatibleAddons.some(a => a.name.toLowerCase().includes(q)));
                    const hiddenOpen = Boolean(expandedHidden[group.id]);
                    const activeAddonCount = compatibleAddons.filter(a => selectedSet.has(a.id)).length;

                    // Attach addon arrow to selected core mod (or leader) and hidden arrow to leader/last primary row
                    const addonAnchorId =
                      primaryCoreMods.find(m => selectedSet.has(m.id))?.id ??
                      primaryCoreMods[0]?.id ??
                      null;
                    const hiddenAnchorId = primaryCoreMods[primaryCoreMods.length - 1]?.id ?? null;

                    return (
                      <div
                        key={group.id}
                        className={`ui-block overflow-hidden ${
                          hasExclusiveConflict
                            ? 'border-[var(--hl-red-border)]'
                            : isMissingCore
                              ? 'border-[var(--hl-yellow-border)]'
                              : ''
                        }`}
                      >
                        {/* Slot Header */}
                        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-sub)]">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <h4 className="text-sm font-semibold text-[var(--ink-1)]">{group.title}</h4>
                              {selectedInGroup.length > 0 && (
                                <span className="text-[11px] font-mono text-[var(--accent-text)] font-semibold tabular-nums">
                                  ({selectedInGroup.length})
                                </span>
                              )}
                            </div>
                            {showDescriptions && (
                              <p className="text-[11px] text-[var(--ink-2)] mt-0.5">{group.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!selectedSet.has(group.leaderId) && (
                              <button
                                type="button"
                                onClick={() => handleQuickSelectSlotLeader(group.leaderId, group.memberIds)}
                                className="text-[11px] px-2 py-0.5 ui-control bg-[var(--surface-control)] hover:bg-[var(--hl-blue-bg)] border border-[var(--border-line)] text-[var(--accent-text)] font-semibold transition-colors whitespace-nowrap"
                              >
                                + Лидер
                              </button>
                            )}
                            {selectedInGroup.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearSlot(group.memberIds)}
                                className="text-[11px] px-2 py-0.5 ui-control bg-[var(--surface-control)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors whitespace-nowrap"
                              >
                                Очистить
                              </button>
                            )}
                          </div>
                        </div>

                        {hasExclusiveConflict && (
                          <div className="px-4 py-1.5 bg-[var(--hl-red-bg)] border-b border-[var(--hl-red-border)] text-xs text-[var(--hl-red-text)] flex items-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Конфликт: {selectedInCore.map(id => MOD_BY_ID.get(id)?.name).join(' + ')}
                            </span>
                          </div>
                        )}

                        <div className="divide-y divide-[var(--border-soft)]">
                          {primaryCoreMods.map(mod => {
                            const isAnchorForAddons =
                              mod.id === addonAnchorId && compatibleAddons.length > 0;
                            const isAnchorForHidden =
                              mod.id === hiddenAnchorId && hiddenOrIncompatibleMods.length > 0;

                            return (
                              <div key={mod.id}>
                                {renderModRow(mod, group, {
                                  isCoreExclusive: group.exclusive,
                                  hasExclusiveConflict,
                                  addonsToggle: isAnchorForAddons
                                    ? {
                                        count: compatibleAddons.length,
                                        activeCount: activeAddonCount,
                                        open: addonsOpen,
                                        onToggle: () =>
                                          setExpandedAddons(prev => ({
                                            ...prev,
                                            [group.id]: !addonsOpen,
                                          })),
                                      }
                                    : undefined,
                                  hiddenInlineToggle: isAnchorForHidden
                                    ? {
                                        count: hiddenOrIncompatibleMods.length,
                                        open: hiddenOpen,
                                        onToggle: () =>
                                          setExpandedHidden(prev => ({
                                            ...prev,
                                            [group.id]: !hiddenOpen,
                                          })),
                                      }
                                    : undefined,
                                })}

                                {/* Indented Addons expanding directly underneath */}
                                {isAnchorForAddons && addonsOpen && (
                                  <div className="divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
                                    {compatibleAddons.map(addon =>
                                      renderModRow(addon, group, {
                                        isAddonChild: true,
                                        isCoreExclusive: false,
                                        hasExclusiveConflict,
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Edge case: slot had no primaryCoreMods but has addons */}
                          {primaryCoreMods.length === 0 && compatibleAddons.length > 0 && (
                            <div className="divide-y divide-[var(--border-soft)]">
                              {compatibleAddons.map(addon =>
                                renderModRow(addon, group, {
                                  isAddonChild: true,
                                  isCoreExclusive: false,
                                  hasExclusiveConflict,
                                })
                              )}
                            </div>
                          )}

                          {/* Hidden / Incompatible disclosure attached under slot if anchor wasn't rendered or opened */}
                          {hiddenOrIncompatibleMods.length > 0 && primaryCoreMods.length === 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHidden(prev => ({ ...prev, [group.id]: !hiddenOpen }))
                              }
                              className="w-full px-4 py-1.5 bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] text-xs text-[var(--ink-2)] flex items-center gap-1.5 transition-colors"
                            >
                              {hiddenOpen ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {hiddenOpen
                                  ? 'Скрыть несовместимые'
                                  : `Скрытые и несовместимые (${hiddenOrIncompatibleMods.length})`}
                              </span>
                            </button>
                          )}

                          {hiddenOpen && hiddenOrIncompatibleMods.length > 0 && (
                            <div className="divide-y divide-[var(--border-soft)] bg-[var(--surface-sub)]/40">
                              {hiddenOrIncompatibleMods.map(hm =>
                                renderModRow(hm, group, {
                                  isAddonChild: addonSet.has(hm.id),
                                  isCoreExclusive: group.exclusive && !addonSet.has(hm.id),
                                  hasExclusiveConflict,
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
