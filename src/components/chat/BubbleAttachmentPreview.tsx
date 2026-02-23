/**
 * BubbleAttachmentPreview — Image/file attachment previews inside a chat bubble.
 */
import React, { useState } from 'react';
import { TouchableOpacity, Image, Dimensions } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { Attachment } from '../../acp/models/types';
import { FontSize, Spacing, Radius, type ThemeColors } from '../../utils/theme';
import { getFileIcon, formatSize } from '../../utils/fileUtils';
import { ImageModal } from './ImageModal';

const SCREEN_W = Dimensions.get('window').width;
const IMAGE_SIZE = Math.min(SCREEN_W * 0.5, 240);

interface Props {
  attachments: Attachment[];
  colors: ThemeColors;
}

export const BubbleAttachmentPreview = React.memo(function BubbleAttachmentPreview({ attachments, colors }: Props) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  return (
    <XStack flexWrap="wrap" gap={Spacing.xs} marginBottom={Spacing.sm}>
      {attachments.map(att => {
        if (att.mediaType.startsWith('image/')) {
          return (
            <TouchableOpacity key={att.id} onPress={() => setPreviewUri(att.uri)} activeOpacity={0.8}>
              <Image
                source={{ uri: att.uri, cache: 'force-cache' }}
                style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: Radius.md }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        }
        return (
          <XStack
            key={att.id}
            alignItems="center"
            borderRadius={Radius.sm}
            paddingHorizontal={Spacing.md}
            paddingVertical={Spacing.sm}
            gap={Spacing.sm}
            backgroundColor={colors.codeBackground}
            minWidth={160}
          >
            {React.createElement(getFileIcon(att.mediaType), { size: 20, color: colors.primary })}
            <YStack flex={1}>
              <Text fontSize={FontSize.caption} fontWeight="500" color={colors.text} numberOfLines={1}>{att.name}</Text>
              {att.size ? (
                <Text fontSize={FontSize.caption - 1} color={colors.textTertiary}>{formatSize(att.size)}</Text>
              ) : null}
            </YStack>
          </XStack>
        );
      })}
      <ImageModal visible={!!previewUri} uri={previewUri ?? ''} onClose={() => setPreviewUri(null)} />
    </XStack>
  );
});
