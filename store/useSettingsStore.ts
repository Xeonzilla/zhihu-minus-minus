import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const settingsStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) =>
    SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

/** Returns true only for a complete, well-formed 6-digit hex color like "#0084ff" */
function isValidHex(color: string | null | undefined): boolean {
  if (!color) return false;
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/** Sanitize a color value: returns the color if valid, null otherwise */
function sanitizeColor(color: string | null | undefined): string | null {
  return isValidHex(color) ? (color as string) : null;
}

export type TabKey =
  | 'following'
  | 'recommend'
  | 'local'
  | 'hot'
  | 'daily'
  | 'publish'
  | 'profile';

export interface AppSettings {
  fontSizeScale: number;
  lineHeightScale: number;
  primaryColor: string | null;
  visibleTabs: TabKey[];
  defaultTab: TabKey;
  localCityName: string | null;
  borderRadius: number;
  useWebView: boolean;
  enablePrivateMessaging: boolean;
  /** iOS 按压时的不透明度 (0.5 ~ 1.0) */
  pressOpacity: number;
  /** iOS 按压时的缩放比例 (0.88 ~ 1.0) */
  pressScale: number;
  /** 安卓按压反馈类型: ripple (水波纹), scale-opacity (透明度+缩放) */
  androidFeedbackType: 'ripple' | 'scale-opacity';
  /** 是否开启浏览历史记录 */
  enableBrowseHistory: boolean;
}

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  fontSizeScale: 1.0,
  lineHeightScale: 1.5,
  primaryColor: '#0084ff', // Zhihu Blue — the canonical default
  visibleTabs: ['following', 'recommend', 'hot', 'daily', 'publish', 'profile'],
  defaultTab: 'recommend',
  localCityName: null,
  borderRadius: 12,
  useWebView: false,
  enablePrivateMessaging: false,
  pressOpacity: 0.82,
  pressScale: 0.98,
  androidFeedbackType: 'ripple',
  enableBrowseHistory: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (newSettings) =>
        set((state) => {
          const nextSettings = { ...state, ...newSettings };
          // 兜底：确保"我的"页面始终可见
          if (
            nextSettings.visibleTabs &&
            !nextSettings.visibleTabs.includes('profile')
          ) {
            nextSettings.visibleTabs = [...nextSettings.visibleTabs, 'profile'];
          }
          // 兜底：非法 hex 颜色退回默认（null）
          nextSettings.primaryColor = sanitizeColor(nextSettings.primaryColor);
          return nextSettings;
        }),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'zhihu-settings-storage',
      storage: createJSONStorage(() => settingsStorage),
      version: 5,
      migrate: (persistedState: any, version: number) => {
        // 清理历史脏数据：null 或非法 hex 都退回默认蓝
        const sanitized = sanitizeColor(persistedState?.primaryColor);
        persistedState.primaryColor = sanitized ?? '#0084ff';

        // 升级到 v3 时兜底新增的按压反馈参数
        if (version < 3) {
          persistedState.pressOpacity = persistedState.pressOpacity ?? 0.82;
          persistedState.pressScale = persistedState.pressScale ?? 0.98;
        }

        // 升级到 v4 时兜底安卓按压反馈类型选择
        if (version < 4) {
          persistedState.androidFeedbackType =
            persistedState.androidFeedbackType ?? 'ripple';
        }

        if (version < 5) {
          persistedState.enableBrowseHistory =
            persistedState.enableBrowseHistory ?? true;
        }

        return persistedState as SettingsState;
      },
    },
  ),
);
