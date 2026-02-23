/**
 * AttachmentPreviewStrip — Horizontal scroll of attachment thumbnails in the composer.
 */
import React from 'react';
import { ScrollView, TouchableOpacity, Image } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { X } from 'lucide-react-native';
import { Attachment } from '../../acp/models/types';
import { Spacing } from '../../utils/theme';
import { getFileIcon, formatSize } from '../../utils/fileUtils';

interface Props {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  colors: {
    inputBackground: string;
    inputBorder: string;
    text: string;
    textTertiary: string;
    background: string;
  };
}

export const AttachmentPreviewStrip = React.memo(function AttachmentPreviewStrip({
  attachments, onRemove, colors,
}: Props) {
  if (attachments.length === 0) return null;

  return (
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
              source={{ uri: att.uri, cache: 'force-cache' }}
              style={{ width: 52, height: 52, borderTopLeftRadius: 11, borderBottomLeftRadius: 11 }}
            />
          ) : (
            <YStack width={52} height={52} justifyContent="center" alignItems="center">
              {React.createElement(getFileIcon(att.mediaType), { size: 24, color: colors.textTertiary })}
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
            onPress={() => onRemove(att.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={10} color={colors.background} />
          </TouchableOpacity>
        </XStack>
      ))}
    </ScrollView>
  );
});
