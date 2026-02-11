/**
 * Navigation — Drawer + Stack layout.
 * Drawer sidebar holds server selector & session list.
 * Main area holds the chat view (SessionDetailScreen).
 * AddServer and Settings are presented as modals from a root stack.
 */

import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionDetailScreen } from './screens/SessionDetailScreen';
import { AddServerScreen } from './screens/AddServerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DrawerContent } from './components/sidebar/DrawerContent';
import { ACPServerConfiguration } from './acp/models/types';
import { useTheme, Spacing } from './utils/theme';
import { useAppStore } from './stores/appStore';

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

function DrawerNavigator() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        drawerType: width >= 768 ? 'permanent' : 'front',
        drawerStyle: {
          width: Math.min(300, width * 0.78),
          backgroundColor: colors.sidebarBackground,
        },
        overlayColor: 'rgba(0,0,0,0.35)',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Drawer.Screen
        name="Chat"
        component={SessionDetailScreen}
        options={({ navigation }) => ({
          title: 'Chat',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
              style={styles.hamburger}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.hamburgerText, { color: colors.text }]}>☰</Text>
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
            headerTintColor: colors.primary,
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
            headerTintColor: colors.primary,
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
    fontSize: 22,
  },
});
