/**
 * AttachmentSheet — Modern bottom sheet for attachment picking.
 * Animated with react-native-reanimated, backdrop blur, ChatGPT style.
 */

import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  Modal,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useDesignSystem } from '../utils/designSystem';
import { Spacing, FontSize } from '../utils/theme';

const SHEET_HEIGHT = 300;
const HAIRLINE = StyleSheet.hairlineWidth;

interface AttachmentOption {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  color?: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  options: AttachmentOption[];
}

const backdropBaseStyle = {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.4)',
} as const;

const sheetBaseStyle = {
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  paddingBottom: Platform.OS === 'ios' ? 34 : 24,
} as const;

export const AttachmentSheet = React.memo(function AttachmentSheet({ visible, onClose, options }: Props) {
  const { colors, dark } = useDesignSystem();
  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, {
        damping: 25,
        stiffness: 300,
        mass: 0.8,
      });
    }
  }, [visible]);

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animateClose = (callback?: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(SHEET_HEIGHT, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    }, () => {
      runOnJS(onClose)();
      if (callback) runOnJS(callback)();
    });
  };

  const handleClose = () => animateClose();

  const handleOptionPress = (option: AttachmentOption) => {
    animateClose(option.onPress);
  };

  const sheetBg = colors.cardBackground;
  const handleColor = dark ? '#555' : '#D1D5DB';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <YStack flex={1} justifyContent="flex-end">
        {/* Backdrop */}
        <Animated.View style={[backdropBaseStyle, backdropAnimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            sheetBaseStyle,
            sheetAnimStyle,
            {
              backgroundColor: sheetBg,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                },
                android: {
                  elevation: 16,
                },
              }),
            },
          ]}
        >
          {/* Handle */}
          <YStack alignItems="center" paddingVertical={10}>
            <YStack width={36} height={4} borderRadius={2} backgroundColor={handleColor} />
          </YStack>

          {/* Options */}
          <YStack paddingHorizontal={Spacing.lg} paddingTop={Spacing.xs}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
                  index < options.length - 1 && {
                    borderBottomWidth: HAIRLINE,
                    borderBottomColor: colors.separator,
                  },
                ]}
                onPress={() => handleOptionPress(option)}
                activeOpacity={0.6}
              >
                <YStack
                  width={48} height={48} borderRadius={24}
                  justifyContent="center" alignItems="center"
                  backgroundColor={option.color || colors.primary + '18'}
                >
                  {option.icon}
                </YStack>
                <YStack flex={1} marginLeft={Spacing.md}>
                  <Text fontSize={FontSize.body} fontWeight="600" color={colors.text}>{option.label}</Text>
                  {option.subtitle && (
                    <Text fontSize={FontSize.footnote} color={colors.textTertiary} marginTop={2}>{option.subtitle}</Text>
                  )}
                </YStack>
                <Text fontSize={24} fontWeight="300" color={colors.textTertiary}>›</Text>
              </TouchableOpacity>
            ))}
          </YStack>

          {/* Cancel button */}
          <TouchableOpacity
            style={{
              marginHorizontal: Spacing.lg, marginTop: Spacing.md,
              paddingVertical: 14, borderRadius: 14, alignItems: 'center',
              backgroundColor: dark ? '#424242' : '#F3F4F6',
            }}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Text fontSize={FontSize.body} fontWeight="600" color={colors.text}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </YStack>
    </Modal>
  );
});
