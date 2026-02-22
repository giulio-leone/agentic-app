/**
 * ComposerActionButton — Right-side action button (send/stop/voice/disabled).
 */
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { YStack } from 'tamagui';
import { ArrowUp, Mic, Square } from 'lucide-react-native';
import { Spacing } from '../../utils/theme';

const BTN_STYLE = {
  width: 32, height: 32, borderRadius: 16,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  marginLeft: Spacing.sm, marginBottom: 1,
};

interface Props {
  isStreaming: boolean;
  canSend: boolean;
  isListening?: boolean;
  hasVoice: boolean;
  onSend: () => void;
  onCancel: () => void;
  onToggleVoice: () => void;
  colors: {
    text: string;
    background: string;
    sendButtonBg: string;
    sendButtonIcon: string;
    sendButtonDisabledBg: string;
    destructive: string;
    contrastText: string;
    textTertiary: string;
  };
}

export const ComposerActionButton = React.memo(function ComposerActionButton({
  isStreaming, canSend, isListening, hasVoice, onSend, onCancel, onToggleVoice, colors,
}: Props) {
  if (isStreaming) {
    return (
      <TouchableOpacity
        style={[BTN_STYLE, { backgroundColor: colors.text }]}
        onPress={onCancel}
        activeOpacity={0.7}
        accessibilityLabel="Stop generating"
      >
        <YStack width={12} height={12} borderRadius={2} backgroundColor={colors.background} />
      </TouchableOpacity>
    );
  }

  if (canSend) {
    return (
      <TouchableOpacity
        style={[BTN_STYLE, { backgroundColor: colors.sendButtonBg }]}
        onPress={onSend}
        activeOpacity={0.7}
        accessibilityLabel="Send message"
      >
        <ArrowUp size={18} color={colors.sendButtonIcon} />
      </TouchableOpacity>
    );
  }

  if (hasVoice) {
    return (
      <TouchableOpacity
        style={[BTN_STYLE, { backgroundColor: isListening ? colors.destructive : colors.sendButtonDisabledBg }]}
        onPress={onToggleVoice}
        activeOpacity={0.7}
        accessibilityLabel={isListening ? 'Stop recording' : 'Start voice input'}
      >
        {isListening
          ? <Square size={14} fill={colors.contrastText} color={colors.contrastText} />
          : <Mic size={18} color={colors.textTertiary} />
        }
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[BTN_STYLE, { backgroundColor: colors.sendButtonDisabledBg }]}
      onPress={onSend}
      disabled
      activeOpacity={0.7}
    >
      <ArrowUp size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});
