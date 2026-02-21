/**
 * Message composer — ChatGPT style: pill-shaped input with attachment support.
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  TextInput,
  TouchableOpacity,
  Platform,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Plus, ArrowUp, Mic, Square, X, ImageIcon, Camera, FileText } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
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
      icon: <ImageIcon size={24} color="#10A37F" />,
      label: 'Photo Library',
      subtitle: 'Choose from your gallery',
      color: '#10A37F22',
      onPress: handlePickImage,
    },
    {
      icon: <Camera size={24} color="#3B82F6" />,
      label: 'Camera',
      subtitle: 'Take a photo',
      color: '#3B82F622',
      onPress: handlePickCamera,
    },
    {
      icon: <FileText size={24} color="#F59E0B" />,
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
    <YStack paddingHorizontal={Spacing.md} paddingBottom={Math.max(insets.bottom, Spacing.sm)}>
      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: Spacing.xs, maxHeight: 80 }}
          contentContainerStyle={{ gap: Spacing.xs, paddingHorizontal: 2 }}
        >
          {attachments.map(att => (
            <XStack
              key={att.id}
              alignItems="center"
              borderRadius={12}
              borderWidth={1}
              paddingRight={Spacing.sm}
              overflow="hidden"
              maxWidth={200}
              backgroundColor={colors.inputBackground}
              borderColor={colors.inputBorder}
            >
              {att.mediaType.startsWith('image/') ? (
                <Image
                  source={{ uri: att.uri }}
                  style={{ width: 52, height: 52, borderTopLeftRadius: 11, borderBottomLeftRadius: 11 }}
                />
              ) : (
                <YStack width={52} height={52} justifyContent="center" alignItems="center">
                  <Text fontSize={24}>{getFileIcon(att.mediaType)}</Text>
                </YStack>
              )}
              <YStack flex={1} paddingHorizontal={Spacing.xs} justifyContent="center">
                <Text fontSize={12} fontWeight="500" color={colors.text} numberOfLines={1}>{att.name}</Text>
                {att.size ? <Text fontSize={10} color={colors.textTertiary} marginTop={1}>{formatSize(att.size)}</Text> : null}
              </YStack>
              <TouchableOpacity
                style={{
                  width: 18, height: 18, borderRadius: 9,
                  justifyContent: 'center', alignItems: 'center',
                  position: 'absolute', top: 4, right: 4,
                  backgroundColor: colors.text,
                }}
                onPress={() => removeAttachment(att.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={10} color={colors.background} />
              </TouchableOpacity>
            </XStack>
          ))}
        </ScrollView>
      )}

      <XStack
        alignItems="center"
        borderRadius={Radius.xl}
        paddingHorizontal={Spacing.sm}
        paddingVertical={Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.sm}
        minHeight={48}
        borderWidth={1}
        backgroundColor={colors.inputBackground}
        borderColor={colors.inputBorder}
        {...(Platform.OS === 'ios'
          ? { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 4 }
          : { elevation: 4 })}
      >
        {/* Attach button */}
        <TouchableOpacity
          style={{
            width: 28, height: 28, borderRadius: 14,
            justifyContent: 'center', alignItems: 'center',
          }}
          onPress={handleAttach}
          disabled={isDisabled || isStreaming}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel="Add attachment"
        >
          <Plus size={20} color={isDisabled ? colors.textTertiary : colors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={{
            flex: 1,
            fontSize: FontSize.body,
            maxHeight: 120,
            paddingTop: 0,
            paddingBottom: 0,
            lineHeight: 22,
            textAlignVertical: 'center',
            marginLeft: Spacing.xs,
            color: colors.text,
          }}
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
            style={{
              width: 32, height: 32, borderRadius: 16,
              justifyContent: 'center', alignItems: 'center',
              marginLeft: Spacing.sm, marginBottom: 1,
              backgroundColor: colors.text,
            }}
            onPress={handleCancel}
            activeOpacity={0.7}
            accessibilityLabel="Stop generating"
          >
            <YStack width={12} height={12} borderRadius={2} backgroundColor={colors.background} />
          </TouchableOpacity>
        ) : canSend ? (
          <TouchableOpacity
            style={{
              width: 32, height: 32, borderRadius: 16,
              justifyContent: 'center', alignItems: 'center',
              marginLeft: Spacing.sm, marginBottom: 1,
              backgroundColor: colors.sendButtonBg,
            }}
            onPress={handleSend}
            activeOpacity={0.7}
            accessibilityLabel="Send message"
          >
            <ArrowUp size={18} color={colors.sendButtonIcon} />
          </TouchableOpacity>
        ) : onToggleVoice ? (
          <TouchableOpacity
            style={{
              width: 32, height: 32, borderRadius: 16,
              justifyContent: 'center', alignItems: 'center',
              marginLeft: Spacing.sm, marginBottom: 1,
              backgroundColor: isListening ? colors.destructive : colors.sendButtonDisabledBg,
            }}
            onPress={handleVoiceToggle}
            activeOpacity={0.7}
            accessibilityLabel={isListening ? 'Stop recording' : 'Start voice input'}
          >
            {isListening ? <Square size={14} fill={colors.contrastText} color={colors.contrastText} /> : <Mic size={18} color={colors.textTertiary} />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{
              width: 32, height: 32, borderRadius: 16,
              justifyContent: 'center', alignItems: 'center',
              marginLeft: Spacing.sm, marginBottom: 1,
              backgroundColor: colors.sendButtonDisabledBg,
            }}
            onPress={handleSend}
            disabled
            activeOpacity={0.7}
          >
            <ArrowUp size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </XStack>
    </YStack>
  );

  // Glass effect on iOS, solid on Android
  if (Platform.OS === 'ios') {
    return (
      <>
        <BlurView intensity={80} tint={dark ? 'dark' : 'light'} style={{ paddingTop: Spacing.sm }}>
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
      <YStack
        paddingTop={Spacing.sm}
        backgroundColor={dark ? 'rgba(33,33,33,0.95)' : 'rgba(255,255,255,0.95)'}
      >
        {content}
      </YStack>
      <AttachmentSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        options={attachmentOptions}
      />
    </>
  );
}
