import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
// Polyfill crypto.randomUUID for Hermes (deep-agents uses it)
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  (globalThis.crypto as any).randomUUID = () => uuidv4();
}
import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import Toast from 'react-native-toast-message';
import tamaguiConfig from './tamagui.config';
import { AppNavigator } from './src/navigation';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { configureNotifications, requestNotificationPermissions } from './src/services/notifications';
import { setupGlobalErrorHandler } from './src/utils/globalErrorHandler';

// Module-level setup (before any component renders)
configureNotifications();
setupGlobalErrorHandler();

export default function App() {
  const scheme = useColorScheme();

  // Request permissions on mount
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <ErrorBoundary>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={scheme === 'dark' ? 'dark' : 'light'}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <AppNavigator />
        <Toast />
      </TamaguiProvider>
    </ErrorBoundary>
  );
}
