import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput,
  Alert, ActivityIndicator, Switch, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDeviceStore, useHomeStore } from '../../store';
import { deviceService } from '../../services/deviceService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, DEVICE_ICONS } from '../../constants/theme';
import { Device, Room } from '../../types';

interface Props {
  route: { params: { room: Room } };
  navigation: any;
}

const RoomControlScreen = ({ route, navigation }: Props) => {
  const { room } = route.params;
  const { devices, loadDevices, updateDeviceState } = useDeviceStore();
  const { deviceTypes, espDevices, loadHome } = useHomeStore();

  const selectedEspObj = espDevices.find(e => e.id === selectedEsp);
  const usedPins = new Set((selectedEspObj?.devices || []).map(d => d.pin));

  const [showAdd, setShowAdd] = useState(false);
  const [showClaimEsp, setShowClaimEsp] = useState(false);
  const [unclaimedEsps, setUnclaimedEsps] = useState<any[]>([]);
  const [claimName, setClaimName] = useState('');
  const [selectedUnclaimedId, setSelectedUnclaimedId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [selectedEsp, setSelectedEsp] = useState('');
  const [selectedPin, setSelectedPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: room.name, headerBackTitle: 'Back' });
    loadDevices(room.id);
  }, [room.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDevices(room.id), loadHome()]);
    setRefreshing(false);
  }, [room.id]);

  const handleToggle = useCallback(async (device: Device) => {
    const isOn = (device.state as any)?.power || false;
    setTogglingId(device.id);
    try {
      const updated = await deviceService.control(device.id, {
        ...(device.state as Record<string, unknown>),
        power: !isOn,
      });
      updateDeviceState(device.id, updated.state);
      await loadHome();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to toggle device');
    } finally {
      setTogglingId(null);
    }
  }, [updateDeviceState, loadHome]);

  const handleDeleteDevice = useCallback((device: Device) => {
    Alert.alert('Delete Device', `Delete "${device.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deviceService.delete(device.id);
            await Promise.all([loadDevices(room.id), loadHome()]);
          } catch {
            Alert.alert('Error', 'Failed to delete device');
          }
        },
      },
    ]);
  }, [room.id]);

  const handleAddDevice = async () => {
    const missing: string[] = [];
    if (!selectedTypeId) missing.push('device type');
    if (!deviceName.trim()) missing.push('name');
    if (!selectedEsp) missing.push('ESP device');
    if (selectedPin === '') missing.push('pin');
    if (missing.length > 0) {
      return Alert.alert('Missing Fields', 'Please fill in: ' + missing.join(', '));
    }
    setSaving(true);
    try {
      await deviceService.create({
        room_id: room.id,
        type_id: selectedTypeId!,
        name: deviceName.trim(),
        esp_device_id: selectedEsp,
        pin: parseInt(selectedPin, 10) || 0,
        config: {},
      });
      await Promise.all([loadDevices(room.id), loadHome()]);
      setShowAdd(false);
      resetAddForm();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to add device');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenClaimEsp = async () => {
    try {
      const devices = await deviceService.getUnclaimedEspDevices();
      setUnclaimedEsps(devices);
      setShowClaimEsp(true);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to scan for devices');
    }
  };

  const handleClaimEsp = async () => {
    if (!selectedUnclaimedId) return Alert.alert('Error', 'Select a device');
    setSaving(true);
    try {
      const esp = await deviceService.claimEspDevice(selectedUnclaimedId, claimName.trim() || undefined);
      await loadHome();
      if (esp) setSelectedEsp(esp.id);
      setShowClaimEsp(false);
      setClaimName('');
      setSelectedUnclaimedId('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to claim');
    } finally {
      setSaving(false);
    }
  };

  const resetAddForm = () => {
    setSelectedTypeId(null);
    setDeviceName('');
    setSelectedEsp('');
    setSelectedPin('');
  };

  const renderDeviceCard = (device: Device) => {
    const isOn = (device.state as any)?.power || false;
    const isOnline = device.esp_device?.is_online || false;
    const isToggling = togglingId === device.id;
    const icon = device.type?.icon || 'devices';
    const iconName = (DEVICE_ICONS[icon] || icon) as any;

    return (
      <View key={device.id} style={s.deviceCard}>
        <View style={s.deviceMain}>
          <View style={[s.deviceIcon, { backgroundColor: isOn ? COLORS.primary + '20' : COLORS.background }]}>
            <MaterialCommunityIcons
              name={iconName}
              size={24}
              color={isOn ? COLORS.primary : COLORS.textLight}
            />
          </View>

          <View style={s.deviceInfo}>
            <Text style={s.deviceName} numberOfLines={1}>{device.name}</Text>
            <View style={s.deviceMeta}>
              <View style={[s.onlineDot, { backgroundColor: isOnline ? COLORS.online : COLORS.offline }]} />
              <Text style={s.deviceMetaText}>
                {device.esp_device?.name || 'Unknown'} · Pin {device.pin}
              </Text>
              {!isOnline && (
                <Text style={s.offlineLabel}>Offline</Text>
              )}
            </View>
          </View>

          {isToggling ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={s.toggleLoader} />
          ) : (
            <Switch
              value={isOn}
              onValueChange={() => handleToggle(device)}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
              ios_backgroundColor={COLORS.border}
              disabled={!isOnline}
            />
          )}
        </View>

        <TouchableOpacity
          style={s.deleteBtn}
          onPress={() => handleDeleteDevice(device)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={[s.roomHeader, { borderLeftColor: room.color }]}>
        <View style={[s.roomColorBar, { backgroundColor: room.color }]} />
        <View style={s.roomHeaderInfo}>
          <Text style={s.roomHeaderName}>{room.name}</Text>
          <Text style={s.roomHeaderMeta}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} · {devices.filter(d => (d.state as any)?.power).length} on
          </Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => { resetAddForm(); setShowAdd(true); }}>
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.deviceList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {devices.length > 0 ? (
          devices.map(renderDeviceCard)
        ) : (
          <View style={s.emptyDevices}>
            <MaterialCommunityIcons name="devices" size={56} color={COLORS.textLight} />
            <Text style={s.emptyTitle}>No Devices</Text>
            <Text style={s.emptySub}>Add your first device to this room</Text>
            <TouchableOpacity style={s.emptyAddBtn} onPress={() => { resetAddForm(); setShowAdd(true); }}>
              <MaterialCommunityIcons name="plus" size={20} color="#fff" />
              <Text style={s.emptyAddBtnText}>Add Device</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {devices.length > 0 && (
        <TouchableOpacity
          style={s.fab}
          onPress={() => { resetAddForm(); setShowAdd(true); }}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Device Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Device</Text>
              <TouchableOpacity onPress={() => { setShowAdd(false); resetAddForm(); }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Device Type</Text>
              <View style={s.typeGrid}>
                {deviceTypes.map(dt => {
                  const icon = (DEVICE_ICONS[dt.icon] || dt.icon) as any;
                  const selected = selectedTypeId === dt.id;
                  return (
                    <TouchableOpacity
                      key={dt.id}
                      style={[s.typeCard, selected && s.typeCardSelected]}
                      onPress={() => {
                        setSelectedTypeId(dt.id);
                        if (!deviceName.trim()) setDeviceName(dt.name);
                      }}
                    >
                      <MaterialCommunityIcons
                        name={icon}
                        size={22}
                        color={selected ? '#fff' : COLORS.textSecondary}
                      />
                      <Text
                        style={[s.typeName, selected && s.typeNameSelected]}
                        numberOfLines={1}
                      >
                        {dt.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>Device Name</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Bedroom Light"
                placeholderTextColor={COLORS.textLight}
                value={deviceName}
                onChangeText={setDeviceName}
              />

              <Text style={s.label}>ESP Device</Text>
              {espDevices.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} keyboardShouldPersistTaps="handled">
                  {espDevices.map(esp => (
                    <TouchableOpacity
                      key={esp.id}
                      style={[s.chip, selectedEsp === esp.id && s.chipSelected]}
                      onPress={() => { setSelectedEsp(esp.id); setSelectedPin(''); }}
                    >
                      <View style={[s.chipDot, { backgroundColor: esp.is_online ? COLORS.online : COLORS.offline }]} />
                      <Text style={[s.chipText, selectedEsp === esp.id && s.chipTextSelected]}>
                        {esp.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
              <TouchableOpacity style={s.registerEspBtn} onPress={handleOpenClaimEsp}>
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color={COLORS.primary} />
                <Text style={s.registerEspText}>
                  {espDevices.length === 0 ? 'No ESP devices — Discover one first' : 'Discover new ESP'}
                </Text>
              </TouchableOpacity>

              <Text style={s.label}>Pin Number</Text>
              {selectedEsp ? (
                <View style={s.pinGrid}>
                  {Array.from({ length: 9 }, (_, i) => {
                    const isUsed = usedPins.has(i);
                    const isSelected = selectedPin === String(i);
                    const occupyingDevice = selectedEspObj?.devices?.find(d => d.pin === i);
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
                          {i}
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
              ) : (
                <Text style={{ color: COLORS.textLight, fontSize: FONT_SIZE.sm }}>
                  Select an ESP device first to see available pins
                </Text>
              )}
            </ScrollView>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setShowAdd(false); resetAddForm(); }}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleAddDevice} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmText}>Add Device</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showClaimEsp} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Discovered Devices</Text>
              <TouchableOpacity onPress={() => setShowClaimEsp(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {unclaimedEsps.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: SPACING.xl }}>
                <MaterialCommunityIcons name="access-point-off" size={48} color={COLORS.textLight} />
                <Text style={{ color: COLORS.textSecondary, marginTop: SPACING.md, textAlign: 'center' }}>
                  No new ESP devices found.
                </Text>
              </View>
            ) : (
              <>
                {unclaimedEsps.map((esp: any) => (
                  <TouchableOpacity
                    key={esp.id}
                    style={[s.chip, selectedUnclaimedId === esp.id && s.chipSelected, { marginBottom: SPACING.sm, paddingVertical: SPACING.md }]}
                    onPress={() => { setSelectedUnclaimedId(esp.id); setClaimName(esp.name); }}
                  >
                    <View style={s.chipDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.chipText, selectedUnclaimedId === esp.id && s.chipTextSelected]}>{esp.name}</Text>
                      <Text style={{ fontSize: 10, color: COLORS.textLight }}>{esp.mac_address}</Text>
                    </View>
                    {esp.is_online && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.online }} />}
                  </TouchableOpacity>
                ))}

                {selectedUnclaimedId ? (
                  <>
                    <Text style={s.label}>Name</Text>
                    <TextInput style={s.input} placeholder="Device name" placeholderTextColor={COLORS.textLight} value={claimName} onChangeText={setClaimName} />
                  </>
                ) : null}
              </>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowClaimEsp(false); setSelectedUnclaimedId(''); }}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              {selectedUnclaimedId ? (
                <TouchableOpacity style={s.confirmBtn} onPress={handleClaimEsp} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmText}>Claim</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 4,
  },
  roomColorBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: SPACING.md,
  },
  roomHeaderInfo: { flex: 1 },
  roomHeaderName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  roomHeaderMeta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceList: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  deviceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  deviceMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  deviceInfo: { flex: 1 },
  deviceName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  deviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deviceMetaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  offlineLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.offline,
    fontWeight: '600',
    marginLeft: 4,
  },
  toggleLoader: {
    marginHorizontal: SPACING.md,
  },
  deleteBtn: {
    padding: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  emptyDevices: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xxl * 2,
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
  emptyAddBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fieldHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 6,
    marginBottom: 2,
  },
  typeCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  typeNameSelected: {
    color: '#fff',
  },
  chipRow: {
    marginBottom: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    marginRight: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  registerEspBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  registerEspText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  pinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pinChip: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pinChipUsed: {
    opacity: 0.4,
  },
  pinChipText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  pinChipTextSelected: {
    color: '#fff',
  },
  pinChipTextUsed: {
    color: COLORS.textLight,
  },
  pinChipLabel: {
    fontSize: 7,
    color: COLORS.textLight,
    position: 'absolute',
    bottom: 3,
    maxWidth: 48,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.lg,
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

export default RoomControlScreen;
