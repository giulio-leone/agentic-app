/**
 * ImageRenderer — Renders base64/URL images with zoom support.
 */

import React from 'react';
import { Image, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';

interface Props {
  content: string;
  mediaType?: string;
}

export const ImageRenderer = React.memo(function ImageRenderer({ content, mediaType }: Props) {
  const { width } = useWindowDimensions();
  const imgWidth = width - 48;

  // Support base64 data or URL
  const uri = content.startsWith('http') || content.startsWith('data:')
    ? content
    : `data:${mediaType || 'image/png'};base64,${content}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      maximumZoomScale={3}
      minimumZoomScale={1}
      showsVerticalScrollIndicator={false}
    >
      <Image
        source={{ uri }}
        style={{ width: imgWidth, height: imgWidth, resizeMode: 'contain' }}
      />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { alignItems: 'center', justifyContent: 'center', flex: 1 },
});
