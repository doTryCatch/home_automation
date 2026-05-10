import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/Home/HomeScreen';
import FloorPlanScreen from '../screens/FloorPlan/FloorPlanScreen';
import FloorEditorScreen from '../screens/FloorPlan/FloorEditorScreen';
import ScheduleListScreen from '../screens/Schedule/ScheduleListScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import RoomControlScreen from '../screens/Room/RoomControlScreen';
import DeviceScheduleScreen from '../screens/Device/DeviceScheduleScreen';
import ProfileScreen from '../screens/Auth/ProfileScreen';
import { COLORS } from '../constants/theme';

import RoomDeviceEditorScreen from '../screens/FloorPlan/RoomDeviceEditorScreen';

export type MainStackParamList = {
  MainTabs: undefined;
  FloorEditor: { floorId: string };
  RoomDeviceEditor: { floorId: string; roomId: string };
  RoomControl: { room: any };
  DeviceSchedules: { deviceId: string; deviceName: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 4,
          height: 60 + Math.max(insets.bottom - 8, 0),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{
        title: 'Home',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" size={size} color={color} />,
      }} />
      <Tab.Screen name="FloorPlanTab" component={FloorPlanScreen} options={{
        title: 'Floor Plan',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="floor-plan" size={size} color={color} />,
      }} />
      <Tab.Screen name="ScheduleTab" component={ScheduleListScreen} options={{
        title: 'Schedules',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clock-outline" size={size} color={color} />,
      }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{
        title: 'Settings',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" size={size} color={color} />,
      }} />
    </Tab.Navigator>
  );
};

const MainNavigator = () => (
  <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.text }}>
    <Stack.Screen name="MainTabs" component={TabNavigator} options={{ headerShown: false }} />
    <Stack.Screen name="FloorEditor" component={FloorEditorScreen} options={({ route }: any) => ({
      title: 'Edit Floor', headerBackTitle: 'Back',
    })} />
    <Stack.Screen name="RoomDeviceEditor" component={RoomDeviceEditorScreen} options={({ route }: any) => ({
      title: 'Edit Room', headerBackTitle: 'Back',
    })} />
    <Stack.Screen name="RoomControl" component={RoomControlScreen} options={({ route }: any) => ({
      title: route.params?.room?.name || 'Room', headerBackTitle: 'Back',
    })} />
    <Stack.Screen name="DeviceSchedules" component={DeviceScheduleScreen} options={({ route }: any) => ({
      title: `${route.params?.deviceName || 'Device'} Schedules`, headerBackTitle: 'Back',
    })} />
    <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Edit Profile', headerBackTitle: 'Back' }} />
  </Stack.Navigator>
);

export default MainNavigator;
