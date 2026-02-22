/**
 * InlineImage — Image with fullscreen preview.
 */

import React, { useState } from 'react';
import { Image, TouchableOpacity, Dimensions } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { ImageOff } from 'lucide-react-native';
import type { ThemeColors } from '../../utils/theme';
import { ImageModal } from './ImageModal';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  url: string;
  alt: string;
  colors: ThemeColors;
}

export const InlineImage = React.memo(function InlineImage({ url, alt, colors }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <YStack borderWidth={1} borderRadius={8} padding={12} alignItems="center" marginVertical={4} borderColor={colors.separator}>
        <XStack alignItems="center" gap={6}>
          <ImageOff size={16} color={colors.textTertiary} />
          <Text color={colors.textTertiary}>Image failed to load</Text>
        </XStack>
      </YStack>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={() => setFullscreen(true)} activeOpacity={0.85}>
        <Image
          source={{ uri: url }}
          style={{ width: SCREEN_WIDTH * 0.7, height: 200, borderRadius: 8, marginVertical: 4, alignSelf: 'flex-start' }}
          resizeMode="contain"
          onError={() => setError(true)}
        />
        {alt ? <Text fontSize={12} fontStyle="italic" marginTop={2} color={colors.textTertiary}>{alt}</Text> : null}
      </TouchableOpacity>
      <ImageModal visible={fullscreen} uri={url} onClose={() => setFullscreen(false)} />
    </>
  );
});
