import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useScheduleStore } from '../../store';
import { scheduleService } from '../../services/scheduleService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';
import { Schedule } from '../../types';

interface Props {
  route: { params: { deviceId: string; deviceName: string } };
  navigation: any;
}

const DeviceScheduleScreen = ({ route, navigation }: Props) => {
  const { deviceId, deviceName } = route.params;
  const { schedules, loadSchedules, toggleSchedule } = useScheduleStore();

  useEffect(() => {
    navigation.setOptions({ title: `${deviceName} Schedules` });
    loadSchedules(deviceId);
  }, [deviceId]);

  const formatTime = (cron: string) => {
    const parts = cron.split(' ');
    const h = parseInt(parts[1]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${parts[0]} ${ampm}`;
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete', 'Delete this schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await scheduleService.delete(id);
            await loadSchedules(deviceId);
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Schedule }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name || 'Schedule'}</Text>
        <Text style={styles.time}>{formatTime(item.cron)}</Text>
        <Text style={styles.action}>Turn {(item.action as any)?.power ? 'ON' : 'OFF'}</Text>
      </View>
      <View style={styles.controls}>
        <Switch value={item.is_active} onValueChange={() => toggleSchedule(item.id)} />
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={schedules}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clock-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No schedules for this device</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  info: { flex: 1 },
  name: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  time: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600', marginTop: 4 },
  action: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  controls: { alignItems: 'center', gap: SPACING.sm },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl },
  emptyText: { color: COLORS.textSecondary, marginTop: SPACING.md, fontSize: FONT_SIZE.md },
});

export default DeviceScheduleScreen;
