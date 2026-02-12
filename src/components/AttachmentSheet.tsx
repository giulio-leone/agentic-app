/**
 * AttachmentSheet — Modern bottom sheet for attachment picking.
 * Animated with react-native-reanimated, backdrop blur, ChatGPT style.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useTheme, Spacing, FontSize } from '../utils/theme';

const SHEET_HEIGHT = 300;

interface AttachmentOption {
  icon: string;
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

export const AttachmentSheet = React.memo(function AttachmentSheet({ visible, onClose, options }: Props) {
  const { colors, dark } = useTheme();
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

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
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
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
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
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: handleColor }]} />
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionRow,
                  index < options.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  },
                ]}
                onPress={() => handleOptionPress(option)}
                activeOpacity={0.6}
              >
                <View style={[styles.iconCircle, { backgroundColor: option.color || colors.primary + '18' }]}>
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                  {option.subtitle && (
                    <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>{option.subtitle}</Text>
                  )}
                </View>
                <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel button */}
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: dark ? '#424242' : '#F3F4F6' }]}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  optionsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 24,
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  optionLabel: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
  optionSubtitle: {
    fontSize: FontSize.footnote,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '300',
  },
  cancelButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
});
