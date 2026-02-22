/**
 * InlineEditView — Inline message editing with submit/cancel actions.
 */
import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { FontSize, Spacing, Radius } from '../../utils/theme';

interface Props {
  isUserEdit: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  colors: {
    userBubble: string;
    surface: string;
    text: string;
    primary: string;
    inputBackground: string;
    textTertiary: string;
  };
}

export const InlineEditView = React.memo(function InlineEditView({
  isUserEdit, editText, setEditText, onSubmit, onCancel, colors,
}: Props) {
  return (
    <YStack
      paddingHorizontal={Spacing.lg}
      paddingVertical={Spacing.md}
      backgroundColor={isUserEdit ? colors.userBubble : colors.surface}
    >
      <XStack maxWidth={768} alignSelf="center" width="100%" gap={Spacing.sm}>
        <YStack flex={1} paddingLeft={isUserEdit ? 40 : 0}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.primary,
                backgroundColor: colors.inputBackground,
                minHeight: isUserEdit ? 40 : 100,
              },
            ]}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={onSubmit}
          />
          <XStack gap={Spacing.sm} marginTop={Spacing.sm} justifyContent="flex-end">
            <Text
              fontSize={FontSize.footnote}
              color={colors.textTertiary}
              onPress={onCancel}
              paddingHorizontal={Spacing.sm}
              paddingVertical={Spacing.xs}
            >
              Cancel
            </Text>
            <Text
              fontSize={FontSize.footnote}
              fontWeight="600"
              color={colors.primary}
              onPress={onSubmit}
              paddingHorizontal={Spacing.sm}
              paddingVertical={Spacing.xs}
            >
              {isUserEdit ? 'Send' : 'Save'}
            </Text>
          </XStack>
        </YStack>
      </XStack>
    </YStack>
  );
});

const styles = StyleSheet.create({
  input: {
    fontSize: FontSize.body,
    lineHeight: 24,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
});
