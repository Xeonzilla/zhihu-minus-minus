import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  View as NativeView,
  Pressable,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import {
  getMemberFollowing,
  getMemberFollowingColumns,
  getMemberFollowingFavlists,
  getMemberFollowingQuestions,
  getMemberFollowingTopics,
} from '@/api/zhihu';
import { Text, useThemeColor, View } from '@/components/Themed';
import { UserCard } from '@/components/UserCard';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const TABS = [
  { key: 'users', title: '关注的人' },
  { key: 'columns', title: '专栏' },
  { key: 'topics', title: '话题' },
  { key: 'questions', title: '问题' },
  { key: 'favlists', title: '收藏夹' },
];

export default function FollowingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('users');
  const [_currentPage, setCurrentPage] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({
    users: true,
  });
  const pagerRef = useRef<PagerView>(null);

  const colorScheme = useColorScheme();
  const borderColor = Colors[colorScheme].border;
  const tint = useThemeColor({}, 'primary');
  const textSecondaryColor = Colors[colorScheme].textSecondary;

  // 1. 关注的人 Query
  const usersQuery = useInfiniteQuery({
    queryKey: ['user-following-users', id],
    queryFn: ({ pageParam = 0 }) =>
      getMemberFollowing(id as string, 20, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const nextUrl = lastPage.paging?.next;
      const match = nextUrl?.match(/offset=(\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    },
    enabled: visitedTabs.users || activeTab === 'users',
  });

  // 2. 关注的专栏 Query
  const columnsQuery = useInfiniteQuery({
    queryKey: ['user-following-columns', id],
    queryFn: ({ pageParam = 0 }) =>
      getMemberFollowingColumns(id as string, pageParam as number, 20),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const nextUrl = lastPage.paging?.next;
      const match = nextUrl?.match(/offset=(\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    },
    enabled: visitedTabs.columns || activeTab === 'columns',
  });

  // 3. 关注的话题 Query
  const topicsQuery = useInfiniteQuery({
    queryKey: ['user-following-topics', id],
    queryFn: ({ pageParam = 0 }) =>
      getMemberFollowingTopics(id as string, pageParam as number, 20),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const nextUrl = lastPage.paging?.next;
      const match = nextUrl?.match(/offset=(\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    },
    enabled: visitedTabs.topics || activeTab === 'topics',
  });

  // 4. 关注的问题 Query
  const questionsQuery = useInfiniteQuery({
    queryKey: ['user-following-questions', id],
    queryFn: ({ pageParam = 0 }) =>
      getMemberFollowingQuestions(id as string, pageParam as number, 20),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const nextUrl = lastPage.paging?.next;
      const match = nextUrl?.match(/offset=(\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    },
    enabled: visitedTabs.questions || activeTab === 'questions',
  });

  // 5. 关注的收藏夹 Query
  const favlistsQuery = useInfiniteQuery({
    queryKey: ['user-following-favlists', id],
    queryFn: ({ pageParam = 0 }) =>
      getMemberFollowingFavlists(id as string, pageParam as number, 20),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const nextUrl = lastPage.paging?.next;
      const match = nextUrl?.match(/offset=(\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    },
    enabled: visitedTabs.favlists || activeTab === 'favlists',
  });

  const getQueryState = (tabKey: string) => {
    switch (tabKey) {
      case 'users':
        return {
          data: usersQuery.data?.pages.flatMap((page) => page.data) || [],
          isLoading: usersQuery.isLoading,
          isFetchingNextPage: usersQuery.isFetchingNextPage,
          hasNextPage: usersQuery.hasNextPage,
          fetchNextPage: usersQuery.fetchNextPage,
          refetch: usersQuery.refetch,
          isRefetching: usersQuery.isRefetching,
        };
      case 'columns':
        return {
          data: columnsQuery.data?.pages.flatMap((page) => page.data) || [],
          isLoading: columnsQuery.isLoading,
          isFetchingNextPage: columnsQuery.isFetchingNextPage,
          hasNextPage: columnsQuery.hasNextPage,
          fetchNextPage: columnsQuery.fetchNextPage,
          refetch: columnsQuery.refetch,
          isRefetching: columnsQuery.isRefetching,
        };
      case 'topics':
        return {
          data: topicsQuery.data?.pages.flatMap((page) => page.data) || [],
          isLoading: topicsQuery.isLoading,
          isFetchingNextPage: topicsQuery.isFetchingNextPage,
          hasNextPage: topicsQuery.hasNextPage,
          fetchNextPage: topicsQuery.fetchNextPage,
          refetch: topicsQuery.refetch,
          isRefetching: topicsQuery.isRefetching,
        };
      case 'questions':
        return {
          data: questionsQuery.data?.pages.flatMap((page) => page.data) || [],
          isLoading: questionsQuery.isLoading,
          isFetchingNextPage: questionsQuery.isFetchingNextPage,
          hasNextPage: questionsQuery.hasNextPage,
          fetchNextPage: questionsQuery.fetchNextPage,
          refetch: questionsQuery.refetch,
          isRefetching: questionsQuery.isRefetching,
        };
      case 'favlists':
        return {
          data: favlistsQuery.data?.pages.flatMap((page) => page.data) || [],
          isLoading: favlistsQuery.isLoading,
          isFetchingNextPage: favlistsQuery.isFetchingNextPage,
          hasNextPage: favlistsQuery.hasNextPage,
          fetchNextPage: favlistsQuery.fetchNextPage,
          refetch: favlistsQuery.refetch,
          isRefetching: favlistsQuery.isRefetching,
        };
      default:
        return {
          data: [],
          isLoading: false,
          isFetchingNextPage: false,
          hasNextPage: false,
          fetchNextPage: () => {},
          refetch: async () => {},
          isRefetching: false,
        };
    }
  };

  const handleTabPress = (index: number) => {
    const tabKey = TABS[index].key;
    pagerRef.current?.setPage(index);
    setCurrentPage(index);
    setActiveTab(tabKey);
    setVisitedTabs((prev) => ({ ...prev, [tabKey]: true }));
  };

  const renderItem = ({ item, tabKey }: { item: any; tabKey: string }) => {
    if (tabKey === 'users') {
      return <UserCard user={item} />;
    }
    if (tabKey === 'columns') {
      return (
        <Pressable
          className="flex-row items-center p-4"
          style={{ borderBottomWidth: 0.5, borderBottomColor: borderColor }}
          onPress={() => router.push(`/column/${item.id}`)}
        >
          <Image
            source={{ uri: item.image_url }}
            className="w-12 h-12 rounded-lg"
          />
          <View className="flex-1 ml-3 bg-transparent">
            <Text className="text-base font-semibold" numberOfLines={1}>
              {item.title}
            </Text>
            <Text
              type="secondary"
              className="text-[13px] mt-0.5"
              numberOfLines={1}
            >
              {item.intro || item.excerpt || '这个专栏没有简介喵'}
            </Text>
            <View className="flex-row mt-1 bg-transparent">
              <Text type="secondary" className="text-xs">
                {item.followers || 0} 关注者
              </Text>
              <Text type="secondary" className="text-xs ml-3">
                {item.articles_count || 0} 文章
              </Text>
            </View>
          </View>
        </Pressable>
      );
    }
    if (tabKey === 'topics') {
      const topic = item.topic;
      if (!topic) return null;
      return (
        <Pressable
          className="flex-row items-center p-4"
          style={{ borderBottomWidth: 0.5, borderBottomColor: borderColor }}
          onPress={() => router.push(`/topic/${topic.id}`)}
        >
          <Image
            source={{ uri: topic.avatar_url }}
            className="w-12 h-12 rounded-lg"
          />
          <View className="flex-1 ml-3 bg-transparent">
            <Text className="text-base font-semibold" numberOfLines={1}>
              {topic.name}
            </Text>
            <Text
              type="secondary"
              className="text-[13px] mt-0.5"
              numberOfLines={1}
            >
              {topic.introduction || topic.excerpt || '这个话题没有简介喵'}
            </Text>
            <View className="flex-row mt-1 bg-transparent">
              <Text type="secondary" className="text-xs">
                {topic.followers_count || 0} 关注者
              </Text>
              <Text type="secondary" className="text-xs ml-3">
                {topic.questions_count || 0} 问题
              </Text>
            </View>
          </View>
        </Pressable>
      );
    }
    if (tabKey === 'questions') {
      return (
        <Pressable
          className="p-4"
          style={{ borderBottomWidth: 0.5, borderBottomColor: borderColor }}
          onPress={() => router.push(`/question/${item.id}`)}
        >
          <Text className="text-base font-semibold" numberOfLines={2}>
            {item.title}
          </Text>
          <View className="flex-row mt-2 bg-transparent items-center">
            <Text type="secondary" className="text-xs">
              {item.answer_count || 0} 个回答
            </Text>
            <Text type="secondary" className="text-xs ml-3">
              {item.follower_count || 0} 人关注
            </Text>
            {item.author?.name && (
              <Text type="secondary" className="text-xs ml-auto">
                提问者: {item.author.name}
              </Text>
            )}
          </View>
        </Pressable>
      );
    }
    if (tabKey === 'favlists') {
      return (
        <Pressable
          className="flex-row items-center p-4"
          style={{ borderBottomWidth: 0.5, borderBottomColor: borderColor }}
          onPress={() => router.push(`/collections/${item.id}`)}
        >
          <View
            className="w-12 h-12 rounded-lg justify-center items-center relative"
            style={{ backgroundColor: 'rgba(0,132,255,0.05)' }}
          >
            <Ionicons
              name={item.is_public ? 'folder' : 'folder-outline'}
              size={24}
              color={tint}
            />
          </View>
          <View className="flex-1 ml-3 bg-transparent">
            <Text className="text-base font-semibold" numberOfLines={1}>
              {item.title}
            </Text>
            <Text
              type="secondary"
              className="text-[13px] mt-0.5"
              numberOfLines={1}
            >
              {item.description || `创建者: ${item.creator?.name || '匿名'}`}
            </Text>
            <View className="flex-row mt-1 bg-transparent">
              <Text type="secondary" className="text-xs">
                {item.answer_count || 0} 内容
              </Text>
              <Text type="secondary" className="text-xs ml-3">
                {item.follower_count || 0} 关注者
              </Text>
            </View>
          </View>
        </Pressable>
      );
    }
    return null;
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: '我的关注' }} />

      {/* Tab bar */}
      <View
        className="flex-row h-11 border-b"
        style={{ borderBottomColor: borderColor }}
      >
        {TABS.map((tab, idx) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(idx)}
              className="flex-1 justify-center items-center h-full"
            >
              <Text
                className={`text-[13px] ${isActive ? 'font-bold' : ''}`}
                style={{ color: isActive ? tint : textSecondaryColor }}
              >
                {tab.title}
              </Text>
              {isActive && (
                <View
                  className="absolute bottom-0 w-8 h-[2px] rounded-full"
                  style={{ backgroundColor: tint }}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => {
          const idx = e.nativeEvent.position;
          const tabKey = TABS[idx].key;
          setCurrentPage(idx);
          setActiveTab(tabKey);
          setVisitedTabs((prev) => ({ ...prev, [tabKey]: true }));
        }}
      >
        {TABS.map((tab) => {
          const query = getQueryState(tab.key);
          return (
            <NativeView key={tab.key} className="flex-1">
              <FlashList
                data={query.data}
                renderItem={({ item }) => renderItem({ item, tabKey: tab.key })}
                {...({ estimatedItemSize: 80 } as any)}
                onEndReached={() => query.hasNextPage && query.fetchNextPage()}
                onRefresh={query.refetch}
                refreshing={query.isRefetching}
                ListEmptyComponent={() => (
                  <View className="p-[50px] items-center">
                    {query.isLoading ? (
                      <ActivityIndicator color={tint} />
                    ) : (
                      <Text type="secondary">这里空空如也喵</Text>
                    )}
                  </View>
                )}
                ListFooterComponent={() =>
                  query.isFetchingNextPage ? (
                    <ActivityIndicator style={{ margin: 20 }} color={tint} />
                  ) : null
                }
              />
            </NativeView>
          );
        })}
      </PagerView>
    </View>
  );
}
