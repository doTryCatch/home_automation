import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore, useSettingsStore } from '../../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type LoginScreenNav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNav>();
  const { login } = useAuthStore();
  const { apiUrl, setApiUrl } = useSettingsStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleSaveUrl = async () => {
    const trimmed = urlInput.trim().replace(/\/+$/, '');
    if (!trimmed) return Alert.alert('Error', 'URL cannot be empty');
    await setApiUrl(trimmed);
    setShowServerConfig(false);
    Alert.alert('Saved', 'Server URL updated');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>Home Automation</Text>
          <Text style={styles.subtitle}>Control your home, anywhere</Text>
        </View>

        <TouchableOpacity
          style={styles.serverRow}
          onPress={() => { setUrlInput(apiUrl); setShowServerConfig(!showServerConfig); }}
        >
          <MaterialCommunityIcons name="server" size={16} color={COLORS.textSecondary} />
          <Text style={styles.serverUrl} numberOfLines={1}>{apiUrl || 'Not configured'}</Text>
          <MaterialCommunityIcons name={showServerConfig ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfig}>
            <TextInput
              style={styles.urlInput}
              placeholder="http://192.168.1.100:3000/api"
              placeholderTextColor={COLORS.textLight}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity style={styles.urlSaveBtn} onPress={handleSaveUrl}>
              <Text style={styles.urlSaveText}>Save URL</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.link}>Register</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.hero, fontWeight: 'bold', color: COLORS.primary },
  subtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.xs },
  form: { gap: SPACING.md },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '600' },
  linkText: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZE.md, marginTop: SPACING.md },
  link: { color: COLORS.primary, fontWeight: '600' },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  serverUrl: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontFamily: 'monospace' },
  serverConfig: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  urlSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  urlSaveText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZE.md },
});

export default LoginScreen;
