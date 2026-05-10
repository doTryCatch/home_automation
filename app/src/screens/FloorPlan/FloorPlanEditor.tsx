import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  TextInput, Modal, ScrollView, ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Circle, G, Text as SvgText, Defs, Pattern } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';

const VW = 800, VH = 600;
const HANDLE_R = 10;
const MIN_SIZE = 30;

export interface RoomBlock {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  devices: PlacedDevice[];
}

export interface PlacedDevice {
  id: string;
  type: string;
  name: string;
  rx: number;
  ry: number;
  isOn?: boolean;
  espDeviceId?: string;
  espPin?: number;
}

export type EditorMode = 'draw' | 'select' | 'device';

export const DEVICE_TYPES = [
  { type: 'light', label: 'Light', letter: 'L', color: '#FFEAA7' },
  { type: 'fan', label: 'Fan', letter: 'F', color: '#74B9FF' },
  { type: 'ac', label: 'AC', letter: 'A', color: '#81ECEC' },
  { type: 'tv', label: 'TV', letter: 'T', color: '#A29BFE' },
  { type: 'switch', label: 'Switch', letter: 'S', color: '#55EFC4' },
  { type: 'motor', label: 'Motor', letter: 'M', color: '#FAB1A0' },
];

const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

type DragInfo =
  | { kind: 'draw'; start: { x: number; y: number } }
  | { kind: 'move'; roomId: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'resize'; roomId: string; corner: number; origX: number; origY: number; origW: number; origH: number }
  | null;

interface Props {
  rooms: RoomBlock[];
  onChange: (rooms: RoomBlock[]) => void;
  onRoomTap?: (room: RoomBlock) => void;
  onSave?: () => void;
  saving?: boolean;
  dirty?: boolean;
}

export default function FloorPlanEditor({ rooms, onChange, onRoomTap, onSave, saving, dirty }: Props) {
  const [mode, setMode] = useState<EditorMode>('draw');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasL, setCanvasL] = useState({ w: 0, h: 0 });
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [pendingDeviceRoom, setPendingDeviceRoom] = useState<string | null>(null);
  const [pendingDevicePos, setPendingDevicePos] = useState<{ rx: number; ry: number } | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [renameRoomId, setRenameRoomId] = useState<string | null>(null);

  const drag = useRef<DragInfo>(null);

  const s2c = useCallback((sx: number, sy: number) => {
    if (!canvasL.w) return { x: 0, y: 0 };
    const r = VW / VH, cr = canvasL.w / canvasL.h;
    let sc: number, ox = 0, oy = 0;
    if (cr > r) { sc = canvasL.h / VH; ox = (canvasL.w - VW * sc) / 2; }
    else { sc = canvasL.w / VW; oy = (canvasL.h - VH * sc) / 2; }
    return {
      x: Math.max(0, Math.min(VW, (sx - ox) / sc)),
      y: Math.max(0, Math.min(VH, (sy - oy) / sc)),
    };
  }, [canvasL]);

  const selectedRoom = rooms.find(r => r.id === selectedId) || null;

  const getCorners = (r: RoomBlock) => [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];

  const hitCorner = (pt: { x: number; y: number }, r: RoomBlock) => {
    const corners = getCorners(r);
    for (let i = 0; i < 4; i++) {
      if (Math.abs(pt.x - corners[i].x) < HANDLE_R + 5 && Math.abs(pt.y - corners[i].y) < HANDLE_R + 5) return i;
    }
    return -1;
  };

  const hitRoom = (pt: { x: number; y: number }) => {
    for (let i = rooms.length - 1; i >= 0; i--) {
      const r = rooms[i];
      if (pt.x >= r.x && pt.x <= r.x + r.width && pt.y >= r.y && pt.y <= r.y + r.height) return r;
    }
    return null;
  };

  const handleStart = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!t) return;
    const pt = s2c(t.locationX, t.locationY);

    if (mode === 'draw') {
      drag.current = { kind: 'draw', start: pt };
      setPreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
    } else if (mode === 'select') {
      if (selectedRoom) {
        const ci = hitCorner(pt, selectedRoom);
        if (ci >= 0) {
          drag.current = { kind: 'resize', roomId: selectedRoom.id, corner: ci, origX: selectedRoom.x, origY: selectedRoom.y, origW: selectedRoom.width, origH: selectedRoom.height };
          return;
        }
      }
      const hit = hitRoom(pt);
      if (hit) {
        setSelectedId(hit.id);
        drag.current = { kind: 'move', roomId: hit.id, startX: pt.x, startY: pt.y, origX: hit.x, origY: hit.y };
      } else {
        setSelectedId(null);
      }
    } else if (mode === 'device') {
      const hit = hitRoom(pt);
      if (hit) {
        const rx = (pt.x - hit.x) / hit.width;
        const ry = (pt.y - hit.y) / hit.height;
        setPendingDeviceRoom(hit.id);
        setPendingDevicePos({ rx: Math.max(0.1, Math.min(0.9, rx)), ry: Math.max(0.1, Math.min(0.9, ry)) });
        setShowDevicePicker(true);
      }
    }
  };

  const handleMove = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!t || !drag.current) return;
    const pt = s2c(t.locationX, t.locationY);
    const d = drag.current;

    if (d.kind === 'draw') {
      const x = Math.min(d.start.x, pt.x);
      const y = Math.min(d.start.y, pt.y);
      const w = Math.abs(pt.x - d.start.x);
      const h = Math.abs(pt.y - d.start.y);
      setPreview({ x, y, w, h });
    } else if (d.kind === 'move') {
      const dx = pt.x - d.startX;
      const dy = pt.y - d.startY;
      const nx = Math.max(0, Math.min(VW - 20, d.origX + dx));
      const ny = Math.max(0, Math.min(VH - 20, d.origY + dy));
      onChange(rooms.map(r => r.id === d.roomId ? { ...r, x: nx, y: ny } : r));
    } else if (d.kind === 'resize') {
      const room = rooms.find(r => r.id === d.roomId);
      if (!room) return;
      let nx = d.origX, ny = d.origY, nw = d.origW, nh = d.origH;
      if (d.corner === 0) { nx = pt.x; ny = pt.y; nw = d.origX + d.origW - pt.x; nh = d.origY + d.origH - pt.y; }
      else if (d.corner === 1) { ny = pt.y; nw = pt.x - d.origX; nh = d.origY + d.origH - pt.y; }
      else if (d.corner === 2) { nw = pt.x - d.origX; nh = pt.y - d.origY; }
      else if (d.corner === 3) { nx = pt.x; nw = d.origX + d.origW - pt.x; nh = pt.y - d.origY; }
      if (nw < MIN_SIZE) { nw = MIN_SIZE; if (d.corner === 0 || d.corner === 3) nx = d.origX + d.origW - MIN_SIZE; }
      if (nh < MIN_SIZE) { nh = MIN_SIZE; if (d.corner === 0 || d.corner === 1) ny = d.origY + d.origH - MIN_SIZE; }
      onChange(rooms.map(r => r.id === d.roomId ? { ...r, x: nx, y: ny, width: nw, height: nh } : r));
    }
  };

  const handleEnd = () => {
    if (drag.current?.kind === 'draw' && preview && preview.w > MIN_SIZE && preview.h > MIN_SIZE) {
      const num = rooms.length + 1;
      const newRoom: RoomBlock = {
        id: genId(),
        name: `Room ${num}`,
        x: preview.x,
        y: preview.y,
        width: preview.w,
        height: preview.h,
        color: COLORS.roomColors[(num - 1) % COLORS.roomColors.length],
        devices: [],
      };
      onChange([...rooms, newRoom]);
      setSelectedId(newRoom.id);
      setMode('select');
    }
    setPreview(null);
    drag.current = null;
  };

  const addDevice = (devType: typeof DEVICE_TYPES[number]) => {
    if (!pendingDeviceRoom || !pendingDevicePos) return;
    onChange(rooms.map(r => {
      if (r.id !== pendingDeviceRoom) return r;
      const devCount = r.devices.filter(d => d.type === devType.type).length + 1;
      return {
        ...r,
        devices: [...r.devices, {
          id: genId(),
          type: devType.type,
          name: `${devType.label} ${devCount}`,
          rx: pendingDevicePos.rx,
          ry: pendingDevicePos.ry,
        }],
      };
    }));
    setShowDevicePicker(false);
    setPendingDeviceRoom(null);
    setPendingDevicePos(null);
  };

  const removeDevice = (roomId: string, devId: string) => {
    onChange(rooms.map(r => r.id === roomId ? { ...r, devices: r.devices.filter(d => d.id !== devId) } : r));
  };

  const deleteRoom = (id: string) => {
    const r = rooms.find(r => r.id === id);
    Alert.alert('Delete Room', `Delete "${r?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { onChange(rooms.filter(r => r.id !== id)); setSelectedId(null); } },
    ]);
  };

  const startRename = (roomId: string) => {
    const r = rooms.find(r => r.id === roomId);
    if (!r) return;
    setRenameRoomId(roomId);
    setRenameText(r.name);
    setShowRename(true);
  };

  const confirmRename = () => {
    if (renameRoomId && renameText.trim()) {
      onChange(rooms.map(r => r.id === renameRoomId ? { ...r, name: renameText.trim() } : r));
      setSelectedId(renameRoomId);
    }
    setShowRename(false);
    setRenameRoomId(null);
  };

  const undo = () => { if (rooms.length > 0) onChange(rooms.slice(0, -1)); };
  const clearAll = () => Alert.alert('Clear', 'Remove all rooms?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => { onChange([]); setSelectedId(null); } },
  ]);

  const modes: { key: EditorMode; icon: string; label: string }[] = [
    { key: 'draw', icon: 'rectangle-outline', label: 'Draw' },
    { key: 'select', icon: 'cursor-move', label: 'Select' },
    { key: 'device', icon: 'devices', label: 'Device' },
  ];

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.toolbar}>
        {modes.map(m => (
          <TouchableOpacity key={m.key} style={[s.toolBtn, mode === m.key && s.toolBtnActive]} onPress={() => setMode(m.key)}>
            <MaterialCommunityIcons name={m.icon as any} size={18} color={mode === m.key ? '#fff' : COLORS.text} />
            <Text style={[s.toolBtnText, mode === m.key && s.toolBtnTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
        {mode === 'draw' && <>
          <View style={s.sep} />
          <TouchableOpacity style={s.toolBtn} onPress={undo}><MaterialCommunityIcons name="undo" size={16} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.toolBtn} onPress={clearAll}><MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.danger} /></TouchableOpacity>
        </>}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[s.saveBtn, dirty && s.saveBtnActive]}
          onPress={onSave}
          disabled={!dirty || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons name="content-save" size={16} color={dirty ? '#fff' : COLORS.textLight} />
          )}
          <Text style={[s.saveBtnText, dirty && s.saveBtnTextActive]}>
            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.hint}>
        <Text style={s.hintText}>
          {mode === 'draw' ? 'Drag to draw rooms'
            : mode === 'select' ? 'Tap room to select · Drag to move · Drag corners to resize'
            : 'Tap inside a room to place a device'}
        </Text>
      </View>

      <View style={s.canvas}
        onLayout={e => setCanvasL({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
          <Defs>
            <Pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <Line x1="40" y1="0" x2="40" y2="40" stroke="#D5DBDF" strokeWidth="0.5" />
              <Line x1="0" y1="40" x2="40" y2="40" stroke="#D5DBDF" strokeWidth="0.5" />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={VW} height={VH} fill="#EEF1F5" />
          <Rect x={0} y={0} width={VW} height={VH} fill="url(#grid)" />

          {rooms.map(room => {
            const sel = selectedId === room.id;
            const cx = room.x + room.width / 2;
            const cy = room.y + room.height / 2;
            return (
              <G key={room.id}>
                <Rect
                  x={room.x} y={room.y} width={room.width} height={room.height}
                  fill={room.color + '30'} stroke={sel ? '#2D3436' : room.color}
                  strokeWidth={sel ? 2.5 : 1.5} rx={4}
                />
                <SvgText x={cx} y={cy - 8} textAnchor="middle" fontSize="13" fill="#2D3436" fontWeight="600">{room.name}</SvgText>
                <SvgText x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="#636E72">{room.devices.length} device{room.devices.length !== 1 ? 's' : ''}</SvgText>

                {room.devices.map(dev => {
                  const dx = room.x + dev.rx * room.width;
                  const dy = room.y + dev.ry * room.height;
                  const dt = DEVICE_TYPES.find(t => t.type === dev.type) || DEVICE_TYPES[0];
                  return (
                    <G key={dev.id}>
                      <Circle cx={dx} cy={dy} r={14} fill="#fff" stroke={dt.color} strokeWidth={2} />
                      <SvgText x={dx} y={dy + 1} textAnchor="middle" fontSize="11" fontWeight="700" fill={dt.color}>{dt.letter}</SvgText>
                      <SvgText x={dx} y={dy + 24} textAnchor="middle" fontSize="7" fill="#636E72">{dev.name}</SvgText>
                    </G>
                  );
                })}

                {sel && getCorners(room).map((c, i) => (
                  <Circle key={i} cx={c.x} cy={c.y} r={HANDLE_R} fill="#fff" stroke={COLORS.primary} strokeWidth={2.5} />
                ))}
              </G>
            );
          })}

          {preview && (
            <Rect
              x={preview.x} y={preview.y} width={preview.w} height={preview.h}
              fill={COLORS.primary + '20'} stroke={COLORS.primary} strokeWidth={2}
              strokeDasharray="8,4" rx={4}
            />
          )}
        </Svg>
      </View>

      {mode === 'select' && selectedRoom && (
        <View style={s.bottomPanel}>
          <View style={[s.panelDot, { backgroundColor: selectedRoom.color }]} />
          <TouchableOpacity style={s.panelNameWrap} onPress={() => startRename(selectedRoom.id)}>
            <Text style={s.panelName}>{selectedRoom.name}</Text>
            <MaterialCommunityIcons name="pencil" size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.panelBtn} onPress={() => onRoomTap?.(selectedRoom)}>
            <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.panelBtn} onPress={() => deleteRoom(selectedRoom.id)}>
            <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      )}

      {mode === 'select' && selectedRoom && selectedRoom.devices.length > 0 && (
        <ScrollView horizontal style={s.deviceStrip} showsHorizontalScrollIndicator={false}>
          {selectedRoom.devices.map(dev => {
            const dt = DEVICE_TYPES.find(t => t.type === dev.type) || DEVICE_TYPES[0];
            return (
              <View key={dev.id} style={s.devChip}>
                <View style={[s.devDot, { backgroundColor: dt.color }]} />
                <Text style={s.devChipText}>{dev.name}</Text>
                <TouchableOpacity onPress={() => removeDevice(selectedRoom.id, dev.id)}>
                  <MaterialCommunityIcons name="close-circle" size={14} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={showDevicePicker} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Add Device</Text>
            <View style={s.deviceGrid}>
              {DEVICE_TYPES.map(dt => (
                <TouchableOpacity key={dt.type} style={s.devicePickBtn} onPress={() => addDevice(dt)}>
                  <View style={[s.devicePickIcon, { backgroundColor: dt.color + '30' }]}>
                    <Text style={[s.devicePickLetter, { color: dt.color }]}>{dt.letter}</Text>
                  </View>
                  <Text style={s.devicePickLabel}>{dt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.modalCancelFull} onPress={() => setShowDevicePicker(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRename} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Rename Room</Text>
            <TextInput style={s.renameInput} value={renameText} onChangeText={setRenameText} autoFocus selectTextOnFocus returnKeyType="done" onSubmitEditing={confirmRename} />
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setShowRename(false)} style={s.modalCancel}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmRename} style={s.modalConfirm}>
                <Text style={s.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, gap: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.background, gap: 4,
  },
  toolBtnActive: { backgroundColor: COLORS.primary },
  toolBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.text },
  toolBtnTextActive: { color: '#fff' },
  sep: { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 4 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.background, gap: 4,
  },
  saveBtnActive: { backgroundColor: COLORS.primary },
  saveBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textLight },
  saveBtnTextActive: { color: '#fff' },
  hint: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  hintText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  canvas: { flex: 1, backgroundColor: '#D5DBDF' },
  bottomPanel: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: SPACING.sm,
  },
  panelDot: { width: 12, height: 12, borderRadius: 6 },
  panelNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  panelName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  panelBtn: { padding: SPACING.sm },
  deviceStrip: {
    backgroundColor: COLORS.surface, maxHeight: 44,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  devChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BORDER_RADIUS.full,
    marginRight: 6, gap: 4,
  },
  devDot: { width: 8, height: 8, borderRadius: 4 },
  devChipText: { fontSize: FONT_SIZE.xs, color: COLORS.text, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  devicePickBtn: { alignItems: 'center', width: 70, gap: 4 },
  devicePickIcon: {
    width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center',
  },
  devicePickLetter: { fontSize: 22, fontWeight: '700' },
  devicePickLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '500' },
  modalCancelFull: { paddingVertical: SPACING.md, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md },
  modalCancel: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  modalConfirm: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
  renameInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.lg, color: COLORS.text,
  },
});
