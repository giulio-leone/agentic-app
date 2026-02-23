/**
 * BottomSheetModal — reusable bottom sheet with drag-to-dismiss gesture and spring animation.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { YStack } from 'tamagui';
import { Radius, Spacing } from '../../utils/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 120;

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  backgroundColor: string;
  maxHeight?: string;
}

export const BottomSheetModal = React.memo(function BottomSheetModal({
  visible,
  onClose,
  children,
  backgroundColor,
  maxHeight = '80%',
}: Props) {
  const [translateY] = useState(() => new Animated.Value(0));

  // Stop animations on unmount
  useEffect(() => () => { translateY.stopAnimation(); }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
            speed: 14,
          }).start();
        }
      },
    }),
  ).current;

  const handleClose = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      translateY.setValue(0);
    });
  }, [onClose, translateY]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <Animated.View
          style={{ transform: [{ translateY }] }}
          {...panResponder.panHandlers}
        >
          <YStack
            borderTopLeftRadius={Radius.lg}
            borderTopRightRadius={Radius.lg}
            maxHeight={maxHeight as any}
            paddingBottom={40}
            backgroundColor={backgroundColor}
          >
            {/* Drag handle */}
            <View style={styles.handleRow}>
              <View style={styles.handleBar} />
            </View>
            {children}
          </YStack>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdrop: {
    flex: 1,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.4)',
  },
});
