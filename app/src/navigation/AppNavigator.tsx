import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore, useSettingsStore, useNotificationStore, subscribeToWebSocket } from '../store';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';
import websocketService from '../services/websocketService';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { isAuthenticated, isLoading, loadAuth } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { loadNotifications } = useNotificationStore();

  React.useEffect(() => {
    loadSettings().then(async () => {
      await loadAuth();
    });
  }, []);

  React.useEffect(() => {
    if (isAuthenticated) {
      websocketService.connect();
      subscribeToWebSocket();
      loadNotifications();
    } else {
      websocketService.disconnect();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
