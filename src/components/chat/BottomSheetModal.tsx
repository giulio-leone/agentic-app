/**
 * BottomSheetModal — reusable bottom sheet with drag handle, backdrop dismiss, and slide animation.
 */

import React from 'react';
import { Modal, TouchableOpacity, View, StyleSheet } from 'react-native';
import { YStack } from 'tamagui';
import { Radius, Spacing } from '../../utils/theme';

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
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Backdrop — tap to dismiss */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <YStack
          borderTopLeftRadius={Radius.lg}
          borderTopRightRadius={Radius.lg}
          maxHeight={maxHeight as any}
          paddingBottom={40}
          backgroundColor={backgroundColor}
        >
          {/* Drag handle indicator */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: `${backgroundColor}80` }]}>
              <View style={styles.handleBar} />
            </View>
          </View>
          {children}
        </YStack>
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
    paddingTop: Spacing.sm,
    paddingBottom: 2,
  },
  handle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
  },
});
