/**
 * Navigation — Drawer + Stack layout, ChatGPT-style header with glass effects.
 */

import React, { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { XStack, Text, YStack } from 'tamagui';
import { Menu } from 'lucide-react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { SessionDetailScreen } from './screens/SessionDetailScreen';
import { DrawerContent } from './components/sidebar/DrawerContent';
import { HeaderActions } from './components/navigation/HeaderActions';

// Lazy-loaded modal screens — not needed until user interaction
const AddServerScreen = React.lazy(() => import('./screens/AddServerScreen').then(m => ({ default: m.AddServerScreen })));
const QuickSetupScreen = React.lazy(() => import('./screens/QuickSetupScreen').then(m => ({ default: m.QuickSetupScreen })));
const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
import { TerminalPanel } from './components/TerminalPanel';
import { ACPServerConfiguration } from './acp/models/types';
import { useDesignSystem, layout } from './utils/designSystem';
import { Spacing, FontSize } from './utils/theme';
import { useAppStore } from './stores/appStore';
import { useAgentInfo, useConnectionState, useIsInitialized, useSessionActions } from './stores/selectors';
import { ConnectionBadge } from './components/ConnectionBadge';
import { ScreenWatcherPanel } from './components/ScreenWatcherPanel';

export type RootStackParamList = {
  Main: undefined;
  Home: undefined;
  Session: undefined;
  AddServer: { editingServer?: ACPServerConfiguration } | undefined;
  QuickSetup: { editingServer?: ACPServerConfiguration } | undefined;
  Settings: undefined;
};

export type DrawerParamList = {
  Chat: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

function ScreenFallback() {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <ActivityIndicator size="small" />
    </YStack>
  );
}

function LazyAddServer(props: NativeStackScreenProps<RootStackParamList, 'AddServer'>) {
  return <Suspense fallback={<ScreenFallback />}><AddServerScreen {...props} /></Suspense>;
}
function LazyQuickSetup(props: NativeStackScreenProps<RootStackParamList, 'QuickSetup'>) {
  return <Suspense fallback={<ScreenFallback />}><QuickSetupScreen {...props} /></Suspense>;
}
function LazySettings(props: NativeStackScreenProps<RootStackParamList, 'Settings'>) {
  return <Suspense fallback={<ScreenFallback />}><SettingsScreen {...props} /></Suspense>;
}

function HeaderTitle() {
  const { colors } = useDesignSystem();
  const agentInfo = useAgentInfo();
  const connectionState = useConnectionState();
  const isInitialized = useIsInitialized();

  return (
    <XStack alignItems="center" gap={Spacing.xs}>
      <Text fontSize={FontSize.subheadline} fontWeight="500" color="$color">
        {agentInfo?.name || 'Agentic'}
      </Text>
      <ConnectionBadge state={connectionState} isInitialized={isInitialized} />
    </XStack>
  );
}

function GlassHeader({ children, tint }: { children: React.ReactNode; tint: 'light' | 'dark' }) {
  if (Platform.OS === 'android') {
    return <>{children}</>;
  }
  return (
    <BlurView intensity={80} tint={tint} style={StyleSheet.absoluteFill}>
      {children}
    </BlurView>
  );
}

function DrawerNavigator() {
  const { colors, dark } = useDesignSystem();
  const { width } = useWindowDimensions();
  const isInitialized = useIsInitialized();
  const { createSession } = useSessionActions();

  return (
    <>
      <Drawer.Navigator
        drawerContent={(props) => <DrawerContent {...props} />}
        screenOptions={{
          drawerType: width >= 768 ? 'permanent' : 'slide',
          drawerStyle: {
            width: Math.min(300, width * 0.78),
            backgroundColor: colors.sidebarBackground,
          },
          overlayColor: 'rgba(0,0,0,0.5)',
          headerStyle: { backgroundColor: dark ? 'rgba(33,33,33,0.85)' : 'rgba(255,255,255,0.85)' },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '500', fontSize: FontSize.subheadline },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Drawer.Screen
          name="Chat"
          component={SessionDetailScreen}
          options={({ navigation }) => ({
            headerTitle: () => <HeaderTitle />,
            headerTransparent: Platform.OS === 'ios',
            headerBackground: Platform.OS === 'ios'
              ? () => (
                <BlurView
                  intensity={80}
                  tint={dark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
              )
              : undefined,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
                style={{ paddingHorizontal: Spacing.md }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Open menu"
                accessibilityRole="button"
              >
                <Menu size={20} color={colors.text} />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <HeaderActions
                colors={colors}
                isInitialized={isInitialized}
                onCreateSession={() => { if (isInitialized) createSession(); }}
              />
            ),
          })}
        />
      </Drawer.Navigator>
      <ScreenWatcherPanel />
      <TerminalPanel />
    </>
  );
}

function AppContent() {
  const { colors, dark } = useDesignSystem();
  const loadServers = useAppStore(s => s.loadServers);
  const loadMCPServers = useAppStore(s => s.loadMCPServers);
  const servers = useAppStore(s => s.servers);
  const navigationRef = React.useRef<any>(null);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);

  useEffect(() => {
    loadServers();
    loadMCPServers();
  }, [loadServers, loadMCPServers]);

  // Auto-show QuickSetup on first launch when no servers configured
  useEffect(() => {
    if (hasCheckedOnboarding) return;
    if (servers.length === 0 && navigationRef.current?.isReady()) {
      setHasCheckedOnboarding(true);
      navigationRef.current.navigate('QuickSetup');
    } else if (servers.length > 0) {
      setHasCheckedOnboarding(true);
    }
  }, [servers, hasCheckedOnboarding]);

  const navTheme = dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text, border: colors.separator } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text, border: colors.separator } };

  const modalOptions = (title: string) => ({
    headerShown: true,
    title,
    presentation: 'modal' as const,
    headerTransparent: Platform.OS === 'ios',
    headerBackground: Platform.OS === 'ios'
      ? () => <BlurView intensity={80} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      : undefined,
    headerStyle: Platform.OS === 'android' ? { backgroundColor: colors.surface } : undefined,
    headerTintColor: colors.text,
    headerShadowVisible: false,
  });

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        if (!hasCheckedOnboarding && servers.length === 0) {
          setHasCheckedOnboarding(true);
          navigationRef.current?.navigate('QuickSetup');
        }
      }}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 250,
        }}
      >
        <RootStack.Screen name="Main" component={DrawerNavigator} />
        <RootStack.Screen
          name="AddServer"
          component={LazyAddServer}
          options={{ ...modalOptions('Add Server'), animation: 'slide_from_bottom' }}
        />
        <RootStack.Screen
          name="QuickSetup"
          component={LazyQuickSetup}
          options={{ ...modalOptions('Quick Setup'), animation: 'slide_from_bottom' }}
        />
        <RootStack.Screen
          name="Settings"
          component={LazySettings}
          options={{ ...modalOptions('Settings'), animation: 'fade_from_bottom' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export function AppNavigator() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppContent />
    </GestureHandlerRootView>
  );
}
