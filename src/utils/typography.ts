/**
 * Typography tokens — theme-independent text style primitives.
 */

import { StyleSheet, Platform } from 'react-native';
import { FontSize } from './theme';

export const typography = StyleSheet.create({
  // Sizes
  caption: { fontSize: FontSize.caption },
  footnote: { fontSize: FontSize.footnote },
  subheadline: { fontSize: FontSize.subheadline },
  body: { fontSize: FontSize.body },
  headline: { fontSize: FontSize.headline },
  title3: { fontSize: FontSize.title3 },
  title2: { fontSize: FontSize.title2 },
  title1: { fontSize: FontSize.title1 },
  largeTitle: { fontSize: FontSize.largeTitle },

  // Weights
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },

  // Alignment
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },

  // Line heights
  bodyLineHeight: { fontSize: FontSize.body, lineHeight: 24 },

  // Uppercase label
  label: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Ellipsis
  singleLine: { numberOfLines: 1 } as any,
  italic: { fontStyle: 'italic' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
