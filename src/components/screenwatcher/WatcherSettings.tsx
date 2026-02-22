/**
 * WatcherSettings — Collapsible settings panel for ScreenWatcher.
 */
import React from 'react';
import { TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Slider } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { FontSize, Spacing } from '../../utils/theme';

interface Props {
  isAutoMode: boolean;
  setAutoMode: (v: boolean) => void;
  isRemoteLLMEnabled: boolean;
  setRemoteLLMEnabled: (v: boolean) => void;
  motionThreshold: number;
  setMotionThreshold: (v: number) => void;
  stableThreshold: number;
  setStableThreshold: (v: number) => void;
  customPrompt: string;
  setCustomPrompt: (v: string) => void;
  colors: { text: string; primary: string; textTertiary: string };
  dark: boolean;
}

export const WatcherSettings = React.memo(function WatcherSettings({
  isAutoMode, setAutoMode,
  isRemoteLLMEnabled, setRemoteLLMEnabled,
  motionThreshold, setMotionThreshold,
  stableThreshold, setStableThreshold,
  customPrompt, setCustomPrompt,
  colors, dark,
}: Props) {
  const trackBg = dark ? '#333' : '#E5E7EB';
  const switchBg = (on: boolean) => on ? colors.primary : (dark ? '#2F2F2F' : '#E5E7EB');

  return (
    <YStack paddingHorizontal={Spacing.xl} paddingTop={Spacing.lg} gap={Spacing.md}>
      {/* Auto-shoot toggle */}
      <ToggleRow label="Modalità Auto-Scatto" value={isAutoMode} onToggle={setAutoMode} colors={colors} switchBg={switchBg} />
      {/* Remote LLM toggle */}
      <ToggleRow label="Abilita Chiamata Cloud (Remote LLM)" value={isRemoteLLMEnabled} onToggle={setRemoteLLMEnabled} colors={colors} switchBg={switchBg} />

      {/* Motion threshold */}
      <SliderRow
        label="Soglia Movimento (Cattura testi)"
        value={motionThreshold}
        onChange={setMotionThreshold}
        min={0.1} max={3.0} step={0.1}
        hint="Più basso = fotocamera più reattiva ai tasti digitati."
        colors={colors} trackBg={trackBg}
      />

      {/* Stable threshold */}
      <SliderRow
        label="Soglia Stabilità (Auto-focus)"
        value={stableThreshold}
        onChange={setStableThreshold}
        min={0.1} max={1.5} step={0.1}
        hint="Più basso = aspetta totale immobilità per evitare il micromosso."
        colors={colors} trackBg={trackBg}
      />

      {/* Custom prompt */}
      <Text fontSize={FontSize.subheadline} fontWeight="600" color={colors.text}>
        Custom Prompt
      </Text>
      <TextInput
        style={[
          styles.promptInput,
          {
            color: colors.text,
            backgroundColor: dark ? '#2F2F2F' : '#FFFFFF',
            borderColor: dark ? '#424242' : '#D9D9E3',
          },
        ]}
        value={customPrompt}
        onChangeText={setCustomPrompt}
        multiline
        placeholder="Es: Analizza la domanda e rispondi..."
        placeholderTextColor={colors.textTertiary}
      />
      <Text fontSize={FontSize.caption} color={colors.textTertiary}>
        Questo prompt viene inviato con ogni screenshot catturato.
      </Text>
    </YStack>
  );
});

/** Reusable toggle row */
function ToggleRow({ label, value, onToggle, colors, switchBg }: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  colors: { text: string };
  switchBg: (on: boolean) => string;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center" paddingBottom={Spacing.sm}>
      <Text fontSize={FontSize.body} fontWeight="600" color={colors.text}>
        {label}
      </Text>
      <TouchableOpacity
        style={[styles.autoSwitch, { backgroundColor: switchBg(value) }]}
        onPress={() => { Haptics.selectionAsync(); onToggle(!value); }}
      >
        <Text fontSize={FontSize.footnote} fontWeight="600" color={value ? '#FFF' : colors.text}>
          {value ? 'ON' : 'OFF'}
        </Text>
      </TouchableOpacity>
    </XStack>
  );
}

/** Reusable slider row */
function SliderRow({ label, value, onChange, min, max, step, hint, colors, trackBg }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number; max: number; step: number;
  hint: string;
  colors: { text: string; primary: string; textTertiary: string };
  trackBg: string;
}) {
  return (
    <YStack gap={Spacing.xs} paddingBottom={Spacing.md}>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={FontSize.footnote} fontWeight="600" color={colors.text}>
          {label}
        </Text>
        <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="bold">
          {value.toFixed(1)}
        </Text>
      </XStack>
      <Slider defaultValue={[value]} min={min} max={max} step={step} onValueChange={(val) => onChange(val[0])}>
        <Slider.Track backgroundColor={trackBg}>
          <Slider.TrackActive backgroundColor={colors.primary} />
        </Slider.Track>
        <Slider.Thumb index={0} circular size="$1" backgroundColor={colors.primary} elevation={2} />
      </Slider>
      <Text fontSize={11} color={colors.textTertiary}>{hint}</Text>
    </YStack>
  );
}

const styles = StyleSheet.create({
  autoSwitch: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  promptInput: {
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
