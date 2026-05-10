import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Text, View, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, DEVICE_ICONS } from '../constants/theme';

interface Props {
  id: string;
  name: string;
  icon: string;
  isOn: boolean;
  isDb: boolean;
  busy: boolean;
  pin?: number;
  onToggle: () => void;
}

const AnimatedDeviceChip = ({ name, icon, isOn, busy, pin, onToggle }: Props) => {
  const anim = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOn ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isOn]);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: busy ? 0.93 : 1,
      tension: 300,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [busy]);

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.surfaceLight, COLORS.primary],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border, COLORS.primary],
  });

  return (
    <TouchableOpacity onPress={onToggle} disabled={busy} activeOpacity={0.7}>
      <Animated.View style={[s.chip, { backgroundColor: bgColor, borderColor, transform: [{ scale: scaleAnim }] }]}>
        <MaterialCommunityIcons
          name={(DEVICE_ICONS[icon] || icon) as any}
          size={16}
          color={isOn ? '#FFFFFF' : COLORS.textSecondary}
        />
        <View style={s.nameCol}>
          <Text style={[s.chipName, isOn && s.chipNameOn]} numberOfLines={1}>
            {name}
          </Text>
          {pin !== undefined && (
            <Text style={[s.chipPin, isOn && s.chipPinOn]}>
              D{pin}
            </Text>
          )}
        </View>
        <Animated.View style={[s.dot, { backgroundColor: isOn ? '#FFFFFF' : COLORS.textLight, shadowColor: COLORS.primary, shadowOpacity: isOn ? 0.8 : 0, shadowRadius: isOn ? 6 : 0, elevation: isOn ? 3 : 0 }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipName: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    maxWidth: 65,
  },
  chipNameOn: {
    color: '#FFFFFF',
  },
  nameCol: {
    flexDirection: 'column',
    gap: 0,
  },
  chipPin: {
    fontSize: 8,
    color: COLORS.textLight,
    fontWeight: '500',
    marginTop: -2,
  },
  chipPinOn: {
    color: '#FFFFFF80',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default AnimatedDeviceChip;
