import { useState } from 'react';
import {
  MOD_PRESETS,
  type ModItem,
  type ModPreset,
} from '../data/modsData.ts';
import {
  evaluateAssemblyHealth,
  formatModNamesListText,
  getBaseHealthTier,
  getModUpdatedLabel,
  organizeAssemblyTree,
} from '../utils/modLogic.ts';
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
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
  const [copiedPresetId, setCopiedPresetId] = useState<string | null>(null);
  const [expandedTextIds, setExpandedTextIds] = useState<Record<string, boolean>>({});

  const handleCopyPlainList = (preset: ModPreset) => {
    const plainList = formatModNamesListText(preset.modIds);
    navigator.clipboard.writeText(plainList);
    setCopiedPresetId(preset.id);
    setTimeout(() => setCopiedPresetId(prev => (prev === preset.id ? null : prev)), 1800);
  };

  const toggleTextPreview = (presetId: string) => {
    setExpandedTextIds(prev => ({ ...prev, [presetId]: !prev[presetId] }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--ink-1)] tracking-tight">
            Основные сборки ({MOD_PRESETS.length})
          </h2>
          <p className="text-xs text-[var(--ink-2)] mt-0.5">
            Две базовые проверенные конфигурации: связка Nvidium + Emberbium и чистый Forge (Alloyium + Embeddium).
          </p>
        </div>
        <span className="px-2.5 py-1 rounded bg-[var(--surface-sub)] border border-[var(--border-soft)] text-[11px] font-mono text-[var(--ink-2)] tabular-nums whitespace-nowrap">
          База: {dbUpdatedAt} · Сохранено: {lastSavedDate}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {MOD_PRESETS.map(preset => {
          const treeNodes = organizeAssemblyTree(preset.modIds);
          const parentWithAddons = treeNodes.filter(n => n.children.length > 0);
          const standaloneRoots = treeNodes.filter(n => n.children.length === 0);
          const plainNamesText = formatModNamesListText(preset.modIds);
          const isTextOpen = Boolean(expandedTextIds[preset.id]);

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
            <div
              key={preset.id}
              className="bg-[var(--surface-panel)] backdrop-blur-md border border-[var(--border-line)] rounded-lg p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-[var(--ink-1)] leading-snug">{preset.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${badgeCls}`}>
                    {preset.badge}
                  </span>
                </div>

                <p className="text-xs text-[var(--ink-2)] leading-relaxed">{preset.description}</p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-2)] bg-[var(--surface-sub)] border border-[var(--border-soft)] rounded-md px-3 py-2">
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
                    · Проверка: {presetRedCount} конфл. / {presetYellowCount} замеч. ({preset.modIds.length} модов)
                  </span>
                </div>

                {isTextOpen && (
                  <div className="rounded-md bg-[var(--surface-sub)] border border-[var(--border-line)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[var(--ink-1)]">
                        Список названий ({preset.modIds.length} строк)
                      </span>
                      <span className="text-[10px] text-[var(--ink-2)]">Только имена, по одному на строку</span>
                    </div>
                    <textarea
                      readOnly
                      value={plainNamesText}
                      onFocus={e => e.currentTarget.select()}
                      rows={8}
                      aria-label={`Текстовый список модов для ${preset.name}`}
                      className="w-full rounded border border-[var(--border-line)] bg-[var(--surface-control)] p-2.5 text-xs font-mono text-[var(--ink-1)] leading-relaxed resize-y"
                    />
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  {parentWithAddons.map((node, idx) => {
                    const pUpdated = getModUpdatedLabel(node.parent);
                    const pTier = getBaseHealthTier(node.parent);
                    const pBoxCls =
                      pTier === 'red'
                        ? 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)]'
                        : pTier === 'yellow'
                          ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)]'
                          : 'bg-[var(--surface-sub)] border-[var(--border-soft)]';

                    return (
                      <div key={node.parent.id} className={`rounded-md border p-3 space-y-2 ${pBoxCls}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                            <span className="text-[11px] font-mono text-[var(--ink-3)] tabular-nums">
                              {idx + 1}.
                            </span>
                            <button
                              type="button"
                              onClick={() => onOpenDetail(node.parent)}
                              className="text-xs font-semibold text-[var(--ink-1)] hover:text-[var(--accent-text)] text-left transition-colors"
                            >
                              {node.parent.name}
                            </button>
                            {pTier === 'yellow' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--hl-yellow-pill)] text-[var(--hl-yellow-text)] border border-[var(--hl-yellow-border)]">
                                нюанс
                              </span>
                            )}
                            {pUpdated && (
                              <span className="text-[10px] text-[var(--ink-3)] font-mono">
                                обн. {pUpdated}
                              </span>
                            )}
                          </div>
                          <a
                            href={node.parent.curseforgeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-control)] hover:bg-[#E05327] border border-[var(--border-line)] hover:border-[#E05327] text-[var(--ink-2)] hover:text-white text-[10px] font-medium transition-colors"
                            title="CurseForge"
                          >
                            CF
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>

                        <div className="ml-2.5 p-2 rounded bg-[var(--surface-panel)] border border-[var(--border-soft)] space-y-1.5">
                          <div className="text-[10px] font-medium text-[var(--ink-2)]">
                            Аддоны и зависимости ({node.children.length}):
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {node.children.map(({ mod: ch, relationLabel }) => {
                              const cUpdated = getModUpdatedLabel(ch);
                              const cTier = getBaseHealthTier(ch);
                              const cChipCls =
                                cTier === 'red'
                                  ? 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)]'
                                  : cTier === 'yellow'
                                    ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)]'
                                    : 'bg-[var(--surface-sub)] border-[var(--border-line)]';
                              return (
                                <div
                                  key={ch.id}
                                  className={`inline-flex items-center rounded border overflow-hidden text-[11px] ${cChipCls}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => onOpenDetail(ch)}
                                    className="px-2 py-1 text-[var(--ink-1)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1.5"
                                  >
                                    <span className="font-medium">{ch.name}</span>
                                    <span className="text-[10px] text-[var(--accent-text)]">
                                      · {relationLabel}
                                    </span>
                                    {cTier === 'yellow' && (
                                      <span className="text-[9px] font-semibold text-[var(--hl-yellow-text)]">
                                        (нюанс)
                                      </span>
                                    )}
                                    {cUpdated && (
                                      <span className="text-[10px] text-[var(--ink-3)] font-mono">
                                        ({cUpdated})
                                      </span>
                                    )}
                                  </button>
                                  <a
                                    href={ch.curseforgeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-1.5 py-1 text-[var(--ink-2)] hover:text-[#E05327] hover:bg-[var(--surface-hover)] border-l border-[var(--border-line)] transition-colors"
                                    title="CurseForge"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {standaloneRoots.length > 0 && (
                    <div className="rounded-md bg-[var(--surface-sub)] border border-[var(--border-soft)] p-3 space-y-1.5">
                      <div className="text-[10px] font-medium text-[var(--ink-2)]">
                        Отдельные моды сборки ({standaloneRoots.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {standaloneRoots.map(({ parent: m }, sIdx) => {
                          const mUpdated = getModUpdatedLabel(m);
                          const mTier = getBaseHealthTier(m);
                          const num = parentWithAddons.length + sIdx + 1;
                          const mCls =
                            mTier === 'red'
                              ? 'bg-[var(--hl-red-bg)] border-[var(--hl-red-border)]'
                              : mTier === 'yellow'
                                ? 'bg-[var(--hl-yellow-bg)] border-[var(--hl-yellow-border)]'
                                : 'bg-[var(--surface-control)] border-[var(--border-line)]';
                          return (
                            <div
                              key={m.id}
                              className={`inline-flex items-center rounded border overflow-hidden text-[11px] ${mCls}`}
                            >
                              <button
                                type="button"
                                onClick={() => onOpenDetail(m)}
                                className="px-2 py-1 text-[var(--ink-1)] hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1"
                              >
                                <span className="text-[10px] font-mono text-[var(--ink-3)] tabular-nums">
                                  {num}.
                                </span>
                                <span className="font-medium">{m.name}</span>
                                {mUpdated && (
                                  <span className="text-[10px] text-[var(--ink-3)] font-mono">
                                    ({mUpdated})
                                  </span>
                                )}
                              </button>
                              <a
                                href={m.curseforgeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-1.5 py-1 text-[var(--ink-2)] hover:text-[#E05327] hover:bg-[var(--surface-hover)] border-l border-[var(--border-soft)] transition-colors"
                                title="CurseForge"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-soft)] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyPlainList(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  {copiedPresetId === preset.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Список скопирован
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Скопировать списком
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleTextPreview(preset.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-1)] text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {isTextOpen ? 'Скрыть текст' : 'Текст списком'}
                </button>

                <button
                  type="button"
                  onClick={() => onLoadToBuilder(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-1)] text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  В Клипание
                </button>

                <button
                  type="button"
                  onClick={() => onLoadToChecker(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-1)] text-xs font-medium transition-colors whitespace-nowrap ml-auto"
                >
                  В Чекер
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
