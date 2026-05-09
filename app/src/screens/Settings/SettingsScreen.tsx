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
import { useAuthStore, useHomeStore, useSettingsStore } from '../../store';
import { deviceService } from '../../services/deviceService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';
import { EspDevice, DeviceType } from '../../types';

const SettingsScreen = () => {
  const { user, logout } = useAuthStore();
  const { espDevices, deviceTypes, loadHome } = useHomeStore();
  const { apiUrl, setApiUrl } = useSettingsStore();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddEsp, setShowAddEsp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [espMac, setEspMac] = useState('');
  const [espName, setEspName] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedEspId, setSelectedEspId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedPin, setSelectedPin] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const { floors } = useHomeStore();
  const allRooms = floors.flatMap(f => f.rooms || []);

  const handleAddEsp = async () => {
    if (!espMac.trim() || !espName.trim()) return Alert.alert('Error', 'Fill all fields');
    setLoading(true);
    try {
      const esp = await deviceService.registerEsp({ mac_address: espMac, name: espName });
      if (!esp) throw new Error('Registration returned no data');
      await loadHome();
      setShowAddEsp(false);
      setEspMac('');
      setEspName('');
      Alert.alert('Success', 'ESP device registered');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed');
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
          await deviceService.deleteEsp(id);
          await loadHome();
        },
      },
    ]);
  };

  const renderEspDevice = ({ item }: { item: EspDevice }) => (
    <View style={styles.espCard}>
      <View style={styles.espInfo}>
        <MaterialCommunityIcons
          name="chip"
          size={24}
          color={item.is_online ? COLORS.online : COLORS.offline}
        />
        <View style={styles.espDetails}>
          <Text style={styles.espName}>{item.name}</Text>
          <Text style={styles.espMac}>{item.mac_address}</Text>
          <Text style={[styles.espStatus, { color: item.is_online ? COLORS.online : COLORS.offline }]}>
            {item.is_online ? 'Online' : 'Offline'} - {item.devices?.length || 0} devices
          </Text>
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
          <View style={styles.profileCard}>
            <MaterialCommunityIcons name="account-circle" size={48} color={COLORS.primary} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
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
            <TouchableOpacity onPress={() => setShowAddEsp(true)}>
              <MaterialCommunityIcons name="plus-circle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {espDevices.map(d => renderEspDevice({ item: d }))}
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

      <Modal visible={showAddEsp} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register ESP Device</Text>
            <TextInput style={styles.input} placeholder="MAC Address (AA:BB:CC:DD:EE:FF)" value={espMac} onChangeText={setEspMac} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Device Name" value={espName} onChangeText={setEspName} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddEsp(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAddEsp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Register</Text>}
              </TouchableOpacity>
            </View>
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
                    onPress={() => setSelectedEspId(e.id)}
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

              <Text style={styles.label}>Pin Number (0-16)</Text>
              <TextInput style={styles.input} placeholder="Pin number" value={selectedPin} onChangeText={setSelectedPin} keyboardType="numeric" />
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
  espStatus: { fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 2 },
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
