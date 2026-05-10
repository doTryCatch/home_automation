import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS } from '../constants/theme';

interface Props {
  isOn: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: number;
}

const AnimatedToggle = ({ isOn, onToggle, disabled, size = 44 }: Props) => {
  const progress = useRef(new Animated.Value(isOn ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: isOn ? 1 : 0,
      tension: 180,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [isOn]);

  const h = size * 0.45;
  const thumbSize = h - 4;
  const maxTranslate = size - thumbSize - 4;

  const trackBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border, COLORS.primary],
  });

  const thumbX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxTranslate],
  });

  const thumbBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#4A4A6A', '#FFFFFF'],
  });

  const shadowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <TouchableOpacity onPress={onToggle} disabled={disabled} activeOpacity={0.8}>
      <Animated.View style={[{ width: size, height: h, borderRadius: h / 2, padding: 2, justifyContent: 'center', backgroundColor: trackBg, shadowColor: COLORS.primary, shadowOpacity, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: isOn ? 4 : 0 }]}>
        <Animated.View style={{ width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: thumbBg, transform: [{ translateX: thumbX }] }} />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default AnimatedToggle;
