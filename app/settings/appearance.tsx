import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BouncyButton } from '@/components/BouncyButton';
import { Text, useThemeColor, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { type TabKey, useSettingsStore } from '@/store/useSettingsStore';

const PRESET_COLORS = [
  '#0084ff', // Zhihu Blue
  '#ff4d4f', // Red
  '#2ecc71', // Green
  '#f39c12', // Orange
  '#9b59b6', // Purple
  '#34495e', // Navy
];

export default function AppearanceSettings() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const {
    fontSizeScale,
    lineHeightScale,
    primaryColor,
    visibleTabs,
    defaultTab,
    useWebView,
    enablePrivateMessaging,
    enableBrowseHistory,
    pressOpacity,
    pressScale,
    androidFeedbackType,
    updateSettings,
    resetSettings,
    localCityName,
  } = useSettingsStore();

  const TAB_LABELS: Record<TabKey, string> = {
    following: '关注',
    recommend: '推荐',
    local: localCityName || '同城',
    hot: '热榜',
    daily: '日报',
    publish: '发布',
    profile: '我的',
  };

  const tintColor = useThemeColor({}, 'primary');
  const textColor = Colors[colorScheme].text;
  const borderColor = Colors[colorScheme].border;

  const toggleTab = (tab: TabKey) => {
    if (visibleTabs.includes(tab)) {
      // 核心：禁止隐藏“我的”页面，防止进入赛博灯泡困境
      if (tab === 'profile') return;
      if (visibleTabs.length > 1) {
        updateSettings({ visibleTabs: visibleTabs.filter((t) => t !== tab) });
      }
    } else {
      updateSettings({ visibleTabs: [...visibleTabs, tab] });
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: '外观与定制', headerShadowVisible: false }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        {/* 1. 字体风格 */}
        <Section title="字体与排版">
          <SettingItem label="字体大小">
            <View style={styles.row}>
              <Pressable
                onPress={() =>
                  updateSettings({
                    fontSizeScale: Math.max(0.8, fontSizeScale - 0.1),
                  })
                }
                style={[
                  styles.smallBtn,
                  { backgroundColor: Colors[colorScheme].backgroundTertiary },
                ]}
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={Colors[colorScheme].text}
                />
              </Pressable>
              <Text style={styles.valueText}>{fontSizeScale.toFixed(1)}x</Text>
              <Pressable
                onPress={() =>
                  updateSettings({
                    fontSizeScale: Math.min(1.5, fontSizeScale + 0.1),
                  })
                }
                style={[
                  styles.smallBtn,
                  { backgroundColor: Colors[colorScheme].backgroundTertiary },
                ]}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={Colors[colorScheme].text}
                />
              </Pressable>
            </View>
          </SettingItem>

          <SettingItem label="行高比例">
            <View style={styles.row}>
              <Pressable
                onPress={() =>
                  updateSettings({
                    lineHeightScale: Math.max(1.0, lineHeightScale - 0.1),
                  })
                }
                style={[
                  styles.smallBtn,
                  { backgroundColor: Colors[colorScheme].backgroundTertiary },
                ]}
              >
                <Ionicons
                  name="remove"
                  size={20}
                  color={Colors[colorScheme].text}
                />
              </Pressable>
              <Text style={styles.valueText}>
                {lineHeightScale.toFixed(1)}x
              </Text>
              <Pressable
                onPress={() =>
                  updateSettings({
                    lineHeightScale: Math.min(2.5, lineHeightScale + 0.1),
                  })
                }
                style={[
                  styles.smallBtn,
                  { backgroundColor: Colors[colorScheme].backgroundTertiary },
                ]}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={Colors[colorScheme].text}
                />
              </Pressable>
            </View>
          </SettingItem>
        </Section>

        {/* 2. 主题颜色 */}
        <Section title="主题颜色">
          {/* 预设颜色 */}
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => updateSettings({ primaryColor: color })}
                style={[
                  styles.colorCircle,
                  { backgroundColor: color },
                  primaryColor === color && {
                    borderColor: Colors[colorScheme].text,
                    borderWidth: 3,
                  },
                ]}
              />
            ))}
            <Pressable
              onPress={() => updateSettings({ primaryColor: '#0084ff' })}
              style={[
                styles.colorCircle,
                {
                  backgroundColor: '#eee',
                  justifyContent: 'center',
                  alignItems: 'center',
                },
                primaryColor === '#0084ff' && {
                  borderColor: Colors[colorScheme].text,
                  borderWidth: 3,
                },
              ]}
            >
              <Ionicons name="refresh" size={24} color="#666" />
            </Pressable>
          </View>

          {/* 自定义颜色调色盘 */}
          <ColorPickerSection
            primaryColor={primaryColor}
            onColorChange={(color) => updateSettings({ primaryColor: color })}
          />
        </Section>

        {/* 3. 按压反馈 */}
        <Section title="按压反馈效果">
          {Platform.OS === 'android' ? (
            <SettingItem label="反馈类型">
              <View style={styles.row}>
                <Pressable
                  onPress={() =>
                    updateSettings({ androidFeedbackType: 'ripple' })
                  }
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: Colors[colorScheme].backgroundTertiary,
                      marginRight: 8,
                    },
                    androidFeedbackType === 'ripple' && {
                      backgroundColor: tintColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabChipText,
                      androidFeedbackType === 'ripple' && {
                        color: '#fff',
                        fontWeight: 'bold',
                      },
                    ]}
                  >
                    水波纹特效
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    updateSettings({ androidFeedbackType: 'scale-opacity' })
                  }
                  style={[
                    styles.tabChip,
                    { backgroundColor: Colors[colorScheme].backgroundTertiary },
                    androidFeedbackType === 'scale-opacity' && {
                      backgroundColor: tintColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabChipText,
                      androidFeedbackType === 'scale-opacity' && {
                        color: '#fff',
                        fontWeight: 'bold',
                      },
                    ]}
                  >
                    透明度+缩放
                  </Text>
                </Pressable>
              </View>
            </SettingItem>
          ) : null}
          {(Platform.OS !== 'android' ||
            androidFeedbackType === 'scale-opacity') && (
            <>
              <SettingItem label="按压不透明度">
                <View style={styles.row}>
                  <Pressable
                    onPress={() =>
                      updateSettings({
                        pressOpacity: Math.max(
                          0.5,
                          parseFloat((pressOpacity - 0.05).toFixed(2)),
                        ),
                      })
                    }
                    style={[
                      styles.smallBtn,
                      {
                        backgroundColor: Colors[colorScheme].backgroundTertiary,
                      },
                    ]}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={Colors[colorScheme].text}
                    />
                  </Pressable>
                  <Text style={styles.valueText}>
                    {pressOpacity.toFixed(2)}
                  </Text>
                  <Pressable
                    onPress={() =>
                      updateSettings({
                        pressOpacity: Math.min(
                          1.0,
                          parseFloat((pressOpacity + 0.05).toFixed(2)),
                        ),
                      })
                    }
                    style={[
                      styles.smallBtn,
                      {
                        backgroundColor: Colors[colorScheme].backgroundTertiary,
                      },
                    ]}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={Colors[colorScheme].text}
                    />
                  </Pressable>
                </View>
              </SettingItem>
              <SettingItem label="按压缩放比例">
                <View style={styles.row}>
                  <Pressable
                    onPress={() =>
                      updateSettings({
                        pressScale: Math.max(
                          0.88,
                          parseFloat((pressScale - 0.01).toFixed(2)),
                        ),
                      })
                    }
                    style={[
                      styles.smallBtn,
                      {
                        backgroundColor: Colors[colorScheme].backgroundTertiary,
                      },
                    ]}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={Colors[colorScheme].text}
                    />
                  </Pressable>
                  <Text style={styles.valueText}>{pressScale.toFixed(2)}</Text>
                  <Pressable
                    onPress={() =>
                      updateSettings({
                        pressScale: Math.min(
                          1.0,
                          parseFloat((pressScale + 0.01).toFixed(2)),
                        ),
                      })
                    }
                    style={[
                      styles.smallBtn,
                      {
                        backgroundColor: Colors[colorScheme].backgroundTertiary,
                      },
                    ]}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={Colors[colorScheme].text}
                    />
                  </Pressable>
                </View>
              </SettingItem>
            </>
          )}
          <SettingItem label="实时预览">
            <BouncyButton
              hapticFeedback={false}
              style={[styles.previewBtn, { backgroundColor: tintColor }]}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                按我测试效果
              </Text>
            </BouncyButton>
          </SettingItem>
        </Section>

        {/* 实验性功能 */}
        <Section title="实验性功能 (默认关闭)">
          <SettingItem label="启用 WebView 渲染">
            <Switch
              value={useWebView}
              onValueChange={(val) => updateSettings({ useWebView: val })}
              trackColor={{ true: tintColor }}
            />
          </SettingItem>
          <SettingItem label="启用私信功能 (IM)">
            <Switch
              value={enablePrivateMessaging}
              onValueChange={(val) =>
                updateSettings({ enablePrivateMessaging: val })
              }
              trackColor={{ true: tintColor }}
            />
          </SettingItem>
          <SettingItem label="记录浏览历史">
            <Switch
              value={enableBrowseHistory}
              onValueChange={(val) =>
                updateSettings({ enableBrowseHistory: val })
              }
              trackColor={{ true: tintColor }}
            />
          </SettingItem>
        </Section>

        {/* 3. 栏目管理 */}
        <Section title="栏目展示 (至少保留一个)">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
            <SettingItem key={tab} label={TAB_LABELS[tab]}>
              <Switch
                value={visibleTabs.includes(tab)}
                onValueChange={() => toggleTab(tab)}
                trackColor={{ true: tintColor }}
                disabled={tab === 'profile'}
              />
            </SettingItem>
          ))}
        </Section>

        {/* 4. 默认落地页 */}
        <Section title="默认启动页">
          <View style={styles.tabGrid}>
            {visibleTabs.map((tab) => (
              <Pressable
                key={tab}
                onPress={() => updateSettings({ defaultTab: tab })}
                style={[
                  styles.tabChip,
                  { backgroundColor: Colors[colorScheme].backgroundTertiary },
                  defaultTab === tab && { backgroundColor: tintColor },
                ]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    defaultTab === tab && { color: '#fff', fontWeight: 'bold' },
                  ]}
                >
                  {TAB_LABELS[tab]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Pressable onPress={resetSettings} style={styles.resetBtn}>
          <Text
            style={{ color: Colors[colorScheme].danger, fontWeight: 'bold' }}
          >
            恢复默认设置
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} type="secondary">
        {title}
      </Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  );
}

// Convert Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((x) => x + x)
      .join('');
  }
  if (cleanHex.length !== 6) return { h: 211, s: 100, l: 50 };
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  const sFrac = s / 100;
  const lFrac = l / 100;
  const c = (1 - Math.abs(2 * lFrac - 1)) * sFrac;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lFrac - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (val: number) => {
    const s = Math.round((val + m) * 255).toString(16);
    return s.length === 1 ? `0${s}` : s;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** A pure-JS horizontal slider using PanResponder — no native modules needed.
 *  Uses absolute pageX for both tap and drag so there's no coordinate drift. */
function HslSlider({
  value,
  min,
  max,
  thumbColor,
  gradientColors,
  onChange,
  onComplete,
}: {
  value: number;
  min: number;
  max: number;
  thumbColor: string;
  gradientColors: string[];
  onChange: (v: number) => void;
  onComplete?: (v: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const viewRef = useRef<any>(null);

  // Refs used inside PanResponder closures (stale-closure safe)
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onCompleteRef = useRef(onComplete);
  const minRef = useRef(min);
  const maxRef = useRef(max);

  // Sync every render
  onChangeRef.current = onChange;
  onCompleteRef.current = onComplete;
  minRef.current = min;
  maxRef.current = max;

  // Measure track's absolute position so we can compute from pageX
  const measureTrack = () => {
    viewRef.current?.measure(
      (_x: number, _y: number, width: number, _h: number, pageX: number) => {
        trackWidthRef.current = width;
        trackPageXRef.current = pageX;
        setTrackWidth(width);
      },
    );
  };

  const computeValue = (pageX: number) => {
    const x = pageX - trackPageXRef.current;
    const r = Math.max(0, Math.min(1, x / trackWidthRef.current));
    return Math.round(minRef.current + r * (maxRef.current - minRef.current));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Grant fires on tap AND on drag start — both handled identically
      onPanResponderGrant: (evt) => {
        onChangeRef.current(computeValue(evt.nativeEvent.pageX));
      },
      onPanResponderMove: (evt) => {
        onChangeRef.current(computeValue(evt.nativeEvent.pageX));
      },
      onPanResponderRelease: (evt) => {
        const finalVal = computeValue(evt.nativeEvent.pageX);
        onChangeRef.current(finalVal);
        if (onCompleteRef.current) {
          onCompleteRef.current(finalVal);
        }
      },
      onPanResponderTerminate: (evt) => {
        const finalVal = computeValue(evt.nativeEvent.pageX);
        onChangeRef.current(finalVal);
        if (onCompleteRef.current) {
          onCompleteRef.current(finalVal);
        }
      },
    }),
  ).current;

  const ratio =
    trackWidth > 0 ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;

  return (
    <RNView
      ref={viewRef}
      style={{ height: 38, justifyContent: 'center' }}
      onLayout={measureTrack}
      {...panResponder.panHandlers}
    >
      {/* Gradient track */}
      <RNView
        style={{
          height: 12,
          borderRadius: 6,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        {gradientColors.map((color, i) => (
          <RNView key={i} style={{ flex: 1, backgroundColor: color }} />
        ))}
      </RNView>
      {/* Thumb */}
      {trackWidth > 0 && (
        <RNView
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ratio * trackWidth - 11,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: thumbColor,
            borderWidth: 2.5,
            borderColor: '#fff',
            shadowColor: '#000',
            shadowOpacity: 0.28,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        />
      )}
    </RNView>
  );
}

function ColorPickerSection({
  primaryColor,
  onColorChange,
}: {
  primaryColor: string | null;
  onColorChange: (color: string | null) => void;
}) {
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme].text;
  const borderColor = Colors[colorScheme].border;

  const getInitialHsl = () =>
    primaryColor ? hexToHsl(primaryColor) : hexToHsl('#0084ff');
  const [hsl, setHsl] = useState(getInitialHsl);
  // Local text state for hex input — allows typing without jumping back
  const [hexText, setHexText] = useState(primaryColor || '#0084ff');

  // Sync sliders + hex input when primaryColor changes from outside (presets, reset)
  useEffect(() => {
    const target = primaryColor || '#0084ff';
    setHexText(target);
    const newHsl = hexToHsl(target);
    const currentHex = hslToHex(hsl.h, hsl.s, hsl.l);
    if (currentHex.toLowerCase() !== target.toLowerCase()) {
      setHsl(newHsl);
    }
  }, [primaryColor]);

  const applyHslLocal = (newHsl: { h: number; s: number; l: number }) => {
    setHsl(newHsl);
    const hex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    setHexText(hex);
  };

  const applyHslComplete = (newHsl: { h: number; s: number; l: number }) => {
    setHsl(newHsl);
    const hex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    setHexText(hex);
    onColorChange(hex);
  };

  const previewColor = hslToHex(hsl.h, hsl.s, hsl.l);

  // Build gradient arrays
  const hueGradient = Array.from(
    { length: 36 },
    (_, i) => `hsl(${i * 10}, 100%, 50%)`,
  );
  const satGradient = Array.from(
    { length: 10 },
    (_, i) => `hsl(${hsl.h}, ${i * 11}%, ${hsl.l}%)`,
  );
  const litGradient = Array.from(
    { length: 10 },
    (_, i) => `hsl(${hsl.h}, ${hsl.s}%, ${i * 11}%)`,
  );

  return (
    <RNView style={{ padding: 14, paddingTop: 6, gap: 14 }}>
      {/* Color preview + hex input row */}
      <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <RNView
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: primaryColor || previewColor,
            borderWidth: 2,
            borderColor: borderColor,
          }}
        />
        <TextInput
          style={[
            styles.hexInput,
            {
              color: textColor,
              borderColor: borderColor,
              backgroundColor: Colors[colorScheme].backgroundTertiary,
            },
          ]}
          placeholder="#0084ff"
          placeholderTextColor="#999"
          value={hexText}
          onChangeText={(val) => {
            const v = val.startsWith('#') ? val : val ? `#${val}` : '#';
            setHexText(v);
            if (v.length === 7) {
              onColorChange(v);
              setHsl(hexToHsl(v));
            }
          }}
          onBlur={() => {
            if (hexText.length !== 7) {
              const fallback = primaryColor || '#0084ff';
              setHexText(fallback);
            }
          }}
          maxLength={7}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={{ fontSize: 12, opacity: 0.5, flex: 1 }}>
          H:{hsl.h}° S:{hsl.s}% L:{hsl.l}%
        </Text>
      </RNView>

      {/* Hue slider */}
      <RNView style={{ gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold' }}>
          色相 (Hue) {hsl.h}°
        </Text>
        <HslSlider
          value={hsl.h}
          min={0}
          max={359}
          thumbColor={previewColor}
          gradientColors={hueGradient}
          onChange={(v) => applyHslLocal({ ...hsl, h: v })}
          onComplete={(v) => applyHslComplete({ ...hsl, h: v })}
        />
      </RNView>

      {/* Saturation slider */}
      <RNView style={{ gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold' }}>
          饱和度 (Saturation) {hsl.s}%
        </Text>
        <HslSlider
          value={hsl.s}
          min={10}
          max={100}
          thumbColor={previewColor}
          gradientColors={satGradient}
          onChange={(v) => applyHslLocal({ ...hsl, s: v })}
          onComplete={(v) => applyHslComplete({ ...hsl, s: v })}
        />
      </RNView>

      {/* Lightness slider */}
      <RNView style={{ gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: 'bold' }}>
          亮度 (Lightness) {hsl.l}%
        </Text>
        <HslSlider
          value={hsl.l}
          min={10}
          max={90}
          thumbColor={previewColor}
          gradientColors={litGradient}
          onChange={(v) => applyHslLocal({ ...hsl, l: v })}
          onComplete={(v) => applyHslComplete({ ...hsl, l: v })}
        />
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  sectionContent: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(150,150,150,0.05)',
    marginBottom: 1,
  },
  settingLabel: { fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    width: 50,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(150,150,150,0.05)',
    borderRadius: 16,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(150,150,150,0.05)',
    borderRadius: 16,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabChipText: { fontSize: 14 },
  previewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resetBtn: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,77,79,0.05)',
  },
  hexInput: {
    width: 110,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 10,
  },
});
