import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated, Dimensions,
} from 'react-native';
import Svg, {
  Rect, Circle, G, Text as SvgText,
  RadialGradient, Stop, Defs,
} from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants/theme';
import { Floor, Room, Point } from '../types';

const VW = 800;
const VH = 600;

const DEVICE_TYPE_MAP: Record<string, { color: string; letter: string; glowId: string }> = {
  light: { color: '#FFD740', letter: 'L', glowId: 'mapGlowLight' },
  fan: { color: '#448AFF', letter: 'F', glowId: 'mapGlowBlue' },
  ac: { color: '#00E5FF', letter: 'A', glowId: 'mapGlowCyan' },
  tv: { color: '#E040FB', letter: 'T', glowId: 'mapGlowPurple' },
  switch: { color: '#69F0AE', letter: 'S', glowId: 'mapGlowGreen' },
  motor: { color: '#FF6E40', letter: 'M', glowId: 'mapGlowOrange' },
};

const GLOW_DEFS = [
  { id: 'mapGlowRed', color: '#FF2E63' },
  { id: 'mapGlowLight', color: '#FFD740' },
  { id: 'mapGlowBlue', color: '#448AFF' },
  { id: 'mapGlowCyan', color: '#00E5FF' },
  { id: 'mapGlowPurple', color: '#E040FB' },
  { id: 'mapGlowGreen', color: '#69F0AE' },
  { id: 'mapGlowOrange', color: '#FF6E40' },
];

const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

interface Props {
  floor: Floor;
  onRoomPress: (room: Room) => void;
  onDeviceToggle?: (deviceId: string, isOn: boolean, isPlaced?: boolean, floorId?: string, layoutData?: any) => void;
}

const FloorMapView: React.FC<Props> = ({ floor, onRoomPress, onDeviceToggle }) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const scaleRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const baseScale = useRef(new Animated.Value(1)).current;
  const panXAnim = useRef(new Animated.Value(0)).current;
  const panYAnim = useRef(new Animated.Value(0)).current;
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const isPinching = useRef(false);
  const isPanning = useRef(false);
  const grantPos = useRef({ x: 0, y: 0 });
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);

  const layoutRooms: any[] = useMemo(() => {
    const ld = floor.layout_data as any;
    if (ld?.rooms && Array.isArray(ld.rooms) && ld.rooms.length > 0) return ld.rooms;
    return [];
  }, [floor]);

  const hasLayoutRooms = layoutRooms.length > 0;

  const devices: any[] = useMemo(() => {
    const result: any[] = [];
    if (hasLayoutRooms) {
      layoutRooms.forEach((lr: any) => {
        const dbRoom = (floor.rooms || []).find((r: any) => r.id === lr.id || r.name === lr.name);
        if (lr.devices && Array.isArray(lr.devices)) {
          lr.devices.forEach((d: any) => {
            const dbDev = dbRoom?.devices?.find((dd: any) => dd.name === d.name);
            const devOn = d.isOn || (dbDev ? ((dbDev as any).state as any)?.power || false : false);
            result.push({
              id: d.id, name: d.name, type: d.type || 'devices',
              x: lr.x + d.rx * lr.width, y: lr.y + d.ry * lr.height,
              isOn: devOn, roomId: dbRoom?.id || lr.id,
              pin: d.espPin,
            });
          });
        }
        if (dbRoom) {
          (dbRoom.devices || []).forEach((d: any) => {
            const placed = (lr.devices || []).some((ld: any) => ld.name === d.name);
            if (placed) return;
            result.push({
              id: d.id, name: d.name, type: d.type?.icon || 'devices',
              x: lr.x + lr.width / 2, y: lr.y + lr.height / 2,
              isOn: (d.state as any)?.power || false, roomId: dbRoom.id,
            });
          });
        }
      });
    }
    return result;
  }, [floor, layoutRooms, hasLayoutRooms]);

  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    if (layout.width === 0) return { x: 0, y: 0 };
    const s = scaleRef.current;
    const mapW = VW * s;
    const mapH = VH * s;
    const ox = (layout.width - mapW) / 2 + panXRef.current;
    const oy = (layout.height - mapH) / 2 + panYRef.current;
    return { x: (sx - ox) / s, y: (sy - oy) / s };
  }, [layout]);

  const handleTapAt = useCallback((sx: number, sy: number) => {
    const pt = screenToCanvas(sx, sy);
    const now = Date.now();
    const isDoubleTap = lastTap.current &&
      now - lastTap.current.time < 400 &&
      Math.abs(sx - lastTap.current.x) < 30 &&
      Math.abs(sy - lastTap.current.y) < 30;

    if (isDoubleTap) {
      lastTap.current = null;
      const rooms = floor.rooms || [];
      for (let i = rooms.length - 1; i >= 0; i--) {
        const lr = layoutRooms.find((r: any) => r.id === rooms[i].id || r.name === rooms[i].name);
        if (lr && pt.x >= lr.x && pt.x <= lr.x + lr.width && pt.y >= lr.y && pt.y <= lr.y + lr.height) {
          onRoomPress(rooms[i]);
          return;
        }
      }
      for (let i = layoutRooms.length - 1; i >= 0; i--) {
        const lr = layoutRooms[i];
        if (pt.x >= lr.x && pt.x <= lr.x + lr.width && pt.y >= lr.y && pt.y <= lr.y + lr.height) {
          onRoomPress({ id: lr.id, name: lr.name, color: lr.color } as any);
          return;
        }
      }
      return;
    }

    lastTap.current = { x: sx, y: sy, time: now };

    for (let i = devices.length - 1; i >= 0; i--) {
      const dev = devices[i];
      if (dist(pt, { x: dev.x, y: dev.y }) < 20) {
        const lr = layoutRooms.find((r: any) =>
          dev.x >= r.x && dev.x <= r.x + r.width && dev.y >= r.y && dev.y <= r.y + r.height
        );
        const isPlaced = lr?.devices?.some((d: any) => d.id === dev.id);
        onDeviceToggle?.(dev.id, dev.isOn, !!isPlaced, floor.id, floor.layout_data);
        return;
      }
    }
  }, [devices, floor, layoutRooms, screenToCanvas, onRoomPress, onDeviceToggle]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      isPanning.current = false;
      grantPos.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      if (e.nativeEvent.numberActiveTouches === 2) {
        isPinching.current = true;
        const t1 = e.nativeEvent.touches[0];
        const t2 = e.nativeEvent.touches[1];
        pinchStartDist.current = Math.sqrt((t1.pageX - t2.pageX) ** 2 + (t1.pageY - t2.pageY) ** 2);
        pinchStartScale.current = scaleRef.current;
      } else {
        isPinching.current = false;
      }
      panXAnim.setOffset(panXRef.current);
      panYAnim.setOffset(panYRef.current);
      panXAnim.setValue(0);
      panYAnim.setValue(0);
    },
    onPanResponderMove: (e, gs) => {
      const movedDist = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);
      if (movedDist > 5) isPanning.current = true;

      if (e.nativeEvent.numberActiveTouches === 2 && isPinching.current) {
        const t1 = e.nativeEvent.touches[0];
        const t2 = e.nativeEvent.touches[1];
        const currentDist = Math.sqrt((t1.pageX - t2.pageX) ** 2 + (t1.pageY - t2.pageY) ** 2);
        if (pinchStartDist.current > 0) {
          const newScale = Math.max(0.5, Math.min(5, pinchStartScale.current * (currentDist / pinchStartDist.current)));
          scaleRef.current = newScale;
          baseScale.setValue(newScale);
        }
      } else if (!isPinching.current) {
        panXAnim.setValue(gs.dx);
        panYAnim.setValue(gs.dy);
      }
    },
    onPanResponderRelease: (e) => {
      panXAnim.flattenOffset();
      panYAnim.flattenOffset();
      panXRef.current = (panXAnim as any).__getValue();
      panYRef.current = (panYAnim as any).__getValue();
      isPinching.current = false;

      if (!isPanning.current) {
        const touch = e.nativeEvent.changedTouches?.[0];
        if (touch) {
          handleTapAt(touch.locationX, touch.locationY);
        }
      }
      isPanning.current = false;
    },
    onPanResponderTerminate: () => {
      panXAnim.flattenOffset();
      panYAnim.flattenOffset();
      panXRef.current = (panXAnim as any).__getValue();
      panYRef.current = (panYAnim as any).__getValue();
      isPinching.current = false;
      isPanning.current = false;
    },
  })).current;

  const zoomIn = () => {
    const next = Math.min(5, scaleRef.current * 1.3);
    scaleRef.current = next;
    Animated.spring(baseScale, { toValue: next, tension: 200, friction: 12, useNativeDriver: false }).start();
  };

  const zoomOut = () => {
    const next = Math.max(0.5, scaleRef.current / 1.3);
    scaleRef.current = next;
    Animated.spring(baseScale, { toValue: next, tension: 200, friction: 12, useNativeDriver: false }).start();
  };

  const roomStats = useMemo(() => {
    const dbRooms = floor.rooms || [];
    const dbOn = dbRooms.reduce((s, r) => s + (r.devices?.filter((d: any) => (d.state as any)?.power).length || 0), 0);
    const placedOn = layoutRooms.reduce((s: number, lr: any) =>
      s + ((Array.isArray(lr.devices) ? lr.devices : []).filter((d: any) => d.isOn).length), 0);
    return { onDevices: dbOn + placedOn };
  }, [floor, layoutRooms]);

  return (
    <View style={s.container} onLayout={e => setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <Animated.View
        style={[s.mapWrapper, { transform: [{ scale: baseScale }, { translateX: panXAnim }, { translateY: panYAnim }] }]}
        {...panResponder.panHandlers}
      >
        <Svg pointerEvents="none" width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}>
          <Defs>
            {GLOW_DEFS.map(g => (
              <RadialGradient key={g.id} id={g.id} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={g.color} stopOpacity="0.7" />
                <Stop offset="60%" stopColor={g.color} stopOpacity="0.2" />
                <Stop offset="100%" stopColor={g.color} stopOpacity="0" />
              </RadialGradient>
            ))}
          </Defs>
          <Rect x={0} y={0} width={VW} height={VH} fill="#08080F" />

          {layoutRooms.map((lr: any) => {
            const dbRoom = (floor.rooms || []).find((r: any) => r.id === lr.id || r.name === lr.name);
            const placedHasOn = (lr.devices || []).some((d: any) => d.isOn);
            const dbHasOn = dbRoom ? (dbRoom.devices || []).some((d: any) => (d.state as any)?.power) : false;
            const hasOn = dbHasOn || placedHasOn;
            const color = lr.color || dbRoom?.color || '#FF2E63';
            const roomDevices: any[] = lr.devices || [];
            return (
              <G key={lr.id}>
                <Rect x={lr.x} y={lr.y} width={lr.width} height={lr.height}
                  fill="#0D0D18" stroke={hasOn ? color : '#1E1E35'}
                  strokeWidth={hasOn ? 2 : 1.5} rx={6} />
                {hasOn && <Rect x={lr.x} y={lr.y} width={lr.width} height={lr.height}
                  fill={color + '08'} stroke="none" rx={6} />}
                <SvgText x={lr.x + lr.width / 2} y={lr.y + 18} textAnchor="middle"
                  fontSize="12" fill={hasOn ? color : '#4A4A6A'} fontWeight="700">
                  {lr.name}
                </SvgText>
                {roomDevices.map((d: any) => {
                  const dx = lr.x + d.rx * lr.width;
                  const dy = lr.y + d.ry * lr.height;
                  const dt = DEVICE_TYPE_MAP[d.type] || { color: '#8892B0', letter: '?', glowId: 'mapGlowRed' };
                  const dbDev = dbRoom?.devices?.find((dd: any) => dd.name === d.name);
                  const devOn = d.isOn || (dbDev ? ((dbDev as any).state as any)?.power || false : false);
                  return (
                    <G key={d.id}>
                      {devOn && <Circle cx={dx} cy={dy} r={28} fill={`url(#${dt.glowId})`} />}
                      {devOn && <Circle cx={dx} cy={dy} r={18} fill={`url(#${dt.glowId})`} />}
                      <Circle cx={dx} cy={dy} r={10}
                        fill={devOn ? dt.color : '#1C1C30'} stroke={devOn ? dt.color : dt.color}
                        strokeWidth={devOn ? 2.5 : 1.5} opacity={devOn ? 1 : 0.9} />
                      <SvgText x={dx} y={dy + 3.5} textAnchor="middle" fontSize="9"
                        fontWeight="700" fill={devOn ? '#FFFFFF' : dt.color}>
                        {dt.letter}
                      </SvgText>
                      <SvgText x={dx} y={dy + 22} textAnchor="middle" fontSize="6"
                        fill={devOn ? dt.color : '#8892B0'} fontWeight={devOn ? '700' : '500'}>
                        {d.name}
                      </SvgText>
                      {d.espPin !== undefined && (
                        <SvgText x={dx} y={dy + 30} textAnchor="middle" fontSize="5"
                          fill="#4A4A6A" fontWeight="500">
                          D{d.espPin}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </G>
            );
          })}

          {devices.map(d => {
            const lr = layoutRooms.find((r: any) =>
              d.x >= r.x && d.x <= r.x + r.width && d.y >= r.y && d.y <= r.y + r.height
            );
            if (lr) return null;
            const dt = DEVICE_TYPE_MAP[d.type] || { color: '#8892B0', letter: '?', glowId: 'mapGlowRed' };
            return (
              <G key={d.id}>
                {d.isOn && <Circle cx={d.x} cy={d.y} r={20} fill={`url(#${dt.glowId})`} />}
                <Circle cx={d.x} cy={d.y} r={8} fill={d.isOn ? dt.color : '#1C1C30'}
                  stroke={d.isOn ? dt.color : dt.color} strokeWidth={d.isOn ? 2 : 1.5} />
                <SvgText x={d.x} y={d.y + 3} textAnchor="middle" fontSize="8"
                  fontWeight="700" fill={d.isOn ? '#fff' : dt.color}>{dt.letter}</SvgText>
              </G>
            );
          })}
        </Svg>
      </Animated.View>

      <View style={s.zoomControls}>
        <TouchableOpacity style={s.zoomBtn} onPress={zoomIn}>
          <MaterialCommunityIcons name="plus" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.zoomBtn} onPress={zoomOut}>
          <MaterialCommunityIcons name="minus" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {roomStats.onDevices > 0 && (
        <View style={s.onBadge}>
          <View style={s.onDot} />
          <Text style={s.onText}>{roomStats.onDevices} on</Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F', overflow: 'hidden' },
  mapWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -VW / 2,
    marginTop: -VH / 2,
    width: VW,
    height: VH,
  },
  zoomControls: {
    position: 'absolute', right: SPACING.md, bottom: SPACING.lg,
    gap: SPACING.xs,
  },
  zoomBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  onBadge: {
    position: 'absolute', top: SPACING.md, left: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary + '25', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  onDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  onText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '700' },
});

export default FloorMapView;
