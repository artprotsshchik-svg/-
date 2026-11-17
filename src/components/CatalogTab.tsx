import { useMemo, useState, useEffect } from 'react';
import {
  MODS_DATABASE,
  MOD_GROUPS,
  type ModItem,
} from '../data/modsData.ts';
import {
  getBaseHealthTier,
  getGroupMembersByRole,
  getModEffectivenessScore,
  getModRestrictionBadge,
  getModSuperseder,
  getModUpdatedLabel,
  isModIncompatibleWithSelection,
  isUnsupportedOnForge,
  type AssemblyPreferences,
  type CheckerTier,
} from '../utils/modLogic.ts';
import {
  Award,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Grid,
  Layers,
  List,
  PackageCheck,
  Plus,
  Search,
  Table,
} from 'lucide-react';

type CatalogView = 'cards' | 'list' | 'table';
type HealthFilter = 'all' | CheckerTier;
type CatalogSort = 'leaders-first' | 'best-first' | 'name-asc';

interface CatalogTabProps {
  checkedModIds: string[];
  toggleCheckerMod: (id: string) => void;
  builderSet: Set<string>;
  builderPrefs: AssemblyPreferences;
  onOpenDetail: (mod: ModItem) => void;
}

export function getHealthBadge(mod: ModItem) {
  const tier = getBaseHealthTier(mod);
  if (tier === 'red') {
    return {
      cls: 'bg-[var(--hl-red-pill)] text-[var(--hl-red-text)] border-[var(--hl-red-border)]',
      textCls: 'text-[var(--hl-red-text)]',
      text: mod.statusLabel,
    };
  }
  if (tier === 'green') {
    return {
      cls: 'bg-[var(--hl-green-bg)] text-[var(--hl-green-text)] border-[var(--hl-green-border)]',
      textCls: 'text-[var(--hl-green-text)]',
      text: mod.statusLabel,
    };
  }
  if (tier === 'lime') {
    return {
      cls: 'bg-[var(--hl-lime-bg)] text-[var(--hl-lime-text)] border-[var(--hl-lime-border)]',
      textCls: 'text-[var(--hl-lime-text)]',
      text: mod.statusLabel,
    };
  }
  return {
    cls: 'bg-[var(--hl-yellow-pill)] text-[var(--hl-yellow-text)] border-[var(--hl-yellow-border)]',
    textCls: 'text-[var(--hl-yellow-text)]',
    text: mod.statusLabel,
  };
}

export function CatalogTab({
  checkedModIds,
  toggleCheckerMod,
  builderSet,
  builderPrefs,
  onOpenDetail,
}: CatalogTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [onlyLeaders, setOnlyLeaders] = useState(true);
  const [hideUselessCovered, setHideUselessCovered] = useState(true);
  const [onlyCompatibleInCatalog, setOnlyCompatibleInCatalog] = useState(false);
  const [catalogView, setCatalogView] = useState<CatalogView>('cards');
  const [sortBy, setSortBy] = useState<CatalogSort>('leaders-first');
  const [itemsPerPage, setItemsPerPage] = useState<number>(36);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, healthFilter, onlyLeaders, hideUselessCovered, onlyCompatibleInCatalog, sortBy]);

  const groupMetaMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getGroupMembersByRole>>();
    MOD_GROUPS.forEach(g => {
      map.set(g.id, getGroupMembersByRole(g.id));
    });
    return map;
  }, []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    MODS_DATABASE.forEach(m => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });
    return ['Все', ...Object.keys(counts)];
  }, []);

  const filteredMods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = MODS_DATABASE.filter(mod => {
      if (selectedCategory !== 'Все' && mod.category !== selectedCategory) return false;

      const modHealth = getBaseHealthTier(mod);
      if (healthFilter !== 'all' && modHealth !== healthFilter) return false;

      if (onlyCompatibleInCatalog && isModIncompatibleWithSelection(mod, builderSet, builderPrefs)) {
        return false;
      }

      if (!q) {
        if (
          hideUselessCovered &&
          (mod.coveredBy ||
            mod.status === 'danger' ||
            isUnsupportedOnForge(mod) ||
            getModSuperseder(mod, builderSet, builderPrefs, true) !== null)
        ) {
          return false;
        }
        if (onlyLeaders && mod.groupId && !mod.isGroupLeader) {
          return false;
        }
      } else {
        const matches =
          mod.name.toLowerCase().includes(q) ||
          mod.description.toLowerCase().includes(q) ||
          (mod.bestAlternative && mod.bestAlternative.toLowerCase().includes(q)) ||
          mod.category.toLowerCase().includes(q) ||
          mod.platform.toLowerCase().includes(q) ||
          (mod.tags && mod.tags.some(t => t.toLowerCase().includes(q)));
        if (!matches) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'ru');
      if (sortBy === 'leaders-first') {
        const lA = a.isGroupLeader ? 1 : 0;
        const lB = b.isGroupLeader ? 1 : 0;
        if (lB !== lA) return lB - lA;
      }
      return getModEffectivenessScore(b) - getModEffectivenessScore(a);
    });
  }, [searchQuery, selectedCategory, healthFilter, onlyLeaders, hideUselessCovered, onlyCompatibleInCatalog, builderSet, builderPrefs, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredMods.length / itemsPerPage));
  const paginatedMods = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMods.slice(start, start + itemsPerPage);
  }, [filteredMods, currentPage, itemsPerPage]);

  const getVisualTone = (mod: ModItem) => {
    const base = getBaseHealthTier(mod);
    const incompatible = isModIncompatibleWithSelection(mod, builderSet, builderPrefs);
    const restriction = getModRestrictionBadge(mod, builderSet, builderPrefs);
    if (base === 'red' || incompatible || restriction?.tone === 'red') return 'red' as const;
    if (base === 'yellow' || Boolean(mod.coveredBy) || restriction?.tone === 'amber') return 'yellow' as const;
    return 'normal' as const;
  };

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, описанию или аналогу..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)] focus:bg-[var(--surface-control)] transition-colors"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Категория модов"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md text-xs text-[var(--ink-1)] focus:border-[var(--accent-text)] transition-colors"
            >
              {categories.map(c => (
                <option key={c} value={c} className="bg-[var(--surface-solid)] text-[var(--ink-1)]">
                  {c === 'Все' ? 'Все категории' : c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Статус модов"
              value={healthFilter}
              onChange={e => setHealthFilter(e.target.value as HealthFilter)}
              className="w-full px-3 py-2 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md text-xs text-[var(--ink-1)] focus:border-[var(--accent-text)] transition-colors"
            >
              <option value="all" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Любой статус</option>
              <option value="green" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Стабильно (зелёный)</option>
              <option value="lime" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Сносно (норма)</option>
              <option value="yellow" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Так себе (жёлтый)</option>
              <option value="red" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Конфликт / опасно (красный)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Сортировка модов"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as CatalogSort)}
              className="w-full px-3 py-2 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md text-xs text-[var(--ink-1)] focus:border-[var(--accent-text)] transition-colors"
            >
              <option value="leaders-first" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Сначала лидеры</option>
              <option value="best-first" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">По эффективности</option>
              <option value="name-asc" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">По алфавиту</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyLeaders(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                onlyLeaders
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
            >
              <Award className={`w-3.5 h-3.5 ${onlyLeaders ? 'text-[var(--accent-text)]' : 'text-[var(--ink-3)]'}`} />
              Только лидеры групп
            </button>

            <button
              type="button"
              onClick={() => setHideUselessCovered(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                hideUselessCovered
                  ? 'bg-[var(--hl-green-bg)] border-[var(--hl-green-border)] text-[var(--hl-green-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
              title="Скрывать плацебо, нерабочие на Forge, встроенные и полностью перекрытые моды"
            >
              {hideUselessCovered ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              Скрыть лишние и перекрытые
            </button>

            <button
              type="button"
              onClick={() => setOnlyCompatibleInCatalog(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                onlyCompatibleInCatalog
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
              title="Показывать только моды, совместимые с текущей активной сборкой"
            >
              {onlyCompatibleInCatalog ? <EyeOff className="w-3.5 h-3.5 text-[var(--accent-text)]" /> : <Eye className="w-3.5 h-3.5" />}
              Совм. со сборкой
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--ink-2)] tabular-nums">
              Показано: <strong className="text-[var(--ink-1)] font-mono">{filteredMods.length}</strong>
            </span>
            <div className="flex items-center bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md p-0.5">
              {[
                { k: 'cards', icon: Grid, title: 'Карточки' },
                { k: 'list', icon: List, title: 'Список' },
                { k: 'table', icon: Table, title: 'Таблица' },
              ].map(v => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.k}
                    type="button"
                    onClick={() => setCatalogView(v.k as CatalogView)}
                    className={`p-1.5 rounded transition-colors ${
                      catalogView === v.k
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                    }`}
                    title={v.title}
                    aria-label={v.title}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {catalogView === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {paginatedMods.map(mod => {
            const badge = getHealthBadge(mod);
            const grp = mod.groupId ? groupMetaMap.get(mod.groupId) : null;
            const addons = mod.isGroupLeader && grp ? grp.addons : [];
            const removedCount = mod.isGroupLeader && grp ? grp.removedAnalogs.length : 0;
            const isInChecker = checkedModIds.includes(mod.id);
            const updated = getModUpdatedLabel(mod);
            const restriction = getModRestrictionBadge(mod, builderSet, builderPrefs);
            const tone = getVisualTone(mod);

            const cardCls =
              tone === 'red'
                ? 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)] hover:bg-[var(--hl-red-hover)]'
                : tone === 'yellow'
                  ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)] hover:bg-[var(--hl-yellow-hover)]'
                  : 'bg-[var(--surface-panel)] backdrop-blur-md border-[var(--border-line)] hover:border-[var(--accent-text)]';

            return (
              <div
                key={mod.id}
                onClick={() => onOpenDetail(mod)}
                className={`border rounded-lg p-4 cursor-pointer transition-colors flex flex-col justify-between gap-3 ${cardCls}`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[var(--ink-1)] truncate">{mod.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--ink-2)] min-w-0">
                        <span className="truncate">{mod.groupTitle || mod.category} · {mod.platform}</span>
                        {updated && (
                          <span className="shrink-0 font-mono text-[var(--ink-3)]">· обн. {updated}</span>
                        )}
                      </div>
                    </div>

                    <a
                      href={mod.curseforgeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface-control)] hover:bg-[#E05327] border border-[var(--border-line)] hover:border-[#E05327] text-[var(--ink-1)] hover:text-white text-[11px] font-medium transition-colors"
                      title="Открыть на CurseForge"
                    >
                      CF
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-xs text-[var(--ink-2)] leading-relaxed line-clamp-3">
                    {mod.description}
                  </p>

                  {addons.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <div className="text-[11px] font-medium text-[var(--ink-2)]">
                        Аддоны ({addons.length}):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {addons.slice(0, 5).map(ad => (
                          <button
                            key={ad.id}
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onOpenDetail(ad);
                            }}
                            className="px-2 py-0.5 rounded bg-[var(--surface-sub)] hover:bg-[var(--hl-blue-bg)] border border-[var(--border-line)] text-[11px] text-[var(--accent-text)] font-medium transition-colors"
                          >
                            {ad.name}
                          </button>
                        ))}
                        {addons.length > 5 && (
                          <span className="text-[11px] text-[var(--ink-3)] px-1">+{addons.length - 5}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-[var(--border-soft)] flex items-center justify-between gap-2">
                  <span className="text-[11px] truncate">
                    {restriction && (restriction.tone === 'red' || restriction.tone === 'amber') ? (
                      <span className={`font-semibold ${restriction.tone === 'red' ? 'text-[var(--hl-red-text)]' : 'text-[var(--hl-yellow-text)]'}`}>
                        {restriction.text}
                      </span>
                    ) : removedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[var(--ink-2)]">
                        <Layers className="w-3 h-3 text-[var(--hl-yellow-text)] shrink-0" />
                        +{removedCount} аналогов внутри
                      </span>
                    ) : mod.coveredBy ? (
                      <span className="inline-flex items-center gap-1 text-[var(--hl-yellow-text)] font-medium">
                        <PackageCheck className="w-3 h-3 shrink-0" />
                        Встроено в {mod.coveredBy}
                      </span>
                    ) : restriction?.tone === 'sky' ? (
                      <span className="font-medium text-[var(--accent-text)]">{restriction.text}</span>
                    ) : (
                      <span className={`font-semibold ${badge.textCls}`}>{badge.text}</span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      toggleCheckerMod(mod.id);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      isInChecker
                        ? 'bg-[var(--hl-green-bg)] border-[var(--hl-green-border)] text-[var(--hl-green-text)]'
                        : 'bg-[var(--surface-control)] border-[var(--border-line)] text-[var(--ink-1)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {isInChecker ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {isInChecker ? 'В Чекере' : 'В Чекер'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {catalogView === 'list' && (
        <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg divide-y divide-[var(--border-soft)] overflow-hidden">
          {paginatedMods.map(mod => {
            const badge = getHealthBadge(mod);
            const grp = mod.groupId ? groupMetaMap.get(mod.groupId) : null;
            const removedCount = mod.isGroupLeader && grp ? grp.removedAnalogs.length : 0;
            const addonsCount = mod.isGroupLeader && grp ? grp.addons.length : 0;
            const updated = getModUpdatedLabel(mod);
            const tone = getVisualTone(mod);

            const rowCls =
              tone === 'red'
                ? 'bg-[var(--hl-red-bg)] hover:bg-[var(--hl-red-hover)]'
                : tone === 'yellow'
                  ? 'bg-[var(--hl-yellow-bg)] hover:bg-[var(--hl-yellow-hover)]'
                  : 'hover:bg-[var(--surface-hover)]';

            return (
              <div
                key={mod.id}
                onClick={() => onOpenDetail(mod)}
                className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between gap-4 ${rowCls}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-[var(--ink-1)]">{mod.name}</span>
                    <span className={`text-[11px] font-semibold ${badge.textCls}`}>{badge.text}</span>
                    <span className="text-[11px] text-[var(--ink-2)]">{mod.platform}</span>
                    {updated && <span className="text-[11px] text-[var(--ink-3)] font-mono">· обн. {updated}</span>}
                    {addonsCount > 0 && <span className="text-[11px] text-[var(--accent-text)] font-medium">+{addonsCount} аддонов</span>}
                    {removedCount > 0 && <span className="text-[11px] text-[var(--ink-2)]">· {removedCount} аналогов внутри</span>}
                  </div>
                  <p className="text-xs text-[var(--ink-2)] mt-0.5 truncate">{mod.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={mod.curseforgeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--surface-control)] hover:bg-[#E05327] border border-[var(--border-line)] hover:border-[#E05327] text-[var(--ink-1)] hover:text-white text-xs transition-colors"
                  >
                    CurseForge
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {catalogView === 'table' && (
        <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-line)] text-[var(--ink-2)] bg-[var(--surface-sub)]">
                <th className="py-2.5 px-4 font-semibold">Мод</th>
                <th className="py-2.5 px-4 font-semibold">Группа / Категория</th>
                <th className="py-2.5 px-4 font-semibold">Статус</th>
                <th className="py-2.5 px-4 font-semibold">Аддоны / Аналоги</th>
                <th className="py-2.5 px-4 font-semibold text-right">CurseForge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {paginatedMods.map(mod => {
                const badge = getHealthBadge(mod);
                const grp = mod.groupId ? groupMetaMap.get(mod.groupId) : null;
                const tone = getVisualTone(mod);
                const trCls =
                  tone === 'red'
                    ? 'bg-[var(--hl-red-bg)] hover:bg-[var(--hl-red-hover)]'
                    : tone === 'yellow'
                      ? 'bg-[var(--hl-yellow-bg)] hover:bg-[var(--hl-yellow-hover)]'
                      : 'hover:bg-[var(--surface-hover)]';
                return (
                  <tr
                    key={mod.id}
                    onClick={() => onOpenDetail(mod)}
                    className={`cursor-pointer transition-colors ${trCls}`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-[var(--ink-1)]">{mod.name}</td>
                    <td className="py-2.5 px-4 text-[var(--ink-2)]">{mod.groupTitle || mod.category}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[var(--ink-2)] tabular-nums">
                      {mod.isGroupLeader && grp
                        ? `${grp.addons.length} аддонов / ${grp.removedAnalogs.length} скрыто`
                        : mod.coveredBy
                          ? `Встроено в ${mod.coveredBy}`
                          : mod.platform}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <a
                        href={mod.curseforgeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[#E05327] hover:underline font-medium"
                      >
                        Открыть <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2 text-xs text-[var(--ink-2)]">
            <span>На странице:</span>
            {[24, 36, 72, 500].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setItemsPerPage(n);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded border tabular-nums transition-colors ${
                  itemsPerPage === n
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold'
                    : 'bg-[var(--surface-panel)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                {n === 500 ? 'Все' : n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1.5 rounded bg-[var(--surface-panel)] border border-[var(--border-line)] text-[var(--ink-1)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors"
            >
              Назад
            </button>
            <span className="px-2 text-[var(--ink-2)] tabular-nums font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1.5 rounded bg-[var(--surface-panel)] border border-[var(--border-line)] text-[var(--ink-1)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
