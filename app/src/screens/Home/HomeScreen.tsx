import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, Dimensions, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHomeStore, useAuthStore } from '../../store';
import { floorService } from '../../services/floorService';
import { deviceService } from '../../services/deviceService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, DEVICE_ICONS } from '../../constants/theme';
import { Floor, Room } from '../../types';
import FloorMapView from '../../components/FloorMapView';
import AnimatedDeviceChip from '../../components/AnimatedDeviceChip';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type HomeNav = NativeStackNavigationProp<MainStackParamList>;
const { width: SCREEN_W } = Dimensions.get('window');

const HomeScreen = () => {
  const { floors, espDevices, isLoading, pinnedFloorIds, loadHome, togglePin } = useHomeStore();
  const { user } = useAuthStore();
  const navigation = useNavigation<HomeNav>();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [floorName, setFloorName] = useState('');
  const [creating, setCreating] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadHome().catch(() => {});
  }, []);

  const onlineCount = espDevices.filter(d => d.is_online).length;

  const sortedFloors = useMemo(() => {
    let list = [...floors];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const aPin = pinnedFloorIds.includes(a.id) ? 0 : 1;
      const bPin = pinnedFloorIds.includes(b.id) ? 0 : 1;
      return aPin - bPin;
    });
    return list;
  }, [floors, search, pinnedFloorIds]);

  const activeFloorRooms = useMemo(() => {
    if (!activeFloor) return [];
    return (activeFloor.rooms || []).map(r => ({ ...r, floorName: activeFloor.name }));
  }, [activeFloor]);

  const openRoom = useCallback((room: Room) => {
    const parentFloor = floors.find(f => (f.rooms || []).some(r => r.id === room.id));
    if (parentFloor) {
      navigation.navigate('RoomDeviceEditor', { floorId: parentFloor.id, roomId: room.id });
    } else {
      navigation.navigate('RoomControl', { room });
    }
  }, [navigation, floors]);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set);
  const [activeFloorIdx, setActiveFloorIdx] = useState(0);
  const activeFloor = sortedFloors[activeFloorIdx] || null;

  const handleDeviceToggle = useCallback(async (deviceId: string, isOn: boolean, isPlaced?: boolean, floorId?: string, layoutData?: any) => {
    setTogglingIds(prev => new Set(prev).add(deviceId));
    try {
      if (isPlaced && floorId && layoutData) {
        const ld = layoutData as any;
        const rooms = (ld?.rooms && Array.isArray(ld.rooms)) ? ld.rooms : [];
        let targetDevice: any = null;
        for (const lr of rooms) {
          if (!Array.isArray(lr.devices)) continue;
          targetDevice = lr.devices.find((d: any) => d.id === deviceId);
          if (targetDevice) break;
        }
        if (targetDevice) {
          if (targetDevice.dbDeviceId) {
            await deviceService.control(targetDevice.dbDeviceId, { power: !isOn });
          } else if (targetDevice.espDeviceId && targetDevice.espPin !== undefined) {
            await deviceService.sendEspCommand(targetDevice.espDeviceId, targetDevice.espPin, { power: !isOn });
          } else {
            const allDbDevices = floors.flatMap(f => (f.rooms || []).flatMap(r => r.devices || []));
            let matchingDb = allDbDevices.find(d => d.name === targetDevice.name && d.esp_device?.is_online);
            if (matchingDb) {
              await deviceService.control(matchingDb.id, { power: !isOn });
              await loadHome();
              return;
            }
          }
          const updatedRooms = rooms.map((lr: any) => {
            if (!Array.isArray(lr.devices)) return lr;
            const devIdx = lr.devices.findIndex((d: any) => d.id === deviceId);
            if (devIdx < 0) return lr;
            const updatedDevices = [...lr.devices];
            updatedDevices[devIdx] = { ...updatedDevices[devIdx], isOn: !isOn };
            return { ...lr, devices: updatedDevices };
          });
          await floorService.update(floorId, {
            layout_data: { ...ld, rooms: updatedRooms },
          } as any);
          await loadHome();
        }
      } else {
        await deviceService.control(deviceId, { power: !isOn });
        await loadHome();
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to toggle');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  }, [loadHome, floors]);

  const handleDeleteFloor = useCallback((floor: Floor) => {
    Alert.alert('Delete Floor', `Delete "${floor.name}" and all its rooms and devices?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await floorService.delete(floor.id);
            setActiveFloorIdx(0);
            await loadHome();
          } catch {
            Alert.alert('Error', 'Failed to delete floor');
          }
        },
      },
    ]);
  }, [loadHome]);

  const handleCreateFloor = async () => {
    if (!floorName.trim()) return Alert.alert('Error', 'Enter floor name');
    setCreating(true);
    try {
      const floor = await floorService.create({ name: floorName });
      await loadHome();
      setShowCreate(false);
      setFloorName('');
      navigation.navigate('FloorEditor', { floorId: floor.id });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleScrollEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveFloorIdx(Math.min(idx, sortedFloors.length - 1));
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello, {user?.name || 'User'}</Text>
          <Text style={s.subGreeting}>Your home at a glance</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: onlineCount === espDevices.length && espDevices.length > 0 ? COLORS.online + '20' : onlineCount > 0 ? COLORS.warning + '20' : COLORS.offline + '20' }]}>
          <MaterialCommunityIcons
            name={onlineCount === espDevices.length && espDevices.length > 0 ? 'wifi' : onlineCount > 0 ? 'wifi-alert' : 'wifi-off'}
            size={14}
            color={onlineCount === espDevices.length && espDevices.length > 0 ? COLORS.online : onlineCount > 0 ? COLORS.warning : COLORS.offline}
          />
          <Text style={[s.statusText, { color: onlineCount === espDevices.length && espDevices.length > 0 ? COLORS.online : onlineCount > 0 ? COLORS.warning : COLORS.offline }]}>
            {espDevices.length === 0 ? 'No devices' : `${onlineCount}/${espDevices.length} online`}
          </Text>
        </View>
      </View>

      {sortedFloors.length > 0 ? (
        <>
          <View style={s.floorTabs}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.floorTabsContent}>
              {sortedFloors.map((f, i) => (
                <TouchableOpacity
                  key={f.id}
                  style={[s.floorTab, activeFloorIdx === i && s.floorTabActive]}
                  onPress={() => {
                    setActiveFloorIdx(i);
                    flatRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
                  }}
                >
                  <Text style={[s.floorTabText, activeFloorIdx === i && s.floorTabTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.addTab} onPress={() => setShowCreate(true)}>
              <MaterialCommunityIcons name="plus" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={flatRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
            style={s.mapScroll}
          >
            {sortedFloors.map(floor => (
              <View key={floor.id} style={{ width: SCREEN_W }}>
                <FloorMapView
                  floor={floor}
                  onRoomPress={openRoom}
                  onDeviceToggle={handleDeviceToggle}
                />
              </View>
            ))}
          </ScrollView>

          <View style={s.mapActions}>
            <TouchableOpacity onPress={() => activeFloor && navigation.navigate('FloorEditor', { floorId: activeFloor.id })} style={s.mapActionBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => activeFloor && handleDeleteFloor(activeFloor)} style={s.mapActionBtn}>
              <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="home-outline" size={64} color={COLORS.textLight} />
          <Text style={s.emptyTitle}>No floors yet</Text>
          <Text style={s.emptySub}>Create your first floor to get started</Text>
          <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)}>
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={s.createBtnText}>Create Floor</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeFloorRooms.length > 0 && (
        <View style={s.bottomPanel}>
          <Text style={s.sectionTitle}>Quick Access — {activeFloor?.name}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
            {activeFloorRooms.map(room => {
              const devices = room.devices || [];
              const parentFloor = floors.find(f => (f.rooms || []).some(r => r.id === room.id));
              const ld = parentFloor?.layout_data as any;
              const lr = (ld?.rooms && Array.isArray(ld.rooms)) ? ld.rooms.find((r: any) => r.id === room.id || r.name === room.name) : null;
              const placedDevices: any[] = lr?.devices || [];
              const allDevs = [
                ...devices.map(d => ({
                  id: d.id, name: d.name, icon: d.type?.icon || 'devices',
                  isOn: (d.state as any)?.power || false, isDb: true,
                  pin: d.pin,
                })),
                ...placedDevices.filter(pd => !devices.some(dd => dd.name === pd.name)).map(pd => ({
                  id: pd.id, name: pd.name, icon: pd.type || 'devices',
                  isOn: pd.isOn || false, isDb: false,
                  pin: pd.espPin,
                })),
              ];
              return (
                <View key={room.id} style={s.roomGroup}>
                  <TouchableOpacity style={s.roomLabel} onPress={() => openRoom(room)} activeOpacity={0.7}>
                    <View style={[s.roomDot, { backgroundColor: room.color }]} />
                    <Text style={s.roomNameText} numberOfLines={1}>{room.name}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={COLORS.textLight} />
                  </TouchableOpacity>
                  <View style={s.deviceRow}>
                    {allDevs.map(d => (
                      <AnimatedDeviceChip
                        key={d.id}
                        id={d.id}
                        name={d.name}
                        icon={d.icon}
                        isOn={d.isOn}
                        isDb={d.isDb}
                        busy={togglingIds.has(d.id)}
                        pin={d.pin}
                        onToggle={() => handleDeviceToggle(d.id, d.isOn, !d.isDb, parentFloor?.id, parentFloor?.layout_data)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Create Floor</Text>
            <TextInput style={s.modalInput} placeholder="Floor name (e.g. Ground Floor)" placeholderTextColor={COLORS.textLight} value={floorName} onChangeText={setFloorName} autoFocus />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setShowCreate(false); setFloorName(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleCreateFloor} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.modalConfirmText}>Create & Design</Text>}
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  greeting: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.text },
  subGreeting: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, gap: SPACING.xs,
  },
  statusText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  floorTabs: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  floorTabsContent: { paddingHorizontal: SPACING.sm, gap: 6, paddingVertical: SPACING.xs },
  floorTab: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceLight,
  },
  floorTabActive: { backgroundColor: COLORS.primary },
  floorTabText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  floorTabTextActive: { color: '#FFFFFF' },
  addTab: {
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  mapScroll: { flex: 1 },
  mapActions: {
    position: 'absolute', left: SPACING.md, bottom: 200,
    gap: SPACING.xs,
  },
  mapActionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  bottomPanel: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
    maxHeight: 180,
  },
  sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, paddingHorizontal: SPACING.md, marginBottom: SPACING.xs },
  quickRow: { paddingHorizontal: SPACING.md, gap: SPACING.md },
  roomGroup: { width: SCREEN_W - 32 },
  roomLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  roomDot: { width: 8, height: 8, borderRadius: 4 },
  roomNameText: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600', flex: 1 },
  deviceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.text, marginTop: SPACING.lg },
  emptySub: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
  createBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full, marginTop: SPACING.lg, gap: SPACING.sm,
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.lg },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.lg, color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.lg },
  modalCancel: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    minWidth: 120, alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
});

export default HomeScreen;
