import { useMemo, useState } from 'react';
import {
  MODS_DATABASE,
  MOD_GROUPS,
  MOD_PRESETS,
  type ModItem,
} from '../data/modsData.ts';
import {
  INITIAL_BUILDER_PREFS,
  evaluateAssemblyHealth,
  formatModNamesListText,
  getCheckerTier,
  getModEffectivenessScore,
  getModRestrictionBadge,
  getModSuperseder,
  isModIncompatibleWithSelection,
  isUnsupportedOnForge,
  removeModsCascade,
  shouldHideMod,
  smartFixAssembly,
  toggleModSmart,
  type AssemblyPreferences,
  type CheckerTier,
} from '../utils/modLogic.ts';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Lock,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Unlock,
  X,
} from 'lucide-react';

interface AssemblyBuilderTabProps {
  selectedIds: string[];
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  prefs: AssemblyPreferences;
  setPrefs: (updater: AssemblyPreferences | ((prev: AssemblyPreferences) => AssemblyPreferences)) => void;
  onOpenDetail: (mod: ModItem) => void;
  onSendToChecker: (ids: string[]) => void;
}

type BuilderSort = 'smart' | 'green-first' | 'alpha';
type BuilderSection = 'all' | 'optimization' | 'recipes';
type SlotFilter = 'all' | 'selected' | 'yellow' | 'red';
type ExtraDrawerFilter = 'all' | 'viable' | 'caution' | 'conflict';

export function AssemblyBuilderTab({
  selectedIds,
  setSelectedIds,
  prefs,
  setPrefs,
  onOpenDetail,
  onSendToChecker,
}: AssemblyBuilderTabProps) {
  const [actionNotice, setActionNotice] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null);
  const [sortMode, setSortMode] = useState<BuilderSort>('smart');
  const [builderSection, setBuilderSection] = useState<BuilderSection>('all');
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all');
  const [slotSearch, setSlotSearch] = useState('');
  const [strictExclusive, setStrictExclusive] = useState(true);
  const [hideUselessCovered, setHideUselessCovered] = useState(false);
  const [hideIncompatible, setHideIncompatible] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [extraSearchByGroup, setExtraSearchByGroup] = useState<Record<string, string>>({});
  const [extraFilterByGroup, setExtraFilterByGroup] = useState<Record<string, ExtraDrawerFilter>>({});
  const [copied, setCopied] = useState(false);

  const modById = useMemo(() => {
    const map = new Map<string, ModItem>();
    MODS_DATABASE.forEach(m => map.set(m.id, m));
    return map;
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const analysis = useMemo(() => evaluateAssemblyHealth(selectedIds), [selectedIds]);

  const incompatibleWithActiveSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of MODS_DATABASE) {
      if (isModIncompatibleWithSelection(m, selectedSet, prefs)) {
        set.add(m.id);
      }
    }
    return set;
  }, [selectedSet, prefs]);

  const uselessOrSupersededSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of MODS_DATABASE) {
      if (selectedSet.has(m.id)) continue;
      if (
        m.status === 'danger' ||
        isUnsupportedOnForge(m) ||
        getModSuperseder(m, selectedSet, prefs, true) !== null
      ) {
        set.add(m.id);
      }
    }
    return set;
  }, [selectedSet, prefs]);

  const warningByMod = useMemo(() => {
    const map = new Map<string, { severity: 'red' | 'yellow'; messages: string[] }>();
    for (const w of analysis.warnings) {
      const prev = map.get(w.modId);
      const severity = prev?.severity === 'red' || w.severity === 'red' ? 'red' : 'yellow';
      map.set(w.modId, { severity, messages: prev ? [...prev.messages, w.message] : [w.message] });
    }
    return map;
  }, [analysis.warnings]);

  const getModHighlight = useMemo(() => {
    return (
      mod: ModItem,
      hasExclusiveConflictInSlot = false,
      isCoreExclusiveItem = false
    ): { tone: 'red' | 'yellow' | 'ok'; label: string; reason: string } => {
      const w = warningByMod.get(mod.id);
      const checker = getCheckerTier(mod, analysis.conflictingIdSet, w?.severity);
      const restriction = getModRestrictionBadge(mod, selectedSet, prefs);
      const superseder = getModSuperseder(mod, selectedSet, prefs, true);
      const isIncompatible = incompatibleWithActiveSet.has(mod.id);
      const isSelected = selectedSet.has(mod.id);

      if (
        checker.tier === 'red' ||
        isIncompatible ||
        isUnsupportedOnForge(mod) ||
        (hasExclusiveConflictInSlot && isCoreExclusiveItem && isSelected) ||
        restriction?.tone === 'red'
      ) {
        const reason =
          w?.messages[0] ||
          (restriction?.tone === 'red' ? restriction.text : null) ||
          (isIncompatible ? 'Конфликтует с выбранными модами или не работает на Forge.' : null) ||
          checker.reason;
        return {
          tone: 'red',
          label: isIncompatible && !isSelected ? 'Конфликт' : 'Опасно / конфликт',
          reason,
        };
      }

      if (
        checker.tier === 'yellow' ||
        Boolean(mod.coveredBy) ||
        superseder !== null ||
        restriction?.tone === 'amber'
      ) {
        const reason =
          w?.messages[0] ||
          (mod.coveredBy ? `Функционал уже встроен в ${mod.coveredBy}.` : null) ||
          (superseder ? `${superseder.reason}.` : null) ||
          (restriction?.tone === 'amber' ? restriction.text : null) ||
          checker.reason;
        return {
          tone: 'yellow',
          label: 'Так себе / нюанс',
          reason,
        };
      }

      return {
        tone: 'ok',
        label: checker.tier === 'green' ? 'Стабильно' : 'Норма',
        reason: mod.description,
      };
    };
  }, [analysis.conflictingIdSet, incompatibleWithActiveSet, prefs, selectedSet, warningByMod]);

  const summaryCounts = useMemo(() => {
    let ok = 0;
    let yellow = 0;
    let red = 0;
    for (const m of analysis.selectedMods) {
      const hl = getModHighlight(m);
      if (hl.tone === 'red') red++;
      else if (hl.tone === 'yellow') yellow++;
      else ok++;
    }
    return { ok, yellow, red, total: analysis.selectedMods.length };
  }, [analysis.selectedMods, getModHighlight]);

  const plainNamesListText = useMemo(() => formatModNamesListText(selectedIds), [selectedIds]);

  const handleLoadCorePreset = (presetId: string) => {
    const preset = MOD_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setSelectedIds([...preset.modIds]);
    setActionNotice({
      text: `Загружена сборка «${preset.name.split('(')[0].trim()}» (${preset.modIds.length} модов).`,
      tone: 'info',
    });
  };

  const handleFullReset = () => {
    setSelectedIds([]);
    setPrefs({ ...INITIAL_BUILDER_PREFS, focusModId: null });
    setSlotSearch('');
    setSlotFilter('all');
    setBuilderSection('all');
    setSortMode('smart');
    setExpandedGroups({});
    setExtraSearchByGroup({});
    setExtraFilterByGroup({});
    setActionNotice(null);
  };

  const handleToggleMod = (mod: ModItem) => {
    const res = toggleModSmart(selectedIds, mod.id, { strict: strictExclusive, prefs });
    setSelectedIds(res.nextIds);
    if (res.notice) {
      setActionNotice({ text: res.notice, tone: res.noticeTone });
    } else {
      setActionNotice(null);
    }
  };

  const handleFixIssues = () => {
    const fixed = smartFixAssembly(selectedIds, prefs);
    setSelectedIds(fixed);
    setActionNotice({
      text: 'Конфликты и устаревшие моды убраны, обязательные зависимости добавлены.',
      tone: 'info',
    });
  };

  const handleQuickSelectSlotLeader = (_groupId: string, leaderId: string, memberIds: string[]) => {
    let next = selectedIds;
    if (strictExclusive) {
      const res = toggleModSmart(
        selectedIds.includes(leaderId)
          ? selectedIds
          : selectedIds.filter(id => !memberIds.includes(id)),
        leaderId,
        { strict: true, prefs }
      );
      next = res.nextIds;
    } else if (!selectedIds.includes(leaderId)) {
      next = [...selectedIds, leaderId];
    }
    setSelectedIds(next);
    const leaderName = modById.get(leaderId)?.name || leaderId;
    setActionNotice({ text: `В слот добавлен лидер: ${leaderName}.`, tone: 'info' });
  };

  const handleClearSlot = (memberIds: string[], groupTitle: string) => {
    if (!strictExclusive) {
      setSelectedIds(selectedIds.filter(id => !memberIds.includes(id)));
      setActionNotice({ text: `Слот «${groupTitle}» очищен.`, tone: 'info' });
      return;
    }
    const res = removeModsCascade(selectedIds, memberIds);
    setSelectedIds(res.nextIds);
    if (res.cascadedNames.length > 0) {
      setActionNotice({
        text: `Слот «${groupTitle}» очищен (также убраны зависимые: ${res.cascadedNames.join(', ')}).`,
        tone: 'info',
      });
    } else {
      setActionNotice({ text: `Слот «${groupTitle}» очищен.`, tone: 'info' });
    }
  };

  const handleCopyPlainList = () => {
    navigator.clipboard.writeText(plainNamesListText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const sortMods = (mods: ModItem[], leaderId: string, addonIds: string[]) => {
    const addonSet = new Set(addonIds);
    const tierScore: Record<CheckerTier, number> = { green: 30, lime: 20, yellow: 10, red: -100 };
    return [...mods].sort((a, b) => {
      if (sortMode === 'alpha') return a.name.localeCompare(b.name, 'ru');
      if (sortMode === 'green-first') {
        const tierA = getCheckerTier(a, analysis.conflictingIdSet, warningByMod.get(a.id)?.severity).tier;
        const tierB = getCheckerTier(b, analysis.conflictingIdSet, warningByMod.get(b.id)?.severity).tier;
        return tierScore[tierB] - tierScore[tierA] || getModEffectivenessScore(b) - getModEffectivenessScore(a);
      }
      const rank = (m: ModItem) => (m.id === leaderId ? 2000 : addonSet.has(m.id) ? 1200 : 0);
      return rank(b) + getModEffectivenessScore(b) - (rank(a) + getModEffectivenessScore(a));
    });
  };

  const missingSlotGroupIds = useMemo(
    () => new Set(analysis.missingCoreSlots.map(s => s.groupId)),
    [analysis.missingCoreSlots]
  );

  const visibleGroups = useMemo(() => {
    const q = slotSearch.trim().toLowerCase();
    return MOD_GROUPS.filter(group => {
      const isRecipeGroup = group.id === 'recipes-jei';
      if (builderSection === 'optimization' && isRecipeGroup) return false;
      if (builderSection === 'recipes' && !isRecipeGroup) return false;

      const selectedInGroup = group.memberIds.filter(id => selectedSet.has(id));
      const members = group.memberIds
        .map(id => modById.get(id))
        .filter((m): m is ModItem => Boolean(m));

      if (slotFilter === 'selected' && selectedInGroup.length === 0) return false;
      if (slotFilter === 'yellow' && !members.some(m => getModHighlight(m).tone === 'yellow')) return false;
      if (slotFilter === 'red' && !members.some(m => getModHighlight(m).tone === 'red')) return false;

      if (!q) return true;
      if (group.title.toLowerCase().includes(q) || group.description.toLowerCase().includes(q)) return true;
      return members.some(
        m =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          Boolean(m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
      );
    });
  }, [slotSearch, slotFilter, builderSection, selectedSet, modById, getModHighlight]);

  const optimizationGroups = useMemo(
    () => visibleGroups.filter(g => g.id !== 'recipes-jei'),
    [visibleGroups]
  );
  const recipeGroups = useMemo(
    () => visibleGroups.filter(g => g.id === 'recipes-jei'),
    [visibleGroups]
  );

  return (
    <div className="space-y-4">
      {/* Top Utilitarian Workbench Header */}
      <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--ink-1)] tracking-tight">Клипание сборок</h2>
            <p className="text-xs text-[var(--ink-2)] mt-0.5">
              Ручной выбор по слотам. Жёлтым отмечены моды с нюансами или слабой отдачей, красным — конфликты и несовместимость.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {MOD_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadCorePreset(preset.id)}
                className="px-3 py-1.5 rounded-md bg-[var(--surface-sub)] hover:bg-[var(--hl-blue-bg)] border border-[var(--border-line)] hover:border-[var(--hl-blue-border)] text-[var(--ink-1)] text-xs font-medium transition-colors whitespace-nowrap"
              >
                {preset.name.split('(')[0].trim()}
              </button>
            ))}

            <button
              type="button"
              onClick={handleFullReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-sub)] hover:bg-[var(--hl-red-bg)] border border-[var(--border-line)] hover:border-[var(--hl-red-border)] text-[var(--ink-1)] hover:text-[var(--hl-red-text)] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сброс
            </button>
          </div>
        </div>

        {/* Color legend + Filter & Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md p-0.5 text-xs"
              role="group"
              aria-label="Секции сборок"
            >
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

            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={slotSearch}
                onChange={e => setSlotSearch(e.target.value)}
                placeholder="Найти слот или мод..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)] focus:bg-[var(--surface-control)]"
              />
            </div>

            <div className="flex flex-wrap items-center bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md p-0.5 text-xs">
              {[
                { k: 'all', label: 'Все слоты', tone: 'neutral' },
                { k: 'selected', label: 'Выбрано', tone: 'neutral' },
                { k: 'yellow', label: 'Жёлтые (нюансы)', tone: 'yellow' },
                { k: 'red', label: 'Красные (конфликт)', tone: 'red' },
              ].map(f => {
                const active = slotFilter === f.k;
                const activeCls =
                  f.tone === 'yellow'
                    ? 'bg-[var(--hl-yellow-pill)] text-[var(--hl-yellow-text)] font-semibold'
                    : f.tone === 'red'
                      ? 'bg-[var(--hl-red-pill)] text-[var(--hl-red-text)] font-semibold'
                      : 'bg-[var(--surface-control)] text-[var(--ink-1)] font-semibold shadow-xs';
                return (
                  <button
                    key={f.k}
                    type="button"
                    onClick={() => setSlotFilter(f.k as SlotFilter)}
                    className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                      active ? activeCls : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md px-1.5 py-0.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-[var(--ink-3)] mr-0.5" />
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
                      ? 'bg-[var(--surface-control)] text-[var(--ink-1)] font-semibold shadow-xs'
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                strictExclusive
                  ? 'bg-[var(--hl-green-bg)] border-[var(--hl-green-border)] text-[var(--hl-green-text)]'
                  : 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)]'
              }`}
            >
              {strictExclusive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {strictExclusive ? '1 мод на слот' : 'Свободный выбор'}
            </button>

            <button
              type="button"
              onClick={() => setHideUselessCovered(v => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap tabular-nums ${
                hideUselessCovered
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
              title="Скрывать плацебо и перекрытые моды"
            >
              {hideUselessCovered ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {hideUselessCovered ? `Скрыты лишние (${uselessOrSupersededSet.size})` : 'Показаны лишние'}
            </button>

            <button
              type="button"
              onClick={() => setHideIncompatible(v => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap tabular-nums ${
                hideIncompatible
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
              title="Скрывать конфликтующие с выбранными модами"
            >
              {hideIncompatible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {hideIncompatible ? `Скрыты конфл. (${incompatibleWithActiveSet.size})` : `Подсветить конфл. (${incompatibleWithActiveSet.size})`}
            </button>
          </div>
        </div>

        {/* Action Feedback Notice */}
        {actionNotice && (
          <div
            className={`rounded-md px-3 py-2 text-xs flex items-center justify-between gap-3 border ${
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

      {/* Main 2-column workbench: Slots Left + Sticky Summary & Plain List Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-5">
          {visibleGroups.length === 0 ? (
            <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg p-8 text-center text-xs text-[var(--ink-2)]">
              По текущему фильтру слоты не найдены.
            </div>
          ) : (
            [
              {
                key: 'optimization',
                title: '01 · Оптимизация',
                subtitle: 'Рендер, память, освещение, тики TPS, чанки, сеть',
                groups: optimizationGroups,
              },
              {
                key: 'recipes',
                title: '02 · JEI / EMI (рецепты)',
                subtitle: 'Просмотрщики рецептов, прослойка TMRV и ускорители крафта',
                groups: recipeGroups,
              },
            ]
              .filter(sec => sec.groups.length > 0)
              .map(sec => (
                <section key={sec.key} className="space-y-3" data-slot-section={sec.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-1)]">{sec.title}</h3>
                      <span className="text-xs font-mono text-[var(--ink-3)] tabular-nums">({sec.groups.length})</span>
                    </div>
                    <span className="text-[11px] text-[var(--ink-2)]">{sec.subtitle}</span>
                  </div>

                  <div className="space-y-3">
                    {sec.groups.map(group => {
                      const addonSet = new Set(group.addonIds);
                      const allMembers = group.memberIds
                        .map(id => modById.get(id))
                        .filter((m): m is ModItem => Boolean(m));
                      const sortedMembers = sortMods(allMembers, group.leaderId, group.addonIds);

                      const q = slotSearch.trim().toLowerCase();
                      const hiddenSupersededInGroupCount = sortedMembers.filter(
                        m => !selectedSet.has(m.id) && uselessOrSupersededSet.has(m.id)
                      ).length;
                      const hiddenIncompatibleInGroupCount = sortedMembers.filter(
                        m =>
                          !selectedSet.has(m.id) &&
                          incompatibleWithActiveSet.has(m.id) &&
                          !(hideUselessCovered && uselessOrSupersededSet.has(m.id))
                      ).length;

                      const primaryMembers = sortedMembers.filter(m => {
                        if (shouldHideMod(m, selectedSet, prefs, { hideIncompatible, hideUselessCovered })) {
                          return false;
                        }
                        const hl = getModHighlight(m);
                        if (slotFilter === 'yellow') return hl.tone === 'yellow';
                        if (slotFilter === 'red') return hl.tone === 'red';
                        if (q && (m.name.toLowerCase().includes(q) || (m.tags && m.tags.some(t => t.toLowerCase().includes(q))))) return true;
                        if (selectedSet.has(m.id)) return true;
                        if (m.id === group.leaderId || addonSet.has(m.id)) return true;
                        return false;
                      });

                      const primaryIdSet = new Set(primaryMembers.map(m => m.id));
                      const extraMembersAll = sortedMembers.filter(m => {
                        if (primaryIdSet.has(m.id)) return false;
                        if (shouldHideMod(m, selectedSet, prefs, { hideIncompatible, hideUselessCovered })) {
                          return false;
                        }
                        return true;
                      });

                      const hiddenCount = extraMembersAll.length;
                      const isExtraOpen = Boolean(expandedGroups[group.id]);
                      const extraSearch = (extraSearchByGroup[group.id] || '').trim().toLowerCase();
                      const extraFilter: ExtraDrawerFilter = extraFilterByGroup[group.id] || 'all';

                      const extraFiltered = extraMembersAll.filter(m => {
                        if (
                          extraSearch &&
                          !m.name.toLowerCase().includes(extraSearch) &&
                          !m.description.toLowerCase().includes(extraSearch) &&
                          !(m.tags && m.tags.some(t => t.toLowerCase().includes(extraSearch)))
                        ) {
                          return false;
                        }
                        const hl = getModHighlight(m);
                        if (extraFilter === 'viable') return hl.tone === 'ok';
                        if (extraFilter === 'caution') return hl.tone === 'yellow';
                        if (extraFilter === 'conflict') return hl.tone === 'red';
                        return true;
                      });

                      const corePoolIds = group.memberIds.filter(id => !addonSet.has(id));
                      const selectedInGroup = group.memberIds.filter(id => selectedSet.has(id));
                      const selectedInCore = corePoolIds.filter(id => selectedSet.has(id));
                      const hasExclusiveConflict = group.exclusive && selectedInCore.length > 1;
                      const isMissingCore = missingSlotGroupIds.has(group.id);

                      return (
                        <div
                          key={group.id}
                          className={`bg-[var(--surface-panel)] backdrop-blur-md border rounded-lg overflow-hidden ${
                            hasExclusiveConflict
                              ? 'border-[var(--hl-red-border)]'
                              : isMissingCore
                                ? 'border-[var(--hl-yellow-border)]'
                                : 'border-[var(--border-line)]'
                          }`}
                        >
                          {/* Slot Header */}
                          <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-sub)]">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                <h4 className="text-sm font-semibold text-[var(--ink-1)]">{group.title}</h4>
                                <span className="text-[11px] text-[var(--ink-2)] tabular-nums">
                                  {group.exclusive ? '1 основа + аддоны' : 'совместимые'}
                                  <span aria-hidden="true"> · </span>
                                  {selectedInGroup.length > 0 ? (
                                    <span className="text-[var(--hl-green-text)] font-semibold">выбрано {selectedInGroup.length}</span>
                                  ) : isMissingCore ? (
                                    <span className="text-[var(--hl-yellow-text)] font-semibold">рекомендуется</span>
                                  ) : (
                                    <span>0 выбрано</span>
                                  )}
                                  {hideIncompatible && hiddenIncompatibleInGroupCount > 0 && (
                                    <>
                                      <span aria-hidden="true"> · </span>
                                      <span className="text-[var(--ink-3)]">скрыто конфл. {hiddenIncompatibleInGroupCount}</span>
                                    </>
                                  )}
                                  {hideUselessCovered && hiddenSupersededInGroupCount > 0 && (
                                    <>
                                      <span aria-hidden="true"> · </span>
                                      <span className="text-[var(--ink-3)]">перекрыто {hiddenSupersededInGroupCount}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--ink-2)] mt-1 leading-relaxed">{group.description}</p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {!selectedSet.has(group.leaderId) && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickSelectSlotLeader(group.id, group.leaderId, group.memberIds)}
                                  className="text-[11px] px-2.5 py-1 rounded bg-[var(--surface-control)] hover:bg-[var(--hl-green-bg)] border border-[var(--border-line)] hover:border-[var(--hl-green-border)] text-[var(--hl-green-text)] font-semibold transition-colors whitespace-nowrap"
                                >
                                  + Лидер
                                </button>
                              )}
                              {selectedInGroup.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleClearSlot(group.memberIds, group.title)}
                                  className="text-[11px] px-2.5 py-1 rounded bg-[var(--surface-control)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors whitespace-nowrap"
                                >
                                  Очистить
                                </button>
                              )}
                              {hiddenCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                                  className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded border font-semibold transition-colors whitespace-nowrap tabular-nums ${
                                    isExtraOpen
                                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                                      : 'bg-[var(--surface-control)] hover:bg-[var(--surface-hover)] border-[var(--border-line)] text-[var(--ink-1)]'
                                  }`}
                                >
                                  <span>{isExtraOpen ? 'Свернуть доп.' : `Доп. (${hiddenCount})`}</span>
                                  {isExtraOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {hasExclusiveConflict && (
                            <div className="mx-4 mt-3 bg-[var(--hl-red-bg)] border border-[var(--hl-red-border)] rounded-md px-3 py-2 text-xs text-[var(--hl-red-text)] flex items-start gap-2">
                              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold">Конфликт внутри слота:</span> выбрано сразу{' '}
                                {selectedInCore.map(id => modById.get(id)?.name).join(' + ')}.{' '}
                                {group.conflictReason || 'Оставьте только 1 вариант.'}
                              </div>
                            </div>
                          )}

                          {/* Expandable Analogues Tray */}
                          {isExtraOpen && extraMembersAll.length > 0 && (
                            <div className="bg-[var(--surface-sub)] border-b border-[var(--border-soft)] p-3 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                  <span className="text-[11px] font-semibold text-[var(--ink-1)] shrink-0">
                                    Аналоги и доп. варианты
                                  </span>
                                  {extraMembersAll.length > 6 && (
                                    <div className="relative w-44 max-w-full">
                                      <Search className="w-3 h-3 text-[var(--ink-3)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                                      <input
                                        type="text"
                                        value={extraSearchByGroup[group.id] || ''}
                                        onChange={e =>
                                          setExtraSearchByGroup(prev => ({ ...prev, [group.id]: e.target.value }))
                                        }
                                        placeholder={`Найти среди ${extraMembersAll.length}...`}
                                        className="w-full pl-7 pr-2 py-1 bg-[var(--surface-control)] border border-[var(--border-line)] rounded text-[11px] text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)]"
                                      />
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center gap-0.5 bg-[var(--surface-control)] border border-[var(--border-line)] rounded p-0.5 text-[11px]">
                                    {[
                                      { k: 'all', label: `Все (${extraMembersAll.length})` },
                                      { k: 'viable', label: 'Чистые' },
                                      { k: 'caution', label: 'Жёлтые' },
                                      { k: 'conflict', label: 'Красные' },
                                    ].map(f => (
                                      <button
                                        key={f.k}
                                        type="button"
                                        onClick={() =>
                                          setExtraFilterByGroup(prev => ({
                                            ...prev,
                                            [group.id]: f.k as ExtraDrawerFilter,
                                          }))
                                        }
                                        className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap tabular-nums ${
                                          extraFilter === f.k
                                            ? 'bg-[var(--accent)] text-white font-semibold'
                                            : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                                        }`}
                                      >
                                        {f.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: false }))}
                                  className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-2)] hover:text-[var(--ink-1)] px-2 py-1 rounded hover:bg-[var(--surface-hover)] whitespace-nowrap"
                                >
                                  <span>Свернуть</span>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {extraFiltered.length === 0 ? (
                                <div className="py-4 text-center text-xs text-[var(--ink-2)]">
                                  По фильтру ничего не найдено.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1">
                                  {extraFiltered.map(mod => {
                                    const isSelected = selectedSet.has(mod.id);
                                    const isAddon = addonSet.has(mod.id);
                                    const isCoreExclusiveItem = group.exclusive && !isAddon;
                                    const hl = getModHighlight(mod, hasExclusiveConflict, isCoreExclusiveItem);

                                    const cardCls =
                                      hl.tone === 'red'
                                        ? 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)]'
                                        : hl.tone === 'yellow'
                                          ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)]'
                                          : isSelected
                                            ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)]'
                                            : 'bg-[var(--surface-control)] border-[var(--border-line)] hover:border-[var(--accent-text)]';

                                    const chipCls =
                                      hl.tone === 'red'
                                        ? 'bg-[var(--hl-red-pill)] text-[var(--hl-red-text)] border-[var(--hl-red-border)]'
                                        : hl.tone === 'yellow'
                                          ? 'bg-[var(--hl-yellow-pill)] text-[var(--hl-yellow-text)] border-[var(--hl-yellow-border)]'
                                          : 'bg-[var(--hl-green-bg)] text-[var(--hl-green-text)] border-[var(--hl-green-border)]';

                                    return (
                                      <div
                                        key={mod.id}
                                        className={`rounded border px-2.5 py-1.5 flex items-center justify-between gap-2 transition-colors ${cardCls}`}
                                      >
                                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                                          <input
                                            type={strictExclusive && isCoreExclusiveItem ? 'radio' : 'checkbox'}
                                            name={strictExclusive && isCoreExclusiveItem ? `group-extra-${group.id}` : undefined}
                                            checked={isSelected}
                                            onChange={() => handleToggleMod(mod)}
                                            className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0"
                                          />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span className="text-[11px] font-semibold text-[var(--ink-1)] truncate">
                                                {mod.name}
                                              </span>
                                              <span className={`text-[9px] font-semibold px-1 py-0.2 rounded border shrink-0 ${chipCls}`}>
                                                {hl.tone === 'red' ? 'Конфл.' : hl.tone === 'yellow' ? 'Нюанс' : 'ОК'}
                                              </span>
                                            </div>
                                            <div
                                              className={`text-[10px] truncate ${
                                                hl.tone === 'red'
                                                  ? 'text-[var(--hl-red-text)]'
                                                  : hl.tone === 'yellow'
                                                    ? 'text-[var(--hl-yellow-text)]'
                                                    : 'text-[var(--ink-2)]'
                                              }`}
                                              title={hl.reason}
                                            >
                                              {hl.tone === 'ok' ? mod.platform : hl.reason}
                                            </div>
                                          </div>
                                        </label>

                                        <button
                                          type="button"
                                          onClick={() => onOpenDetail(mod)}
                                          className="p-1 rounded text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
                                          title="Подробнее"
                                        >
                                          <Info className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Primary Visible Mods List */}
                          <div className="divide-y divide-[var(--border-soft)]">
                            {primaryMembers.map(mod => {
                              const isSelected = selectedSet.has(mod.id);
                              const isLeader = mod.id === group.leaderId;
                              const isAddon = addonSet.has(mod.id);
                              const isCoreExclusiveItem = group.exclusive && !isAddon;
                              const hl = getModHighlight(mod, hasExclusiveConflict, isCoreExclusiveItem);

                              const rowBgCls =
                                hl.tone === 'red'
                                  ? 'bg-[var(--hl-red-bg)] hover:bg-[var(--hl-red-hover)]'
                                  : hl.tone === 'yellow'
                                    ? 'bg-[var(--hl-yellow-bg)] hover:bg-[var(--hl-yellow-hover)]'
                                    : isSelected
                                      ? 'bg-[var(--hl-blue-bg)] hover:bg-[var(--hl-blue-bg)]'
                                      : 'hover:bg-[var(--surface-hover)]';

                              const badgeCls =
                                hl.tone === 'red'
                                  ? 'bg-[var(--hl-red-pill)] text-[var(--hl-red-text)] border-[var(--hl-red-border)]'
                                  : hl.tone === 'yellow'
                                    ? 'bg-[var(--hl-yellow-pill)] text-[var(--hl-yellow-text)] border-[var(--hl-yellow-border)]'
                                    : 'bg-[var(--hl-green-bg)] text-[var(--hl-green-text)] border-[var(--hl-green-border)]';

                              return (
                                <div
                                  key={mod.id}
                                  className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${rowBgCls}`}
                                >
                                  <label className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
                                    <input
                                      type={strictExclusive && isCoreExclusiveItem ? 'radio' : 'checkbox'}
                                      name={strictExclusive && isCoreExclusiveItem ? `group-${group.id}` : undefined}
                                      checked={isSelected}
                                      onChange={() => handleToggleMod(mod)}
                                      className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0 mt-1"
                                    />

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                        <span className="text-[13px] font-semibold text-[var(--ink-1)]">{mod.name}</span>
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeCls}`}>
                                          {hl.label}
                                        </span>
                                        <span className="text-[11px] text-[var(--ink-2)]">
                                          {[
                                            isLeader ? 'Лидер' : isAddon ? 'Аддон' : null,
                                            mod.platform.includes('Sinytra') ? 'Sinytra' : null,
                                          ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </span>
                                      </div>
                                      <p
                                        className={`text-xs truncate mt-0.5 ${
                                          hl.tone === 'red'
                                            ? 'text-[var(--hl-red-text)] font-medium'
                                            : hl.tone === 'yellow'
                                              ? 'text-[var(--hl-yellow-text)] font-medium'
                                              : 'text-[var(--ink-2)]'
                                        }`}
                                        title={hl.reason}
                                      >
                                        {hl.reason}
                                      </p>
                                    </div>
                                  </label>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => onOpenDetail(mod)}
                                      className="p-1.5 rounded text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-[var(--surface-hover)] transition-colors"
                                      title="Подробнее"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                    <a
                                      href={mod.curseforgeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded text-[var(--ink-2)] hover:text-[#E05327] hover:bg-[var(--surface-hover)] transition-colors"
                                      title="CurseForge"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {hiddenCount > 0 && !isExtraOpen && (
                            <button
                              type="button"
                              onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: true }))}
                              className="w-full px-4 py-2 bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border-t border-[var(--border-soft)] text-xs text-[var(--ink-2)] hover:text-[var(--ink-1)] flex items-center justify-between transition-colors"
                            >
                              <span>Показать аналоги и скрытые варианты ({hiddenCount})</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
          )}
        </div>

        {/* Right Sticky Workbench Summary & Plain Text List */}
        <div className="lg:col-span-4 lg:sticky lg:top-[104px] lg:max-h-[calc(100vh-118px)] flex flex-col">
          <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--ink-1)]">Состав сборки</h3>
              <span className="text-xs font-mono font-semibold text-[var(--ink-2)] tabular-nums">
                {summaryCounts.total} модов
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[var(--hl-green-bg)] border border-[var(--hl-green-border)] rounded-md p-2">
                <div className="text-base font-bold font-mono text-[var(--hl-green-text)] tabular-nums">{summaryCounts.ok}</div>
                <div className="text-[10px] font-medium text-[var(--hl-green-text)]">Чистые</div>
              </div>
              <div className="bg-[var(--hl-yellow-bg)] border border-[var(--hl-yellow-border)] rounded-md p-2">
                <div className="text-base font-bold font-mono text-[var(--hl-yellow-text)] tabular-nums">{summaryCounts.yellow}</div>
                <div className="text-[10px] font-medium text-[var(--hl-yellow-text)]">Жёлтые</div>
              </div>
              <div className="bg-[var(--hl-red-bg)] border border-[var(--hl-red-border)] rounded-md p-2">
                <div className="text-base font-bold font-mono text-[var(--hl-red-text)] tabular-nums">{summaryCounts.red}</div>
                <div className="text-[10px] font-medium text-[var(--hl-red-text)]">Красные</div>
              </div>
            </div>

            {analysis.missingCoreSlots.length > 0 && summaryCounts.total > 0 && (
              <div className="p-2.5 rounded-md bg-[var(--hl-yellow-bg)] border border-[var(--hl-yellow-border)] space-y-1.5">
                <div className="text-xs font-semibold text-[var(--hl-yellow-text)] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Пропущены базовые слоты ({analysis.missingCoreSlots.length})
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {analysis.missingCoreSlots.map(slot => (
                    <div key={slot.groupId} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[var(--ink-1)] truncate">{slot.groupTitle}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const res = toggleModSmart(selectedIds, slot.leaderId, { strict: true, prefs });
                          setSelectedIds(res.nextIds);
                        }}
                        className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-[var(--surface-control)] hover:bg-[var(--hl-yellow-pill)] border border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)] font-medium"
                      >
                        <Plus className="w-3 h-3" />
                        {slot.leaderName}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(analysis.conflicts.length > 0 || analysis.warnings.length > 0 || summaryCounts.red > 0) && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {analysis.conflicts.map((c, idx) => (
                  <div key={idx} className="p-2 rounded bg-[var(--hl-red-bg)] border border-[var(--hl-red-border)] text-xs space-y-0.5">
                    <div className="font-semibold text-[var(--hl-red-text)] flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      {c.matchedNames.join(' + ')}
                    </div>
                    <p className="text-[11px] text-[var(--ink-2)]">{c.rule.explanation}</p>
                  </div>
                ))}
                {analysis.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded border text-[11px] flex items-start gap-1.5 ${
                      w.severity === 'red'
                        ? 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)] text-[var(--hl-red-text)]'
                        : 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)]'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleFixIssues}
                  className="w-full py-1.5 px-3 rounded bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors"
                >
                  Исправить конфликты и добрать зависимости
                </button>
              </div>
            )}

            {summaryCounts.total > 0 && analysis.conflicts.length === 0 && analysis.warnings.length === 0 && summaryCounts.red === 0 && (
              <div className="p-2 rounded-md bg-[var(--hl-green-bg)] border border-[var(--hl-green-border)] text-xs text-[var(--hl-green-text)] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Конфликтов нет.
              </div>
            )}

            {/* Selected Mods List */}
            {analysis.selectedMods.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1 border border-[var(--border-soft)] rounded-md p-1.5 bg-[var(--surface-sub)]">
                {analysis.selectedMods.map(mod => {
                  const hl = getModHighlight(mod);
                  const chipCls =
                    hl.tone === 'red'
                      ? 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)] text-[var(--hl-red-text)]'
                      : hl.tone === 'yellow'
                        ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] text-[var(--hl-yellow-text)]'
                        : 'bg-[var(--surface-control)] border-[var(--border-line)] text-[var(--ink-1)]';
                  return (
                    <div
                      key={mod.id}
                      className={`flex items-center justify-between gap-2 px-2 py-1 rounded border text-xs ${chipCls}`}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenDetail(mod)}
                        className="truncate text-left font-medium hover:underline"
                      >
                        {mod.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleMod(mod)}
                        className="p-0.5 rounded hover:bg-[var(--surface-hover)] shrink-0"
                        title={`Убрать ${mod.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-md bg-[var(--surface-sub)] border border-[var(--border-line)] text-xs text-[var(--ink-2)]">
                Список пуст. Отметьте моды слева или выберите базовую сборку сверху.
              </div>
            )}

            {/* Plain-text names list preview + copy */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-soft)]">
              <div className="flex items-center justify-between text-[11px] text-[var(--ink-2)]">
                <span className="font-semibold text-[var(--ink-1)]">Текстовый список названий</span>
                <span className="font-mono tabular-nums">{summaryCounts.total} строк</span>
              </div>
              <textarea
                readOnly
                value={plainNamesListText}
                onFocus={e => e.currentTarget.select()}
                rows={3}
                placeholder="Названия выбранных модов..."
                aria-label="Список названий выбранных модов"
                className="w-full rounded-md border border-[var(--border-line)] bg-[var(--surface-sub)] p-2 text-[11px] font-mono text-[var(--ink-1)] placeholder:text-[var(--ink-3)] leading-relaxed resize-none"
              />
              <button
                type="button"
                onClick={handleCopyPlainList}
                disabled={summaryCounts.total === 0}
                className="w-full py-2 px-3 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Список скопирован' : 'Скопировать списком'}
              </button>
              <button
                type="button"
                onClick={() => onSendToChecker(selectedIds)}
                disabled={summaryCounts.total === 0}
                className="w-full py-2 px-3 rounded-md bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-1)] text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
              >
                Открыть в Чекере
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
