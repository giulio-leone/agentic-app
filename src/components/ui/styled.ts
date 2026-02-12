/**
 * Styled Tamagui components — design system primitives.
 * Compiler-optimized: styles are extracted at build time.
 */

import { styled, View, Text, XStack } from 'tamagui';

export const Card = styled(View, {
  backgroundColor: '$cardBackground',
  borderRadius: '$4',
  padding: '$3',
  borderWidth: 0.5,
  borderColor: '$separator',
});

export const SectionTitle = styled(Text, {
  fontSize: 17,
  fontWeight: '600',
  color: '$color',
});

export const Caption = styled(Text, {
  fontSize: 12,
  color: '$textTertiary',
});

export const BodyText = styled(Text, {
  fontSize: 16,
  color: '$color',
  lineHeight: 22,
});

export const Badge = styled(View, {
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 999,
  backgroundColor: '$primaryMuted',
  alignItems: 'center',
  justifyContent: 'center',
});

export const BadgeText = styled(Text, {
  fontSize: 11,
  fontWeight: '600',
  color: '$primary',
});

export const FormField = styled(View, {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderBottomWidth: 0.5,
  borderBottomColor: '$separator',
});

export const FormLabel = styled(Text, {
  fontSize: 16,
  color: '$color',
  flex: 1,
});

export const FormInput = styled(Text, {
  fontSize: 16,
  color: '$textSecondary',
  textAlign: 'right',
});

export const Chip = styled(View, {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: '$cardBackground',
  borderWidth: 1,
  borderColor: '$separator',
  alignItems: 'center',
  justifyContent: 'center',

  variants: {
    selected: {
      true: {
        backgroundColor: '$primaryMuted',
        borderColor: '$primary',
      },
    },
  } as const,
});

export const ChipText = styled(Text, {
  fontSize: 13,
  fontWeight: '500',
  color: '$color',

  variants: {
    selected: {
      true: {
        color: '$primary',
      },
    },
  } as const,
});

export const FormCard = styled(View, {
  backgroundColor: '$cardBackground',
  borderRadius: 12,
  paddingHorizontal: 16,
  overflow: 'hidden',
});

export const CardLabel = styled(Text, {
  color: '$colorMuted',
  fontSize: 12,
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  paddingTop: 12,
  paddingBottom: 8,
});

export const FieldRow = styled(XStack, {
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 12,
  minHeight: 44,
});

export const FieldLabel = styled(Text, {
  color: '$color',
  fontSize: 16,
  fontWeight: '400',
  width: 90,
});
