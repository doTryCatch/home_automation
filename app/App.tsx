import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import Toast from 'react-native-toast-message';
import { COLORS } from './src/constants/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <>
        <StatusBar style="dark" />
        <AppNavigator />
        <Toast />
      </>
    </GestureHandlerRootView>
  );
}
