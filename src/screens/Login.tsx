import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  DeviceEventEmitter,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {userSession} from '../lib/services/login';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import ProfileAvatar from './Profileavatar'; 

const EMAIL_REGEX = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [loggedInUser, setLoggedInUser] = useState<{
    name: string;
    email: string;
  } | null>(null);

  const navigation = useNavigation<any>();

  const validate = (): boolean => {
    const trimEmail = email.trim();
    if (!trimEmail) {
      setError('Please enter your email.');
      return false;
    }
    if (!EMAIL_REGEX.test(trimEmail)) {
      setError('Please enter a valid email.');
      return false;
    }
    if (mode === 'reset') return true;
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'reset') {
        const {supabase} = require('../lib/services/supabaseClient');
        const {error} = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setSuccessMsg('Reset email sent! Check your inbox.');
        return;
      }

      const user =
        mode === 'signup'
          ? await userSession.signUp(email.trim(), password)
          : await userSession.signInWithEmail(email.trim(), password);

      setLoggedInUser({name: user.name, email: user.email});
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const goToApp = () => {
    DeviceEventEmitter.emit('userLoggedIn', loggedInUser);
    navigation.reset({index: 0, routes: [{name: 'MainStack'}]});
  };

  if (loggedInUser) {
    return (
      <View style={styles.profileStep}>
        <Text style={styles.profileStepTitle}>Welcome to Doodle! 🎉</Text>
        <Text style={styles.profileStepSub}>
          Set a profile photo or continue to the app.
        </Text>
        <ProfileAvatar size={110} editable={true} />
        <Text style={styles.profileName}>{loggedInUser.name}</Text>
        <Text style={styles.profileEmail}>{loggedInUser.email}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={goToApp}>
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{flex: 1, backgroundColor: '#000'}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logo}><Text style={styles.logoText}>D</Text></View>
        <Text style={styles.title}>{mode === 'signin' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}</Text>
        
        {error && <Text style={styles.errorText}>{error}</Text>}
        {successMsg && <Text style={styles.successText}>{successMsg}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        {mode !== 'reset' && (
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        )}

        {mode === 'signup' && (
           <TextInput
           style={styles.input}
           placeholder="Confirm Password"
           placeholderTextColor="#9ca3af"
           secureTextEntry={!showPassword}
           value={confirmPassword}
           onChangeText={setConfirmPassword}
         />
        )}

        <TouchableOpacity onPress={handleSubmit} style={styles.primaryBtn} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>{mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{marginTop: 20}}>
          <Text style={{color: '#fff'}}>{mode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#000' },
  logo: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  logoText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: { width: '100%', backgroundColor: '#1a1a1a', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  passwordRow: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, marginBottom: 12 },
  passwordInput: { flex: 1, color: '#fff', padding: 16 },
  eyeBtn: { padding: 12 },
  primaryBtn: { width: '100%', backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#000', fontWeight: 'bold' },
  errorText: { color: '#ef4444', marginBottom: 12 },
  successText: { color: '#22c55e', marginBottom: 12 },
  profileStep: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 },
  profileStepTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  profileStepSub: { color: '#9ca3af', marginBottom: 24 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  profileEmail: { color: '#6b7280', marginBottom: 24 },
});
