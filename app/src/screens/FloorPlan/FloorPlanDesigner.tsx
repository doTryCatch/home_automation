import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, GestureResponderEvent } from 'react-native';
import Svg, { Rect, Line, Path, Polygon, Circle, G, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';
import { Room, Point } from '../../types';

interface WallPath { id: string; points: Point[]; color: string; strokeWidth: number }
type Mode = 'draw' | 'room' | 'select';
type DrawTool = 'pen' | 'line';
type Drag = { type: 'body'; roomId: string; start: Point; orig: Point[] } | { type: 'corner'; roomId: string; idx: number } | null;

interface Props {
  walls: WallPath[];
  rooms: Room[];
  onWallsChange: (w: WallPath[]) => void;
  onCreateRoom: (data: { name: string; polygon_coords: Point[]; color: string }) => Promise<Room>;
  onUpdateRoom: (id: string, data: { name?: string; color?: string; polygon_coords?: Point[] }) => Promise<void>;
  onDeleteRoom: (id: string) => Promise<void>;
  onOpenRoom: (room: Room) => void;
}

const VW = 800, VH = 600, HANDLE_R = 10, HIT = 18;
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const toD = (pts: Point[]) => pts.length === 0 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const pStr = (pts: Point[]) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const pInPoly = (x: number, y: number, poly: Point[]) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; };
const dist2 = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const clamp = (p: Point) => ({ x: Math.max(5, Math.min(VW - 5, p.x)), y: Math.max(5, Math.min(VH - 5, p.y)) });

const FloorPlanDesigner: React.FC<Props> = ({ walls, rooms, onWallsChange, onCreateRoom, onUpdateRoom, onDeleteRoom, onOpenRoom }) => {
  const [mode, setMode] = useState<Mode>('draw');
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [penPath, setPenPath] = useState<Point[]>([]);
  const [lineStart, setLineStart] = useState<Point | null>(null);
  const [lineEnd, setLineEnd] = useState<Point | null>(null);
  const [rectStart, setRectStart] = useState<Point | null>(null);
  const [rectEnd, setRectEnd] = useState<Point | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasL, setCanvasL] = useState({ w: 0, h: 0 });
  const lastPt = useRef<Point>({ x: 0, y: 0 });
  const drag = useRef<Drag>(null);

  const s2c = useCallback((sx: number, sy: number): Point => {
    if (!canvasL.w) return { x: 0, y: 0 };
    const r = VW / VH, cr = canvasL.w / canvasL.h;
    let sc: number, ox = 0, oy = 0;
    if (cr > r) { sc = canvasL.h / VH; ox = (canvasL.w - VW * sc) / 2; }
    else { sc = canvasL.w / VW; oy = (canvasL.h - VH * sc) / 2; }
    return { x: Math.max(0, Math.min(VW, (sx - ox) / sc)), y: Math.max(0, Math.min(VH, (sy - oy) / sc)) };
  }, [canvasL]);

  const cornerIdx = (pt: Point, room: Room) => {
    if (!room.polygon_coords) return -1;
    for (let i = 0; i < room.polygon_coords.length; i++) if (dist2(pt, room.polygon_coords[i]) < HIT) return i;
    return -1;
  };

  const roomAt = (pt: Point) => {
    for (let i = rooms.length - 1; i >= 0; i--) {
      if (rooms[i].polygon_coords?.length >= 3 && pInPoly(pt.x, pt.y, rooms[i].polygon_coords)) return rooms[i];
    }
    return null;
  };

  const onTouchStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!t) return;
    const pt = s2c(t.locationX, t.locationY);
    lastPt.current = pt;

    if (mode === 'draw') {
      if (drawTool === 'pen') setPenPath([pt]);
      else { setLineStart(pt); setLineEnd(pt); }
    } else if (mode === 'room') {
      setRectStart(pt); setRectEnd(pt);
    } else {
      const sel = selectedId ? rooms.find(r => r.id === selectedId) : null;
      if (sel) {
        const ci = cornerIdx(pt, sel);
        if (ci >= 0) {
          drag.current = { type: 'corner', roomId: sel.id, idx: ci };
          return;
        }
        if (pInPoly(pt.x, pt.y, sel.polygon_coords)) {
          drag.current = { type: 'body', roomId: sel.id, start: pt, orig: sel.polygon_coords.map(p => ({ ...p })) };
          return;
        }
      }
      const hit = roomAt(pt);
      if (hit) {
        setSelectedId(hit.id);
        const ci = cornerIdx(pt, hit);
        if (ci >= 0) drag.current = { type: 'corner', roomId: hit.id, idx: ci };
        else drag.current = { type: 'body', roomId: hit.id, start: pt, orig: hit.polygon_coords.map(p => ({ ...p })) };
      } else {
        setSelectedId(null);
      }
    }
  };

  const onTouchMove = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!t) return;
    const pt = s2c(t.locationX, t.locationY);
    lastPt.current = pt;

    if (mode === 'draw') {
      if (drawTool === 'pen') setPenPath(prev => [...prev, pt]);
      else if (lineStart) setLineEnd(pt);
    } else if (mode === 'room') {
      if (rectStart) setRectEnd(pt);
    } else if (drag.current) {
      const d = drag.current;
      if (d.type === 'corner') {
        const room = rooms.find(r => r.id === d.roomId);
        if (room) {
          const pts = room.polygon_coords.map((p, i) => i === d.idx ? clamp(pt) : { ...p });
          onUpdateRoom(d.roomId, { polygon_coords: pts });
        }
      } else {
        const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
        const pts = d.orig.map(p => clamp({ x: p.x + dx, y: p.y + dy }));
        onUpdateRoom(d.roomId, { polygon_coords: pts });
      }
    }
  };

  const onTouchEnd = () => {
    const pt = lastPt.current;
    if (mode === 'draw') {
      if (drawTool === 'pen' && penPath.length > 1) {
        onWallsChange([...walls, { id: genId(), points: [...penPath], color: '#556270', strokeWidth: 3 }]);
        setPenPath([]);
      } else if (drawTool === 'line' && lineStart) {
        onWallsChange([...walls, { id: genId(), points: [lineStart, pt], color: '#556270', strokeWidth: 3 }]);
        setLineStart(null); setLineEnd(null);
      }
    } else if (mode === 'room') {
      if (rectStart && Math.abs(pt.x - rectStart.x) > 20 && Math.abs(pt.y - rectStart.y) > 20) {
        const poly = [
          { x: rectStart.x, y: rectStart.y }, { x: pt.x, y: rectStart.y },
          { x: pt.x, y: pt.y }, { x: rectStart.x, y: pt.y },
        ];
        const num = rooms.length + 1;
        const color = COLORS.roomColors[(num - 1) % COLORS.roomColors.length];
        onCreateRoom({ name: `Room ${num}`, polygon_coords: poly, color });
      }
      setRectStart(null); setRectEnd(null);
    } else {
      drag.current = null;
    }
  };

  const undo = () => walls.length > 0 && onWallsChange(walls.slice(0, -1));
  const clearAll = () => Alert.alert('Clear', 'Remove all walls?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => onWallsChange([]) },
  ]);

  const delRoom = () => {
    if (!selectedId) return;
    const r = rooms.find(r => r.id === selectedId);
    Alert.alert('Delete', `Delete "${r?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await onDeleteRoom(selectedId); setSelectedId(null); } },
    ]);
  };

  const tools: { key: Mode; icon: string; label: string }[] = [
    { key: 'draw', icon: 'pencil', label: 'Draw' },
    { key: 'room', icon: 'rectangle-outline', label: 'Room' },
    { key: 'select', icon: 'cursor-move', label: 'Select' },
  ];

  return (
    <View style={s.container}>
      <View style={s.toolbar}>
        {tools.map(t => (
          <TouchableOpacity key={t.key} style={[s.toolBtn, mode === t.key && s.toolBtnActive]} onPress={() => setMode(t.key)}>
            <MaterialCommunityIcons name={t.icon as any} size={18} color={mode === t.key ? '#fff' : COLORS.text} />
            <Text style={[s.toolBtnText, mode === t.key && s.toolBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        {mode === 'draw' && <>
          <View style={s.sep} />
          <TouchableOpacity style={[s.toolBtn, drawTool === 'pen' && s.toolBtnActive]} onPress={() => setDrawTool('pen')}>
            <Text style={[s.toolBtnText, drawTool === 'pen' && s.toolBtnTextActive]}>Pen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.toolBtn, drawTool === 'line' && s.toolBtnActive]} onPress={() => setDrawTool('line')}>
            <Text style={[s.toolBtnText, drawTool === 'line' && s.toolBtnTextActive]}>Line</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.toolBtn} onPress={undo}><Text style={s.toolBtnText}>Undo</Text></TouchableOpacity>
          <TouchableOpacity style={s.toolBtn} onPress={clearAll}><Text style={[s.toolBtnText, { color: COLORS.danger }]}>Clear</Text></TouchableOpacity>
        </>}
      </View>

      <View style={s.hint}>
        <Text style={s.hintText}>
          {mode === 'draw' ? 'Sketch walls and layout lines'
            : mode === 'room' ? 'Drag rectangles to create rooms — auto-named'
            : 'Tap room to select · Drag to move · Drag corners to resize'}
        </Text>
      </View>

      <View style={s.canvas} onLayout={e => setCanvasL({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
          <Rect x={0} y={0} width={VW} height={VH} fill="#EEF1F5" />
          {Array.from({ length: Math.ceil(VW / 40) }).map((_, i) => <Line key={`v${i}`} x1={i*40} y1={0} x2={i*40} y2={VH} stroke="#D5DBDF" strokeWidth={0.5} />)}
          {Array.from({ length: Math.ceil(VH / 40) }).map((_, i) => <Line key={`h${i}`} x1={0} y1={i*40} x2={VW} y2={i*40} stroke="#D5DBDF" strokeWidth={0.5} />)}

          {rooms.map(room => {
            if (!room.polygon_coords || room.polygon_coords.length < 3) return null;
            const sel = selectedId === room.id;
            const cx = room.polygon_coords.reduce((s, p) => s + p.x, 0) / room.polygon_coords.length;
            const cy = room.polygon_coords.reduce((s, p) => s + p.y, 0) / room.polygon_coords.length;
            return (
              <G key={room.id}>
                <Polygon points={pStr(room.polygon_coords)} fill={room.color + '35'} stroke={sel ? '#2D3436' : room.color} strokeWidth={sel ? 3 : 2} />
                <SvgText x={cx} y={cy} textAnchor="middle" fontSize="13" fill="#2D3436" fontWeight="600">{room.name}</SvgText>
                {sel && room.polygon_coords.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={HANDLE_R} fill="#fff" stroke={COLORS.primary} strokeWidth={2.5} />
                ))}
              </G>
            );
          })}

          {walls.map(w => <Path key={w.id} d={toD(w.points)} stroke={w.color} strokeWidth={w.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {penPath.length > 1 && <Path d={toD(penPath)} stroke={COLORS.primary} strokeWidth={3} fill="none" strokeLinecap="round" />}
          {lineStart && lineEnd && <Line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke={COLORS.primary} strokeWidth={3} strokeDasharray="6,4" />}
          {rectStart && rectEnd && (
            <Polygon points={pStr([
              { x: rectStart.x, y: rectStart.y }, { x: rectEnd.x, y: rectStart.y },
              { x: rectEnd.x, y: rectEnd.y }, { x: rectStart.x, y: rectEnd.y },
            ])} fill={COLORS.primary + '20'} stroke={COLORS.primary} strokeWidth={2} strokeDasharray="6,4" />
          )}
        </Svg>
      </View>

      {mode === 'select' && selectedId && (() => {
        const room = rooms.find(r => r.id === selectedId);
        if (!room) return null;
        return (
          <View style={s.bottomPanel}>
            <View style={[s.panelDot, { backgroundColor: room.color }]} />
            <Text style={s.panelName}>{room.name}</Text>
            <TouchableOpacity style={s.panelBtn} onPress={delRoom}>
              <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
            <TouchableOpacity style={s.openRoomBtn} onPress={() => onOpenRoom(room)}>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
              <Text style={s.openRoomBtnText}>Devices</Text>
            </TouchableOpacity>
          </View>
        );
      })()}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, gap: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.background, gap: 4,
  },
  toolBtnActive: { backgroundColor: COLORS.primary },
  toolBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.text },
  toolBtnTextActive: { color: '#fff' },
  sep: { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 4 },
  hint: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  hintText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  canvas: { flex: 1, backgroundColor: '#D5DBDF' },
  bottomPanel: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: SPACING.sm,
  },
  panelDot: { width: 10, height: 10, borderRadius: 5 },
  panelName: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  panelBtn: { padding: SPACING.sm },
  openRoomBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, gap: 4,
  },
  openRoomBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.xs },
});

export default FloorPlanDesigner;
