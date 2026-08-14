import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addArticleToCollection,
  addToCollection,
  createCollection,
  getAnswerCollectionStatus,
  getArticleCollectionStatus,
  removeArticleFromCollection,
  removeFromCollection,
} from '@/api/zhihu/collection';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useCollectionStore } from '@/store/useCollectionStore';
import { showToast } from '@/utils/toast';
import { Text, useThemeColor, View } from './Themed';

export function CollectionSelectorModal() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const _isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();

  const {
    selectorVisible,
    selectorContentId,
    selectorContentType,
    closeSelector,
    setCollectedStatus,
  } = useCollectionStore();

  // Create Collection sub-modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);

  // Fetch folders and their favorite status for the active item
  const {
    data: statusData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'collection-selector-status',
      selectorContentId,
      selectorContentType,
    ],
    queryFn: async () => {
      if (!selectorContentId || !selectorContentType) return null;
      if (selectorContentType === 'answer') {
        return getAnswerCollectionStatus(selectorContentId);
      } else {
        return getArticleCollectionStatus(selectorContentId);
      }
    },
    enabled: selectorVisible && !!selectorContentId && !!selectorContentType,
  });

  const collections = statusData?.data || [];

  // Mutations to toggle item in folder
  const toggleMutation = useMutation({
    mutationFn: async ({
      folderId,
      isFavorited,
    }: {
      folderId: string | number;
      isFavorited: boolean;
    }) => {
      if (!selectorContentId || !selectorContentType) return;
      if (selectorContentType === 'answer') {
        if (isFavorited) {
          return removeFromCollection(folderId, selectorContentId);
        } else {
          return addToCollection(folderId, selectorContentId);
        }
      } else {
        if (isFavorited) {
          return removeArticleFromCollection(folderId, selectorContentId);
        } else {
          return addArticleToCollection(folderId, selectorContentId);
        }
      }
    },
    onSuccess: (_, _variables) => {
      refetch().then((updated) => {
        const idStr = selectorContentId?.toString();
        if (idStr) {
          const prevCollected =
            useCollectionStore.getState().collectedStatusMap[idStr] || false;
          // If the item is in at least one folder now, set collected = true
          const hasCollections =
            updated.data?.data?.some((item: any) => item.is_favorited) || false;

          if (prevCollected !== hasCollections) {
            const delta = hasCollections ? 1 : -1;
            useCollectionStore
              .getState()
              .updateCollectedCountOffset(idStr, delta);
          }

          setCollectedStatus(idStr, hasCollections);

          // Invalidate key queries so detail views update
          queryClient.invalidateQueries({
            queryKey: ['answer-collection-status', idStr],
          });
          queryClient.invalidateQueries({
            queryKey: ['article-collection-status', idStr],
          });
        }
      });
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || '操作失败');
    },
  });

  // Mutation to create new folder
  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      showToast('新建成功');
      setCreateModalVisible(false);
      setNewTitle('');
      setNewDesc('');
      setNewIsPublic(true);
      // Invalidate general list
      queryClient.invalidateQueries({ queryKey: ['my-collections'] });
      // Refetch selector list
      refetch();
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || '创建失败');
    },
  });

  const handleCreateCollection = () => {
    if (!newTitle.trim()) {
      Alert.alert('提示', '请输入标题');
      return;
    }
    createMutation.mutate({
      title: newTitle,
      description: newDesc,
      is_public: newIsPublic,
    });
  };

  const surfaceColor = Colors[colorScheme].surface;
  const borderColor = Colors[colorScheme].border;
  const primaryColor = useThemeColor({}, 'primary');
  const primaryTransparent = useThemeColor({}, 'primaryTransparent');

  if (!selectorVisible) return null;

  return (
    <>
      <Modal
        visible={selectorVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSelector}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={closeSelector}
        >
          <Pressable
            className="rounded-t-[28px] px-5 pt-3"
            style={{
              backgroundColor: surfaceColor,
              height: '60%',
              paddingBottom: insets.bottom + 10,
            }}
            onPress={(e) => e.stopPropagation()} // Prevent click-through closing
          >
            {/* Grab handle indicator */}
            <View className="items-center py-2 bg-transparent">
              <View className="w-10 h-1.5 rounded-[3px] bg-gray-300 dark:bg-gray-700" />
            </View>

            {/* Header */}
            <View className="flex-row justify-between items-center mb-3 bg-transparent">
              <Text className="text-xl font-bold">收藏至收藏夹</Text>
              <Pressable
                onPress={() => setCreateModalVisible(true)}
                className="flex-row items-center bg-transparent py-1 px-2.5 rounded-full"
                style={{ backgroundColor: primaryTransparent }}
              >
                <Ionicons name="add" size={16} color={primaryColor} />
                <Text
                  style={{ color: primaryColor }}
                  className="text-sm font-bold ml-0.5"
                >
                  新建
                </Text>
              </Pressable>
            </View>

            {/* Main content list */}
            {isLoading ? (
              <View className="flex-1 justify-center items-center bg-transparent">
                <ActivityIndicator color={primaryColor} size="small" />
              </View>
            ) : (
              <FlatList
                data={collections}
                keyExtractor={(item) => item.id.toString()}
                className="flex-1"
                renderItem={({ item }) => {
                  const isFavorited = item.is_favorited;
                  const isPending =
                    toggleMutation.isPending &&
                    toggleMutation.variables?.folderId === item.id;

                  return (
                    <Pressable
                      onPress={() => {
                        if (isPending) return;
                        toggleMutation.mutate({
                          folderId: item.id,
                          isFavorited,
                        });
                      }}
                      className="flex-row py-4 items-center justify-between"
                      style={{
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderColor,
                      }}
                    >
                      <View className="flex-row items-center flex-1 bg-transparent">
                        <Ionicons
                          name={item.is_public ? 'folder' : 'folder-outline'}
                          size={24}
                          color={isFavorited ? primaryColor : '#888'}
                        />
                        <View className="ml-3 flex-1 bg-transparent">
                          <Text
                            className="text-base font-semibold"
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {item.description ? (
                            <Text
                              type="secondary"
                              className="text-xs mt-0.5"
                              numberOfLines={1}
                            >
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Status indicator */}
                      <View className="w-8 h-8 items-center justify-center bg-transparent">
                        {isPending ? (
                          <ActivityIndicator
                            size="small"
                            color={primaryColor}
                          />
                        ) : (
                          <Ionicons
                            name={isFavorited ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isFavorited ? primaryColor : '#bbb'}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View className="py-20 items-center justify-center bg-transparent">
                    <Text type="secondary">暂无收藏夹喵</Text>
                  </View>
                }
              />
            )}

            {/* Close Button */}
            <Pressable
              className="py-[16px] items-center rounded-full mt-2"
              style={{ backgroundColor: primaryColor }}
              onPress={closeSelector}
            >
              <Text className="text-white text-base font-bold">完成</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Nested Create Collection Modal */}
      {createModalVisible && (
        <Modal
          visible={createModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View
              className="rounded-t-3xl p-5"
              style={{ backgroundColor: surfaceColor, height: '70%' }}
            >
              <View className="flex-row justify-between items-center mb-5 bg-transparent">
                <Text className="text-lg font-bold">新建收藏夹</Text>
                <Pressable onPress={() => setCreateModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#999" />
                </Pressable>
              </View>

              <ScrollView className="flex-1 bg-transparent">
                <Text className="text-[15px] font-semibold mb-2 mt-[10px]">
                  标题
                </Text>
                <TextInput
                  className="rounded-lg p-3 text-base"
                  style={{
                    borderWidth: 1,
                    borderColor,
                    color: Colors[colorScheme].text,
                  }}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="输入标题"
                  placeholderTextColor="#999"
                />

                <Text className="text-[15px] font-semibold mb-2 mt-[20px]">
                  描述 (可选)
                </Text>
                <TextInput
                  className="rounded-lg p-3 text-base h-20"
                  style={{
                    borderWidth: 1,
                    borderColor,
                    color: Colors[colorScheme].text,
                    textAlignVertical: 'top',
                  }}
                  value={newDesc}
                  onChangeText={setNewDesc}
                  placeholder="输入描述"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />

                <View className="flex-row justify-between items-center mt-5 mb-[30px] bg-transparent">
                  <View className="bg-transparent">
                    <Text className="text-[15px] font-semibold">
                      公开收藏夹
                    </Text>
                    <Text type="secondary" className="text-xs mt-0.5">
                      公开后其他用户可见
                    </Text>
                  </View>
                  <Switch
                    value={newIsPublic}
                    onValueChange={setNewIsPublic}
                    trackColor={{ false: '#ddd', true: primaryColor }}
                  />
                </View>
              </ScrollView>

              <Pressable
                className="h-[50px] rounded-[25px] justify-center items-center mt-2.5 mb-5"
                style={{ backgroundColor: primaryColor }}
                onPress={handleCreateCollection}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-bold">完成</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
