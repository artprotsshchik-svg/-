import { useState, useMemo, useEffect, useRef, type SetStateAction } from 'react';
import {
  DATABASE_UPDATED_AT,
  MODS_DATABASE,
  MOD_PRESETS,
  type ModItem,
  type ModPreset,
} from './data/modsData.ts';
import {
  toggleModSmart,
  INITIAL_BUILDER_PREFS,
  type AssemblyPreferences,
} from './utils/modLogic.ts';
import {
  formatRuDate,
  loadLocalAppState,
  parsePersistedState,
  saveLocalAppState,
  type PersistedAppState,
  type PersistedTabKey,
} from './utils/persistence.ts';
import { ModDetailModal } from './components/ModDetailModal.tsx';
import { CheckerTab } from './components/CheckerTab.tsx';
import { AssemblyBuilderTab } from './components/AssemblyBuilderTab.tsx';
import { CatalogTab } from './components/CatalogTab.tsx';
import { PresetsTab } from './components/PresetsTab.tsx';
import {
  ThemeConfigurator,
  loadThemeConfig,
  saveThemeConfig,
  type ThemeConfig,
} from './components/ThemeConfigurator.tsx';
import { ShieldCheck } from 'lucide-react';

const DEFAULT_CHECKED_MOD_IDS: string[] = [
  'embeddium',
  'sodium-chloride',
  'alloyium',
  'immediatelyfast',
  'entity-culling',
  'more-culling-reforged',
  'enhanced-block-entities-reloaded',
  'culllessleaves-reforged',
  'modernfix',
  'ferritecore',
  'alltheleaks-memory-leak-fix',
  'radium-re-reforged',
  'badoptimizations',
  'noisiumed',
  'ixeris',
  'smooth-boot-reloaded',
  'dynamic-fps',
  'clumps',
  'packet-fixer',
  'spark',
];

const DEFAULT_BUILDER_MOD_IDS: string[] =
  MOD_PRESETS.find(p => p.id === 'user-alloyium-embeddium')?.modIds ??
  MOD_PRESETS[0]?.modIds ??
  DEFAULT_CHECKED_MOD_IDS;

export default function App() {
  const initialLocal = useMemo(() => loadLocalAppState(), []);
  const initialPrefs = initialLocal?.builderPrefs ?? INITIAL_BUILDER_PREFS;

  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => loadThemeConfig());
  const [activeTab, setActiveTabState] = useState<PersistedTabKey>(
    initialLocal?.activeTab ?? 'assembler'
  );
  const [selectedModDetail, setSelectedModDetail] = useState<ModItem | null>(null);
  const [checkedModIds, setCheckedModIdsState] = useState<string[]>(
    initialLocal?.checkedModIds ?? DEFAULT_CHECKED_MOD_IDS
  );
  const [builderPrefs, setBuilderPrefsState] = useState<AssemblyPreferences>(initialPrefs);
  const [builderModIds, setBuilderModIdsState] = useState<string[]>(
    () => initialLocal?.builderModIds ?? [...DEFAULT_BUILDER_MOD_IDS]
  );
  const [dbUpdatedAt, setDbUpdatedAt] = useState<string>(
    initialLocal?.dbUpdatedAt ?? DATABASE_UPDATED_AT
  );
  const [lastSavedDate, setLastSavedDate] = useState<string>(
    initialLocal?.lastSavedDate ?? initialLocal?.dbUpdatedAt ?? DATABASE_UPDATED_AT
  );

  const hydratedRef = useRef(false);
  const userMutatedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeConfig.mode);
    const t = Math.max(0, Math.min(100, themeConfig.panelTransparency)) / 100;
    if (themeConfig.mode === 'dark') {
      const panelAlpha = +(Math.pow(1 - t, 1.15) * 0.96 + 0.02).toFixed(3);
      const headerAlpha = +Math.min(0.98, panelAlpha + 0.07).toFixed(3);
      root.style.setProperty('--surface-panel', `rgba(15, 14, 22, ${panelAlpha})`);
      root.style.setProperty('--surface-header', `rgba(13, 12, 19, ${headerAlpha})`);
    } else {
      const panelAlpha = +(Math.pow(1 - t, 1.1) * 0.94 + 0.04).toFixed(3);
      const headerAlpha = +Math.min(0.98, panelAlpha + 0.05).toFixed(3);
      root.style.setProperty('--surface-panel', `rgba(255, 255, 255, ${panelAlpha})`);
      root.style.setProperty('--surface-header', `rgba(255, 255, 255, ${headerAlpha})`);
    }
    saveThemeConfig(themeConfig);
  }, [themeConfig]);

  const touchSavedDate = () => {
    userMutatedRef.current = true;
    setLastSavedDate(formatRuDate());
  };

  const setActiveTab = (next: PersistedTabKey) => {
    touchSavedDate();
    setActiveTabState(next);
  };

  const setCheckedModIds = (action: SetStateAction<string[]>) => {
    touchSavedDate();
    setCheckedModIdsState(action);
  };

  const setBuilderPrefs = (action: SetStateAction<AssemblyPreferences>) => {
    touchSavedDate();
    setBuilderPrefsState(action);
  };

  const setBuilderModIds = (action: SetStateAction<string[]>) => {
    touchSavedDate();
    setBuilderModIdsState(action);
  };

  // Hydrate persisted Desktop state & hot DB date on startup
  useEffect(() => {
    let cancelled = false;
    const api = window.desktopAPI;
    if (!api) {
      hydratedRef.current = true;
      return;
    }

    (async () => {
      try {
        const [meta, rawDesktopState] = await Promise.all([
          api.getAppMeta?.().catch(() => null),
          api.loadAppState?.().catch(() => null),
        ]);
        if (cancelled) return;

        const hotUpdatedAt = meta?.hotManifest?.updatedAt;
        if (hotUpdatedAt && typeof hotUpdatedAt === 'string') {
          setDbUpdatedAt(hotUpdatedAt);
        }

        const parsed = parsePersistedState(rawDesktopState);
        if (parsed && !userMutatedRef.current) {
          if (parsed.activeTab) setActiveTabState(parsed.activeTab);
          if (parsed.checkedModIds) setCheckedModIdsState(parsed.checkedModIds);
          if (parsed.builderPrefs) setBuilderPrefsState(parsed.builderPrefs);
          if (parsed.builderModIds) setBuilderModIdsState(parsed.builderModIds);
          if (parsed.lastSavedDate) setLastSavedDate(parsed.lastSavedDate);
          if (parsed.dbUpdatedAt && !hotUpdatedAt) setDbUpdatedAt(parsed.dbUpdatedAt);
        }
      } finally {
        hydratedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist state & dates on every change
  useEffect(() => {
    if (!hydratedRef.current) return;
    const snapshot: PersistedAppState = {
      schemaVersion: 2,
      dbUpdatedAt,
      lastSavedDate,
      activeTab,
      checkedModIds,
      builderModIds,
      builderPrefs,
      focusModId: null,
    };
    saveLocalAppState(snapshot);
    void window.desktopAPI?.saveAppState?.(snapshot as unknown as Record<string, unknown>);
  }, [dbUpdatedAt, lastSavedDate, activeTab, checkedModIds, builderModIds, builderPrefs]);

  const builderSet = useMemo(() => new Set(builderModIds), [builderModIds]);

  const toggleCheckerMod = (id: string) => {
    setCheckedModIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const loadPresetToChecker = (preset: ModPreset) => {
    setCheckedModIds([...preset.modIds]);
    setActiveTab('checker');
  };

  const loadPresetToBuilder = (preset: ModPreset) => {
    setBuilderModIds([...preset.modIds]);
    setActiveTab('assembler');
  };

  const navItems: Array<{ id: PersistedTabKey; label: string; count: number }> = [
    { id: 'catalog', label: 'Каталог', count: MODS_DATABASE.length },
    { id: 'assembler', label: 'Клипание сборок', count: builderModIds.length },
    { id: 'presets', label: 'Сборки', count: MOD_PRESETS.length },
    { id: 'checker', label: 'Чекер', count: checkedModIds.length },
  ];

  const angleRad = ((themeConfig.angle + 90) * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const maxAxis = Math.max(Math.abs(cosA), Math.abs(sinA), 0.001);
  const ux = cosA / maxAxis;
  const uy = sinA / maxAxis;
  const corner1 = { x: +(50 + 50 * ux).toFixed(1), y: +(50 + 50 * uy).toFixed(1) };
  const corner2 = { x: +(50 - 50 * ux).toFixed(1), y: +(50 - 50 * uy).toFixed(1) };

  const satRatio = Math.max(0, Math.min(1, themeConfig.saturation / 100));
  const cornerPeakOpacity = +(satRatio * (themeConfig.mode === 'dark' ? 0.68 : 0.36)).toFixed(3);
  const [c0, c1, c2, c3, c4] = themeConfig.colors;

  return (
    <div className="relative min-h-screen text-[var(--ink-1)] flex flex-col">
      {/* Subtle Dual-Corner Pulsing Glows fading into base page */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[var(--surface-page)]"
      >
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: cornerPeakOpacity }}
        >
          <div
            className={`absolute w-[62vmax] h-[62vmax] rounded-full ${
              themeConfig.animate ? 'corner-glow-a' : ''
            }`}
            style={{
              left: `${corner1.x}%`,
              top: `${corner1.y}%`,
              transform: themeConfig.animate ? undefined : 'translate(-50%, -50%)',
              backgroundImage: `radial-gradient(circle at center, ${c0} 0%, ${c4} 24%, transparent 64%)`,
            }}
          />
          <div
            className={`absolute w-[62vmax] h-[62vmax] rounded-full ${
              themeConfig.animate ? 'corner-glow-b' : ''
            }`}
            style={{
              left: `${corner2.x}%`,
              top: `${corner2.y}%`,
              transform: themeConfig.animate ? undefined : 'translate(-50%, -50%)',
              backgroundImage: `radial-gradient(circle at center, ${c1} 0%, ${c2} 20%, ${c3} 38%, transparent 66%)`,
            }}
          />
        </div>
      </div>

      {/* Top Navigation & Theme Controls */}
      <header className="sticky top-0 z-30 bg-[var(--surface-header)] backdrop-blur-md border-b border-[var(--border-line)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 md:h-14 flex items-center justify-between gap-3 sm:gap-5">
          <a
            href="#top"
            onClick={e => {
              e.preventDefault();
              setActiveTab('assembler');
            }}
            className="text-sm font-bold tracking-tight text-[var(--ink-1)] hover:text-[var(--accent-text)] transition-colors whitespace-nowrap shrink-0"
          >
            Верстак сборок
          </a>

          <nav className="hidden md:flex items-center gap-6 overflow-x-auto no-scrollbar" aria-label="Разделы">
            {navItems.map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-4 border-b-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'border-[var(--accent-text)] text-[var(--ink-1)] font-semibold'
                      : 'border-transparent text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`text-[11px] font-mono tabular-nums ${
                      active ? 'text-[var(--accent-text)] font-semibold' : 'text-[var(--ink-3)]'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeConfigurator config={themeConfig} onChange={setThemeConfig} />
            <button
              type="button"
              onClick={() => setActiveTab('checker')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shrink-0 whitespace-nowrap transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Проверить сборку</span>
            </button>
          </div>
        </div>

        {/* Mobile full-width navigation strip */}
        <nav
          className="md:hidden border-t border-[var(--border-soft)] px-4 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar"
          aria-label="Разделы (мобильная навигация)"
        >
          {navItems.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-2.5 border-b-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1 ${
                  active
                    ? 'border-[var(--accent-text)] text-[var(--ink-1)] font-semibold'
                    : 'border-transparent text-[var(--ink-2)]'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    active ? 'text-[var(--accent-text)] font-semibold' : 'text-[var(--ink-3)]'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Metadata Strip */}
        <div className="border-t border-[var(--border-soft)] bg-[var(--surface-sub)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-7 flex items-center justify-between text-[11px] text-[var(--ink-2)]">
            <span className="font-mono tabular-nums truncate">
              База: <strong className="text-[var(--ink-1)] font-semibold">{dbUpdatedAt}</strong> · Сохранено:{' '}
              <strong className="text-[var(--accent-text)] font-semibold">{lastSavedDate}</strong>
            </span>
            <span className="hidden sm:inline text-[var(--ink-3)] whitespace-nowrap">
              Forge 1.20.1 · Nvidium &amp; Alloyium
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'catalog' && (
          <CatalogTab
            checkedModIds={checkedModIds}
            toggleCheckerMod={toggleCheckerMod}
            builderSet={builderSet}
            builderPrefs={builderPrefs}
            onOpenDetail={setSelectedModDetail}
          />
        )}

        {activeTab === 'assembler' && (
          <AssemblyBuilderTab
            selectedIds={builderModIds}
            setSelectedIds={setBuilderModIds}
            prefs={builderPrefs}
            setPrefs={setBuilderPrefs}
            onOpenDetail={setSelectedModDetail}
            onSendToChecker={ids => {
              setCheckedModIds(ids);
              setActiveTab('checker');
            }}
          />
        )}

        {activeTab === 'presets' && (
          <PresetsTab
            dbUpdatedAt={dbUpdatedAt}
            lastSavedDate={lastSavedDate}
            onLoadToChecker={loadPresetToChecker}
            onLoadToBuilder={loadPresetToBuilder}
            onOpenDetail={setSelectedModDetail}
          />
        )}

        {activeTab === 'checker' && (
          <CheckerTab
            checkedModIds={checkedModIds}
            setCheckedModIds={setCheckedModIds}
            onOpenDetail={setSelectedModDetail}
          />
        )}
      </main>

      <ModDetailModal
        mod={selectedModDetail}
        onClose={() => setSelectedModDetail(null)}
        onSelectMod={setSelectedModDetail}
        checkedModIds={checkedModIds}
        onToggleCheckMod={toggleCheckerMod}
        activeModIds={builderModIds}
        builderPrefs={builderPrefs}
        onChooseVariantInBuilder={mod => {
          const alreadySelected = builderModIds.includes(mod.id);
          if (!alreadySelected) {
            const res = toggleModSmart(builderModIds, mod.id, { strict: true, prefs: builderPrefs });
            setBuilderModIds(res.nextIds);
          }
          setSelectedModDetail(null);
          setActiveTab('assembler');
        }}
      />
    </div>
  );
}
