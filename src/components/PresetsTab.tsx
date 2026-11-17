import { useState } from 'react';
import {
  MOD_PRESETS,
  type ModItem,
  type ModPreset,
} from '../data/modsData.ts';
import {
  evaluateAssemblyHealth,
  getBaseHealthTier,
  getModUpdatedLabel,
  organizeAssemblyTree,
} from '../utils/modLogic.ts';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Wrench,
} from 'lucide-react';

interface PresetsTabProps {
  dbUpdatedAt: string;
  lastSavedDate: string;
  onLoadToChecker: (preset: ModPreset) => void;
  onLoadToBuilder: (preset: ModPreset) => void;
  onOpenDetail: (mod: ModItem) => void;
}

export function PresetsTab({
  dbUpdatedAt,
  lastSavedDate,
  onLoadToChecker,
  onLoadToBuilder,
  onOpenDetail,
}: PresetsTabProps) {
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      <div className="ui-block p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--ink-1)] tracking-tight">
            Основные сборки ({MOD_PRESETS.length})
          </h2>
          <p className="text-xs text-[var(--ink-2)] mt-0.5">
            Две проверенные связки: Nvidium + Emberbium и чистый Forge (Alloyium + Embeddium). Копирование и импорт списком — в «Чекере».
          </p>
        </div>
        <span className="px-2.5 py-1 ui-control bg-[var(--surface-sub)] border border-[var(--border-soft)] text-[11px] font-mono text-[var(--ink-2)] tabular-nums whitespace-nowrap">
          База: {dbUpdatedAt} · Сохранено: {lastSavedDate}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {MOD_PRESETS.map(preset => {
          const treeNodes = organizeAssemblyTree(preset.modIds);
          const parentWithAddons = treeNodes.filter(n => n.children.length > 0);
          const standaloneRoots = treeNodes.filter(n => n.children.length === 0);

          const presetHealth = evaluateAssemblyHealth(preset.modIds);
          const presetRedCount =
            presetHealth.conflicts.length +
            presetHealth.warnings.filter(w => w.severity === 'red').length;
          const presetYellowCount = presetHealth.warnings.filter(w => w.severity === 'yellow').length;

          const badgeCls =
            preset.badgeColor === 'emerald'
              ? 'bg-[var(--hl-green-bg)] text-[var(--hl-green-text)] border-[var(--hl-green-border)]'
              : 'bg-[var(--hl-blue-bg)] text-[var(--hl-blue-text)] border-[var(--hl-blue-border)]';

          return (
            <div key={preset.id} className="ui-block p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-[var(--ink-1)] leading-snug">{preset.name}</h3>
                  <span className={`px-2 py-0.5 ui-control text-[11px] font-semibold border whitespace-nowrap ${badgeCls}`}>
                    {preset.badge}
                  </span>
                </div>

                <p className="text-xs text-[var(--ink-2)] leading-relaxed">{preset.description}</p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-2)] bg-[var(--surface-sub)] border border-[var(--border-soft)] ui-control px-3 py-2">
                  <span>
                    <strong className="text-[var(--ink-1)]">Условия:</strong> {preset.crashRisk}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      presetRedCount > 0
                        ? 'text-[var(--hl-red-text)]'
                        : presetYellowCount > 0
                          ? 'text-[var(--hl-yellow-text)]'
                          : 'text-[var(--hl-green-text)]'
                    }`}
                  >
                    · {preset.modIds.length} модов ({presetRedCount} конфл.)
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-soft)] border border-[var(--border-soft)] ui-control overflow-hidden">
                  {parentWithAddons.map((node, idx) => {
                    const pUpdated = getModUpdatedLabel(node.parent);
                    const pTier = getBaseHealthTier(node.parent);
                    const key = `${preset.id}:${node.parent.id}`;
                    const isCollapsed = Boolean(collapsedParents[key]);

                    return (
                      <div key={node.parent.id}>
                        <div
                          data-active="true"
                          data-status={pTier}
                          className="mod-row px-3 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-mono text-[var(--ink-3)] tabular-nums">
                              {idx + 1}.
                            </span>
                            <button
                              type="button"
                              onClick={() => onOpenDetail(node.parent)}
                              className="text-xs font-semibold text-[var(--ink-1)] hover:text-[var(--accent-text)] truncate"
                            >
                              {node.parent.name}
                            </button>
                            {pUpdated && (
                              <span className="text-[10px] text-[var(--ink-3)] font-mono">{pUpdated}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedParents(prev => ({ ...prev, [key]: !isCollapsed }))
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 ui-control bg-[var(--surface-control)] border border-[var(--border-line)] text-[11px] text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                              <span>{node.children.length}</span>
                            </button>
                            <a
                              href={node.parent.curseforgeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-[var(--ink-3)] hover:text-[#E05327]"
                              title="CurseForge"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)] bg-[var(--surface-sub)]/60">
                            {node.children.map(({ mod: ch, relationLabel }) => (
                              <div
                                key={ch.id}
                                data-active="true"
                                data-status={getBaseHealthTier(ch)}
                                className="mod-row pl-8 pr-3 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs font-mono text-[var(--accent-text)]">↳</span>
                                  <button
                                    type="button"
                                    onClick={() => onOpenDetail(ch)}
                                    className="text-xs font-medium text-[var(--ink-1)] hover:text-[var(--accent-text)] truncate"
                                  >
                                    {ch.name}
                                  </button>
                                  <span className="text-[10px] text-[var(--ink-3)] truncate">
                                    · {relationLabel}
                                  </span>
                                </div>
                                <a
                                  href={ch.curseforgeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-[var(--ink-3)] hover:text-[#E05327] shrink-0"
                                  title="CurseForge"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {standaloneRoots.map(({ parent: m }, sIdx) => (
                    <div
                      key={m.id}
                      data-active="true"
                      data-status={getBaseHealthTier(m)}
                      className="mod-row px-3 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-[var(--ink-3)] tabular-nums">
                          {parentWithAddons.length + sIdx + 1}.
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenDetail(m)}
                          className="text-xs font-medium text-[var(--ink-1)] hover:text-[var(--accent-text)] truncate"
                        >
                          {m.name}
                        </button>
                      </div>
                      <a
                        href={m.curseforgeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-[var(--ink-3)] hover:text-[#E05327] shrink-0"
                        title="CurseForge"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLoadToBuilder(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 ui-control bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Загрузить в Клипание
                </button>

                <button
                  type="button"
                  onClick={() => onLoadToChecker(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 ui-control bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-1)] text-xs font-medium transition-colors whitespace-nowrap ml-auto"
                >
                  Открыть в Чекере
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
