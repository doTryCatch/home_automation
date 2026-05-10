import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHomeStore, useAuthStore } from '../../store';
import { floorService } from '../../services/floorService';
import { deviceService } from '../../services/deviceService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, DEVICE_ICONS } from '../../constants/theme';
import { Floor, Room } from '../../types';
import FloorPlanViewer from '../../components/FloorPlanViewer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type HomeNav = NativeStackNavigationProp<MainStackParamList>;
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;

const HomeScreen = () => {
  const { floors, espDevices, isLoading, pinnedFloorIds, loadHome, togglePin } = useHomeStore();
  const { user } = useAuthStore();
  const navigation = useNavigation<HomeNav>();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [floorName, setFloorName] = useState('');
  const [creating, setCreating] = useState(false);

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

  const allRooms = useMemo(() =>
    floors.flatMap(f => (f.rooms || []).map(r => ({ ...r, floorName: f.name })))
  , [floors]);

  const openRoom = useCallback((room: Room) => {
    const parentFloor = floors.find(f => (f.rooms || []).some(r => r.id === room.id));
    if (parentFloor) {
      navigation.navigate('RoomDeviceEditor', { floorId: parentFloor.id, roomId: room.id });
    } else {
      navigation.navigate('RoomControl', { room });
    }
  }, [navigation, floors]);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set);

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
          if (targetDevice.espDeviceId && targetDevice.espPin !== undefined) {
            await deviceService.sendEspCommand(targetDevice.espDeviceId, targetDevice.espPin, { power: !isOn });
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
          } else {
            const allDbDevices = floors.flatMap(f => (f.rooms || []).flatMap(r => r.devices || []));
            let matchingDb = allDbDevices.find(d => d.name === targetDevice.name && d.esp_device?.is_online);
            if (matchingDb) {
              await deviceService.control(matchingDb.id, { power: !isOn });
              await loadHome();
            } else {
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
          }
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

  const renderFloorCard = (floor: Floor) => {
    const isPinned = pinnedFloorIds.includes(floor.id);
    const ld = floor.layout_data as any;
    const layoutRooms: any[] = (ld?.rooms && Array.isArray(ld.rooms)) ? ld.rooms : [];
    const dbDevCount = (floor.rooms || []).reduce((s, r) => s + (r.devices?.length || 0), 0);
    const dbOnCount = (floor.rooms || []).reduce((s, r) =>
      s + (r.devices?.filter(d => (d.state as any)?.power).length || 0), 0);
    const placedDevCount = layoutRooms.reduce((s: number, lr: any) => s + (Array.isArray(lr.devices) ? lr.devices.length : 0), 0);
    const placedOnCount = layoutRooms.reduce((s: number, lr: any) =>
      s + ((Array.isArray(lr.devices) ? lr.devices : []).filter((d: any) => d.isOn).length), 0);
    const devCount = dbDevCount + placedDevCount;
    const onCount = dbOnCount + placedOnCount;

    return (
      <View key={floor.id} style={s.card}>
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{floor.name}</Text>
            <Text style={s.cardSub}>{devCount} device{devCount !== 1 ? 's' : ''} · {onCount} on</Text>
          </View>
          <TouchableOpacity onPress={() => togglePin(floor.id)} style={s.pinBtn}>
            <MaterialCommunityIcons name={isPinned ? 'pin' : 'pin-outline'} size={20} color={isPinned ? COLORS.primary : COLORS.textLight} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('FloorEditor', { floorId: floor.id })}
        >
          <FloorPlanViewer floor={floor} onRoomPress={openRoom} onDeviceToggle={handleDeviceToggle} />
        </TouchableOpacity>

        <View style={s.cardFooter}>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <TouchableOpacity onPress={() => handleDeleteFloor(floor)} style={s.deleteBtn}>
              <MaterialCommunityIcons name="delete-outline" size={16} color={COLORS.danger} />
              <Text style={s.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('FloorEditor', { floorId: floor.id })} style={s.editBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.primary} />
              <Text style={s.editBtnText}>Edit Layout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello, {user?.name || 'User'}</Text>
          <Text style={s.subGreeting}>Your home at a glance</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: onlineCount === espDevices.length && espDevices.length > 0 ? COLORS.online + '15' : onlineCount > 0 ? COLORS.warning + '15' : COLORS.offline + '15' }]}>
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

      <View style={s.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textLight} />
        <TextInput style={s.searchInput} placeholder="Search floors..." value={search} onChangeText={setSearch} placeholderTextColor={COLORS.textLight} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadHome} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {sortedFloors.length > 0 ? (
          <View style={s.cardsSection}>
            {sortedFloors.map(renderFloorCard)}
            <TouchableOpacity style={s.addCard} onPress={() => setShowCreate(true)}>
              <MaterialCommunityIcons name="plus" size={32} color={COLORS.primary} />
              <Text style={s.addCardText}>New Floor</Text>
            </TouchableOpacity>
          </View>
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

        {allRooms.length > 0 && (
          <View style={s.roomsSection}>
            <Text style={s.sectionTitle}>Quick Access</Text>
            {allRooms.map(room => {
              const devices = room.devices || [];
              const parentFloor = floors.find(f => (f.rooms || []).some(r => r.id === room.id));
              const ld = parentFloor?.layout_data as any;
              const lr = (ld?.rooms && Array.isArray(ld.rooms)) ? ld.rooms.find((r: any) => r.id === room.id || r.name === room.name) : null;
              const placedDevices: any[] = lr?.devices || [];
              const allDevs = [
                ...devices.map(d => ({
                  id: d.id,
                  name: d.name,
                  icon: d.type?.icon || 'devices',
                  isOn: (d.state as any)?.power || false,
                  isDb: true,
                })),
                ...placedDevices.filter(pd => !devices.some(dd => dd.name === pd.name)).map(pd => ({
                  id: pd.id,
                  name: pd.name,
                  icon: pd.type || 'devices',
                  isOn: pd.isOn || false,
                  isDb: false,
                })),
              ];
              return (
                <View key={room.id} style={[s.roomCard, { borderLeftColor: room.color }]}>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => openRoom(room)} activeOpacity={0.7}>
                    <View style={[s.roomDot, { backgroundColor: room.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.roomName}>{room.name}</Text>
                      <Text style={s.roomMeta}>{room.floorName}</Text>
                    </View>
                  </TouchableOpacity>
                  {allDevs.length > 0 && (
                    <View style={s.quickDevices}>
                      {allDevs.map(d => {
                        const busy = togglingIds.has(d.id);
                        return (
                          <TouchableOpacity
                            key={d.id}
                            style={[s.quickDevice, d.isOn && s.quickDeviceOn]}
                            onPress={() => handleDeviceToggle(d.id, d.isOn, !d.isDb, parentFloor?.id, parentFloor?.layout_data)}
                            disabled={busy}
                            activeOpacity={0.6}
                          >
                            <MaterialCommunityIcons
                              name={(DEVICE_ICONS[d.icon] || d.icon) as any}
                              size={15}
                              color={d.isOn ? '#fff' : COLORS.textLight}
                            />
                            <Text style={[s.quickDevName, d.isOn && s.quickDevNameOn]} numberOfLines={1}>
                              {d.name}
                            </Text>
                            <View style={[s.toggleTrack, d.isOn && s.toggleTrackOn]}>
                              <View style={[s.toggleThumb, d.isOn && s.toggleThumbOn]} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {sortedFloors.length > 0 && (
        <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </TouchableOpacity>
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
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  greeting: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.text },
  subGreeting: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, gap: SPACING.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  searchInput: { flex: 1, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.md, color: COLORS.text },
  scrollContent: { paddingBottom: 100 },
  cardsSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.md },
  card: {
    width: CARD_W, backgroundColor: COLORS.surface, borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 1 },
  pinBtn: { padding: SPACING.sm },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm,
  },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.primary + '15' },
  editBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.danger + '15' },
  deleteBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.danger, fontWeight: '600' },
  addCard: {
    width: CARD_W, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primary + '40', borderStyle: 'dashed',
    borderRadius: 20, paddingVertical: SPACING.xl,
  },
  addCardText: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.sm },
  emptyState: { alignItems: 'center', paddingTop: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '600', color: COLORS.text, marginTop: SPACING.lg },
  emptySub: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
  createBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full, marginTop: SPACING.lg, gap: SPACING.sm,
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.lg },
  roomsSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  roomCard: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  roomDot: { width: 10, height: 10, borderRadius: 5, marginRight: SPACING.md },
  roomName: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  roomMeta: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  quickDevices: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingTop: SPACING.sm, marginTop: SPACING.xs,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  quickDevice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.background, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: BORDER_RADIUS.lg, flexShrink: 0,
  },
  quickDeviceOn: {
    backgroundColor: COLORS.primary,
  },
  quickDevName: {
    fontSize: 12, color: COLORS.text, fontWeight: '500', maxWidth: 70,
  },
  quickDevNameOn: {
    color: '#fff',
  },
  toggleTrack: {
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: COLORS.border, justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: {
    backgroundColor: '#fff',
  },
  toggleThumb: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff',
  },
  toggleThumbOn: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
  },
  fab: {
    position: 'absolute', bottom: SPACING.xl, right: SPACING.xl,
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.lg, color: COLORS.text,
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
