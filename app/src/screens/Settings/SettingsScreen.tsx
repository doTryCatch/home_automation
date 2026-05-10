import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore, useHomeStore, useSettingsStore } from '../../store';
import { deviceService } from '../../services/deviceService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';
import { EspDevice, DeviceType } from '../../types';

const SettingsScreen = () => {
  const { user, logout } = useAuthStore();
  const { espDevices, deviceTypes, loadHome } = useHomeStore();
  const { apiUrl, setApiUrl } = useSettingsStore();
  const navigation = useNavigation<any>();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showClaimEsp, setShowClaimEsp] = useState(false);
  const [unclaimedEsps, setUnclaimedEsps] = useState<EspDevice[]>([]);
  const [claimName, setClaimName] = useState('');
  const [selectedUnclaimedId, setSelectedUnclaimedId] = useState('');
  const [loadingUnclaimed, setLoadingUnclaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedEspId, setSelectedEspId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedPin, setSelectedPin] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const { floors } = useHomeStore();
  const allRooms = floors.flatMap(f => f.rooms || []);

  const selectedEspObj = espDevices.find(e => e.id === selectedEspId);
  const usedPins = new Set((selectedEspObj?.devices || []).map(d => d.pin));

  const handleOpenClaimEsp = async () => {
    setLoadingUnclaimed(true);
    try {
      const devices = await deviceService.getUnclaimedEspDevices();
      setUnclaimedEsps(devices);
      setShowClaimEsp(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to scan for devices');
    } finally {
      setLoadingUnclaimed(false);
    }
  };

  const handleClaimEsp = async () => {
    if (!selectedUnclaimedId) return Alert.alert('Error', 'Select a device to claim');
    setLoading(true);
    try {
      await deviceService.claimEspDevice(selectedUnclaimedId, claimName.trim() || undefined);
      await loadHome();
      setShowClaimEsp(false);
      setClaimName('');
      setSelectedUnclaimedId('');
      Alert.alert('Success', 'ESP device claimed');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to claim device');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    if (!newDeviceName || !selectedEspId || !selectedTypeId || !selectedRoomId || selectedPin === '') {
      return Alert.alert('Error', 'Fill all fields');
    }
    setLoading(true);
    try {
      await deviceService.create({
        name: newDeviceName,
        esp_device_id: selectedEspId,
        type_id: selectedTypeId,
        room_id: selectedRoomId,
        pin: parseInt(selectedPin) || 0,
      });
      await loadHome();
      setShowAddDevice(false);
      resetDeviceForm();
      Alert.alert('Success', 'Device added');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const resetDeviceForm = () => {
    setNewDeviceName('');
    setSelectedEspId('');
    setSelectedTypeId('');
    setSelectedRoomId('');
    setSelectedPin('');
  };

  const handleDeleteEsp = async (id: string) => {
    Alert.alert('Delete ESP Device', 'All linked devices will also be deleted. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deviceService.deleteEsp(id);
            await loadHome();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'Failed to delete ESP device');
          }
        },
      },
    ]);
  };

  const renderEspDevice = ({ item }: { item: EspDevice }) => (
    <View style={styles.espCard}>
      <View style={styles.espInfo}>
        <View style={[
          styles.espStatusIcon,
          { backgroundColor: item.is_online ? COLORS.online + '20' : COLORS.offline + '20' },
        ]}>
          <MaterialCommunityIcons
            name={item.is_online ? 'wifi' : 'wifi-off'}
            size={22}
            color={item.is_online ? COLORS.online : COLORS.offline}
          />
        </View>
        <View style={styles.espDetails}>
          <Text style={styles.espName}>{item.name}</Text>
          <Text style={styles.espMac}>{item.mac_address}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={[styles.espStatusBadge, { backgroundColor: item.is_online ? COLORS.online + '20' : COLORS.offline + '20' }]}>
              <View style={[styles.espStatusDot, { backgroundColor: item.is_online ? COLORS.online : COLORS.offline }]} />
              <Text style={[styles.espStatusBadgeText, { color: item.is_online ? COLORS.online : COLORS.offline }]}>
                {item.is_online ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            <Text style={styles.espDeviceCount}>
              {item.devices?.length || 0} device{(item.devices?.length || 0) !== 1 ? 's' : ''}
            </Text>
          </View>
          {item.last_seen && !item.is_online && (
            <Text style={styles.lastSeen}>
              Last seen {new Date(item.last_seen).toLocaleDateString()} {new Date(item.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity onPress={() => handleDeleteEsp(item.id)}>
        <MaterialCommunityIcons name="delete-outline" size={22} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TouchableOpacity style={styles.profileCard} onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
            <MaterialCommunityIcons name="account-circle" size={48} color={COLORS.primary} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server Configuration</Text>
          <Text style={styles.sectionDesc}>Backend API URL for all requests</Text>
          {editingUrl ? (
            <View style={styles.urlEditContainer}>
              <TextInput
                style={styles.urlInput}
                placeholder="http://192.168.1.100:3000/api"
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={styles.urlActions}>
                <TouchableOpacity
                  style={styles.urlCancelBtn}
                  onPress={() => setEditingUrl(false)}
                >
                  <Text style={styles.urlCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.urlSaveBtn}
                  onPress={async () => {
                    const trimmed = urlInput.trim().replace(/\/+$/, '');
                    if (!trimmed) return Alert.alert('Error', 'URL cannot be empty');
                    await setApiUrl(trimmed);
                    setEditingUrl(false);
                    Alert.alert('Saved', 'Server URL updated. Restart the app for all changes to take effect.');
                  }}
                >
                  <Text style={styles.urlSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.urlCard}
              onPress={() => { setUrlInput(apiUrl); setEditingUrl(true); }}
            >
              <View style={styles.urlInfo}>
                <MaterialCommunityIcons name="server" size={22} color={COLORS.primary} />
                <Text style={styles.urlText} numberOfLines={1}>{apiUrl || 'Not configured'}</Text>
              </View>
              <MaterialCommunityIcons name="pencil" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ESP Devices</Text>
            <TouchableOpacity onPress={handleOpenClaimEsp}>
              <MaterialCommunityIcons name="plus-circle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {espDevices.map(d => <View key={d.id}>{renderEspDevice({ item: d })}</View>)}
          {espDevices.length === 0 && <Text style={styles.emptyText}>No ESP devices registered</Text>}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Add Device</Text>
            <TouchableOpacity onPress={() => setShowAddDevice(true)}>
              <MaterialCommunityIcons name="plus-circle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDesc}>Link appliances to ESP device pins and assign to rooms</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Types</Text>
          <View style={styles.typesGrid}>
            {deviceTypes.map(t => (
              <View key={t.id} style={styles.typeChip}>
                <MaterialCommunityIcons name={t.icon as any || 'devices'} size={18} color={COLORS.primary} />
                <Text style={styles.typeChipText}>{t.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showClaimEsp} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Discovered Devices</Text>
            {unclaimedEsps.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: SPACING.xl }}>
                <MaterialCommunityIcons name="access-point-off" size={48} color={COLORS.textLight} />
                <Text style={{ color: COLORS.textSecondary, marginTop: SPACING.md, textAlign: 'center' }}>
                  No new ESP devices found.{'\n'}Make sure your ESP is powered on and connected to WiFi.
                </Text>
                <TouchableOpacity style={styles.modalConfirm} onPress={handleOpenClaimEsp}>
                  {loadingUnclaimed ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Scan Again</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.sectionDesc}>Select an ESP device to claim and add to your account</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                  {unclaimedEsps.map(esp => (
                    <TouchableOpacity
                      key={esp.id}
                      style={[
                        styles.espCard,
                        selectedUnclaimedId === esp.id && { borderColor: COLORS.primary, borderWidth: 2 },
                      ]}
                      onPress={() => { setSelectedUnclaimedId(esp.id); setClaimName(esp.name); }}
                    >
                      <View style={styles.espInfo}>
                        <MaterialCommunityIcons
                          name="chip"
                          size={24}
                          color={esp.is_online ? COLORS.online : COLORS.offline}
                        />
                        <View style={styles.espDetails}>
                          <Text style={styles.espName}>{esp.name}</Text>
                          <Text style={styles.espMac}>{esp.mac_address}</Text>
                          <Text style={[styles.espStatus, { color: esp.is_online ? COLORS.online : COLORS.offline }]}>
                            {esp.is_online ? 'Online' : 'Offline'}
                          </Text>
                        </View>
                      </View>
                      {selectedUnclaimedId === esp.id && (
                        <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selectedUnclaimedId ? (
                  <>
                    <Text style={styles.label}>Device Name</Text>
                    <TextInput style={styles.input} placeholder="e.g. Living Room ESP" placeholderTextColor={COLORS.textLight} value={claimName} onChangeText={setClaimName} />
                  </>
                ) : null}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowClaimEsp(false); setSelectedUnclaimedId(''); setClaimName(''); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleClaimEsp} disabled={loading || !selectedUnclaimedId}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Claim Device</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showAddDevice} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Device</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} placeholder="Device name (e.g., Bedroom Light)" value={newDeviceName} onChangeText={setNewDeviceName} />

              <Text style={styles.label}>Room</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {allRooms.map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.chip, selectedRoomId === r.id && styles.chipSelected]}
                    onPress={() => setSelectedRoomId(r.id)}
                  >
                    <Text style={[styles.chipText, selectedRoomId === r.id && styles.chipTextSelected]}>{r.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>ESP Device</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {espDevices.map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.chip, selectedEspId === e.id && styles.chipSelected]}
                    onPress={() => { setSelectedEspId(e.id); setSelectedPin(''); }}
                  >
                    <Text style={[styles.chipText, selectedEspId === e.id && styles.chipTextSelected]}>{e.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Device Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {deviceTypes.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.chip, selectedTypeId === t.id && styles.chipSelected]}
                    onPress={() => setSelectedTypeId(t.id)}
                  >
                    <Text style={[styles.chipText, selectedTypeId === t.id && styles.chipTextSelected]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Pin Number</Text>
              {selectedEspId ? (
                <View style={styles.pinGrid}>
                  {Array.from({ length: 9 }, (_, i) => {
                    const isUsed = usedPins.has(i);
                    const isSelected = selectedPin === String(i);
                    const occupyingDevice = selectedEspObj?.devices?.find(d => d.pin === i);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.pinChip,
                          isSelected && styles.pinChipSelected,
                          isUsed && styles.pinChipUsed,
                        ]}
                        disabled={isUsed}
                        onPress={() => setSelectedPin(String(i))}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.pinChipText,
                          isSelected && styles.pinChipTextSelected,
                          isUsed && styles.pinChipTextUsed,
                        ]}>
                          {i}
                        </Text>
                        {isUsed && occupyingDevice ? (
                          <Text style={styles.pinChipLabel} numberOfLines={1}>
                            {occupyingDevice.name}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: COLORS.textLight, fontSize: 12 }}>
                  Select an ESP device first
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowAddDevice(false); resetDeviceForm(); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAddDevice} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  sectionDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
    gap: SPACING.md,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  profileEmail: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  espCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  espInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  espDetails: { flex: 1 },
  espName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  espMac: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontFamily: 'monospace' },
  espStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  espStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  espStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  espStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  espDeviceCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  lastSeen: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
  },
  emptyText: { color: COLORS.textLight, textAlign: 'center', padding: SPACING.lg },
  typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  typeChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.danger + '15',
    gap: SPACING.sm,
  },
  logoutText: { color: COLORS.danger, fontWeight: '600', fontSize: FONT_SIZE.lg },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  chipRow: { marginBottom: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  chipTextSelected: { color: '#fff' },
  pinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    fontSize: 14,
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.xl },
  modalCancel: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 100,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
  urlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  urlInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  urlText: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontFamily: 'monospace', flex: 1 },
  urlEditContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  urlActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm },
  urlCancelBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  urlCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  urlSaveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  urlSaveText: { color: '#fff', fontWeight: '600' },
});

export default SettingsScreen;
