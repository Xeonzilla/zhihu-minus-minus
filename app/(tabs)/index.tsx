import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
// 使用 @ 别名导入组件
import {
  FEED_URLS,
  type FeedItem,
  getFeed,
  type RawFeedItem,
} from '@/api/zhihu';
import { BouncyButton } from '@/components/BouncyButton';
import { DailyList } from '@/components/DailyList';
import { FeedCard } from '@/components/FeedCard';
import { HotCard, type HotItem } from '@/components/HotCard';
import { RecentMoments } from '@/components/RecentMoments';
import { Text, useThemeColor, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import {
  type FeedExposureContext,
  feedExposureRepository,
} from '@/storage/feedExposureRepository';
import { useAuthStore } from '@/store/useAuthStore';
import { type TabKey, useSettingsStore } from '@/store/useSettingsStore';
import { supportsLocalFeedDedup } from '@/utils/feedDedup';
import {
  type FeedContentIdentity,
  getFeedContentIdentity,
  getFeedContentKey,
  getInMemoryFeedKey,
} from '@/utils/feedIdentity';
import { resolveLocalAccountKey } from '@/utils/localAccount';
import { refreshInfiniteQuery } from '@/utils/query';
import ProfileScreen from './profile';
import PublishScreen from './publish';

const _tintColor = Colors.light.tint; // Fallback or use colorScheme logic inside component

// 统一的所有可滑动的页面索引
// 0: 关注, 1: 推荐, 2: 热榜, 3: 日报, 4: 发布, 5: 我的
const TABS = [
  'following',
  'recommend',
  'local',
  'hot',
  'daily',
  'publish',
  'profile',
] as const;
type TabType = (typeof TABS)[number];
type FeedListItem = FeedItem | HotItem;

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const containerWidth = Math.min(windowWidth - 40, 500);

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { visibleTabs, defaultTab, localCityName } = useSettingsStore();

  // 动态过滤 Tabs
  const currentTabs = useMemo(() => {
    return [
      'following',
      'recommend',
      'local',
      'hot',
      'daily',
      'publish',
      'profile',
    ].filter((tab) => {
      if (tab === 'profile') return true;
      return visibleTabs.includes(tab as any);
    }) as TabType[];
  }, [visibleTabs]);

  const homeTabs = useMemo(() => {
    return currentTabs.filter((t) => !['publish', 'profile'].includes(t));
  }, [currentTabs]);
  const homeTabsCount = homeTabs.length;

  const bottomCapsuleWidth = useMemo(() => {
    const hasPublish = currentTabs.includes('publish');
    const hasProfile = currentTabs.includes('profile');
    const totalBottomIcons =
      (homeTabsCount > 0 ? 1 : 0) + (hasPublish ? 1 : 0) + (hasProfile ? 1 : 0);
    return containerWidth / (totalBottomIcons || 1) - 20;
  }, [currentTabs, homeTabsCount, containerWidth]);

  // 计算初始页码
  const initialPageIndex = useMemo(() => {
    // 优先考虑 URL 参数中的 tab
    if (params.tab) {
      const idx = currentTabs.indexOf(params.tab as TabKey);
      if (idx >= 0) return idx;
    }
    const idx = currentTabs.indexOf(defaultTab);
    return idx >= 0 ? idx : 0;
  }, [currentTabs, defaultTab, params.tab]);

  // 核心状态：共享滚动位置
  const scrollX = useSharedValue(initialPageIndex);
  const pagerRef = useRef<PagerView>(null);
  const { cookies } = useAuthStore();

  const tintColor = useThemeColor({}, 'primary');
  const textColor = useThemeColor({}, 'text');
  const indicatorBgColor = useThemeColor({}, 'primary_26');
  const [currentPage, setCurrentPage] = useState(initialPageIndex);
  const [guestCookieReady, setGuestCookieReady] = useState(false);

  // 监听 params.tab 变化并切换页面
  useEffect(() => {
    if (params.tab) {
      const idx = currentTabs.indexOf(params.tab as TabKey);
      if (idx >= 0 && idx !== currentPage) {
        pagerRef.current?.setPage(idx);
        setCurrentPage(idx);
      }
    }
  }, [params.tab, currentTabs, currentPage]);

  const [scrolledTabs, setScrolledTabs] = useState<Record<number, boolean>>({});
  const listRefs = useRef<any[]>([]);

  const SCROLL_THRESHOLD_SHOW = 300;
  const SCROLL_THRESHOLD_HIDE = 200;

  const handleScrollUpdate = useCallback(
    (pageIndex: number, offset: number) => {
      setScrolledTabs((prev) => {
        const currentlyScrolled = prev[pageIndex] || false;
        let nextScrolled = currentlyScrolled;

        if (!currentlyScrolled && offset > SCROLL_THRESHOLD_SHOW) {
          nextScrolled = true;
        } else if (currentlyScrolled && offset < SCROLL_THRESHOLD_HIDE) {
          nextScrolled = false;
        }

        if (currentlyScrolled === nextScrolled) return prev;
        return { ...prev, [pageIndex]: nextScrolled };
      });
    },
    [],
  );

  const handleHomeTabPress = () => {
    const isAtHome = currentPage < homeTabsCount;

    if (isAtHome) {
      if (scrolledTabs[currentPage]) {
        // 如果已经在首页 Tab 且已滚动，则置顶
        listRefs.current[currentPage]?.scrollToOffset({
          offset: 0,
          animated: true,
        });
      } else {
        // 在顶部时，刷新当前 tab 的内容
        listRefs.current[currentPage]?.refresh?.();
      }
    } else {
      // 如果不在首页 Tab（如发布或我的页面），则切换到第一页
      pagerRef.current?.setPage(0);
    }
  };

  const handleTabPress = (index: number) => {
    pagerRef.current?.setPage(index);
  };

  // 顶部导航栏动画样式
  const topNavAnimStyle = useAnimatedStyle(() => {
    if (homeTabsCount === 0) {
      return {
        opacity: 0,
        transform: [{ translateY: -100 }],
        pointerEvents: 'none',
      };
    }
    const fadeStart = homeTabsCount - 1;
    const fadeEnd = homeTabsCount;
    const opacity = interpolate(
      scrollX.value,
      [fadeStart, fadeEnd],
      [1, 0],
      Extrapolate.CLAMP,
    );
    const translateY = interpolate(
      scrollX.value,
      [fadeStart, fadeEnd],
      [0, -100],
      Extrapolate.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
      pointerEvents: scrollX.value > fadeStart + 0.5 ? 'none' : 'auto',
    };
  });

  // 顶部 Tab 指示器动画
  const topIndicatorStyle = useAnimatedStyle(() => {
    const tabWidth = 58;
    const maxIndex = Math.max(0, homeTabsCount - 1);
    const clampedScroll = interpolate(
      scrollX.value,
      [0, maxIndex],
      [0, maxIndex],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ translateX: clampedScroll * tabWidth }],
    };
  });

  // 底部导航栏指示器动画
  const bottomIndicatorStyle = useAnimatedStyle(() => {
    const hasPublish = currentTabs.includes('publish');
    const hasProfile = currentTabs.includes('profile');

    // 底部导航栏总图标数 (首页算一个)
    const totalBottomIcons =
      (homeTabsCount > 0 ? 1 : 0) + (hasPublish ? 1 : 0) + (hasProfile ? 1 : 0);
    const iconWidth = containerWidth / (totalBottomIcons || 1);

    // 构建插值映射表
    const inputRange: number[] = [];
    const outputRange: number[] = [];

    // 1. 首页区域：无论在首页内怎么滑，底部指示器都在索引 0
    if (homeTabsCount === 1) {
      inputRange.push(0);
      outputRange.push(0);
    } else if (homeTabsCount > 1) {
      inputRange.push(0, homeTabsCount - 1);
      outputRange.push(0, 0);
    }

    // 2. 发布区域
    if (hasPublish) {
      const publishIdx = currentTabs.indexOf('publish');
      const bottomIdx = homeTabsCount > 0 ? 1 : 0;
      inputRange.push(publishIdx);
      outputRange.push(bottomIdx * iconWidth);
    }

    // 3. 个人区域
    if (hasProfile) {
      const profileIdx = currentTabs.indexOf('profile');
      const bottomIdx = (homeTabsCount > 0 ? 1 : 0) + (hasPublish ? 1 : 0);
      inputRange.push(profileIdx);
      outputRange.push(bottomIdx * iconWidth);
    }

    // 确保 inputRange 是递增且唯一的（防止计算错误）
    const translateX = interpolate(
      scrollX.value,
      inputRange.length > 1 ? inputRange : [0, 1],
      outputRange.length > 1 ? outputRange : [0, 0],
      Extrapolate.CLAMP,
    );

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={styles.container}>
      {/* 1. 顶部 Tab 导航 (Home 专属) */}
      <Animated.View
        style={[styles.topNavContainer, { top: insets.top }, topNavAnimStyle]}
      >
        <BlurView
          intensity={100}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[
            styles.blurWrapper,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? 'rgba(0,0,0,0.7)'
                  : 'rgba(255,255,255,0.85)',
            },
          ]}
        >
          <View style={styles.topNav}>
            <View
              style={{
                flexDirection: 'row',
                flex: 1,
                backgroundColor: 'transparent',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <Animated.View
                style={[
                  styles.topPill,
                  { backgroundColor: indicatorBgColor },
                  topIndicatorStyle,
                ]}
              />
              {currentTabs
                .filter((t) => !['publish', 'profile'].includes(t))
                .map((tab, index) => {
                  const labels: Record<string, string> = {
                    following: '关注',
                    recommend: '推荐',
                    local: localCityName || '同城',
                    hot: '热榜',
                    daily: '日报',
                  };
                  return (
                    <BouncyButton
                      key={tab}
                      onPress={() => handleTabPress(index)}
                      style={[
                        styles.navItem,
                        { width: 54, paddingHorizontal: 0 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.navText,
                          currentPage === index && {
                            fontWeight: 'bold',
                            color: tintColor,
                          },
                        ]}
                        type={currentPage === index ? 'default' : 'secondary'}
                      >
                        {labels[tab]}
                      </Text>
                    </BouncyButton>
                  );
                })}
            </View>
            <Pressable
              onPress={() => router.push('/search')}
              style={styles.searchBtn}
            >
              <Ionicons name="search" size={22} color={textColor} />
            </Pressable>
          </View>
        </BlurView>
      </Animated.View>

      <PagerView
        key={`pager-${currentTabs.join('-')}`} // 强制重新渲染
        ref={pagerRef}
        style={styles.pager}
        initialPage={initialPageIndex}
        onPageScroll={(e) => {
          scrollX.value = e.nativeEvent.position + e.nativeEvent.offset;
        }}
        onPageSelected={(e) => {
          setCurrentPage(e.nativeEvent.position);
        }}
      >
        {currentTabs.map((tab, idx) => {
          return (
            <View key={tab} style={{ flex: 1, backgroundColor: 'transparent' }}>
              {tab === 'daily' ? (
                <DailyList
                  ref={(el) => (listRefs.current[idx] = el)}
                  insets={insets}
                  onScroll={(offset) => handleScrollUpdate(idx, offset)}
                />
              ) : tab === 'publish' ? (
                <PublishScreen />
              ) : tab === 'profile' ? (
                <ProfileScreen />
              ) : !cookies && tab === 'following' ? (
                <View style={styles.loginPrompt}>
                  <Text style={styles.loginText} type="secondary">
                    登录后才能看此栏目哦
                  </Text>
                  <Pressable
                    style={[styles.loginBtn, { backgroundColor: tintColor }]}
                    onPress={() => router.push('/login' as any)}
                  >
                    <Text style={styles.loginBtnText}>去登录</Text>
                  </Pressable>
                </View>
              ) : (
                <FeedList
                  ref={(el) => (listRefs.current[idx] = el)}
                  tab={tab as any}
                  isActive={isFocused && currentPage === idx}
                  insets={insets}
                  guestCookieReady={guestCookieReady}
                  onScroll={(offset) => handleScrollUpdate(idx, offset)}
                />
              )}
            </View>
          );
        })}
      </PagerView>

      {/* 3. 底部悬浮导航栏 (Custom TabBar) */}
      <View
        style={[
          styles.bottomBarContainer,
          { bottom: insets.bottom, width: containerWidth },
        ]}
      >
        <BlurView
          intensity={130}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[
            styles.bottomBlur,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? 'rgba(0,0,0,0.7)'
                  : 'rgba(255,255,255,0.85)',
            },
          ]}
        >
          <View style={styles.bottomNavItems}>
            {/* 联动指示器 */}
            <Animated.View
              style={[
                styles.bottomIndicator,
                {
                  backgroundColor: indicatorBgColor,
                  width: bottomCapsuleWidth,
                },
                bottomIndicatorStyle,
              ]}
            />

            {currentTabs.some((t) => !['publish', 'profile'].includes(t)) && (
              <BottomTabIcon
                // 判断逻辑：当前在首页区域且当前子 Tab 有滚动
                isScrollTop={
                  currentPage <
                    currentTabs.filter(
                      (t) => !['publish', 'profile'].includes(t),
                    ).length && scrolledTabs[currentPage]
                }
                icon={
                  currentPage <
                  currentTabs.filter((t) => !['publish', 'profile'].includes(t))
                    .length
                    ? 'home'
                    : 'home-outline'
                }
                active={
                  currentPage <
                  currentTabs.filter((t) => !['publish', 'profile'].includes(t))
                    .length
                }
                onPress={handleHomeTabPress}
                color={
                  currentPage <
                  currentTabs.filter((t) => !['publish', 'profile'].includes(t))
                    .length
                    ? tintColor
                    : Colors[colorScheme].textSecondary
                }
                width={bottomCapsuleWidth}
              />
            )}

            {currentTabs.includes('publish') && (
              <BottomTabIcon
                icon={
                  currentTabs[currentPage] === 'publish' ? 'add-circle' : 'add'
                }
                active={currentTabs[currentPage] === 'publish'}
                onPress={() => handleTabPress(currentTabs.indexOf('publish'))}
                color={
                  currentTabs[currentPage] === 'publish'
                    ? tintColor
                    : Colors[colorScheme].textSecondary
                }
                size={currentTabs[currentPage] === 'publish' ? 28 : 24}
                width={bottomCapsuleWidth}
              />
            )}

            {currentTabs.includes('profile') && (
              <BottomTabIcon
                icon={
                  currentTabs[currentPage] === 'profile'
                    ? 'person'
                    : 'person-outline'
                }
                active={currentTabs[currentPage] === 'profile'}
                onPress={() => handleTabPress(currentTabs.indexOf('profile'))}
                color={
                  currentTabs[currentPage] === 'profile'
                    ? tintColor
                    : Colors[colorScheme].textSecondary
                }
                width={bottomCapsuleWidth}
              />
            )}
          </View>
        </BlurView>
      </View>
      {!cookies && !guestCookieReady && (
        <View
          style={{
            width: 1,
            height: 1,
            opacity: 0,
            position: 'absolute',
            pointerEvents: 'none',
          }}
        >
          <WebView
            source={{ uri: 'https://www.zhihu.com/' }}
            sharedCookiesEnabled={true}
            injectedJavaScript={`
              (function() {
                var checkCookie = setInterval(function() {
                  if (document.cookie.includes('d_c0')) {
                    clearInterval(checkCookie);
                    setTimeout(function() {
                      window.ReactNativeWebView.postMessage('ready');
                    }, 2000); // 找到 d_c0 后再等 2 秒，让其他 cookie 载入
                  }
                }, 500);
              })();
              true;
            `}
            onMessage={() => {
              setGuestCookieReady(true);
            }}
          />
        </View>
      )}
    </View>
  );
}

const _AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

function BottomTabIcon({
  icon,
  active,
  onPress,
  color,
  size = 24,
  isScrollTop,
  width,
}: any) {
  // 动画状态
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // 当置顶状态切换时播放动画
  React.useEffect(() => {
    scale.value = withSequence(
      withTiming(0.6, { duration: 150 }),
      withTiming(1, { duration: 150 }),
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.bottomTabItem} className="bg-transparent">
      <BouncyButton
        onPress={onPress}
        style={{
          width: width || 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Animated.View style={animatedStyle}>
          <Ionicons
            name={isScrollTop ? 'arrow-up-circle' : icon}
            size={isScrollTop ? size + 4 : size}
            color={isScrollTop ? color : color}
          />
        </Animated.View>
      </BouncyButton>
    </View>
  );
}

// FeedList 组件
const FeedList = React.forwardRef<
  any,
  {
    tab: TabType;
    isActive: boolean;
    insets: any;
    guestCookieReady: boolean;
    onScroll?: (offset: number) => void;
  }
>(({ tab, isActive, insets, guestCookieReady, onScroll }, ref) => {
  const queryClient = useQueryClient();
  const { cookies, me } = useAuthStore();
  const { enableLocalFeedDedup } = useSettingsStore();
  const colorScheme = useColorScheme();
  const tintColor = useThemeColor({}, 'primary');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const localAccountKey = useMemo(
    () => resolveLocalAccountKey(me, Boolean(cookies)),
    [cookies, me],
  );
  const queryAccountKey = localAccountKey ?? 'authenticated-pending';
  const localDedupEnabled =
    enableLocalFeedDedup &&
    supportsLocalFeedDedup(tab) &&
    localAccountKey !== null;
  const exposureContext = useMemo<FeedExposureContext | null>(() => {
    if (!localAccountKey) return null;
    return { accountKey: localAccountKey, feedType: tab };
  }, [localAccountKey, tab]);
  const [recentExposureKeys, setRecentExposureKeys] =
    useState<Set<string> | null>(() => (localDedupEnabled ? null : new Set()));

  useEffect(() => {
    let cancelled = false;
    if (!localDedupEnabled || !exposureContext) {
      setRecentExposureKeys(new Set());
      return () => {
        cancelled = true;
      };
    }

    setRecentExposureKeys(null);
    void feedExposureRepository
      .getRecentContentKeys(exposureContext)
      .then((keys) => {
        if (!cancelled) setRecentExposureKeys(keys);
      })
      .catch((error) => {
        console.warn('读取本地 Feed 曝光记录失败', error);
        if (!cancelled) setRecentExposureKeys(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [exposureContext, localDedupEnabled]);

  const exposureTrackingRef = useRef({
    enabled:
      isActive &&
      localDedupEnabled &&
      exposureContext !== null &&
      recentExposureKeys !== null,
    context: exposureContext,
  });
  exposureTrackingRef.current = {
    enabled:
      isActive &&
      localDedupEnabled &&
      exposureContext !== null &&
      recentExposureKeys !== null,
    context: exposureContext,
  };
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 800,
  }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: FeedListItem }> }) => {
      const { enabled, context } = exposureTrackingRef.current;
      if (!enabled || !context) return;

      const identities = viewableItems
        .map((viewable) => getFeedContentIdentity(viewable.item))
        .filter(
          (identity): identity is FeedContentIdentity => identity !== null,
        );
      if (identities.length > 0) {
        void feedExposureRepository
          .recordExposures(context, identities)
          .catch((error) => {
            console.warn('记录本地 Feed 曝光失败', error);
          });
      }
    },
  ).current;
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['zhihu-feed', queryAccountKey, tab],
    queryFn: async ({ pageParam = (FEED_URLS as any)[tab] }) => {
      if (!cookies && tab === 'following') return { items: [], nextUrl: null };
      try {
        const data = await getFeed(pageParam as string);
        const rawItems = data.data || [];
        let items: Array<FeedItem | HotItem>;
        if (tab === 'following')
          items = rawItems
            .map((item: RawFeedItem) => parseFollowingData(item))
            .filter(Boolean) as FeedItem[];
        else if (tab === 'recommend' || tab === 'local')
          items = rawItems.map((item: RawFeedItem) => parseRecommendData(item));
        else
          items = rawItems.map((item: RawFeedItem, index: number) =>
            parseHotData(item, index),
          );
        return {
          items,
          nextUrl: data.paging?.next?.replace('http://', 'https://'),
        };
      } catch (_e: any) {
        return { items: [], nextUrl: null };
      }
    },
    initialPageParam: (FEED_URLS as any)[tab],
    getNextPageParam: (lastPage) => lastPage.nextUrl,
    enabled:
      (!!cookies || guestCookieReady) &&
      (!localDedupEnabled || recentExposureKeys !== null),
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (localDedupEnabled && exposureContext) {
        try {
          const keys =
            await feedExposureRepository.getRecentContentKeys(exposureContext);
          setRecentExposureKeys(keys);
        } catch (error) {
          console.warn('刷新本地 Feed 曝光记录失败', error);
        }
      }
      await refreshInfiniteQuery(
        queryClient,
        ['zhihu-feed', queryAccountKey, tab],
        refetch,
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [
    exposureContext,
    localDedupEnabled,
    queryClient,
    queryAccountKey,
    refetch,
    tab,
  ]);

  const flattenedData = useMemo(() => {
    const all = data?.pages.flatMap((page) => page.items) ?? [];
    const seen = new Set<string>();
    return all.filter((item) => {
      const inMemoryKey = getInMemoryFeedKey(item);
      if (!inMemoryKey || seen.has(inMemoryKey)) return false;
      seen.add(inMemoryKey);

      const persistentKey = getFeedContentKey(item);
      if (
        localDedupEnabled &&
        persistentKey &&
        recentExposureKeys?.has(persistentKey)
      ) {
        return false;
      }
      return true;
    });
  }, [data, localDedupEnabled, recentExposureKeys]);

  const flashListRef = useRef<FlashListRef<FeedListItem>>(null);

  useEffect(() => {
    if (!isActive || !localDedupEnabled || recentExposureKeys === null) return;

    const frame = requestAnimationFrame(() => {
      flashListRef.current?.recomputeViewableItems();
    });
    return () => cancelAnimationFrame(frame);
  }, [isActive, localDedupEnabled, recentExposureKeys]);

  React.useImperativeHandle(ref, () => ({
    scrollToOffset: (args: any) => flashListRef.current?.scrollToOffset(args),
    refresh: handleRefresh,
  }));

  return (
    <FlashList
      ref={flashListRef}
      showsVerticalScrollIndicator={false}
      data={flattenedData}
      keyExtractor={(item, index) => {
        const key = getInMemoryFeedKey(item);
        return `feed-${key || index}`;
      }}
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing || isRefetching}
          onRefresh={handleRefresh}
          tintColor={tintColor}
          colors={[tintColor]}
          progressViewOffset={insets.top + 70}
        />
      }
      onScroll={(e) => onScroll?.(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={100}
      contentContainerStyle={{
        paddingTop: insets.top + 70,
        paddingBottom: 120,
      }}
      renderItem={({ item }: { item: any }) =>
        tab === 'hot' ? (
          <HotCard item={item} />
        ) : (
          <FeedCard item={item} tab={tab} />
        )
      }
      ListHeaderComponent={tab === 'following' ? <RecentMoments /> : null}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={{ margin: 20 }} /> : null
      }
      ListEmptyComponent={
        isLoading ? (
          <View className="flex-1 items-center justify-center mt-[100px] bg-transparent">
            <ActivityIndicator size="large" color={tintColor} />
          </View>
        ) : (
          <View className="flex-1 items-center justify-center mt-[100px] bg-transparent">
            <Text type="secondary">暂无内容 喵~</Text>
          </View>
        )
      }
    />
  );
});

// 数据解析函数保持不变 (省略以节省空间，实际代码中应保留)
function parseFollowingData(item: RawFeedItem): FeedItem | null {
  const target = item.target;
  if (!target) return null;
  const type = target.type;
  let appType: 'answers' | 'articles' | 'pins' | 'questions' = 'answers';
  if (type === 'answer') appType = 'answers';
  else if (type === 'article') appType = 'articles';
  else if (type === 'pin') appType = 'pins';
  else if (type === 'question') appType = 'questions';

  return {
    id: target.id?.toString() || Math.random().toString(),
    title: target.question?.title || target.title || '',
    questionId:
      target.question?.id?.toString() ||
      (type === 'question' ? target.id?.toString() : ''),
    actionText: item.action_text,
    author: {
      id: target.author?.id || '',
      url_token: target.author?.url_token || '',
      name: target.author?.name || '匿名用户',
      avatar:
        target.author?.avatar_url ||
        'https://picx.zhimg.com/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg',
    },
    excerpt: target.excerpt || target.content?.[0]?.content || '',
    content: target.content || '',
    image:
      target.thumbnail ||
      (target.content_img && target.content_img.length > 0
        ? target.content_img[0]
        : null),
    voteCount: target.voteup_count || target.like_count || 0,
    commentCount: target.comment_count || 0,
    favlistsCount:
      target.favorite_count || target.reaction?.statistics?.favorites || 0,
    voted: target.relationship?.voting || 0,
    type: appType,
    topics: target.topics?.map((t: any) => ({ id: t.id, name: t.name })) || [],
  };
}

function parseRecommendData(item: RawFeedItem): FeedItem {
  const target = (item.target || item) as any;
  const type = target.type;
  const stableId = target.id?.toString().trim();
  let appType: 'answers' | 'articles' | 'pins' | 'questions' = 'answers';
  if (type === 'answer') appType = 'answers';
  else if (type === 'article') appType = 'articles';
  else if (type === 'pin') appType = 'pins';
  else if (type === 'question') appType = 'questions';

  return {
    id: stableId || Math.random().toString(),
    isIdStable: Boolean(stableId),
    title: target.question?.title || target.title || '',
    questionId:
      target.question?.id?.toString() ||
      (type === 'question' ? target.id?.toString() : ''),
    author: {
      id: target.author?.id || '',
      name: target.author?.name || '匿名用户',
      avatar:
        target.author?.avatar_url ||
        'https://picx.zhimg.com/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg',
      headline: target.author?.headline || '',
    },
    excerpt: target.excerpt || target.content?.[0]?.content || '',
    content: target.content || '',
    image:
      target.thumbnail ||
      (target.content_img && target.content_img.length > 0
        ? target.content_img[0]
        : null),
    voteCount: target.voteup_count || target.like_count || 0,
    commentCount: target.comment_count || 0,
    favlistsCount:
      target.favlists_count ||
      target.favorite_count ||
      target.reaction?.statistics?.favorites ||
      0,
    voted: target.relationship?.voting || 0,
    type: appType,
    topics: target.topics?.map((t: any) => ({ id: t.id, name: t.name })) || [],
  };
}

function parseHotData(item: any, index: number): HotItem {
  const target = (item.target || item) as any;
  const questionId =
    target.link?.url?.split('/').pop() || target.url?.split('/').pop() || '';

  // Handle fallback fields for both JSON structures
  const hotValue =
    target.metrics_area?.text || item.detail_text || target.detail_text || '';
  const answerCount =
    item.feed_specific?.answer_count || target.answer_count || 0;

  // Reconstruct labelArea if it's missing but we have card_label
  let labelArea = target.label_area || null;
  if (!labelArea) {
    if (item.card_label?.type === 'new' || item.debut) {
      labelArea = { type: 'text', text: '新', normal_color: '#ff9607' };
    } else if (item.card_label?.type === 'hot') {
      labelArea = { type: 'text', text: '热', normal_color: '#f65324' };
    }
  }

  return {
    id:
      item.id?.toString() || target.id?.toString() || Math.random().toString(),
    questionId: questionId,
    rank: index + 1,
    title: target.title_area?.text || target.title || '无标题',
    excerpt: target.excerpt_area?.text || target.excerpt || '',
    image:
      target.image_area?.url ||
      item.children?.[0]?.thumbnail ||
      item.image_url ||
      null,
    hotValue,
    answerCount,
    labelArea,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pager: { flex: 1 },
  topNavContainer: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
  blurWrapper: {
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 50,
  },
  navItem: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  navText: { fontSize: 15 },
  topPill: {
    position: 'absolute',
    width: 54,
    height: 34,
    borderRadius: 17,
    left: 0,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomBarContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1001,
  },
  bottomBlur: { borderRadius: 32, overflow: 'hidden', height: 64 },
  bottomNavItems: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  bottomTabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomIndicator: {
    position: 'absolute',
    height: 44,
    borderRadius: 22,
    left: 10,
  },

  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loginText: { fontSize: 16, marginTop: 20, marginBottom: 30 },
  loginBtn: { paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
