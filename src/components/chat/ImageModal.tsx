/**
 * ImageModal — Fullscreen image viewer overlay.
 */

import React from 'react';
import { Modal, Pressable, Image, TouchableOpacity } from 'react-native';
import { YStack, Text } from 'tamagui';
import { X } from 'lucide-react-native';

interface Props {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

export const ImageModal = React.memo(function ImageModal({ visible, uri, onClose }: Props) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }} onPress={onClose}>
        <Image source={{ uri }} style={{ width: '95%', height: '85%' }} resizeMode="contain" />
        <TouchableOpacity
          style={{ position: 'absolute', top: 60, right: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
          onPress={onClose}
        >
          <X size={20} color="#fff" />
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
});
