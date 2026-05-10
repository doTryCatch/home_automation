import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useScheduleStore, useHomeStore } from '../../store';
import { scheduleService } from '../../services/scheduleService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';
import { Schedule } from '../../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ScheduleListScreen = () => {
  const { schedules, isLoading, loadSchedules, toggleSchedule } = useScheduleStore();
  const { floors } = useHomeStore();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [scheduleName, setScheduleName] = useState('');
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [actionPower, setActionPower] = useState(true);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState('');
  const [editName, setEditName] = useState('');
  const [editHour, setEditHour] = useState('08');
  const [editMinute, setEditMinute] = useState('00');
  const [editActionPower, setEditActionPower] = useState(true);
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    loadSchedules();
  }, []);

  const allDevices = floors.flatMap(f => f.rooms?.flatMap(r => r.devices?.map(d => ({ ...d, roomName: r.name })) || []) || []);

  const handleCreate = async () => {
    if (!selectedDeviceId) return Alert.alert('Error', 'Select a device');
    if (selectedDays.length === 0) return Alert.alert('Error', 'Select at least one day');

    const dayField = selectedDays.length === 7 ? '*' : selectedDays.join(',');
    const cron = `${minute} ${hour} * * ${dayField}`;

    setLoading(true);
    try {
      await scheduleService.create({
        device_id: selectedDeviceId,
        name: scheduleName || undefined,
        action: { power: actionPower },
        cron,
        is_active: true,
      });
      await loadSchedules();
      setShowCreate(false);
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Schedule', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await scheduleService.delete(id);
            await loadSchedules();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'Failed to delete schedule');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setSelectedDeviceId('');
    setScheduleName('');
    setHour('08');
    setMinute('00');
    setActionPower(true);
    setSelectedDays([]);
  };

  const openEdit = (schedule: Schedule) => {
    const cron = parseCron(schedule.cron);
    setEditScheduleId(schedule.id);
    setEditName(schedule.name || '');
    setEditHour(cron.hour);
    setEditMinute(cron.minute);
    setEditActionPower((schedule.action as any)?.power ?? true);
    if (cron.days === '*') {
      setEditDays([0, 1, 2, 3, 4, 5, 6]);
    } else {
      setEditDays(cron.days.split(',').map(Number).filter(n => !isNaN(n)));
    }
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (editDays.length === 0) return Alert.alert('Error', 'Select at least one day');
    const dayField = editDays.length === 7 ? '*' : editDays.join(',');
    const cron = `${editMinute} ${editHour} * * ${dayField}`;
    setEditLoading(true);
    try {
      await scheduleService.update(editScheduleId, {
        name: editName || undefined,
        action: { power: editActionPower },
        cron,
      });
      await loadSchedules();
      setShowEdit(false);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e.message);
    } finally {
      setEditLoading(false);
    }
  };

  const parseCron = (cron: string) => {
    const parts = cron.split(' ');
    return { minute: parts[0], hour: parts[1], days: parts[4] };
  };

  const formatTime = (hour: string, minute: string) => {
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minute} ${ampm}`;
  };

  const renderSchedule = ({ item }: { item: Schedule }) => {
    const cron = parseCron(item.cron);
    const deviceName = item.device?.name || 'Unknown';
    const roomName = (item.device?.room as any)?.name || '';

    return (
      <View style={[styles.scheduleCard, !item.is_active && styles.scheduleCardInactive]}>
        <View style={styles.scheduleInfo}>
          <Text style={styles.scheduleName}>{item.name || 'Untitled Schedule'}</Text>
          <Text style={styles.scheduleDevice}>{deviceName} {roomName ? `- ${roomName}` : ''}</Text>
          <View style={styles.scheduleTimeRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.scheduleTime}>{formatTime(cron.hour, cron.minute)}</Text>
            <Text style={styles.scheduleDays}>{cron.days === '*' ? 'Every day' : cron.days}</Text>
          </View>
          <View style={styles.scheduleAction}>
            <Text style={styles.scheduleActionText}>
              Turn {(item.action as any)?.power ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
        <View style={styles.scheduleControls}>
          <Switch
            value={item.is_active}
            onValueChange={() => toggleSchedule(item.id)}
            trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
            thumbColor={item.is_active ? COLORS.primary : COLORS.textLight}
          />
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.deleteButton}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={schedules}
        renderItem={renderSchedule}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clock-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No schedules</Text>
            <Text style={styles.emptySubtitle}>Create schedules to automate your devices</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Schedule</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Device</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceSelector}>
                {allDevices.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.deviceChip, selectedDeviceId === d.id && styles.deviceChipSelected]}
                    onPress={() => setSelectedDeviceId(d.id)}
                  >
                    <Text style={[styles.deviceChipText, selectedDeviceId === d.id && styles.deviceChipTextSelected]}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Name (optional)</Text>
              <TextInput style={styles.input} placeholder="Schedule name" value={scheduleName} onChangeText={setScheduleName} />

              <Text style={styles.label}>Time</Text>
              <View style={styles.timeRow}>
                <TextInput style={styles.timeInput} value={hour} onChangeText={setHour} keyboardType="numeric" maxLength={2} />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput style={styles.timeInput} value={minute} onChangeText={setMinute} keyboardType="numeric" maxLength={2} />
              </View>

              <Text style={styles.label}>Days</Text>
              <View style={styles.daysRow}>
                {DAYS.map((day, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, selectedDays.includes(i) && styles.dayChipSelected]}
                    onPress={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                  >
                    <Text style={[styles.dayChipText, selectedDays.includes(i) && styles.dayChipTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Action</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionChip, actionPower && styles.actionChipOn]}
                  onPress={() => setActionPower(true)}
                >
                  <Text style={[styles.actionChipText, actionPower && styles.actionChipTextOn]}>Turn ON</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionChip, !actionPower && styles.actionChipOff]}
                  onPress={() => setActionPower(false)}
                >
                  <Text style={[styles.actionChipText, !actionPower && { color: COLORS.danger }]}>Turn OFF</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleCreate} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Schedule</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Name (optional)</Text>
              <TextInput style={styles.input} placeholder="Schedule name" value={editName} onChangeText={setEditName} />
              <Text style={styles.label}>Time</Text>
              <View style={styles.timeRow}>
                <TextInput style={styles.timeInput} value={editHour} onChangeText={setEditHour} keyboardType="numeric" maxLength={2} />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput style={styles.timeInput} value={editMinute} onChangeText={setEditMinute} keyboardType="numeric" maxLength={2} />
              </View>
              <Text style={styles.label}>Days</Text>
              <View style={styles.daysRow}>
                {DAYS.map((day, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, editDays.includes(i) && styles.dayChipSelected]}
                    onPress={() => setEditDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                  >
                    <Text style={[styles.dayChipText, editDays.includes(i) && styles.dayChipTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Action</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionChip, editActionPower && styles.actionChipOn]} onPress={() => setEditActionPower(true)}>
                  <Text style={[styles.actionChipText, editActionPower && styles.actionChipTextOn]}>Turn ON</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionChip, !editActionPower && styles.actionChipOff]} onPress={() => setEditActionPower(false)}>
                  <Text style={[styles.actionChipText, !editActionPower && { color: COLORS.danger }]}>Turn OFF</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEdit(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleEdit} disabled={editLoading}>
                {editLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Save</Text>}
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
  list: { padding: SPACING.md, paddingBottom: 80 },
  scheduleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  scheduleCardInactive: { opacity: 0.6 },
  scheduleInfo: { flex: 1 },
  scheduleName: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  scheduleDevice: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  scheduleTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
  scheduleTime: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  scheduleDays: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  scheduleAction: { marginTop: SPACING.xs },
  scheduleActionText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '500' },
  scheduleControls: { alignItems: 'center', gap: SPACING.sm },
  deleteButton: { padding: SPACING.xs },
  emptyState: { alignItems: 'center', paddingTop: SPACING.xxl },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, marginTop: SPACING.md },
  emptySubtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
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
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  deviceSelector: { marginBottom: SPACING.sm },
  deviceChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deviceChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  deviceChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  deviceChipTextSelected: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  timeInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.xxl,
    color: COLORS.text,
    width: 80,
    textAlign: 'center',
  },
  timeSeparator: { fontSize: FONT_SIZE.xxl, color: COLORS.text, fontWeight: 'bold' },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },
  dayChipTextSelected: { color: '#fff' },
  actionRow: { flexDirection: 'row', gap: SPACING.md },
  actionChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionChipOn: { backgroundColor: COLORS.success + '20', borderColor: COLORS.success },
  actionChipOff: { backgroundColor: COLORS.danger + '20', borderColor: COLORS.danger },
  actionChipText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textSecondary },
  actionChipTextOn: { color: COLORS.success },
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
});

export default ScheduleListScreen;
