import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useHomeStore } from '../../store';
import { floorService } from '../../services/floorService';
import { roomService } from '../../services/roomService';
import { COLORS, SPACING } from '../../constants/theme';
import { Floor, Room, Point } from '../../types';
import FloorPlanEditor, { RoomBlock } from './FloorPlanEditor';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

function dbRoomsToBlocks(floor: Floor): RoomBlock[] {
  const rooms = floor.rooms || [];
  if (rooms.length === 0) return [];

  const cols = 2;
  const rw = 340, rh = 220, gapX = 40, gapY = 30;
  const startX = 30, startY = 30;

  return rooms.map((room, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: room.id,
      name: room.name,
      x: startX + col * (rw + gapX),
      y: startY + row * (rh + gapY),
      width: rw,
      height: rh,
      color: room.color || COLORS.roomColors[i % COLORS.roomColors.length],
      devices: [],
    };
  });
}

function loadRooms(floor: Floor): RoomBlock[] {
  const ld = floor.layout_data as any;
  if (ld?.rooms && Array.isArray(ld.rooms) && ld.rooms.length > 0) return ld.rooms;
  return dbRoomsToBlocks(floor);
}

type Props = { route: { params: { floorId: string } }; navigation: any };

const FloorEditorScreen = ({ route, navigation }: Props) => {
  const { floorId } = route.params;
  const { floors, loadHome } = useHomeStore();
  const [floor, setFloor] = useState<Floor | null>(null);
  const [rooms, setRooms] = useState<RoomBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const snapshotRef = useRef<string>('');

  useEffect(() => {
    const f = floors.find(fl => fl.id === floorId);
    if (f) setFloor(f);
  }, [floors, floorId]);

  useEffect(() => {
    if (!floor) return;
    navigation.setOptions({ title: floor.name, headerBackTitle: 'Back' });

    const loaded = loadRooms(floor);
    const snap = JSON.stringify(loaded);

    if (snap !== snapshotRef.current) {
      setRooms(loaded);
      snapshotRef.current = snap;
      setDirty(false);
    }
  }, [floor]);

  const nav = navigation as NativeStackNavigationProp<MainStackParamList>;

  const handleSave = useCallback(async () => {
    if (!floor || !dirty) return;
    setSaving(true);
    try {
      await floorService.update(floor.id, {
        layout_data: {
          ...(floor.layout_data as any || {}),
          rooms,
        },
      } as any);

      const existingRooms = floor.rooms || [];
      const layoutIds = new Set(rooms.map(r => r.id));

      for (const room of existingRooms) {
        if (!layoutIds.has(room.id)) {
          try { await roomService.delete(room.id); } catch {}
        }
      }

      const dbIds = new Set(existingRooms.map(r => r.id));
      for (const rb of rooms) {
        if (!dbIds.has(rb.id)) {
          try {
            await roomService.create({
              floor_id: floor.id,
              name: rb.name,
              polygon_coords: [
                { x: rb.x, y: rb.y },
                { x: rb.x + rb.width, y: rb.y },
                { x: rb.x + rb.width, y: rb.y + rb.height },
                { x: rb.x, y: rb.y + rb.height },
              ],
              color: rb.color,
            });
          } catch {}
        } else {
          const existing = existingRooms.find(r => r.id === rb.id);
          if (existing) {
            try {
              await roomService.update(existing.id, {
                color: rb.color,
                polygon_coords: [
                  { x: rb.x, y: rb.y },
                  { x: rb.x + rb.width, y: rb.y },
                  { x: rb.x + rb.width, y: rb.y + rb.height },
                  { x: rb.x, y: rb.y + rb.height },
                ],
              });
            } catch {}
          }
        }
      }

      snapshotRef.current = JSON.stringify(rooms);
      await loadHome();
      setDirty(false);
      Alert.alert('Saved', 'Floor plan saved');
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }, [floor, rooms, dirty, loadHome]);

  const handleChange = useCallback((newRooms: RoomBlock[]) => {
    setRooms(newRooms);
    setDirty(JSON.stringify(newRooms) !== snapshotRef.current);
  }, []);

  const handleRoomTap = useCallback((room: RoomBlock) => {
    if (floor) {
      nav.navigate('RoomDeviceEditor', { floorId: floor.id, roomId: room.id });
    }
  }, [floor, nav]);

  if (!floor) return null;

  return (
    <View style={styles.container}>
      <FloorPlanEditor
        rooms={rooms}
        onChange={handleChange}
        onRoomTap={handleRoomTap}
        onSave={handleSave}
        saving={saving}
        dirty={dirty}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default FloorEditorScreen;
