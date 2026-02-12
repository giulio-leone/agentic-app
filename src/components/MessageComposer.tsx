/**
 * Message composer — ChatGPT style: pill-shaped input with attachment support.
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing } from '../utils/theme';
import { Attachment } from '../acp/models/types';
import { useFilePicker } from '../hooks/useFilePicker';
import { AttachmentSheet } from './AttachmentSheet';

// File type icons
import { getFileIcon, formatSize } from '../utils/fileUtils';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (attachments?: Attachment[]) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  isDisabled: boolean;
  placeholder?: string;
  isListening?: boolean;
  onToggleVoice?: () => void;
}

export function MessageComposer({
  value,
  onChangeText,
  onSend,
  onCancel,
  isStreaming,
  isDisabled,
  placeholder = 'Message',
  isListening,
  onToggleVoice,
}: Props) {
  const { colors, dark } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);
  const { pickImage, pickCamera, pickDocument } = useFilePicker();

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming && !isDisabled;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend(attachments.length > 0 ? attachments : undefined);
    setAttachments([]);
  }, [canSend, onSend, attachments]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel?.();
  }, [onCancel]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleAttach = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetVisible(true);
  }, []);

  const handlePickImage = useCallback(async () => {
    try {
      const imgs = await pickImage();
      setAttachments(prev => [...prev, ...imgs]);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }, [pickImage]);

  const handlePickCamera = useCallback(async () => {
    try {
      const photo = await pickCamera();
      if (photo) setAttachments(prev => [...prev, photo]);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }, [pickCamera]);

  const handlePickDocument = useCallback(async () => {
    try {
      const docs = await pickDocument();
      setAttachments(prev => [...prev, ...docs]);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  }, [pickDocument]);

  const attachmentOptions = useMemo(() => [
    {
      icon: '🖼️',
      label: 'Photo Library',
      subtitle: 'Choose from your gallery',
      color: '#10A37F22',
      onPress: handlePickImage,
    },
    {
      icon: '📷',
      label: 'Camera',
      subtitle: 'Take a photo',
      color: '#3B82F622',
      onPress: handlePickCamera,
    },
    {
      icon: '📄',
      label: 'Document',
      subtitle: 'PDF, DOCX, XLSX, CSV and more',
      color: '#F59E0B22',
      onPress: handlePickDocument,
    },
  ], [handlePickImage, handlePickCamera, handlePickDocument]);

  const handleVoiceToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleVoice?.();
  }, [onToggleVoice]);

  const content = (
    <View style={[styles.inner, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.attachmentStrip}
          contentContainerStyle={styles.attachmentStripContent}
        >
          {attachments.map(att => (
            <View key={att.id} style={[styles.attachmentPreview, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              {att.mediaType.startsWith('image/') ? (
                <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
              ) : (
                <View style={styles.attachmentFileIcon}>
                  <Text style={styles.fileIconText}>{getFileIcon(att.mediaType)}</Text>
                </View>
              )}
              <View style={styles.attachmentInfo}>
                <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>{att.name}</Text>
                {att.size ? <Text style={[styles.attachmentSize, { color: colors.textTertiary }]}>{formatSize(att.size)}</Text> : null}
              </View>
              <TouchableOpacity
                style={[styles.removeAttachment, { backgroundColor: colors.text }]}
                onPress={() => removeAttachment(att.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.removeIcon, { color: colors.background }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        {/* Attach button */}
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleAttach}
          disabled={isDisabled || isStreaming}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel="Add attachment"
        >
          <Text style={[styles.attachIcon, { color: isDisabled ? colors.textTertiary : colors.textSecondary }]}>+</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.systemGray2}
          multiline
          maxLength={10000}
          editable={!isDisabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        {isStreaming ? (
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.text }]}
            onPress={handleCancel}
            activeOpacity={0.7}
            accessibilityLabel="Stop generating"
          >
            <View style={[styles.stopIcon, { backgroundColor: colors.background }]} />
          </TouchableOpacity>
        ) : canSend ? (
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.sendButtonBg }]}
            onPress={handleSend}
            activeOpacity={0.7}
            accessibilityLabel="Send message"
          >
            <Text style={[styles.sendIcon, { color: colors.sendButtonIcon }]}>↑</Text>
          </TouchableOpacity>
        ) : onToggleVoice ? (
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: isListening ? colors.destructive : colors.sendButtonDisabledBg },
            ]}
            onPress={handleVoiceToggle}
            activeOpacity={0.7}
            accessibilityLabel={isListening ? 'Stop recording' : 'Start voice input'}
          >
            <Text style={[styles.sendIcon, { color: isListening ? colors.contrastText : colors.textTertiary }]}>
              {isListening ? '⏹' : '🎙'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.sendButtonDisabledBg }]}
            onPress={handleSend}
            disabled
            activeOpacity={0.7}
          >
            <Text style={[styles.sendIcon, { color: colors.textTertiary }]}>↑</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Glass effect on iOS, solid on Android
  if (Platform.OS === 'ios') {
    return (
      <>
        <BlurView intensity={80} tint={dark ? 'dark' : 'light'} style={styles.container}>
          {content}
        </BlurView>
        <AttachmentSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          options={attachmentOptions}
        />
      </>
    );
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: dark ? 'rgba(33,33,33,0.95)' : 'rgba(255,255,255,0.95)' }]}>
        {content}
      </View>
      <AttachmentSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        options={attachmentOptions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.sm,
  },
  inner: {
    paddingHorizontal: Spacing.md,
  },
  attachmentStrip: {
    marginBottom: Spacing.xs,
    maxHeight: 80,
  },
  attachmentStripContent: {
    gap: Spacing.xs,
    paddingHorizontal: 2,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingRight: Spacing.sm,
    overflow: 'hidden',
    maxWidth: 200,
  },
  attachmentThumb: {
    width: 52,
    height: 52,
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
  attachmentFileIcon: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconText: {
    fontSize: 24,
  },
  attachmentInfo: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
    justifyContent: 'center',
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '500',
  },
  attachmentSize: {
    fontSize: 10,
    marginTop: 1,
  },
  removeAttachment: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 4,
    right: 4,
  },
  removeIcon: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs + 2,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.sm,
    minHeight: 48,
    borderWidth: 1,
  },
  attachButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  attachIcon: {
    fontSize: 24,
    fontWeight: '300',
    marginTop: -2,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.body,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 2 : Spacing.xs,
    paddingBottom: 0,
    lineHeight: 22,
    marginLeft: Spacing.xs,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    marginBottom: 1,
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -1,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    marginBottom: 1,
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
});
