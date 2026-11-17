import { useState } from 'react';
import { Moon, Palette, RotateCcw, Sparkles, Sun, X } from 'lucide-react';

export interface ThemeConfig {
  mode: 'dark' | 'light';
  colors: [string, string, string, string, string];
  angle: number;
  saturation: number;
  panelTransparency: number;
  animate: boolean;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'dark',
  colors: ['#00FF52', '#FF5CA8', '#FF6B8A', '#3ED0FF', '#45F5C8'],
  angle: 42,
  saturation: 20,
  panelTransparency: 25,
  animate: true,
};

const THEME_STORAGE_KEY = 'mod_optimizer_theme_v2';

export function loadThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    if (
      !parsed ||
      (parsed.mode !== 'dark' && parsed.mode !== 'light') ||
      !Array.isArray(parsed.colors) ||
      parsed.colors.length !== 5
    ) {
      return DEFAULT_THEME_CONFIG;
    }
    return {
      mode: parsed.mode,
      colors: parsed.colors.map(c => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#00FF52')) as ThemeConfig['colors'],
      angle: typeof parsed.angle === 'number' ? Math.max(0, Math.min(360, parsed.angle)) : 42,
      saturation: typeof parsed.saturation === 'number' ? Math.max(0, Math.min(100, parsed.saturation)) : 20,
      panelTransparency:
        typeof parsed.panelTransparency === 'number'
          ? Math.max(0, Math.min(100, parsed.panelTransparency))
          : 25,
      animate: typeof parsed.animate === 'boolean' ? parsed.animate : true,
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

const PRESET_THEMES: Array<{ label: string; config: ThemeConfig }> = [
  {
    label: 'Тихое свечение (42° / 20%)',
    config: DEFAULT_THEME_CONFIG,
  },
  {
    label: 'Северное сияние',
    config: {
      mode: 'dark',
      colors: ['#00FF87', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6'],
      angle: 135,
      saturation: 24,
      panelTransparency: 26,
      animate: true,
    },
  },
  {
    label: 'Тёплый обсидиан',
    config: {
      mode: 'dark',
      colors: ['#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#3B82F6'],
      angle: 45,
      saturation: 18,
      panelTransparency: 22,
      animate: true,
    },
  },
  {
    label: 'Чистый тёмный (без перелива)',
    config: {
      mode: 'dark',
      colors: ['#1E293B', '#1E293B', '#334155', '#1E293B', '#0F172A'],
      angle: 42,
      saturation: 0,
      panelTransparency: 0,
      animate: false,
    },
  },
  {
    label: 'Светлая тема',
    config: {
      ...DEFAULT_THEME_CONFIG,
      mode: 'light',
      saturation: 12,
      panelTransparency: 10,
      animate: false,
    },
  },
];

interface ThemeConfiguratorProps {
  config: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
}

export function ThemeConfigurator({ config, onChange }: ThemeConfiguratorProps) {
  const [open, setOpen] = useState(false);
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
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[var(--ink-1)] text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
        title="Настройка темы и переливающегося фона"
      >
        <Palette className="w-3.5 h-3.5 text-[var(--accent-text)]" />
        <span className="hidden sm:inline">Фон</span>
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
            aria-label="Настройка фона и темы"
            className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 z-50 w-[min(320px,calc(100vw-24px))] bg-[var(--surface-solid)] border border-[var(--border-line)] rounded-lg shadow-2xl p-4 space-y-4 text-[var(--ink-1)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold tracking-tight">Настройка фона</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                aria-label="Закрыть настройки темы"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dark / Light switch */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-[var(--ink-2)]">Внешний вид</div>
              <div className="grid grid-cols-2 gap-1 bg-[var(--surface-sub)] border border-[var(--border-line)] rounded-md p-1">
                <button
                  type="button"
                  onClick={() => onChange({ ...config, mode: 'dark' })}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    config.mode === 'dark'
                      ? 'bg-[var(--accent)] text-white font-semibold'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  Тёмный
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, mode: 'light' })}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    config.mode === 'light'
                      ? 'bg-[var(--accent)] text-white font-semibold'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  Светлый
                </button>
              </div>
            </div>

            {/* 5-color stops */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-[var(--ink-2)]">Цвета градиента (5 точек)</span>
                <span className="font-mono text-[var(--ink-2)]">{config.colors[activeStop]}</span>
              </div>

              <div
                className="rounded-md p-1.5 border border-[var(--border-line)] flex items-center justify-between gap-1.5"
                style={{ backgroundImage: gradientBarCss }}
              >
                {config.colors.map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveStop(idx)}
                    aria-label={`Цвет ${idx + 1}: ${c}`}
                    className={`w-9 h-7 rounded border-2 transition-transform ${
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
                  aria-label="Выбрать цвет точки градиента"
                  className="w-9 h-8 rounded border border-[var(--border-line)] bg-transparent cursor-pointer shrink-0 p-0.5"
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
                  className="flex-1 px-2.5 py-1.5 rounded bg-[var(--surface-sub)] border border-[var(--border-line)] text-xs font-mono text-[var(--ink-1)]"
                />
              </div>
            </div>

            {/* Sliders: Angle & Saturation */}
            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--ink-2)]">Направление градиента</span>
                  <span className="font-mono font-semibold tabular-nums">{config.angle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={config.angle}
                  onChange={e => onChange({ ...config, angle: Number(e.target.value) })}
                  aria-label="Направление градиента"
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--ink-2)]">Насыщенность цвета</span>
                  <span className="font-mono font-semibold tabular-nums">{config.saturation}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.saturation}
                  onChange={e => onChange({ ...config, saturation: Number(e.target.value) })}
                  aria-label="Насыщенность цвета"
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--ink-2)]">
                    {config.mode === 'dark' ? 'Прозрачность тёмных зон' : 'Прозрачность панелей'}
                  </span>
                  <span className="font-mono font-semibold tabular-nums">{config.panelTransparency}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.panelTransparency}
                  onChange={e => onChange({ ...config, panelTransparency: Number(e.target.value) })}
                  aria-label="Прозрачность тёмных зон"
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer text-xs">
                <span className="inline-flex items-center gap-1.5 text-[var(--ink-1)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  Плавный перелив фона
                </span>
                <input
                  type="checkbox"
                  checked={config.animate}
                  onChange={e => onChange({ ...config, animate: e.target.checked })}
                  className="accent-[var(--accent)] w-4 h-4"
                />
              </label>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-soft)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--ink-2)]">Быстрые настройки</span>
                <button
                  type="button"
                  onClick={() => onChange(DEFAULT_THEME_CONFIG)}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-text)] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Сброс темы
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {PRESET_THEMES.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange(preset.config)}
                    className="px-2 py-1 rounded bg-[var(--surface-sub)] hover:bg-[var(--surface-hover)] border border-[var(--border-line)] text-[11px] text-[var(--ink-1)] transition-colors"
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
