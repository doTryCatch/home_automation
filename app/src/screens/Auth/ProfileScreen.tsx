import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import { authService } from '../../services/authService';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';

const ProfileScreen = ({ navigation }: any) => {
  const { user, setUser, logout } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Edit Profile' });
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await authService.updateProfile({ name: name || undefined, phone: phone || undefined });
      setUser(updated);
      Alert.alert('Success', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) return Alert.alert('Error', 'Fill all fields');
    if (newPw !== confirmPw) return Alert.alert('Error', 'Passwords do not match');
    if (newPw.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters');
    setChangingPw(true);
    try {
      await authService.changePassword(currentPw, newPw);
      Alert.alert('Success', 'Password changed');
      setShowChangePw(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This will permanently delete your account and all data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Account',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Confirm', 'Type "DELETE" to confirm (not implemented for safety - use API directly)', [
            { text: 'OK' },
          ]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Personal Information</Text>
          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} placeholder="Your name" placeholderTextColor={COLORS.textLight} value={name} onChangeText={setName} />
          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} placeholder="Phone number" placeholderTextColor={COLORS.textLight} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Text style={s.label}>Email</Text>
          <TextInput style={[s.input, s.inputDisabled]} value={user?.email || ''} editable={false} />
          <TouchableOpacity style={s.saveBtn} onPress={handleSaveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Profile</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Security</Text>
          <TouchableOpacity style={s.actionRow} onPress={() => setShowChangePw(true)}>
            <MaterialCommunityIcons name="lock-outline" size={22} color={COLORS.text} />
            <Text style={s.actionText}>Change Password</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          <TouchableOpacity style={s.actionRow} onPress={() => logout()}>
            <MaterialCommunityIcons name="logout" size={22} color={COLORS.danger} />
            <Text style={[s.actionText, { color: COLORS.danger }]}>Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionRow} onPress={handleDeleteAccount}>
            <MaterialCommunityIcons name="delete-outline" size={22} color={COLORS.danger} />
            <Text style={[s.actionText, { color: COLORS.danger }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showChangePw} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Change Password</Text>
            <Text style={s.label}>Current Password</Text>
            <TextInput style={s.input} placeholder="Current password" placeholderTextColor={COLORS.textLight} value={currentPw} onChangeText={setCurrentPw} secureTextEntry />
            <Text style={s.label}>New Password</Text>
            <TextInput style={s.input} placeholder="New password (min 8 chars)" placeholderTextColor={COLORS.textLight} value={newPw} onChangeText={setNewPw} secureTextEntry />
            <Text style={s.label}>Confirm New Password</Text>
            <TextInput style={s.input} placeholder="Confirm new password" placeholderTextColor={COLORS.textLight} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowChangePw(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleChangePassword} disabled={changingPw}>
                {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnText}>Change</Text>}
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
  content: { padding: SPACING.lg },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.lg,
    color: COLORS.text, backgroundColor: COLORS.surface,
  },
  inputDisabled: { backgroundColor: COLORS.background, opacity: 0.6 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.lg },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.sm,
  },
  actionText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.lg },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, minWidth: 100, alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '600' },
});

export default ProfileScreen;
