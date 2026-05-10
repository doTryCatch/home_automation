import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import Toast from 'react-native-toast-message';
import { COLORS } from './src/constants/theme';

export default function App() {
  useEffect(() => {
    import('expo-navigation-bar').then(mod => {
      if (mod?.setNavigationBarColor) {
        mod.setNavigationBarColor(COLORS.background);
      }
    }).catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <>
        <StatusBar style="light" backgroundColor={COLORS.background} />
        <AppNavigator />
        <Toast />
      </>
    </GestureHandlerRootView>
  );
}
