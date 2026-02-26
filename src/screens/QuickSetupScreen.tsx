/**
 * QuickSetupScreen — 3-step onboarding wizard with animated transitions.
 *
 * AI Provider flow:     Step 0: Choose provider → Step 1: API key → Step 2: Pick model
 * ACP Agent flow:       Step 0: Choose ACP → Step 1: Host + token → Save
 * Copilot Bridge flow:  Step 0: Choose Copilot → Step 1: Discovery/Pairing → Step 2: Pick model
 *
 * Logic extracted into:
 *  - quicksetup/presets.ts              (preset data)
 *  - quicksetup/useQuickSetupWizard.ts  (state + handlers)
 *  - quicksetup/Step0Presets.tsx         (provider selection)
 *  - quicksetup/Step1AI.tsx             (API key input)
 *  - quicksetup/Step1ACP.tsx            (ACP host config)
 *  - quicksetup/Step1CopilotBridge.tsx  (discovery + pairing)
 *  - quicksetup/Step2ModelPicker.tsx    (AI model picker + advanced)
 *  - quicksetup/Step2CopilotModels.tsx  (Copilot model picker)
 */

import React from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  View,
  UIManager,
} from 'react-native';
import { XStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignSystem } from '../utils/designSystem';
import { Spacing } from '../utils/theme';
import { useQuickSetupWizard } from './quicksetup/useQuickSetupWizard';
import { Step0Presets } from './quicksetup/Step0Presets';
import { Step1AI } from './quicksetup/Step1AI';
import { Step1ACP } from './quicksetup/Step1ACP';
import { Step1CopilotBridge } from './quicksetup/Step1CopilotBridge';
import { Step2ModelPicker } from './quicksetup/Step2ModelPicker';
import { Step2CopilotModels } from './quicksetup/Step2CopilotModels';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export function QuickSetupScreen() {
  const { colors } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const w = useQuickSetupWizard();

  const renderStepIndicator = () => (
    <XStack justifyContent="center" gap={Spacing.xs} marginBottom={Spacing.lg}>
      {Array.from({ length: w.stepCount }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === w.step ? colors.primary : colors.separator,
              width: i === w.step ? 24 : 8,
            },
          ]}
        />
      ))}
    </XStack>
  );

  const renderStep0 = () => <Step0Presets w={w} colors={colors} />;

  const renderStep1 = () => {
    if (w.flow === 'copilot') return <Step1CopilotBridge w={w} colors={colors} />;
    if (w.flow === 'acp') return <Step1ACP w={w} colors={colors} />;
    return <Step1AI w={w} colors={colors} />;
  };

  const renderStep2 = () => {
    if (w.flow === 'copilot') return <Step2CopilotModels w={w} colors={colors} />;
    return <Step2ModelPicker w={w} colors={colors} />;
  };

  const steps = [renderStep0, renderStep1, renderStep2];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: Math.max(insets.bottom, Spacing.lg) + 80,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepIndicator()}
        <Animated.View style={{ opacity: w.fadeAnim, transform: [{ translateX: w.slideAnim }], flex: 1 }}>
          {steps[w.step]()}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
