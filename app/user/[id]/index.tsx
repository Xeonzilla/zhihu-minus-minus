import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  View as NativeView,
  Pressable,
  TextInput,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Reanimated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  followMember,
  getMe,
  getMember,
  getMemberActivities,
  getMemberRelations,
  searchContent,
  unfollowMember,
} from '@/api/zhihu';
import { addReadHistory } from '@/api/zhihu/history';
import { FeedCard } from '@/components/FeedCard';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSettingsStore } from '@/store/useSettingsStore';

const AnimatedFlashList = Reanimated.createAnimatedComponent(FlashList) as any;

const PROFILE_TABS = [
  { key: 'activities', label: '动态', countKey: undefined },
  { key: 'answers', label: '回答', countKey: 'answer_count' },
  { key: 'articles', label: '文章', countKey: 'articles_count' },
  { key: 'questions', label: '提问', countKey: 'question_count' },
  { key: 'pins', label: '想法', countKey: 'pins_count' },
] as const;

type ProfileTabKey = (typeof PROFILE_TABS)[number]['key'];

export default function UserDetailScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { id, avatar: initialAvatar } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<ProfileTabKey>('answers');
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({
    answers: true,
  });
  const [sortBy, setSortBy] = useState<'created' | 'voteups'>('created');
  const [followLoading, setFollowLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // 动态测量 Header 高度
  const [headerHeight, setHeaderHeight] = useState(420);
  const maxScroll = useSharedValue(370);

  const pagerRef = useRef<PagerView>(null);
  const panStart = useRef({ x: 0, y: 0 });

  // 1. 各个 Tab 的独立滚动高度 (Shared Value)
  const scrollYActivities = useSharedValue(0);
  const scrollYAnswers = useSharedValue(0);
  const scrollYArticles = useSharedValue(0);
  const scrollYQuestions = useSharedValue(0);
  const scrollYPins = useSharedValue(0);

  // 2. 列表引用，用于程序控制滚动以对齐 Header 高度
  const listRefs = useRef<(any | null)[]>([null, null, null, null, null]);

  // 3. 当前活跃的 Tab 索引与 PagerView 滑动状态
  const activeIndex = useSharedValue(1); // 默认是 'answers' (index 1)
  const activeIndexRef = useRef(1);
  const pagerPosition = useSharedValue(1);
  const pagerOffset = useSharedValue(0);

  // 获取对应 Tab 索引的 shared value
  const getSharedValue = (idx: number) => {
    if (idx === 0) return scrollYActivities;
    if (idx === 1) return scrollYAnswers;
    if (idx === 2) return scrollYArticles;
    if (idx === 3) return scrollYQuestions;
    return scrollYPins;
  };

  // 4. 绑定各 Tab 的 Scroll Handler
  const scrollHandler0 = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollYActivities.value = e.contentOffset.y;
    },
  });
  const scrollHandler1 = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollYAnswers.value = e.contentOffset.y;
    },
  });
  const scrollHandler2 = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollYArticles.value = e.contentOffset.y;
    },
  });
  const scrollHandler3 = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollYQuestions.value = e.contentOffset.y;
    },
  });
  const scrollHandler4 = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollYPins.value = e.contentOffset.y;
    },
  });

  // 5. 根据当前滑动进度和各个 Tab 的滚动高度，插值计算出 Header 的 translateY
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const p = pagerPosition.value;
    const o = pagerOffset.value;

    const idx1 = Math.max(0, Math.min(4, Math.floor(p)));
    const idx2 = Math.max(0, Math.min(4, Math.ceil(p + o)));

    const y1 =
      idx1 === 0
        ? scrollYActivities.value
        : idx1 === 1
          ? scrollYAnswers.value
          : idx1 === 2
            ? scrollYArticles.value
            : idx1 === 3
              ? scrollYQuestions.value
              : scrollYPins.value;

    const y2 =
      idx2 === 0
        ? scrollYActivities.value
        : idx2 === 1
          ? scrollYAnswers.value
          : idx2 === 2
            ? scrollYArticles.value
            : idx2 === 3
              ? scrollYQuestions.value
              : scrollYPins.value;

    // 滑动过程中平滑插值
    const currentScrollY = y1 + (y2 - y1) * o;

    const translateY = interpolate(
      currentScrollY,
      [0, maxScroll.value],
      [0, -maxScroll.value],
      'clamp' as any,
    );

    return {
      transform: [{ translateY }],
    };
  });

  // 6. 同步滚动高度以防止跳动
  const syncLists = (currentIdx: number) => {
    const currentScrollY = getSharedValue(currentIdx).value;
    const collapsedHeight = Math.min(currentScrollY, maxScroll.value);

    // 将其他未达到当前折叠高度的 Tab 列表，程序滚动到对应的折叠高度上
    for (let i = 0; i < PROFILE_TABS.length; i++) {
      if (i !== currentIdx) {
        const val = getSharedValue(i);
        if (val.value < collapsedHeight) {
          val.value = collapsedHeight;
          listRefs.current[i]?.scrollToOffset({
            offset: collapsedHeight,
            animated: false,
          });
        }
      }
    }
  };

  // Tapping tab button sync & transition
  const handleTabPress = (idx: number) => {
    const currentIdx = activeIndexRef.current;
    const currentScrollY = getSharedValue(currentIdx).value;
    const collapsedHeight = Math.min(currentScrollY, maxScroll.value);

    const val = getSharedValue(idx);
    if (val.value < collapsedHeight) {
      val.value = collapsedHeight;
      listRefs.current[idx]?.scrollToOffset({
        offset: collapsedHeight,
        animated: false,
      });
    }

    pagerRef.current?.setPage(idx);
    const tab = PROFILE_TABS[idx].key;
    setActiveTab(tab);
    activeIndex.value = idx;
    activeIndexRef.current = idx;
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    navigation.setOptions({ title: '个人主页' });
  }, [navigation]);

  const borderColor = Colors[colorScheme].border;
  const { primaryColor: customPrimaryColor } = useSettingsStore();
  const primaryColor = customPrimaryColor || '#0084ff';

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => getMe() });
  const isMe = me?.id === id;

  const { data: user, refetch: refetchUser } = useQuery({
    queryKey: ['user-detail', id],
    queryFn: async () => {
      try {
        return await getMember(id as string);
      } catch (err: any) {
        if (err.response?.status === 403)
          return await getMember(
            id as string,
            'follower_count,headline,cover_url,description,answer_count,articles_count,question_count,pins_count',
          );
        return null;
      }
    },
  });

  const enableBrowseHistory = useSettingsStore((s) => s.enableBrowseHistory);

  useEffect(() => {
    if (enableBrowseHistory && user?.id) {
      addReadHistory({
        content_token: String(user.id),
        content_type: 'profile',
      });
    }
  }, [enableBrowseHistory, user?.id]);

  // 1. 动态 Query
  const activitiesQuery = useInfiniteQuery({
    queryKey: ['user-activities', id],
    queryFn: async ({ pageParam = 0 }) => {
      const targetId = (user?.url_token || id) as string;
      try {
        return await getMemberActivities(targetId, 20, pageParam as number);
      } catch (err) {
        console.error('获取动态失败:', err);
        return { data: [], paging: { is_end: true } };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const match = lastPage.paging?.next?.match(/offset=(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    },
    enabled:
      !!user && (visitedTabs['activities'] || activeTab === 'activities'),
  });

  // 2. 回答 Query
  const answersQuery = useInfiniteQuery({
    queryKey: ['user-answers', id, sortBy],
    queryFn: async ({ pageParam = 0 }) => {
      const targetId = (user?.url_token || id) as string;
      const include =
        'data[*].is_normal,admin_closed_comment,content,voteup_count,comment_count,favlists_count,created_time,updated_time,excerpt,reaction,relationship.voting,relationship.is_author,relationship.is_thanked;data[*].author;data[*].question.title';
      try {
        return await getMemberRelations(targetId, 'answers', {
          limit: 20,
          offset: pageParam as number,
          include,
          sort_by: sortBy,
        });
      } catch (err) {
        console.error('获取回答失败:', err);
        return { data: [], paging: { is_end: true } };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const match = lastPage.paging?.next?.match(/offset=(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    },
    enabled: !!user && (visitedTabs['answers'] || activeTab === 'answers'),
  });

  // 3. 提问 Query
  const questionsQuery = useInfiniteQuery({
    queryKey: ['user-questions', id],
    queryFn: async ({ pageParam = 0 }) => {
      const targetId = (user?.url_token || id) as string;
      const include =
        'data[*].created,answer_count,follower_count,admin_closed_comment,title,reaction,relationship.is_following;data[*].author';
      try {
        return await getMemberRelations(targetId, 'questions', {
          limit: 20,
          offset: pageParam as number,
          include,
        });
      } catch (err) {
        console.error('获取提问失败:', err);
        return { data: [], paging: { is_end: true } };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const match = lastPage.paging?.next?.match(/offset=(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    },
    enabled: !!user && (visitedTabs['questions'] || activeTab === 'questions'),
  });

  // 4. 文章 Query
  const articlesQuery = useInfiniteQuery({
    queryKey: ['user-articles', id],
    queryFn: async ({ pageParam = 0 }) => {
      const targetId = (user?.url_token || id) as string;
      const include =
        'data[*].comment_count,content,voteup_count,favlists_count,created,updated,title,excerpt,reaction,relationship.voting;data[*].author';
      try {
        return await getMemberRelations(targetId, 'articles', {
          limit: 20,
          offset: pageParam as number,
          include,
        });
      } catch (err) {
        console.error('获取文章失败:', err);
        return { data: [], paging: { is_end: true } };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const match = lastPage.paging?.next?.match(/offset=(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    },
    enabled: !!user && (visitedTabs['articles'] || activeTab === 'articles'),
  });

  // 5. 想法 Query
  const pinsQuery = useInfiniteQuery({
    queryKey: ['user-pins', id],
    queryFn: async ({ pageParam = 0 }) => {
      const targetId = (user?.url_token || id) as string;
      const include =
        'data[*].content,reaction_count,comment_count,created,reaction,relationship.voting;data[*].author';
      try {
        return await getMemberRelations(targetId, 'pins', {
          limit: 20,
          offset: pageParam as number,
          include,
        });
      } catch (err) {
        console.error('获取想法失败:', err);
        return { data: [], paging: { is_end: true } };
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const match = lastPage.paging?.next?.match(/offset=(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    },
    enabled: !!user && (visitedTabs['pins'] || activeTab === 'pins'),
  });

  const getTabQueryState = (tabKey: ProfileTabKey) => {
    switch (tabKey) {
      case 'activities':
        return {
          data:
            activitiesQuery.data?.pages.flatMap((page) => page.data || []) ||
            [],
          isLoading: activitiesQuery.isLoading,
          isFetchingNextPage: activitiesQuery.isFetchingNextPage,
          hasNextPage: activitiesQuery.hasNextPage,
          fetchNextPage: activitiesQuery.fetchNextPage,
          refetch: activitiesQuery.refetch,
          isRefetching: activitiesQuery.isRefetching,
        };
      case 'answers':
        return {
          data:
            answersQuery.data?.pages.flatMap((page) => page.data || []) || [],
          isLoading: answersQuery.isLoading,
          isFetchingNextPage: answersQuery.isFetchingNextPage,
          hasNextPage: answersQuery.hasNextPage,
          fetchNextPage: answersQuery.fetchNextPage,
          refetch: answersQuery.refetch,
          isRefetching: answersQuery.isRefetching,
        };
      case 'articles':
        return {
          data:
            articlesQuery.data?.pages.flatMap((page) => page.data || []) || [],
          isLoading: articlesQuery.isLoading,
          isFetchingNextPage: articlesQuery.isFetchingNextPage,
          hasNextPage: articlesQuery.hasNextPage,
          fetchNextPage: articlesQuery.fetchNextPage,
          refetch: articlesQuery.refetch,
          isRefetching: articlesQuery.isRefetching,
        };
      case 'questions':
        return {
          data:
            questionsQuery.data?.pages.flatMap((page) => page.data || []) || [],
          isLoading: questionsQuery.isLoading,
          isFetchingNextPage: questionsQuery.isFetchingNextPage,
          hasNextPage: questionsQuery.hasNextPage,
          fetchNextPage: questionsQuery.fetchNextPage,
          refetch: questionsQuery.refetch,
          isRefetching: questionsQuery.isRefetching,
        };
      case 'pins':
        return {
          data: pinsQuery.data?.pages.flatMap((page) => page.data || []) || [],
          isLoading: pinsQuery.isLoading,
          isFetchingNextPage: pinsQuery.isFetchingNextPage,
          hasNextPage: pinsQuery.hasNextPage,
          fetchNextPage: pinsQuery.fetchNextPage,
          refetch: pinsQuery.refetch,
          isRefetching: pinsQuery.isRefetching,
        };
    }
  };

  const {
    data: searchResults,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
    isLoading: searchLoading,
    refetch: refetchSearch,
  } = useInfiniteQuery({
    queryKey: ['user-creations-search', user?.id, debouncedSearchQuery],
    queryFn: ({ pageParam = 0 }) =>
      searchContent(debouncedSearchQuery, pageParam as number, 20, 'general', {
        restricted_scene: 'member',
        restricted_field: 'member_hash_id',
        restricted_value: user?.id,
      }),
    enabled: debouncedSearchQuery.length > 0 && !!user?.id,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.paging?.is_end) return undefined;
      const match = lastPage.paging?.next?.match(/offset=(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    },
  });

  const HighlightText = (
    text: string,
    highlightColor: string = primaryColor,
  ) => {
    if (!text) return '';
    const decodedText = text
      .replace(/&lt;em&gt;/g, '[[EM]]')
      .replace(/&lt;\/em&gt;/g, '[[/EM]]')
      .replace(/<em>/g, '[[EM]]')
      .replace(/<\/em>/g, '[[/EM]]')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');
    const parts = decodedText.split(/(\[\[EM\]\].*?\[\[\/EM\]\])/gs);
    return (
      <React.Fragment>
        {parts.map((part, i) =>
          part.startsWith('[[EM]]') && part.endsWith('[[/EM]]') ? (
            <Text
              key={i}
              type="primary"
              className="font-bold"
              style={{ color: highlightColor }}
            >
              {part.replace(/\[\[\/?EM\]\]/g, '')}
            </Text>
          ) : (
            part
          ),
        )}
      </React.Fragment>
    );
  };

  const parseSearchResult = (item: any) => {
    const obj = item.object;
    if (!obj) return null;
    const highlight = item.highlight || {};
    return {
      id: obj.id,
      type: obj.type + 's',
      title: highlight.title
        ? HighlightText(highlight.title)
        : obj.question?.name || obj.title || '无标题',
      titleString: obj.question?.name || obj.title || '无标题',
      excerpt: highlight.description
        ? HighlightText(highlight.description)
        : obj.excerpt || '',
      image: obj.thumbnail_info?.thumbnails?.[0]?.url || null,
      voteCount: obj.voteup_count || 0,
      commentCount: obj.comment_count || 0,
      author: {
        id: obj.author?.id,
        name: obj.author?.name || '匿名用户',
        avatar: obj.author?.avatar_url,
        url_token: obj.author?.url_token,
      },
      questionId: obj.question?.id || obj.id,
      voted: obj.relationship?.voting || 0,
    };
  };

  const isSearching = debouncedSearchQuery.length > 0;
  const currentListItems = isSearching
    ? searchResults?.pages.flatMap(
        (page) => page.data?.map(parseSearchResult).filter(Boolean) || [],
      ) || []
    : [];

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const targetId = (user?.url_token || id) as string;
      if (user?.is_following) await unfollowMember(targetId);
      else await followMember(targetId);
      refetchUser();
    } catch (err) {
      console.error('关注操作失败:', err);
      Alert.alert('提示', '操作失败，请重试');
    } finally {
      setFollowLoading(false);
    }
  };

  const renderHeader = () => (
    <View className="bg-transparent">
      <Image
        source={{
          uri:
            user?.cover_url ||
            'https://picx.zhimg.com/v2-3975ba668e1c6670e309228892697843_b.jpg',
        }}
        className="h-[120px] w-full"
      />
      <View type="surface" className="px-5 pt-0 pb-4 rounded-b-[24px]">
        <View className="flex-row justify-between items-end -mt-10">
          <Reanimated.Image
            source={{ uri: user?.avatar_url || (initialAvatar as string) }}
            className="w-20 h-20 rounded-[40px] border-4 border-white dark:border-[#1e1e22]"
            sharedTransitionTag={`avatar-${user?.url_token || id}`}
          />
          {!isMe && (
            <Pressable
              className="px-5 h-9 rounded-full justify-center items-center mb-1.5"
              style={[
                user?.is_following
                  ? {
                      backgroundColor: 'transparent',
                      borderColor: borderColor,
                      borderWidth: 1,
                    }
                  : { backgroundColor: primaryColor },
              ]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator
                  size="small"
                  color={
                    user?.is_following
                      ? Colors[colorScheme].textSecondary
                      : '#fff'
                  }
                />
              ) : (
                <Text
                  className="font-bold text-sm"
                  style={[
                    { color: '#fff' },
                    user?.is_following && {
                      color: Colors[colorScheme].textSecondary,
                    },
                  ]}
                >
                  {user?.is_following ? '已关注' : '关注'}
                </Text>
              )}
            </Pressable>
          )}
        </View>
        <Text className="text-[22px] font-bold mt-2.5">{user?.name}</Text>
        <Text type="secondary" className="mt-1.5 text-sm">
          {user?.headline || '知乎用户'}
        </Text>

        {user?.description ? (
          <Text
            type="secondary"
            className="mt-2.5 text-[13px] leading-[18px]"
            numberOfLines={3}
          >
            {user.description}
          </Text>
        ) : null}

        {!isMe && (user?.mutual_followees_count || 0) > 0 && (
          <Pressable
            className="flex-row items-center mt-[15px] p-2.5 rounded-lg bg-black/5 dark:bg-white/5"
            onPress={() => router.push(`/user/${user?.url_token || id}/mutual`)}
          >
            <Text className="text-[13px]">
              <Text className="font-bold">{user.mutual_followees_count}</Text>{' '}
              位共同关注
            </Text>
            <Image
              source={{
                uri: 'https://pic1.zhimg.com/v2-abed1a8c04702bc9e7ba3d3d82bc7591_s.jpg',
              }}
              className="w-5 h-5 rounded-full ml-2"
            />
          </Pressable>
        )}

        <View className="flex-row mt-5 pt-[15px] bg-transparent">
          <Pressable
            className="mr-[30px] items-center"
            onPress={() =>
              router.push(`/user/${user?.url_token || id}/followers`)
            }
          >
            <Text className="font-bold text-lg">
              {user?.follower_count || 0}
            </Text>
            <Text type="secondary" className="text-xs mt-0.5">
              关注者
            </Text>
          </Pressable>
          <Pressable
            className="mr-[30px] items-center"
            onPress={() =>
              router.push(`/user/${user?.url_token || id}/following`)
            }
          >
            <Text className="font-bold text-lg">
              {user?.following_count || 0}
            </Text>
            <Text type="secondary" className="text-xs mt-0.5">
              关注
            </Text>
          </Pressable>
          <View className="items-center">
            <Text className="font-bold text-lg">{user?.voteup_count || 0}</Text>
            <Text type="secondary" className="text-xs mt-0.5">
              赞同
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderSearchBar = () => (
    <View className="pb-1 pt-1 bg-transparent">
      <View
        className="flex-row items-center rounded-3xl mx-[15px] my-2.5 pr-2.5 h-9"
        style={{ backgroundColor: Colors[colorScheme].backgroundTertiary }}
      >
        <Ionicons
          name="search"
          size={16}
          color={Colors[colorScheme].textTertiary}
          className="ml-2.5"
        />
        <TextInput
          className="flex-1 text-sm px-2.5 h-full py-0"
          style={{
            color: Colors[colorScheme].text,
            textAlignVertical: 'center',
          }}
          placeholder={`搜索 ${user?.name || '用户'} 的创作...`}
          placeholderTextColor={Colors[colorScheme].textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {isSearching && searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} className="p-[5px]">
            <Ionicons
              name="close-circle"
              size={16}
              color={Colors[colorScheme].textTertiary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderTabsSelector = () => (
    <View className="flex-row bg-transparent my-1 border-b border-gray-100 dark:border-gray-800">
      {PROFILE_TABS.map((tab, idx) => {
        const count = tab.countKey ? (user as any)?.[tab.countKey] : undefined;
        const countStr = count !== undefined && count > 0 ? ` ${count}` : '';
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => handleTabPress(idx)}
            className="flex-1 py-2 items-center"
            style={
              isActive && {
                borderBottomWidth: 2.5,
                borderBottomColor: primaryColor,
              }
            }
          >
            <Text
              className="font-bold text-[14px]"
              style={{
                color: isActive
                  ? primaryColor
                  : Colors[colorScheme].textSecondary,
              }}
            >
              {tab.label}
              {countStr}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderAnswersSortSelector = () => {
    return (
      <View
        className="flex-row px-[15px] py-2.5 bg-transparent"
        style={{ borderBottomWidth: 0 }}
      >
        {[
          { key: 'created', label: '最新' },
          { key: 'voteups', label: '赞同' },
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setSortBy(item.key as any)}
            className="px-3 py-1 mr-2.5 rounded"
            style={[
              sortBy === item.key && {
                backgroundColor: 'rgba(0,132,255,0.08)',
              },
            ]}
          >
            <Text
              type={sortBy === item.key ? 'primary' : 'secondary'}
              className="text-[13px]"
              style={[sortBy === item.key && { fontWeight: 'bold' }]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderItemContent = (item: any, tabKey: ProfileTabKey) => {
    let displayItem = item as any;
    if (tabKey === 'activities') {
      displayItem = item.target || item;
    }
    if (!displayItem || (!displayItem.id && !displayItem.url)) return null;

    const rawType = displayItem.type;
    let mappedType: 'answers' | 'articles' | 'questions' | 'pins' = 'answers';
    if (rawType === 'article') mappedType = 'articles';
    else if (rawType === 'question') mappedType = 'questions';
    else if (rawType === 'pin') mappedType = 'pins';
    else if (rawType === 'zvideo' || rawType === 'video')
      mappedType = 'answers';

    const getExcerptText = () => {
      if (rawType === 'pin') {
        if (Array.isArray(displayItem.content)) {
          return (displayItem.content as any[])
            .filter((c) => c.type === 'text')
            .map((c) => c.content)
            .join('')
            .replace(/<[^>]+>/g, '')
            .substring(0, 150);
        }
        if (typeof displayItem.content === 'string') {
          return (displayItem.content as string)
            .replace(/<[^>]+>/g, '')
            .substring(0, 150);
        }
      }
      const raw = (displayItem as any).excerpt || displayItem.content || '';
      if (typeof raw === 'string')
        return raw.replace(/<[^>]+>/g, '').substring(0, 150);
      return '';
    };

    const imageUrl =
      displayItem.image_url ||
      displayItem.thumbnail ||
      (rawType === 'pin' && Array.isArray(displayItem.content)
        ? displayItem.content.find((c: any) => c.type === 'image')?.url
        : null) ||
      null;

    const feedItem: any = {
      id: displayItem.id?.toString() || Math.random().toString(),
      title: displayItem.question?.title || displayItem.title || '',
      questionId:
        displayItem.question?.id?.toString() ||
        (rawType === 'question' ? displayItem.id?.toString() : undefined),
      author: {
        id: displayItem.author?.id || user?.id || '',
        url_token: displayItem.author?.url_token || user?.url_token || '',
        name: displayItem.author?.name || user?.name || '匿名用户',
        avatar:
          displayItem.author?.avatar_url ||
          user?.avatar_url ||
          'https://picx.zhimg.com/v2-abed1a8c04702bc9e7ba3d3d82bc7591_s.jpg',
        headline: displayItem.author?.headline || user?.headline || '',
      },
      excerpt: getExcerptText(),
      image: imageUrl,
      voteCount:
        mappedType === 'pins'
          ? displayItem.reaction_count || displayItem.like_count || 0
          : displayItem.voteup_count || 0,
      commentCount:
        displayItem.comment_count ??
        displayItem.reaction?.statistics?.comments ??
        0,
      favlistsCount:
        displayItem.favlists_count ??
        displayItem.favorite_count ??
        displayItem.reaction?.statistics?.favorites ??
        0,
      voted: displayItem.relationship?.voting || 0,
      type: mappedType,
    };

    return <FeedCard item={feedItem} />;
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: Colors[colorScheme].background }}
    >
      {isSearching ? (
        <FlashList
          data={currentListItems}
          renderItem={({ item }: { item: any }) => {
            const rawType = item.type;
            let mappedType: 'answers' | 'articles' | 'questions' | 'pins' =
              'answers';
            if (rawType === 'articles') mappedType = 'articles';
            else if (rawType === 'questions') mappedType = 'questions';
            else if (rawType === 'pins') mappedType = 'pins';
            return <FeedCard item={{ ...item, type: mappedType }} />;
          }}
          keyExtractor={(item: any, index: number) =>
            `user-search-item-${item.id || ''}-${index}`
          }
          {...({ estimatedItemSize: 200 } as any)}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View className="bg-transparent">
              {renderHeader()}
              {renderSearchBar()}
            </View>
          }
          ListFooterComponent={
            <View className="bg-transparent">
              {searchLoading || isFetchingNextSearchPage ? (
                <ActivityIndicator
                  style={{ margin: 20 }}
                  color={primaryColor}
                />
              ) : currentListItems.length > 0 && !hasNextSearchPage ? (
                <Text type="secondary" className="text-center p-5 text-xs">
                  — 已经到底了喵 —
                </Text>
              ) : null}
            </View>
          }
          onEndReached={() => {
            if (hasNextSearchPage && !isFetchingNextSearchPage)
              fetchNextSearchPage();
          }}
          onEndReachedThreshold={0.5}
          onRefresh={refetchUser}
          refreshing={followLoading}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Header 绝对定位在最顶层，且水平完全不跟随 PagerView 滑动 */}
          <Reanimated.View
            onLayout={(e) => {
              const height = e.nativeEvent.layout.height;
              if (height > 0 && height !== headerHeight) {
                setHeaderHeight(height);
                maxScroll.value = height - 50; // 减去 Tab 栏高度，以保留 Tab 栏悬停在顶部
              }
            }}
            style={[
              headerAnimatedStyle,
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                backgroundColor: Colors[colorScheme].background,
              },
            ]}
            onStartShouldSetResponder={(evt) => {
              panStart.current = {
                x: evt.nativeEvent.pageX,
                y: evt.nativeEvent.pageY,
              };
              return false;
            }}
            onMoveShouldSetResponder={(evt) => {
              const deltaX = Math.abs(
                evt.nativeEvent.pageX - panStart.current.x,
              );
              const deltaY = Math.abs(
                evt.nativeEvent.pageY - panStart.current.y,
              );
              // 拦截横向手势，使得在 Header 上的左滑右滑完全不发生切屏
              return deltaX > deltaY && deltaX > 10;
            }}
            onResponderTerminationRequest={() => true}
          >
            {renderHeader()}
            {renderSearchBar()}
            {renderTabsSelector()}
          </Reanimated.View>

          {/* 底部 PagerView 进行左右切屏，Header 不会参与左右平移 */}
          <PagerView
            ref={pagerRef}
            style={{ flex: 1 }}
            initialPage={1} // 默认是 'answers'
            onPageScroll={(e) => {
              pagerPosition.value = e.nativeEvent.position;
              pagerOffset.value = e.nativeEvent.offset;
            }}
            onPageScrollStateChanged={(e) => {
              const state = e.nativeEvent.pageScrollState;
              if (state === 'dragging') {
                syncLists(activeIndexRef.current);
              } else if (state === 'idle') {
                const tab = PROFILE_TABS[activeIndexRef.current].key;
                setVisitedTabs((prev) => {
                  if (prev[tab]) return prev;
                  return { ...prev, [tab]: true };
                });
              }
            }}
            onPageSelected={(e) => {
              const idx = e.nativeEvent.position;
              const tab = PROFILE_TABS[idx].key;
              setActiveTab(tab);
              activeIndex.value = idx;
              activeIndexRef.current = idx;

              // 亚像素微调滚动，强行触发 FlashList 的可见区重绘，防止显示空白
              const currentScrollY = getSharedValue(idx).value;
              if (currentScrollY > 0) {
                requestAnimationFrame(() => {
                  listRefs.current[idx]?.scrollToOffset({
                    offset: currentScrollY + 0.1,
                    animated: false,
                  });
                });
              }
            }}
          >
            {PROFILE_TABS.map((tab, idx) => {
              const query = getTabQueryState(tab.key);
              return (
                <NativeView key={tab.key} className="flex-1">
                  <AnimatedFlashList
                    ref={(ref: any) => {
                      listRefs.current[idx] = ref;
                    }}
                    data={query.data}
                    renderItem={({ item }: any) =>
                      renderItemContent(item, tab.key)
                    }
                    keyExtractor={(item: any, index: number) =>
                      `user-item-${tab.key}-${item.id || ''}-${index}`
                    }
                    {...({ estimatedItemSize: 200 } as any)}
                    contentContainerStyle={{ paddingTop: headerHeight }}
                    scrollEventThrottle={16}
                    drawDistance={1000}
                    removeClippedSubviews={false}
                    onScroll={
                      idx === 0
                        ? scrollHandler0
                        : idx === 1
                          ? scrollHandler1
                          : idx === 2
                            ? scrollHandler2
                            : idx === 3
                              ? scrollHandler3
                              : scrollHandler4
                    }
                    ListHeaderComponent={
                      tab.key === 'answers' ? renderAnswersSortSelector() : null
                    }
                    ListFooterComponent={
                      <View className="bg-transparent">
                        {query.isLoading || query.isFetchingNextPage ? (
                          <ActivityIndicator
                            style={{ margin: 20 }}
                            color={primaryColor}
                          />
                        ) : query.data.length > 0 && !query.hasNextPage ? (
                          <Text
                            type="secondary"
                            className="text-center p-5 text-xs"
                          >
                            — 已经到底了喵 —
                          </Text>
                        ) : null}
                      </View>
                    }
                    onEndReached={() => {
                      if (query.hasNextPage && !query.isFetchingNextPage) {
                        query.fetchNextPage();
                      }
                    }}
                    onEndReachedThreshold={0.5}
                    onRefresh={query.refetch}
                    refreshing={query.isRefetching}
                  />
                </NativeView>
              );
            })}
          </PagerView>
        </View>
      )}
    </View>
  );
}
