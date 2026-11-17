import { useState } from 'react';
import { Moon, RotateCcw, SlidersHorizontal, Sparkles, Sun, X } from 'lucide-react';

export type FractalType = 'none' | 'julia' | 'tree' | 'koch' | 'sierpinski' | 'fbm';
export type BlockStyle = 'glass' | 'flat' | 'bordered' | 'elevated';
export type BlockRadius = 'sharp' | 'medium' | 'soft';
export type RowDensity = 'compact' | 'normal' | 'comfortable';
export type EdgeHighlightMode = 'both' | 'edges' | 'soft';

export interface ThemeConfig {
  mode: 'dark' | 'light';
  colors: [string, string, string, string, string];
  angle: number;
  saturation: number;
  panelTransparency: number;
  animate: boolean;
  fractal: FractalType;
  fractalOpacity: number;
  fractalScale: number;
  blockStyle: BlockStyle;
  blockRadius: BlockRadius;
  rowDensity: RowDensity;
  edgeHighlight: EdgeHighlightMode;
  showDescriptions: boolean;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'dark',
  colors: ['#00FF52', '#FF5CA8', '#FF6B8A', '#3ED0FF', '#45F5C8'],
  angle: 42,
  saturation: 22,
  panelTransparency: 26,
  animate: true,
  fractal: 'julia',
  fractalOpacity: 24,
  fractalScale: 52,
  blockStyle: 'glass',
  blockRadius: 'medium',
  rowDensity: 'normal',
  edgeHighlight: 'both',
  showDescriptions: false,
};

const THEME_STORAGE_KEY = 'mod_optimizer_theme_v3';

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('mod_optimizer_theme_v2');
    if (!raw) return DEFAULT_THEME_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_THEME_CONFIG;

    const validFractals = new Set<FractalType>(['none', 'julia', 'tree', 'koch', 'sierpinski', 'fbm']);
    const validBlockStyles = new Set<BlockStyle>(['glass', 'flat', 'bordered', 'elevated']);
    const validRadii = new Set<BlockRadius>(['sharp', 'medium', 'soft']);
    const validDensities = new Set<RowDensity>(['compact', 'normal', 'comfortable']);
    const validEdges = new Set<EdgeHighlightMode>(['both', 'edges', 'soft']);

    const colors: ThemeConfig['colors'] =
      Array.isArray(parsed.colors) && parsed.colors.length === 5
        ? (parsed.colors.map((c, idx) =>
            typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : DEFAULT_THEME_CONFIG.colors[idx]
          ) as ThemeConfig['colors'])
        : DEFAULT_THEME_CONFIG.colors;

    return {
      mode: parsed.mode === 'light' ? 'light' : 'dark',
      colors,
      angle: clamp(parsed.angle, 0, 360, DEFAULT_THEME_CONFIG.angle),
      saturation: clamp(parsed.saturation, 0, 100, DEFAULT_THEME_CONFIG.saturation),
      panelTransparency: clamp(parsed.panelTransparency, 0, 100, DEFAULT_THEME_CONFIG.panelTransparency),
      animate: typeof parsed.animate === 'boolean' ? parsed.animate : DEFAULT_THEME_CONFIG.animate,
      fractal: validFractals.has(parsed.fractal as FractalType) ? (parsed.fractal as FractalType) : DEFAULT_THEME_CONFIG.fractal,
      fractalOpacity: clamp(parsed.fractalOpacity, 0, 100, DEFAULT_THEME_CONFIG.fractalOpacity),
      fractalScale: clamp(parsed.fractalScale, 10, 100, DEFAULT_THEME_CONFIG.fractalScale),
      blockStyle: validBlockStyles.has(parsed.blockStyle as BlockStyle)
        ? (parsed.blockStyle as BlockStyle)
        : DEFAULT_THEME_CONFIG.blockStyle,
      blockRadius: validRadii.has(parsed.blockRadius as BlockRadius)
        ? (parsed.blockRadius as BlockRadius)
        : DEFAULT_THEME_CONFIG.blockRadius,
      rowDensity: validDensities.has(parsed.rowDensity as RowDensity)
        ? (parsed.rowDensity as RowDensity)
        : DEFAULT_THEME_CONFIG.rowDensity,
      edgeHighlight: validEdges.has(parsed.edgeHighlight as EdgeHighlightMode)
        ? (parsed.edgeHighlight as EdgeHighlightMode)
        : DEFAULT_THEME_CONFIG.edgeHighlight,
      showDescriptions:
        typeof parsed.showDescriptions === 'boolean' ? parsed.showDescriptions : DEFAULT_THEME_CONFIG.showDescriptions,
    };
  } catch {
    return DEFAULT_THEME_CONFIG;
  }
}

export function saveThemeConfig(config: ThemeConfig): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

const FRACTAL_OPTIONS: Array<{ id: FractalType; label: string }> = [
  { id: 'none', label: 'Нет' },
  { id: 'julia', label: 'Жюлиа' },
  { id: 'fbm', label: 'Туман FBM' },
  { id: 'tree', label: 'Дерево' },
  { id: 'koch', label: 'Кох' },
  { id: 'sierpinski', label: 'Серпинский' },
];

const PRESET_THEMES: Array<{ label: string; config: ThemeConfig }> = [
  {
    label: 'Жюлиа · Стекло',
    config: DEFAULT_THEME_CONFIG,
  },
  {
    label: 'Северный FBM',
    config: {
      ...DEFAULT_THEME_CONFIG,
      colors: ['#00FF87', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6'],
      angle: 135,
      saturation: 24,
      panelTransparency: 28,
      fractal: 'fbm',
      fractalOpacity: 28,
      blockStyle: 'elevated',
    },
  },
  {
    label: 'Чёткие контуры',
    config: {
      ...DEFAULT_THEME_CONFIG,
      colors: ['#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#3B82F6'],
      fractal: 'koch',
      fractalOpacity: 22,
      blockStyle: 'bordered',
      blockRadius: 'sharp',
      rowDensity: 'compact',
      panelTransparency: 14,
    },
  },
  {
    label: 'Строгий плоский',
    config: {
      ...DEFAULT_THEME_CONFIG,
      colors: ['#334155', '#1E293B', '#475569', '#1E293B', '#0F172A'],
      saturation: 0,
      panelTransparency: 0,
      animate: false,
      fractal: 'none',
      fractalOpacity: 0,
      blockStyle: 'flat',
      blockRadius: 'medium',
      edgeHighlight: 'edges',
    },
  },
  {
    label: 'Светлая схема',
    config: {
      ...DEFAULT_THEME_CONFIG,
      mode: 'light',
      saturation: 12,
      panelTransparency: 12,
      animate: false,
      fractal: 'tree',
      fractalOpacity: 18,
      blockStyle: 'bordered',
    },
  },
];

interface ThemeConfiguratorProps {
  config: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
}

export function ThemeConfigurator({ config, onChange }: ThemeConfiguratorProps) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<'layout' | 'background'>('layout');
  const [activeStop, setActiveStop] = useState<number>(0);

  const updateColor = (idx: number, hex: string) => {
    const nextColors = [...config.colors] as ThemeConfig['colors'];
    nextColors[idx] = hex.toUpperCase();
    onChange({ ...config, colors: nextColors });
  };

  const gradientBarCss = `linear-gradient(90deg, ${config.colors.join(', ')})`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 ui-control bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-1)] text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
        title="Настроить отображение, стиль блоков и фрактальный фон"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-text)]" />
        <span className="hidden sm:inline">Вид и фон</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Настройка отображения и фона"
            className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 z-50 w-[min(360px,calc(100vw-24px))] max-h-[82vh] overflow-y-auto bg-[var(--surface-solid)] border border-[var(--border-line)] ui-block shadow-2xl p-4 space-y-3.5 text-[var(--ink-1)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold tracking-tight">Вид и фон</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                aria-label="Закрыть настройки"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section switcher inside configurator */}
            <div className="grid grid-cols-2 gap-1 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control p-1 text-xs">
              <button
                type="button"
                onClick={() => setSection('layout')}
                className={`py-1 rounded font-medium transition-colors ${
                  section === 'layout'
                    ? 'bg-[var(--accent)] text-white font-semibold'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                Блоки и строки
              </button>
              <button
                type="button"
                onClick={() => setSection('background')}
                className={`py-1 rounded font-medium transition-colors ${
                  section === 'background'
                    ? 'bg-[var(--accent)] text-white font-semibold'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                }`}
              >
                Фракталы и цвета
              </button>
            </div>

            {section === 'layout' ? (
              <div className="space-y-3">
                {/* Dark / Light switch */}
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-[var(--ink-2)]">Тема</div>
                  <div className="grid grid-cols-2 gap-1 bg-[var(--surface-sub)] border border-[var(--border-line)] ui-control p-1">
                    <button
                      type="button"
                      onClick={() => onChange({ ...config, mode: 'dark' })}
                      className={`flex items-center justify-center gap-1.5 py-1 rounded text-xs font-medium transition-colors ${
                        config.mode === 'dark'
                          ? 'bg-[var(--accent)] text-white font-semibold'
                          : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Тёмная
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ ...config, mode: 'light' })}
                      className={`flex items-center justify-center gap-1.5 py-1 rounded text-xs font-medium transition-colors ${
                        config.mode === 'light'
                          ? 'bg-[var(--accent)] text-white font-semibold'
                          : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      Светлая
                    </button>
                  </div>
                </div>

                {/* Block Style */}
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-[var(--ink-2)]">Стиль блоков</div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'glass', label: 'Стекло' },
                      { id: 'flat', label: 'Плоский' },
                      { id: 'bordered', label: 'Контур' },
                      { id: 'elevated', label: 'Объёмный' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChange({ ...config, blockStyle: item.id as BlockStyle })}
                        className={`py-1.5 px-2 ui-control border text-xs font-medium transition-colors ${
                          config.blockStyle === item.id
                            ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)] font-semibold'
                            : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Radius */}
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-[var(--ink-2)]">Скругление</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'sharp', label: 'Острое' },
                      { id: 'medium', label: 'Среднее' },
                      { id: 'soft', label: 'Мягкое' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChange({ ...config, blockRadius: item.id as BlockRadius })}
                        className={`py-1 px-2 ui-control border text-xs font-medium transition-colors ${
                          config.blockRadius === item.id
                            ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)] font-semibold'
                            : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Density */}
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-[var(--ink-2)]">Плотность строк</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'compact', label: 'Плотно' },
                      { id: 'normal', label: 'Норма' },
                      { id: 'comfortable', label: 'Просторно' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChange({ ...config, rowDensity: item.id as RowDensity })}
                        className={`py-1 px-2 ui-control border text-xs font-medium transition-colors ${
                          config.rowDensity === item.id
                            ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)] font-semibold'
                            : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Edge highlight */}
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-[var(--ink-2)]">Цветовые края строк (слева/справа)</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'both', label: 'Край + градиент' },
                      { id: 'edges', label: 'Полосы' },
                      { id: 'soft', label: 'Заливка' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChange({ ...config, edgeHighlight: item.id as EdgeHighlightMode })}
                        className={`py-1 px-1.5 ui-control border text-[11px] font-medium transition-colors whitespace-nowrap ${
                          config.edgeHighlight === item.id
                            ? 'bg-[var(--hl-blue-bg)] border-[var(--hl-blue-border)] text-[var(--hl-blue-text)] font-semibold'
                            : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel Transparency + Descriptions Toggle */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ink-2)]">Прозрачность блоков</span>
                    <span className="font-mono font-semibold tabular-nums">{config.panelTransparency}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={config.panelTransparency}
                    onChange={e => onChange({ ...config, panelTransparency: Number(e.target.value) })}
                    aria-label="Прозрачность блоков"
                    className="w-full accent-[var(--accent)] cursor-pointer"
                  />
                </div>

                <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer text-xs">
                  <span className="text-[var(--ink-1)]">Описания модов и слотов</span>
                  <input
                    type="checkbox"
                    checked={config.showDescriptions}
                    onChange={e => onChange({ ...config, showDescriptions: e.target.checked })}
                    className="accent-[var(--accent)] w-4 h-4"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Fractal Selector */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-[var(--ink-2)]">Фрактал на фоне</div>
                  <div className="grid grid-cols-3 gap-1">
                    {FRACTAL_OPTIONS.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onChange({ ...config, fractal: f.id })}
                        className={`py-1.5 px-2 ui-control border text-[11px] font-medium transition-colors truncate ${
                          config.fractal === f.id
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-semibold'
                            : 'bg-[var(--surface-sub)] border-[var(--border-line)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {config.fractal !== 'none' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--ink-2)]">Яркость</span>
                        <span className="font-mono font-semibold tabular-nums">{config.fractalOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={85}
                        value={config.fractalOpacity}
                        onChange={e => onChange({ ...config, fractalOpacity: Number(e.target.value) })}
                        aria-label="Яркость фрактала"
                        className="w-full accent-[var(--accent)] cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--ink-2)]">Масштаб</span>
                        <span className="font-mono font-semibold tabular-nums">{config.fractalScale}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={config.fractalScale}
                        onChange={e => onChange({ ...config, fractalScale: Number(e.target.value) })}
                        aria-label="Масштаб фрактала"
                        className="w-full accent-[var(--accent)] cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* 5-color stops */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-[var(--ink-2)]">Палитра (5 цветов)</span>
                    <span className="font-mono text-[var(--ink-2)]">{config.colors[activeStop]}</span>
                  </div>

                  <div
                    className="ui-control p-1 border border-[var(--border-line)] flex items-center justify-between gap-1"
                    style={{ backgroundImage: gradientBarCss }}
                  >
                    {config.colors.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveStop(idx)}
                        aria-label={`Цвет ${idx + 1}: ${c}`}
                        className={`w-10 h-6 rounded border-2 transition-transform ${
                          activeStop === idx
                            ? 'border-white scale-105 shadow-md'
                            : 'border-white/70 opacity-90 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.colors[activeStop]}
                      onChange={e => updateColor(activeStop, e.target.value)}
                      aria-label="Выбрать цвет палитры"
                      className="w-9 h-7 rounded border border-[var(--border-line)] bg-transparent cursor-pointer shrink-0 p-0.5"
                    />
                    <input
                      type="text"
                      value={config.colors[activeStop]}
                      onChange={e => {
                        const val = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                          updateColor(activeStop, val);
                        }
                      }}
                      maxLength={7}
                      aria-label="HEX код цвета"
                      className="flex-1 px-2.5 py-1 rounded bg-[var(--surface-sub)] border border-[var(--border-line)] text-xs font-mono text-[var(--ink-1)]"
                    />
                  </div>
                </div>

                {/* Glow sliders */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--ink-2)]">Угол свечения</span>
                      <span className="font-mono font-semibold tabular-nums">{config.angle}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={config.angle}
                      onChange={e => onChange({ ...config, angle: Number(e.target.value) })}
                      aria-label="Угол свечения"
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--ink-2)]">Свечение</span>
                      <span className="font-mono font-semibold tabular-nums">{config.saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config.saturation}
                      onChange={e => onChange({ ...config, saturation: Number(e.target.value) })}
                      aria-label="Насыщенность свечения"
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between gap-2 pt-0.5 cursor-pointer text-xs">
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink-1)]">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    Анимация фона и фрактала
                  </span>
                  <input
                    type="checkbox"
                    checked={config.animate}
                    onChange={e => onChange({ ...config, animate: e.target.checked })}
                    className="accent-[var(--accent)] w-4 h-4"
                  />
                </label>
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-1.5 pt-2.5 border-t border-[var(--border-soft)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--ink-2)]">Готовые профили</span>
                <button
                  type="button"
                  onClick={() => onChange(DEFAULT_THEME_CONFIG)}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-text)] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Сбросить
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {PRESET_THEMES.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange(preset.config)}
                    className="px-2 py-1 ui-control bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[11px] text-[var(--ink-1)] transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
