import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Circle, G, Text as SvgText, Defs, Pattern, Line, RadialGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';
import { useHomeStore } from '../../store';
import { floorService } from '../../services/floorService';
import { deviceService } from '../../services/deviceService';
import { Floor, Room } from '../../types';
import { DEVICE_TYPES, PlacedDevice, RoomBlock } from './FloorPlanEditor';

const VW = 600, VH = 500;
const PAD = 30;
const INNER_W = VW - PAD * 2;
const INNER_H = VH - PAD * 2;
const DEV_R = 18;

type DragInfo = { devId: string; startRx: number; startRy: number; startX: number; startY: number } | null;

type Props = { route: { params: { floorId: string; roomId: string } }; navigation: any };

export default function RoomDeviceEditorScreen({ route, navigation }: Props) {
  const { floorId, roomId } = route.params;
  const { floors, loadHome, espDevices, deviceTypes } = useHomeStore();
  const [saving, setSaving] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ rx: number; ry: number } | null>(null);
  const [canvasL, setCanvasL] = useState({ w: 0, h: 0 });
  const dragRef = useRef<DragInfo>(null);
  const [devices, setDevices] = useState<PlacedDevice[]>([]);
  const snapRef = useRef('');
  const [dirty, setDirty] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomColor, setRoomColor] = useState('#4ECDC4');
  const [selectedDevType, setSelectedDevType] = useState<string | null>(null);
  const [selectedEspId, setSelectedEspId] = useState('');
  const [selectedPin, setSelectedPin] = useState('');

  const selectedEspObj = espDevices.find((e: any) => e.id === selectedEspId);
  const usedPins = new Set(
    (selectedEspObj?.devices || []).map((d: any) => d.pin)
  );

  const floor = floors.find((f: Floor) => f.id === floorId);

  useEffect(() => {
    if (!floor) return;
    const ld = floor.layout_data as any;
    const layoutRooms: any[] = (ld?.rooms && Array.isArray(ld.rooms)) ? ld.rooms : [];
    const dbRoom = (floor.rooms || []).find((r: any) => r.id === roomId);
    const lr = layoutRooms.find((r: any) => r.id === roomId) ||
               layoutRooms.find((r: any) => r.name === dbRoom?.name);

    const name = lr?.name || dbRoom?.name || 'Room';
    const color = lr?.color || dbRoom?.color || COLORS.roomColors[0];
    setRoomName(name);
    setRoomColor(color);
    navigation.setOptions({ title: name });

    const loadedDevices: PlacedDevice[] = Array.isArray(lr?.devices) ? lr.devices : [];
    const snap = JSON.stringify(loadedDevices);
    if (snap !== snapRef.current) {
      setDevices(loadedDevices);
      snapRef.current = snap;
      setDirty(false);
    }
  }, [floor, roomId]);

  const checkDirty = useCallback((next: PlacedDevice[]) => {
    setDirty(JSON.stringify(next) !== snapRef.current);
  }, []);

  const s2c = useCallback((sx: number, sy: number) => {
    if (!canvasL.w) return { x: 0, y: 0 };
    const vr = VW / VH, cr = canvasL.w / canvasL.h;
    let sc: number, ox = 0, oy = 0;
    if (cr > vr) { sc = canvasL.h / VH; ox = (canvasL.w - VW * sc) / 2; }
    else { sc = canvasL.w / VW; oy = (canvasL.h - VH * sc) / 2; }
    return { x: (sx - ox) / sc, y: (sy - oy) / sc };
  }, [canvasL]);

  const canvasToRelative = useCallback((cx: number, cy: number) => ({
    rx: Math.max(0.05, Math.min(0.95, (cx - PAD) / INNER_W)),
    ry: Math.max(0.05, Math.min(0.95, (cy - PAD) / INNER_H)),
  }), []);

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleStart = useCallback((e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!t) return;
    const pt = s2c(t.locationX, t.locationY);
    const rel = canvasToRelative(pt.x, pt.y);
    if (rel.rx < 0 || rel.rx > 1 || rel.ry < 0 || rel.ry > 1) return;

    dragStartPos.current = { x: pt.x, y: pt.y };

    for (let i = devices.length - 1; i >= 0; i--) {
      const d = devices[i];
      if (Math.abs(rel.rx - d.rx) < 0.07 && Math.abs(rel.ry - d.ry) < 0.09) {
        dragRef.current = { devId: d.id, startRx: d.rx, startRy: d.ry, startX: pt.x, startY: pt.y };
        return;
      }
    }

    setPendingPos(rel);
    setShowDevicePicker(true);
    setSelectedDevType(null);
    setSelectedEspId('');
    setSelectedPin('');
  }, [devices, s2c, canvasToRelative]);

  const handleMove = useCallback((e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches[0];
    if (!t || !dragRef.current) return;
    const pt = s2c(t.locationX, t.locationY);
    const d = dragRef.current;
    const dxPx = pt.x - d.startX;
    const dyPx = pt.y - d.startY;
    const newRx = Math.max(0.05, Math.min(0.95, d.startRx + dxPx / INNER_W));
    const newRy = Math.max(0.05, Math.min(0.95, d.startRy + dyPx / INNER_H));
    setDevices(prev => {
      const next = prev.map(dev => dev.id === d.devId ? { ...dev, rx: newRx, ry: newRy } : dev);
      checkDirty(next);
      return next;
    });
  }, [s2c, checkDirty]);

  const toggleDevice = useCallback((devId: string) => {
    const updated = devices.map(d => d.id === devId ? { ...d, isOn: !d.isOn } : d);
    setDevices(updated);
    checkDirty(updated);
  }, [devices, checkDirty]);

  const handleEnd = useCallback(() => {
    if (dragRef.current) {
      const d = dragRef.current;
      const wasTap = dragStartPos.current &&
        Math.abs(dragRef.current.startX - dragStartPos.current.x) < 3 &&
        Math.abs(dragRef.current.startY - dragStartPos.current.y) < 3;
      if (wasTap) {
        toggleDevice(d.devId);
      }
    }
    dragRef.current = null;
    dragStartPos.current = null;
  }, [toggleDevice]);

  const addDevice = useCallback(async (devType: typeof DEVICE_TYPES[number]) => {
    if (!pendingPos) return;
    const count = devices.filter(d => d.type === devType.type).length + 1;
    const newDev: PlacedDevice = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      type: devType.type,
      name: `${devType.label} ${count}`,
      rx: pendingPos.rx,
      ry: pendingPos.ry,
    };

    if (selectedEspId && selectedPin !== '') {
      newDev.espDeviceId = selectedEspId;
      newDev.espPin = parseInt(selectedPin, 10);

      try {
        const typeName = devType.type.charAt(0).toUpperCase() + devType.type.slice(1);
        const matchingType = deviceTypes.find(t =>
          t.name.toLowerCase() === typeName.toLowerCase() || t.name.toLowerCase() === devType.type
        );

        if (matchingType) {
          const dbDevice = await deviceService.create({
            room_id: roomId,
            esp_device_id: selectedEspId,
            type_id: matchingType.id,
            name: newDev.name,
            pin: newDev.espPin,
          });
          newDev.dbDeviceId = dbDevice.id;
        }
      } catch (e: any) {
        console.warn('Failed to create DB device:', e?.response?.data?.message || e.message);
      }
    }

    const updated = [...devices, newDev];
    setDevices(updated);
    checkDirty(updated);
    setShowDevicePicker(false);
    setPendingPos(null);
    setSelectedDevType(null);
    setSelectedEspId('');
    setSelectedPin('');
  }, [devices, pendingPos, checkDirty, selectedEspId, selectedPin, roomId, deviceTypes]);

  const removeDevice = useCallback((devId: string) => {
    const updated = devices.filter(d => d.id !== devId);
    setDevices(updated);
    checkDirty(updated);
  }, [devices, checkDirty]);

  const handleSave = useCallback(async () => {
    if (!floor || !dirty) return;
    setSaving(true);
    try {
      const ld = (floor.layout_data as any) || {};
      let layoutRooms: any[] = (ld.rooms && Array.isArray(ld.rooms)) ? [...ld.rooms] : [];
      const dbRoom = (floor.rooms || []).find((r: any) => r.id === roomId);

      const idx = layoutRooms.findIndex((r: any) => r.id === roomId || r.name === dbRoom?.name);
      if (idx >= 0) {
        layoutRooms[idx] = { ...layoutRooms[idx], devices };
      } else if (dbRoom) {
        const existingNames = new Set(layoutRooms.map((r: any) => r.name));
        const cols = 2;
        const position = layoutRooms.length;
        layoutRooms.push({
          id: roomId,
          name: roomName,
          x: 30 + (position % cols) * 380,
          y: 30 + Math.floor(position / cols) * 250,
          width: 340, height: 220,
          color: roomColor,
          devices,
        });
      }

      await floorService.update(floor.id, {
        layout_data: { ...ld, rooms: layoutRooms },
      } as any);

      snapRef.current = JSON.stringify(devices);
      setDirty(false);
      await loadHome();
      Alert.alert('Saved', 'Device layout saved');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [floor, roomId, roomName, roomColor, devices, dirty, loadHome]);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.toolbar}>
        <View style={[s.roomDot, { backgroundColor: roomColor }]} />
        <Text style={s.toolbarTitle}>{roomName}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[s.saveBtn, (!dirty || saving) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!dirty || saving}
        >
          <MaterialCommunityIcons
            name="content-save"
            size={16}
            color={!dirty || saving ? COLORS.textLight : '#fff'}
          />
          <Text style={[s.saveBtnText, !dirty && s.saveBtnDisabledText]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.hintBar}>
        <Text style={s.hintText}>Tap inside room to add device. Tap device to toggle on/off. Drag to move.</Text>
      </View>

      <View
        style={s.canvas}
        onLayout={e => setCanvasL({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
          <Defs>
            <Pattern id="gridR" width="20" height="20" patternUnits="userSpaceOnUse">
              <Line x1="20" y1="0" x2="20" y2="20" stroke="#1E1E35" strokeWidth="0.4" />
              <Line x1="0" y1="20" x2="20" y2="20" stroke="#1E1E35" strokeWidth="0.4" />
            </Pattern>
            <RadialGradient id="glowR" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={VW} height={VH} fill="#08080F" />
          <Rect x={PAD} y={PAD} width={INNER_W} height={INNER_H} fill="url(#gridR)" />
          <Rect
            x={PAD} y={PAD} width={INNER_W} height={INNER_H}
            fill="#0D0D18" stroke={roomColor} strokeWidth="3" rx={10}
          />
          <SvgText
            x={VW / 2} y={PAD + 22}
            textAnchor="middle" fontSize="15" fill={roomColor} fontWeight="700"
          >
            {roomName}
          </SvgText>

          {devices.map(dev => {
            const dx = PAD + dev.rx * INNER_W;
            const dy = PAD + dev.ry * INNER_H;
            const dt = DEVICE_TYPES.find(t => t.type === dev.type) || DEVICE_TYPES[0];
            const on = dev.isOn || false;
            return (
              <G key={dev.id}>
                {on && <Circle cx={dx} cy={dy} r={DEV_R * 2} fill="url(#glowR)" />}
                <Circle cx={dx} cy={dy} r={DEV_R}
                  fill={on ? COLORS.primary : '#1C1C30'}
                  stroke={on ? COLORS.primary : COLORS.textSecondary}
                  strokeWidth={2}
                />
                <SvgText x={dx} y={dy + 5} textAnchor="middle" fontSize="15" fontWeight="700"
                  fill={on ? '#fff' : COLORS.textSecondary}>
                  {dt.letter}
                </SvgText>
                <SvgText x={dx} y={dy + DEV_R + 12} textAnchor="middle" fontSize="8"
                  fill={on ? COLORS.primary : '#4A4A6A'} fontWeight="500">
                  {dev.name}
                </SvgText>
                {dev.espPin !== undefined && (
                  <SvgText x={dx} y={dy - DEV_R - 6} textAnchor="middle" fontSize="7"
                    fill={COLORS.textLight} fontWeight="600">
                    D{dev.espPin}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </View>

      {devices.length > 0 && (
        <ScrollView horizontal style={s.strip} showsHorizontalScrollIndicator={false}>
          {devices.map(dev => {
            const dt = DEVICE_TYPES.find(t => t.type === dev.type) || DEVICE_TYPES[0];
            const on = dev.isOn || false;
            return (
              <TouchableOpacity key={dev.id} style={s.chip} onPress={() => toggleDevice(dev.id)} activeOpacity={0.7}>
                <View style={[s.chipDot, { backgroundColor: on ? COLORS.primary : dt.color }]} />
                <Text style={[s.chipText, on && { color: COLORS.primary }]}>{dev.name}</Text>
                <MaterialCommunityIcons name={on ? 'power' : 'power-standby'} size={14} color={on ? COLORS.primary : COLORS.textLight} />
                <TouchableOpacity onPress={() => removeDevice(dev.id)}>
                  <MaterialCommunityIcons name="close-circle" size={14} color={COLORS.textLight} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={showDevicePicker} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Place Device</Text>
            <Text style={s.modalSub}>Choose a device type to place at the tapped position</Text>

            <Text style={s.stepLabel}>1. Device Type</Text>
            <View style={s.deviceGrid}>
              {DEVICE_TYPES.map(dt => (
                <TouchableOpacity
                  key={dt.type}
                  style={[s.pickBtn, selectedDevType === dt.type && s.pickBtnSelected]}
                  onPress={() => setSelectedDevType(dt.type)}
                >
                  <View style={[s.pickIcon, { backgroundColor: dt.color + '30' }]}>
                    <Text style={[s.pickLetter, { color: dt.color }]}>{dt.letter}</Text>
                  </View>
                  <Text style={s.pickLabel}>{dt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedDevType && (
              <>
                <Text style={s.stepLabel}>2. Link to ESP (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
                  <TouchableOpacity
                    style={[s.espChip, selectedEspId === '' && s.espChipSelected]}
                    onPress={() => { setSelectedEspId(''); setSelectedPin(''); }}
                  >
                    <Text style={[s.espChipText, selectedEspId === '' && s.espChipTextSelected]}>Skip</Text>
                  </TouchableOpacity>
                  {espDevices.map((esp: any) => (
                    <TouchableOpacity
                      key={esp.id}
                      style={[s.espChip, selectedEspId === esp.id && s.espChipSelected]}
                      onPress={() => { setSelectedEspId(esp.id); setSelectedPin(''); }}
                    >
                      <Text style={[s.espChipText, selectedEspId === esp.id && s.espChipTextSelected]}>{esp.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {selectedEspId && (
              <>
                <Text style={s.stepLabel}>3. Select Pin</Text>
                <View style={s.pinGrid}>
                  {Array.from({ length: 9 }, (_, i) => {
                    const isUsed = usedPins.has(i);
                    const isSelected = selectedPin === String(i);
                    const occupyingDevice = selectedEspObj?.devices?.find((d: any) => d.pin === i);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          s.pinChip,
                          isSelected && s.pinChipSelected,
                          isUsed && s.pinChipUsed,
                        ]}
                        disabled={isUsed}
                        onPress={() => setSelectedPin(String(i))}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          s.pinChipText,
                          isSelected && s.pinChipTextSelected,
                          isUsed && s.pinChipTextUsed,
                        ]}>
                          D{i}
                        </Text>
                        {isUsed && occupyingDevice ? (
                          <Text style={s.pinChipLabel} numberOfLines={1}>
                            {occupyingDevice.name}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowDevicePicker(false); setPendingPos(null); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              {selectedDevType && (
                <TouchableOpacity
                  style={s.confirmBtn}
                  onPress={() => addDevice(DEVICE_TYPES.find(dt => dt.type === selectedDevType)!)}
                >
                  <Text style={s.confirmBtnText}>Place</Text>
                </TouchableOpacity>
              )}
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
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm,
  },
  roomDot: { width: 12, height: 12, borderRadius: 6 },
  toolbarTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, flex: 1 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.primary, gap: 4,
  },
  saveBtnDisabled: { backgroundColor: COLORS.background },
  saveBtnDisabledText: { color: COLORS.textLight },
  saveBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: '#fff' },
  hintBar: { backgroundColor: COLORS.surface + 'CC', paddingHorizontal: SPACING.md, paddingVertical: 6 },
  hintText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center' },
  canvas: { flex: 1, backgroundColor: '#08080F' },
  strip: {
    maxHeight: 48, backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: BORDER_RADIUS.full,
    marginRight: 6, gap: 4,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 11, color: COLORS.text, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  modalSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  pickBtn: {
    width: 80, alignItems: 'center', paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.background,
  },
  pickIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  pickLetter: { fontSize: 18, fontWeight: '700' },
  pickLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.background,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.md },
  stepLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.xs },
  chipRow: { maxHeight: 44, marginBottom: SPACING.sm },
  espChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background, marginRight: 8,
  },
  espChipSelected: { backgroundColor: COLORS.primary },
  espChipText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },
  espChipTextSelected: { color: '#fff' },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  pinChip: {
    width: 56, paddingVertical: 8, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background, alignItems: 'center',
  },
  pinChipSelected: { backgroundColor: COLORS.primary },
  pinChipUsed: { opacity: 0.4 },
  pinChipText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.text },
  pinChipTextSelected: { color: '#fff' },
  pinChipTextUsed: { color: COLORS.textLight },
  pinChipLabel: { fontSize: 8, color: COLORS.textLight, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  confirmBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  pickBtnSelected: { backgroundColor: COLORS.primary + '20', borderWidth: 2, borderColor: COLORS.primary },
});
