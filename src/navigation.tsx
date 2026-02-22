/**
 * Navigation — Drawer + Stack layout, ChatGPT-style header with glass effects.
 */

import React, { useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { XStack, Text } from 'tamagui';
import { Eye, Bot, Scale, PenLine, Menu, Search } from 'lucide-react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { SessionDetailScreen } from './screens/SessionDetailScreen';
import { AddServerScreen } from './screens/AddServerScreen';
import { QuickSetupScreen } from './screens/QuickSetupScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DrawerContent } from './components/sidebar/DrawerContent';
import { ConsensusConfigSheet } from './components/ConsensusConfigSheet';
import { ACPServerConfiguration } from './acp/models/types';
import { useDesignSystem, layout } from './utils/designSystem';
import { Spacing, FontSize } from './utils/theme';
import { useAppStore } from './stores/appStore';
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

function HeaderTitle() {
  const { colors } = useDesignSystem();
  const { agentInfo, connectionState, isInitialized } = useAppStore();

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
  const { createSession, isInitialized, agentModeEnabled, toggleAgentMode, consensusModeEnabled, toggleConsensusMode } = useAppStore();
  const { screenWatcherVisible, setScreenWatcherVisible, isWatching, toggleChatSearch } = useAppStore();
  const [consensusSheetVisible, setConsensusSheetVisible] = useState(false);

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
              <XStack alignItems="center" gap={Spacing.xs}>
                <TouchableOpacity
                  onPress={toggleChatSearch}
                  style={{ paddingHorizontal: Spacing.sm }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Search messages"
                  accessibilityRole="button"
                >
                  <Search size={18} color={colors.text} opacity={0.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setScreenWatcherVisible(true)}
                  style={{ paddingHorizontal: Spacing.sm }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={isWatching ? 'Screen watcher active' : 'Open screen watcher'}
                  accessibilityRole="button"
                >
                  <Eye size={18} color={isWatching ? colors.destructive : colors.text} opacity={isWatching ? 1 : 0.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleAgentMode}
                  style={{ paddingHorizontal: Spacing.sm }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={agentModeEnabled ? 'Disable agent mode' : 'Enable agent mode'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: agentModeEnabled }}
                >
                  <Bot size={18} color={agentModeEnabled ? colors.primary : colors.text} opacity={agentModeEnabled ? 1 : 0.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleConsensusMode}
                  onLongPress={() => setConsensusSheetVisible(true)}
                  delayLongPress={400}
                  style={{ paddingHorizontal: Spacing.sm }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={consensusModeEnabled ? 'Disable consensus mode' : 'Enable consensus mode'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: consensusModeEnabled }}
                >
                  <Scale size={18} color={consensusModeEnabled ? colors.primary : colors.text} opacity={consensusModeEnabled ? 1 : 0.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { if (isInitialized) createSession(); }}
                  style={{ paddingHorizontal: Spacing.md }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <PenLine size={20} color={colors.text} opacity={isInitialized ? 1 : 0.3} />
                </TouchableOpacity>
              </XStack>
            ),
          })}
        />
      </Drawer.Navigator>
      <ScreenWatcherPanel />
      <ConsensusConfigSheet
        visible={consensusSheetVisible}
        onClose={() => setConsensusSheetVisible(false)}
      />
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
          animation: 'slide_from_bottom',
        }}
      >
        <RootStack.Screen name="Main" component={DrawerNavigator} />
        <RootStack.Screen
          name="AddServer"
          component={AddServerScreen}
          options={{
            headerShown: true,
            title: 'Add Server',
            presentation: 'modal',
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
            headerStyle: Platform.OS === 'android' ? { backgroundColor: colors.surface } : undefined,
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
        <RootStack.Screen
          name="QuickSetup"
          component={QuickSetupScreen}
          options={{
            headerShown: true,
            title: 'Quick Setup',
            presentation: 'modal',
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
            headerStyle: Platform.OS === 'android' ? { backgroundColor: colors.surface } : undefined,
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
        <RootStack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: true,
            title: 'Settings',
            presentation: 'modal',
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
            headerStyle: Platform.OS === 'android' ? { backgroundColor: colors.surface } : undefined,
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
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
