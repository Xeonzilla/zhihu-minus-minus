import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { getMemberMutual } from '@/api/zhihu';
import { Text, useThemeColor, View } from '@/components/Themed';
import { UserCard } from '@/components/UserCard';

export default function MutualFollowersScreen() {
  const { id } = useLocalSearchParams();
  const _router = useRouter();
  const primaryColor = useThemeColor({}, 'primary');

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['user-mutual', id],
    queryFn: ({ pageParam = 0 }) =>
      getMemberMutual(id as string, 20, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.paging?.is_end) return undefined;
      const nextUrl = lastPage.paging?.next;
      const match = nextUrl?.match(/offset=(\d+)/);
      return match ? parseInt(match[1], 10) : undefined;
    },
  });

  const users = data?.pages.flatMap((page) => page.data) || [];

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: '共同关注' }} />
      <FlashList
        data={users}
        renderItem={({ item }) => <UserCard user={item} />}
        {...({ estimatedItemSize: 80 } as any)}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={() => (
          <View className="p-[50px] items-center">
            {isLoading ? (
              <ActivityIndicator color={primaryColor} />
            ) : (
              <Text type="secondary">没有共同关注喵</Text>
            )}
          </View>
        )}
        ListFooterComponent={() =>
          isFetchingNextPage ? (
            <ActivityIndicator style={{ margin: 20 }} color={primaryColor} />
          ) : null
        }
      />
    </View>
  );
}
