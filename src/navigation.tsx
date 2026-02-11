/**
 * Navigation — Drawer + Stack layout, ChatGPT-style header with glass effects.
 */

import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, useWindowDimensions, View, Platform } from 'react-native';
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
import { useTheme, Spacing, FontSize } from './utils/theme';
import { useAppStore } from './stores/appStore';
import { ConnectionBadge } from './components/ConnectionBadge';

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
  const { colors } = useTheme();
  const { agentInfo, connectionState, isInitialized } = useAppStore();

  return (
    <View style={styles.headerTitleContainer}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        {agentInfo?.name || 'Agentic'}
      </Text>
      <ConnectionBadge state={connectionState} isInitialized={isInitialized} />
    </View>
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
  const { colors, dark } = useTheme();
  const { width } = useWindowDimensions();
  const { createSession, isInitialized } = useAppStore();

  return (
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
              style={styles.hamburger}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.hamburgerText, { color: colors.text }]}>☰</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => { if (isInitialized) createSession(); }}
              style={styles.newChatHeaderButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.newChatHeaderIcon, { color: colors.text, opacity: isInitialized ? 1 : 0.3 }]}>✎</Text>
            </TouchableOpacity>
          ),
        })}
      />
    </Drawer.Navigator>
  );
}

function AppContent() {
  const { colors, dark } = useTheme();
  const loadServers = useAppStore(s => s.loadServers);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

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
            headerStyle: { backgroundColor: colors.surface },
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
            headerStyle: { backgroundColor: colors.surface },
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

const styles = StyleSheet.create({
  hamburger: {
    paddingHorizontal: Spacing.md,
  },
  hamburgerText: {
    fontSize: 20,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.subheadline,
    fontWeight: '500',
  },
  newChatHeaderButton: {
    paddingHorizontal: Spacing.md,
  },
  newChatHeaderIcon: {
    fontSize: 20,
  },
});
