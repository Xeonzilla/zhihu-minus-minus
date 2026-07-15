import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import { Animated, Modal, Pressable, StyleSheet } from 'react-native';
import { Text, ThemedIcon, useThemeColor, View } from './Themed';
import { useColorScheme } from './useColorScheme';

export function ClipboardLinkModal({
  visible,
  url,
  onClose,
  onOpen,
}: {
  visible: boolean;
  url: string;
  onClose: () => void;
  onOpen: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  const [internalVisible, setInternalVisible] = React.useState(visible);

  const primaryColor = useThemeColor({}, 'primary');
  const primaryTransparent = useThemeColor({}, 'primaryTransparent');

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!internalVisible) return null;

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
          opacity: fadeAnim,
        }}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={{
            width: '85%',
            maxWidth: 340,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <BlurView
            intensity={90}
            tint={isDark ? 'dark' : 'light'}
            style={{
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: isDark
                ? 'rgba(30,30,30,0.7)'
                : 'rgba(255,255,255,0.7)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            }}
          >
            <View className="p-6 items-center bg-transparent">
              <View
                className="w-14 h-14 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: primaryTransparent }}
              >
                <ThemedIcon name="link" size={28} colorType="primary" />
              </View>
              <Text className="text-[19px] font-bold mb-2">发现知乎链接</Text>
              <Text
                type="secondary"
                className="text-[14px] text-center mb-6 px-2 leading-5"
                numberOfLines={4}
              >
                是否要打开剪贴板中的链接？{'\n'}
                <Text
                  type="secondary"
                  style={{ color: primaryColor }}
                  className="text-[13px]"
                >
                  {url}
                </Text>
              </Text>

              <View className="flex-row w-full gap-3 bg-transparent">
                <Pressable
                  onPress={onClose}
                  className="flex-1 py-3.5 rounded-[16px] items-center justify-center"
                  style={{
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.05)',
                  }}
                >
                  <Text className="font-bold text-[16px]">忽略</Text>
                </Pressable>
                <Pressable
                  onPress={onOpen}
                  className="flex-1 py-3.5 rounded-[16px] items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Text className="font-bold text-[16px] text-white">
                    立即打开
                  </Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
