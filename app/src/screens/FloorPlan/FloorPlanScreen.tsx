import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHomeStore } from '../../store';
import { floorService } from '../../services/floorService';
import { roomService } from '../../services/roomService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, DEVICE_ICONS } from '../../constants/theme';
import { Floor, Room, Point } from '../../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const FloorPlanScreen = () => {
  const { floors, loadHome } = useHomeStore();
  const navigation = useNavigation<Nav>();
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [showCreateFloor, setShowCreateFloor] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [floorName, setFloorName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomColor, setRoomColor] = useState(COLORS.roomColors[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (floors.length === 0) {
      loadHome();
    }
  }, []);

  useEffect(() => {
    if (floors.length > 0 && !selectedFloorId) {
      setSelectedFloorId(floors[0].id);
    }
  }, [floors, selectedFloorId]);

  const selectedFloor = floors.find(f => f.id === selectedFloorId) || null;
  const rooms = selectedFloor?.rooms || [];

  const handleCreateFloor = async () => {
    if (!floorName.trim()) return Alert.alert('Error', 'Enter floor name');
    setLoading(true);
    try {
      const floor = await floorService.create({ name: floorName });
      await loadHome();
      setSelectedFloorId(floor.id);
      setShowCreateFloor(false);
      setFloorName('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to create floor');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoom = async () => {
    if (!roomName.trim() || !selectedFloorId) {
      return Alert.alert('Error', 'Enter room name');
    }
    setLoading(true);
    try {
      const coords: Point[] = [
        { x: 100, y: 100 }, { x: 400, y: 100 },
        { x: 400, y: 350 }, { x: 100, y: 350 },
      ];
      await roomService.create({
        floor_id: selectedFloorId,
        name: roomName.trim(),
        polygon_coords: coords,
        color: roomColor,
      });
      await loadHome();
      setShowAddRoom(false);
      setRoomName('');
      setRoomColor(COLORS.roomColors[Math.floor(Math.random() * COLORS.roomColors.length)]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to add room');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = (room: Room) => {
    Alert.alert('Delete Room', `Delete "${room.name}" and all its devices?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await roomService.delete(room.id);
            await loadHome();
          } catch {
            Alert.alert('Error', 'Failed to delete room');
          }
        },
      },
    ]);
  };

  const handleDeleteFloor = (floor: Floor) => {
    Alert.alert('Delete Floor', `Delete "${floor.name}" and all its rooms and devices?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await floorService.delete(floor.id);
            setSelectedFloorId(null);
            await loadHome();
          } catch {
            Alert.alert('Error', 'Failed to delete floor');
          }
        },
      },
    ]);
  };

  const openRoom = (room: Room) => {
    if (!selectedFloorId) return;
    navigation.navigate('RoomDeviceEditor', { floorId: selectedFloorId, roomId: room.id });
  };

  const renderRoomCard = ({ item }: { item: Room | null }) => {
    if (!item) {
      return (
        <TouchableOpacity
          style={s.addRoomCard}
          onPress={() => {
            setRoomName('');
            setRoomColor(COLORS.roomColors[Math.floor(Math.random() * COLORS.roomColors.length)]);
            setShowAddRoom(true);
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="plus" size={32} color={COLORS.primary} />
          <Text style={s.addRoomText}>Add Room</Text>
        </TouchableOpacity>
      );
    }

    const dbDevices = item.devices || [];
    const onCount = dbDevices.filter(d => (d.state as any)?.power).length;

    const ld = selectedFloor?.layout_data as any;
    const lr = (ld?.rooms && Array.isArray(ld.rooms)) ? ld.rooms.find((r: any) => r.id === item.id || r.name === item.name) : null;
    const placedDevices: any[] = lr?.devices || [];
    const allDeviceIcons = [...dbDevices, ...placedDevices.filter(pd => !dbDevices.some(dd => dd.name === pd.name))];
    const totalCount = allDeviceIcons.length;

    return (
      <TouchableOpacity
        style={[s.roomCard, { borderLeftColor: item.color }]}
        onPress={() => openRoom(item)}
        onLongPress={() => handleDeleteRoom(item)}
        activeOpacity={0.7}
      >
        <View style={s.roomCardHeader}>
          <View style={[s.roomDot, { backgroundColor: item.color }]} />
          <Text style={s.roomName} numberOfLines={1}>{item.name}</Text>
        </View>

        {totalCount > 0 ? (
          <View style={s.deviceIcons}>
            {allDeviceIcons.slice(0, 8).map((d: any, idx: number) => {
              const isOn = (d.state as any)?.power || false;
              const icon = d.type?.icon || d.type || 'devices';
              const key = d.id || `dev-${idx}`;
              return (
                <View key={key} style={s.deviceIconWrap}>
                  <MaterialCommunityIcons
                    name={(DEVICE_ICONS[icon] || icon) as any}
                    size={18}
                    color={isOn ? COLORS.primary : COLORS.textLight}
                  />
                  <View style={[s.statusDot, { backgroundColor: isOn ? COLORS.online : COLORS.textLight }]} />
                </View>
              );
            })}
            {totalCount > 8 && (
              <Text style={s.moreText}>+{totalCount - 8}</Text>
            )}
          </View>
        ) : (
          <TouchableOpacity style={s.noDevices} onPress={() => openRoom(item)}>
            <MaterialCommunityIcons name="devices" size={20} color={COLORS.primary} />
            <Text style={[s.noDevicesText, { color: COLORS.primary }]}>Tap to add devices</Text>
          </TouchableOpacity>
        )}

        <View style={s.roomCardFooter}>
          <Text style={s.deviceCount}>
            {totalCount} device{totalCount !== 1 ? 's' : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.editRoomBtn} onPress={() => openRoom(item)}>
              <MaterialCommunityIcons name="pencil-outline" size={14} color={COLORS.primary} />
              <Text style={s.editRoomBtnText}>Edit</Text>
            </TouchableOpacity>
            <View style={s.onIndicator}>
              <View style={[s.onDot, { backgroundColor: onCount > 0 ? COLORS.primary : COLORS.textLight }]} />
              <Text style={s.onText}>{onCount} on</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const createFloorModal = (
    <Modal visible={showCreateFloor} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <Text style={s.modalTitle}>Create Floor</Text>
          <TextInput
            style={s.input}
            placeholder="Floor name (e.g. Ground Floor)"
            placeholderTextColor={COLORS.textLight}
            value={floorName}
            onChangeText={setFloorName}
            autoFocus
          />
          <View style={s.modalActions}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => { setShowCreateFloor(false); setFloorName(''); }}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={handleCreateFloor} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmText}>Create</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (floors.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="floor-plan" size={64} color={COLORS.textLight} />
          <Text style={s.emptyTitle}>No Floors Yet</Text>
          <Text style={s.emptySub}>Create your first floor to start adding rooms</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setShowCreateFloor(true)}>
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={s.primaryBtnText}>Create Floor</Text>
          </TouchableOpacity>
        </View>
        {createFloorModal}
      </SafeAreaView>
    );
  }

  const roomData: (Room | null)[] = [...rooms, null];
  const ld = selectedFloor?.layout_data as any;
  const layoutRooms: any[] = (ld?.rooms && Array.isArray(ld.rooms)) ? ld.rooms : [];
  const dbTotal = rooms.reduce((sum, r) => sum + (r.devices?.length || 0), 0);
  const dbOn = rooms.reduce(
    (sum, r) => sum + (r.devices?.filter(d => (d.state as any)?.power).length || 0), 0,
  );
  const placedTotal = layoutRooms.reduce((s: number, lr: any) => s + (Array.isArray(lr.devices) ? lr.devices.length : 0), 0);
  const placedOn = layoutRooms.reduce((s: number, lr: any) =>
    s + ((Array.isArray(lr.devices) ? lr.devices : []).filter((d: any) => d.isOn).length), 0);
  const totalDevices = dbTotal + placedTotal;
  const totalOn = dbOn + placedOn;

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <View style={s.floorSelector}>
        <FlatList
          horizontal
          data={floors}
          keyExtractor={f => f.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.floorTab, selectedFloorId === item.id && s.floorTabActive]}
              onPress={() => setSelectedFloorId(item.id)}
              onLongPress={() => handleDeleteFloor(item)}
            >
              <Text style={[s.floorTabText, selectedFloorId === item.id && s.floorTabTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity style={s.addFloorTab} onPress={() => setShowCreateFloor(true)}>
              <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          }
        />
      </View>

      {selectedFloor && (
        <View style={s.floorStats}>
          <View style={s.floorStatsLeft}>
            <Text style={s.floorStatsText}>
              {rooms.length} room{rooms.length !== 1 ? 's' : ''}
            </Text>
            <Text style={s.floorStatsSep}>·</Text>
            <Text style={s.floorStatsText}>
              {totalDevices} device{totalDevices !== 1 ? 's' : ''}
            </Text>
            <Text style={s.floorStatsSep}>·</Text>
            <View style={[s.statusDot, { backgroundColor: totalOn > 0 ? COLORS.primary : COLORS.textLight }]} />
            <Text style={s.floorStatsText}>{totalOn} on</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('FloorEditor', { floorId: selectedFloor.id })}
            style={s.drawBtn}
          >
            <MaterialCommunityIcons name="pencil-ruler" size={16} color={COLORS.primary} />
            <Text style={s.drawBtnText}>Draw</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={roomData}
        keyExtractor={(item, index) => item?.id || `add-${index}`}
        numColumns={2}
        contentContainerStyle={s.roomGrid}
        columnWrapperStyle={rooms.length > 0 ? s.roomRow : undefined}
        renderItem={renderRoomCard}
        showsVerticalScrollIndicator={false}
      />

      {createFloorModal}

      <Modal visible={showAddRoom} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Add Room</Text>

            <Text style={s.label}>Room Name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Bedroom, Kitchen"
              placeholderTextColor={COLORS.textLight}
              value={roomName}
              onChangeText={setRoomName}
              autoFocus
            />

            <Text style={s.label}>Color</Text>
            <View style={s.colorGrid}>
              {COLORS.roomColors.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.colorCircle, { backgroundColor: c }, roomColor === c && s.colorCircleSelected]}
                  onPress={() => setRoomColor(c)}
                >
                  {roomColor === c && (
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setShowAddRoom(false); setRoomName(''); }}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleAddRoom} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmText}>Add Room</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  floorSelector: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  floorTab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
  },
  floorTabActive: { backgroundColor: COLORS.primary },
  floorTabText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  floorTabTextActive: { color: '#fff' },
  addFloorTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floorStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  floorStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  floorStatsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  floorStatsSep: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
  },
  drawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + '15',
  },
  drawBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  roomGrid: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  roomRow: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  roomCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderLeftWidth: 4,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  roomDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roomName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  deviceIcons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  deviceIconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  moreText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    alignSelf: 'center',
  },
  noDevices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  noDevicesText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  roomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  onIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  onText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  editRoomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.primary + '15',
  },
  editRoomBtnText: {
    fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600',
  },
  addRoomCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    minHeight: 140,
  },
  addRoomText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySub: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FONT_SIZE.lg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 120,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default FloorPlanScreen;
