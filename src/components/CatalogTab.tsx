import { Fragment, useMemo, useState, useEffect } from 'react';
import {
  MODS_DATABASE,
  MOD_GROUPS,
  type ModItem,
} from '../data/modsData.ts';
import {
  getBaseHealthTier,
  getDualPortPairForMod,
  getGroupMembersByRole,
  getModEffectivenessScore,
  getModRestrictionBadge,
  getModSuperseder,
  getModUpdatedLabel,
  isModIncompatibleWithSelection,
  isUnsupportedOnForge,
  searchModsByQuery,
  type AssemblyPreferences,
  type CheckerTier,
} from '../utils/modLogic.ts';
import {
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Search,
} from 'lucide-react';

type HealthFilter = 'all' | CheckerTier;
type CatalogSort = 'leaders-first' | 'best-first' | 'name-asc';

interface CatalogTabProps {
  checkedModIds: string[];
  toggleCheckerMod: (id: string) => void;
  builderSet: Set<string>;
  builderPrefs: AssemblyPreferences;
  showDescriptions: boolean;
}

export function CatalogTab({
  checkedModIds,
  toggleCheckerMod,
  builderSet,
  builderPrefs,
  showDescriptions,
}: CatalogTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [onlyLeaders, setOnlyLeaders] = useState(true);
  const [hideUselessCovered, setHideUselessCovered] = useState(true);
  const [onlyCompatibleInCatalog, setOnlyCompatibleInCatalog] = useState(false);
  const [sortBy, setSortBy] = useState<CatalogSort>('leaders-first');
  const [itemsPerPage, setItemsPerPage] = useState<number>(36);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedModId, setExpandedModId] = useState<string | null>(null);
  const [expandedAnalogsByMod, setExpandedAnalogsByMod] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCurrentPage(1);
    setExpandedModId(null);
  }, [searchQuery, selectedCategory, healthFilter, onlyLeaders, hideUselessCovered, onlyCompatibleInCatalog, sortBy]);

  const groupMetaMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getGroupMembersByRole>>();
    MOD_GROUPS.forEach(g => {
      map.set(g.id, getGroupMembersByRole(g.id));
    });
    return map;
  }, []);

  const modById = useMemo(() => new Map(MODS_DATABASE.map(m => [m.id, m])), []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    MODS_DATABASE.forEach(m => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });
    return ['Все', ...Object.keys(counts)];
  }, []);

  const filteredMods = useMemo(() => {
    const q = searchQuery.trim();
    const baseList = q ? searchModsByQuery(q, MODS_DATABASE.length) : MODS_DATABASE;

    const list = baseList.filter(mod => {
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
      }

      return true;
    });

    if (q) return list;

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

  const getVisualTier = (mod: ModItem): CheckerTier => {
    const base = getBaseHealthTier(mod);
    const incompatible = isModIncompatibleWithSelection(mod, builderSet, builderPrefs);
    const restriction = getModRestrictionBadge(mod, builderSet, builderPrefs);
    if (base === 'red' || incompatible || restriction?.tone === 'red') return 'red';
    if (base === 'yellow' || Boolean(mod.coveredBy) || restriction?.tone === 'amber') return 'yellow';
    return base;
  };

  return (
    <div className="space-y-4">
      <div className="ui-block p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, назначению или аналогу..."
              className="w-full pl-9 pr-3 py-1.5 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control text-xs text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent-text)]"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Категория модов"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control text-xs text-[var(--ink-1)] focus:border-[var(--accent-text)]"
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
              className="w-full px-3 py-1.5 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control text-xs text-[var(--ink-1)] focus:border-[var(--accent-text)]"
            >
              <option value="all" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Любой статус</option>
              <option value="green" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Зелёный</option>
              <option value="lime" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Светло-зелёный</option>
              <option value="yellow" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Жёлтый</option>
              <option value="red" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Красный</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Сортировка модов"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as CatalogSort)}
              className="w-full px-3 py-1.5 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control text-xs text-[var(--ink-1)] focus:border-[var(--accent-text)]"
            >
              <option value="leaders-first" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">Сначала лидеры</option>
              <option value="best-first" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">По эффективности</option>
              <option value="name-asc" className="bg-[var(--surface-solid)] text-[var(--ink-1)]">По алфавиту</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-[var(--border-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyLeaders(v => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 ui-control text-xs font-medium border transition-colors whitespace-nowrap ${
                onlyLeaders
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
            >
              <Award className={`w-3.5 h-3.5 ${onlyLeaders ? 'text-[var(--accent-text)]' : 'text-[var(--ink-3)]'}`} />
              Только лидеры
            </button>

            <button
              type="button"
              onClick={() => setHideUselessCovered(v => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 ui-control text-xs font-medium border transition-colors whitespace-nowrap ${
                hideUselessCovered
                  ? 'bg-[var(--hl-green-bg)] border-[var(--hl-green-border)] text-[var(--hl-green-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
            >
              {hideUselessCovered ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              Скрыть лишние
            </button>

            <button
              type="button"
              onClick={() => setOnlyCompatibleInCatalog(v => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 ui-control text-xs font-medium border transition-colors whitespace-nowrap ${
                onlyCompatibleInCatalog
                  ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                  : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
              }`}
            >
              {onlyCompatibleInCatalog ? <EyeOff className="w-3.5 h-3.5 text-[var(--accent-text)]" /> : <Eye className="w-3.5 h-3.5" />}
              Совм. со сборкой
            </button>
          </div>

          <span className="text-xs text-[var(--ink-2)] tabular-nums">
            Найдено: <strong className="text-[var(--ink-1)] font-mono">{filteredMods.length}</strong>
          </span>
        </div>
      </div>

      {/* Expandable Table Catalog */}
      <div className="ui-block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border-line)] text-[var(--ink-2)] bg-[var(--surface-sub)]">
              <th className="py-2.5 pl-4 pr-2 font-semibold w-8"></th>
              <th className="py-2.5 px-3 font-semibold">Мод</th>
              <th className="py-2.5 px-3 font-semibold">Группа / Назначение</th>
              <th className="py-2.5 px-3 font-semibold hidden md:table-cell">Платформа</th>
              <th className="py-2.5 px-3 font-semibold hidden sm:table-cell">Связи</th>
              <th className="py-2.5 px-4 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {paginatedMods.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--ink-2)]">
                  Моды по фильтру не найдены.
                </td>
              </tr>
            ) : (
              paginatedMods.map(mod => {
                const isExpanded = expandedModId === mod.id;
                const isSelected = checkedModIds.includes(mod.id);
                const tier = getVisualTier(mod);
                const grp = mod.groupId ? groupMetaMap.get(mod.groupId) : null;
                const addons = grp ? grp.addons : [];
                const removedAnalogs = grp ? grp.removedAnalogs : [];
                const updated = getModUpdatedLabel(mod);
                const restriction = getModRestrictionBadge(mod, builderSet, builderPrefs);
                const dualPair = isExpanded ? getDualPortPairForMod(mod.id) : null;
                const analogsOpen = Boolean(expandedAnalogsByMod[mod.id]);

                return (
                  <Fragment key={mod.id}>
                    <tr
                      onClick={() => setExpandedModId(isExpanded ? null : mod.id)}
                      data-active={isSelected ? 'true' : 'false'}
                      data-status={tier}
                      className="mod-row cursor-pointer"
                    >
                      <td className="pl-4 pr-1 text-[var(--ink-3)]">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[var(--accent-text)]" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-3">
                        <div className="font-semibold text-[var(--ink-1)] text-[13px]">{mod.name}</div>
                        {showDescriptions && (
                          <div className="text-[11px] text-[var(--ink-2)] line-clamp-1 mt-0.5">
                            {mod.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 text-[var(--ink-2)]">
                        <div>{mod.groupTitle || mod.category}</div>
                        {restriction && (restriction.tone === 'red' || restriction.tone === 'amber') && (
                          <div
                            className={`text-[10px] font-medium ${
                              restriction.tone === 'red'
                                ? 'text-[var(--hl-red-text)]'
                                : 'text-[var(--hl-yellow-text)]'
                            }`}
                          >
                            {restriction.text}
                          </div>
                        )}
                      </td>
                      <td className="px-3 text-[var(--ink-2)] hidden md:table-cell whitespace-nowrap">
                        {mod.platform}
                        {updated && <span className="text-[var(--ink-3)] font-mono ml-1.5">· {updated}</span>}
                      </td>
                      <td className="px-3 text-[var(--ink-2)] hidden sm:table-cell tabular-nums whitespace-nowrap">
                        {addons.length > 0 ? `+${addons.length} адд.` : mod.coveredBy ? `в ${mod.coveredBy}` : '—'}
                      </td>
                      <td className="px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleCheckerMod(mod.id);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 ui-control text-[11px] font-medium border transition-colors ${
                              isSelected
                                ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)]'
                                : 'bg-[var(--surface-control)] border-[var(--border-line)] text-[var(--ink-1)] hover:bg-[var(--surface-hover)]'
                            }`}
                          >
                            {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            {isSelected ? 'В сборке' : 'Добавить'}
                          </button>
                          <a
                            href={mod.curseforgeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 ui-control text-[var(--ink-3)] hover:text-[#E05327] hover:bg-[var(--surface-hover)] transition-colors"
                            title="CurseForge"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[var(--surface-sub)]/70">
                        <td colSpan={6} className="px-6 py-4 border-t border-[var(--border-soft)]">
                          <div className="space-y-3">
                            <p className="text-xs text-[var(--ink-1)] leading-relaxed">{mod.description}</p>

                            {mod.warning && (
                              <div className="text-xs text-[var(--hl-yellow-text)] bg-[var(--hl-yellow-bg)] border border-[var(--hl-yellow-border)] ui-control px-3 py-2">
                                <strong>Важно:</strong> {mod.warning}
                              </div>
                            )}

                            {mod.bestAlternative && (
                              <div className="text-xs text-[var(--hl-green-text)] bg-[var(--hl-green-bg)] border border-[var(--hl-green-border)] ui-control px-3 py-2">
                                <strong>Рекомендация:</strong> {mod.bestAlternative}
                              </div>
                            )}

                            {dualPair && (
                              <div className="text-xs text-[var(--ink-2)] bg-[var(--surface-solid)] border border-[var(--border-line)] ui-control px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  <strong className="text-[var(--ink-1)]">Реализации:</strong>{' '}
                                  {modById.get(dualPair.forgeModId)?.name} (Forge) ↔{' '}
                                  {modById.get(dualPair.fabricModId)?.name}
                                </span>
                              </div>
                            )}

                            {addons.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-semibold text-[var(--ink-2)]">
                                  Аддоны ({addons.length}):
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                  {addons.map(ad => {
                                    const adInBuild = checkedModIds.includes(ad.id);
                                    const adTier = getVisualTier(ad);
                                    return (
                                      <div
                                        key={ad.id}
                                        data-active={adInBuild ? 'true' : 'false'}
                                        data-status={adTier}
                                        className="mod-row ui-control bg-[var(--surface-solid)] border border-[var(--border-soft)] px-2.5 flex items-center justify-between gap-2"
                                      >
                                        <span className="text-xs font-medium text-[var(--ink-1)] truncate">
                                          {ad.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => toggleCheckerMod(ad.id)}
                                          className="text-[11px] px-2 py-0.5 ui-control border border-[var(--border-line)] bg-[var(--surface-control)] hover:bg-[var(--surface-hover)] text-[var(--ink-1)] shrink-0"
                                        >
                                          {adInBuild ? 'Убрать' : '+ Добавить'}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {removedAnalogs.length > 0 && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedAnalogsByMod(prev => ({ ...prev, [mod.id]: !analogsOpen }))
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                                >
                                  {analogsOpen ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {analogsOpen
                                      ? 'Скрыть несовместимые / аналоги'
                                      : `Показать несовместимые и аналоги (${removedAnalogs.length})`}
                                  </span>
                                </button>

                                {analogsOpen && (
                                  <div className="mt-2 divide-y divide-[var(--border-soft)] border border-[var(--border-line)] ui-control overflow-hidden bg-[var(--surface-solid)]">
                                    {removedAnalogs.map(alt => (
                                      <div
                                        key={alt.id}
                                        data-active={checkedModIds.includes(alt.id) ? 'true' : 'false'}
                                        data-status={getVisualTier(alt)}
                                        className="mod-row px-3 flex items-center justify-between gap-3"
                                      >
                                        <div className="min-w-0">
                                          <div className="text-xs font-semibold text-[var(--ink-1)]">{alt.name}</div>
                                          <div className="text-[11px] text-[var(--ink-2)] truncate">
                                            {alt.bestAlternative || alt.warning || alt.description}
                                          </div>
                                        </div>
                                        <a
                                          href={alt.curseforgeUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 text-[var(--ink-3)] hover:text-[#E05327] shrink-0"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]">
            <span>На странице:</span>
            {[24, 36, 72, 500].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setItemsPerPage(n);
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 ui-control border tabular-nums transition-colors ${
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
              className="px-3 py-1 ui-control bg-[var(--surface-panel)] border border-[var(--border-line)] text-[var(--ink-1)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
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
              className="px-3 py-1 ui-control bg-[var(--surface-panel)] border border-[var(--border-line)] text-[var(--ink-1)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
