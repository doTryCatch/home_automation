import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import Svg, {
  Rect,
  Path,
  Polygon,
  Circle,
  G,
  Text as SvgText,
  RadialGradient,
  Stop,
  Defs,
} from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';
import { Floor, Room, Point } from '../types';

const VW = 800;
const VH = 600;

const DEVICE_TYPE_MAP: Record<string, { color: string; letter: string; icon: string }> = {
  light: { color: '#F9CA24', letter: 'L', icon: 'lightbulb-outline' },
  fan: { color: '#0984E3', letter: 'F', icon: 'fan' },
  ac: { color: '#00CEC9', letter: 'A', icon: 'air-conditioner' },
  tv: { color: '#6C5CE7', letter: 'T', icon: 'television' },
  switch: { color: '#00B894', letter: 'S', icon: 'toggle-switch' },
  motor: { color: '#E17055', letter: 'M', icon: 'engine' },
};

interface WallPath {
  id: string;
  points: Point[];
  color: string;
  strokeWidth: number;
}

interface DeviceOnPlan {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  isOn: boolean;
  isOnline: boolean;
  roomId: string;
  type: string;
}

interface Props {
  floor: Floor;
  onRoomPress: (room: Room) => void;
  onDeviceToggle?: (deviceId: string, isOn: boolean, isPlaced?: boolean, floorId?: string, layoutData?: any) => void;
}

const pathToSvgD = (pts: Point[]) => {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
};

const pointsStr = (pts: Point[]) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

const pointInPoly = (x: number, y: number, poly: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const polyCenter = (pts: Point[]): Point => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

const FloorPlanViewer: React.FC<Props> = ({ floor, onRoomPress, onDeviceToggle }) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const layoutRooms: any[] = useMemo(() => {
    const ld = floor.layout_data as any;
    if (ld?.rooms && Array.isArray(ld.rooms) && ld.rooms.length > 0) return ld.rooms;
    return [];
  }, [floor]);

  const hasLayoutRooms = layoutRooms.length > 0;

  const walls: WallPath[] = useMemo(() => {
    if (hasLayoutRooms) return [];
    const ld = floor.layout_data as any;
    if (ld?.walls && Array.isArray(ld.walls)) return ld.walls;
    return [];
  }, [floor, hasLayoutRooms]);

  const devices: DeviceOnPlan[] = useMemo(() => {
    const result: DeviceOnPlan[] = [];

    if (hasLayoutRooms) {
      layoutRooms.forEach((lr: any) => {
        const dbRoom = (floor.rooms || []).find((r: any) => r.id === lr.id || r.name === lr.name);
        const placedIds = new Set<string>();

        if (lr.devices && Array.isArray(lr.devices) && lr.devices.length > 0) {
          lr.devices.forEach((d: any) => {
            placedIds.add(d.id);
            const dbDev = dbRoom?.devices?.find((dd: any) => dd.name === d.name);
            const devIsOn = d.isOn || (dbDev ? ((dbDev as any).state as any)?.power || false : false);
            result.push({
              id: d.id,
              name: d.name,
              icon: d.type || 'devices',
              type: d.type || 'devices',
              x: lr.x + d.rx * lr.width,
              y: lr.y + d.ry * lr.height,
              isOn: devIsOn,
              isOnline: dbDev ? (dbDev as any).esp_device?.is_online || false : false,
              roomId: dbRoom?.id || lr.id,
            });
          });
        }

        if (dbRoom) {
          (dbRoom.devices || []).forEach((d: any) => {
            if (placedIds.has(d.id)) return;
            const matchByName = (lr.devices || []).some((ld: any) => ld.name === d.name);
            if (matchByName) return;
            result.push({
              id: d.id,
              name: d.name,
              icon: d.type?.icon || 'devices',
              type: d.type?.icon || 'devices',
              x: lr.x + lr.width / 2,
              y: lr.y + lr.height / 2,
              isOn: (d.state as any)?.power || false,
              isOnline: d.esp_device?.is_online || false,
              roomId: dbRoom.id,
            });
          });
        }
      });
    } else {
      (floor.rooms || []).forEach((room: any) => {
        if (!room.polygon_coords || room.polygon_coords.length < 3) return;
        const center = polyCenter(room.polygon_coords);
        (room.devices || []).forEach((d: any, i: number) => {
          const cx = (d.config as any)?.canvasX;
          const cy = (d.config as any)?.canvasY;
          const col = i % 3;
          const row = Math.floor(i / 3);
            result.push({
              id: d.id,
              name: d.name,
              icon: d.type?.icon || 'devices',
              type: d.type?.icon || 'devices',
              x: cx ?? (center.x - 40 + col * 40),
              y: cy ?? (center.y - 20 + row * 35),
              isOn: (d.state as any)?.power || false,
              isOnline: d.esp_device?.is_online || false,
              roomId: room.id,
            });
        });
      });
    }
    return result;
  }, [floor, layoutRooms, hasLayoutRooms]);

  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    if (layout.width === 0 || layout.height === 0) return { x: 0, y: 0 };
    const viewRatio = VW / VH;
    const containerRatio = layout.width / layout.height;
    let scale: number, offsetX = 0, offsetY = 0;
    if (containerRatio > viewRatio) {
      scale = layout.height / VH;
      offsetX = (layout.width - VW * scale) / 2;
    } else {
      scale = layout.width / VW;
      offsetY = (layout.height - VH * scale) / 2;
    }
    return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
  }, [layout]);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    const touch = e.nativeEvent.changedTouches[0];
    if (!touch) return;
    const pt = screenToCanvas(touch.locationX, touch.locationY);

    for (let i = devices.length - 1; i >= 0; i--) {
      const dev = devices[i];
      const hitR = 15;
      if (dist(pt, { x: dev.x, y: dev.y }) < hitR + 5) {
        const lr = layoutRooms.find((r: any) =>
          dev.x >= r.x && dev.x <= r.x + r.width && dev.y >= r.y && dev.y <= r.y + r.height
        );
        const isPlaced = lr?.devices?.some((d: any) => d.id === dev.id);
        onDeviceToggle?.(dev.id, dev.isOn, !!isPlaced, floor.id, floor.layout_data);
        return;
      }
    }

    const rooms = floor.rooms || [];
    for (let i = rooms.length - 1; i >= 0; i--) {
      const lr = layoutRooms.find((r: any) => r.id === rooms[i].id || r.name === rooms[i].name);
      if (lr) {
        if (pt.x >= lr.x && pt.x <= lr.x + lr.width && pt.y >= lr.y && pt.y <= lr.y + lr.height) {
          onRoomPress(rooms[i]);
          return;
        }
      } else if (rooms[i].polygon_coords && pointInPoly(pt.x, pt.y, rooms[i].polygon_coords)) {
        onRoomPress(rooms[i]);
        return;
      }
    }
  }, [devices, floor, layoutRooms, screenToCanvas, onRoomPress, onDeviceToggle]);

  const roomStats = useMemo(() => {
    const dbRooms = floor.rooms || [];
    const dbTotal = dbRooms.reduce((s, r) => s + (r.devices?.length || 0), 0);
    const dbOn = dbRooms.reduce((s, r) =>
      s + (r.devices?.filter((d: any) => (d.state as any)?.power).length || 0), 0);
    const placedTotal = layoutRooms.reduce((s: number, lr: any) => s + (Array.isArray(lr.devices) ? lr.devices.length : 0), 0);
    const placedOn = layoutRooms.reduce((s: number, lr: any) =>
      s + ((Array.isArray(lr.devices) ? lr.devices : []).filter((d: any) => d.isOn).length), 0);
    const totalRooms = Math.max(dbRooms.length, layoutRooms.length);
    return {
      rooms: totalRooms,
      totalDevices: dbTotal + placedTotal,
      onDevices: dbOn + placedOn,
    };
  }, [floor, layoutRooms]);

  return (
    <View style={s.container}>
      <View
        style={s.canvas}
        onLayout={e => setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        onTouchEnd={handleTouchEnd}
      >
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
          <Defs>
            <RadialGradient id="glowOn" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.5" />
              <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={VW} height={VH} fill="#E8EDF2" rx="8" />

          {hasLayoutRooms ? null : (floor.rooms || []).map(room => {
            if (!room.polygon_coords || room.polygon_coords.length < 3) return null;
            const cx = room.polygon_coords.reduce((s, p) => s + p.x, 0) / room.polygon_coords.length;
            const cy = room.polygon_coords.reduce((s, p) => s + p.y, 0) / room.polygon_coords.length;
            const hasOn = (room.devices || []).some(d => (d.state as any)?.power);
            return (
              <G key={room.id}>
                <Polygon
                  points={pointsStr(room.polygon_coords)}
                  fill={hasOn ? room.color + '25' : '#E8ECF0'}
                  stroke={room.color}
                  strokeWidth="2"
                />
                <SvgText x={cx} y={cy + 4} textAnchor="middle" fontSize="13" fill="#636E72" fontWeight="600">
                  {room.name}
                </SvgText>
              </G>
            );
          })}

          {layoutRooms.map((lr: any) => {
            const dbRoom = (floor.rooms || []).find((r: any) => r.id === lr.id || r.name === lr.name);
            const dbHasOn = dbRoom ? (dbRoom.devices || []).some((d: any) => (d.state as any)?.power) : false;
            const placedHasOn = (lr.devices || []).some((d: any) => d.isOn);
            const hasOn = dbHasOn || placedHasOn;
            const color = lr.color || (dbRoom?.color || '#4ECDC4');
            const roomDevices: any[] = lr.devices || [];
            const scale = Math.min(lr.width / 340, lr.height / 220);
            const devR = Math.max(6, Math.min(12, 10 * scale));
            const letterSize = Math.max(5, Math.min(10, 8 * scale));
            const labelSize = Math.max(4, Math.min(7, 6 * scale));
            return (
              <G key={lr.id}>
                <Rect
                  x={lr.x} y={lr.y} width={lr.width} height={lr.height}
                  fill={hasOn ? color + '18' : '#F5F7FA'}
                  stroke={color} strokeWidth="2.5" rx={6}
                />
                <SvgText
                  x={lr.x + lr.width / 2} y={lr.y + 16}
                  textAnchor="middle" fontSize="11" fill={color} fontWeight="700"
                >
                  {lr.name}
                </SvgText>
                {roomDevices.map((d: any) => {
                  const dx = lr.x + d.rx * lr.width;
                  const dy = lr.y + d.ry * lr.height;
                  const dt = DEVICE_TYPE_MAP[d.type] || { color: '#B2BEC3', letter: '?', icon: 'devices' };
                  const dbDev = dbRoom?.devices?.find((dd: any) => dd.name === d.name);
                  const devOn = d.isOn || (dbDev ? ((dbDev as any).state as any)?.power || false : false);
                  return (
                    <G key={d.id}>
                      {devOn && <Circle cx={dx} cy={dy} r={devR * 2} fill="url(#glowOn)" />}
                      <Circle cx={dx} cy={dy} r={devR}
                        fill={devOn ? COLORS.primary : dt.color + '50'}
                        stroke={devOn ? COLORS.primary : dt.color}
                        strokeWidth={devOn ? 2 : 1.5}
                      />
                      <SvgText x={dx} y={dy + letterSize * 0.35} textAnchor="middle"
                        fontSize={letterSize} fontWeight="700" fill={devOn ? '#fff' : dt.color}>
                        {dt.letter}
                      </SvgText>
                      <SvgText x={dx} y={dy + devR + labelSize + 2} textAnchor="middle"
                        fontSize={labelSize} fill={devOn ? COLORS.primary : '#636E72'} fontWeight="500">
                        {d.name}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            );
          })}

          {walls.map(wall => (
            <Path key={wall.id} d={pathToSvgD(wall.points)} stroke={wall.color} strokeWidth={wall.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {devices.map(d => {
            const lr = layoutRooms.find((r: any) =>
              d.x >= r.x && d.x <= r.x + r.width && d.y >= r.y && d.y <= r.y + r.height
            );
            if (lr) return null;
            const dt = DEVICE_TYPE_MAP[d.type] || { color: '#B2BEC3', letter: '?', icon: 'devices' };
            return (
              <G key={d.id}>
                {d.isOn && <Circle cx={d.x} cy={d.y} r={16} fill="url(#glowOn)" />}
                <Circle cx={d.x} cy={d.y} r={8}
                  fill={d.isOn ? COLORS.primary : dt.color + '50'}
                  stroke={d.isOn ? COLORS.primary : dt.color}
                  strokeWidth={d.isOn ? 2 : 1.5}
                />
                <SvgText x={d.x} y={d.y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={d.isOn ? '#fff' : dt.color}>
                  {dt.letter}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={s.statsBar}>
        <View style={s.stat}>
          <MaterialCommunityIcons name="devices" size={14} color={COLORS.textSecondary} />
          <Text style={s.statText}>{roomStats.totalDevices} device{roomStats.totalDevices !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.stat}>
          <View style={[s.statDot, { backgroundColor: roomStats.onDevices > 0 ? COLORS.primary : COLORS.textLight }]} />
          <Text style={s.statText}>{roomStats.onDevices} on</Text>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  canvas: {
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.surface,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

export default FloorPlanViewer;
