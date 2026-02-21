/**
 * Navigation — Drawer + Stack layout, ChatGPT-style header with glass effects.
 */

import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { XStack, Text } from 'tamagui';
import { NavigationContainer, DefaultTheme, DarkTheme, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { SessionDetailScreen } from './screens/SessionDetailScreen';
import { AddServerScreen } from './screens/AddServerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DrawerContent } from './components/sidebar/DrawerContent';
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
  const { screenWatcherVisible, setScreenWatcherVisible, isWatching } = useAppStore();

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
              >
                <Text fontSize={20} color="$color">☰</Text>
              </TouchableOpacity>
            ),
            headerRight: () => (
              <XStack alignItems="center" gap={Spacing.xs}>
                <TouchableOpacity
                  onPress={() => setScreenWatcherVisible(true)}
                  style={{ paddingHorizontal: Spacing.xs }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text fontSize={18} color={isWatching ? '#EF4444' : '$color'} opacity={isWatching ? 1 : 0.5}>
                    👁
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleAgentMode}
                  style={{ paddingHorizontal: Spacing.xs }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text fontSize={18} color={agentModeEnabled ? colors.primary : '$color'} opacity={agentModeEnabled ? 1 : 0.5}>
                    🤖
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleConsensusMode}
                  style={{ paddingHorizontal: Spacing.xs }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text fontSize={18} color={consensusModeEnabled ? colors.primary : '$color'} opacity={consensusModeEnabled ? 1 : 0.5}>
                    ⚖️
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { if (isInitialized) createSession(); }}
                  style={{ paddingHorizontal: Spacing.md }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text fontSize={20} color="$color" opacity={isInitialized ? 1 : 0.3}>✎</Text>
                </TouchableOpacity>
              </XStack>
            ),
          })}
        />
      </Drawer.Navigator>
      <ScreenWatcherPanel />
    </>
  );
}

function AppContent() {
  const { colors, dark } = useDesignSystem();
  const loadServers = useAppStore(s => s.loadServers);
  const loadMCPServers = useAppStore(s => s.loadMCPServers);

  useEffect(() => {
    loadServers();
    loadMCPServers();
  }, [loadServers, loadMCPServers]);

  const navTheme = dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text, border: colors.separator } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text, border: colors.separator } };

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
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
