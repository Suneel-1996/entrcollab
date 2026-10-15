import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createAuthentication } from './src/auth/native';
import type { AuthState } from './src/auth/session';
import { ProfileClient } from './src/profiles/client';
import { ProfileScreen } from './src/profiles/ProfileScreen';
import { initialProfileGate, profileGateForAuth } from './src/profiles/session-gate';

let authentication: ReturnType<typeof createAuthentication> = null;
try { authentication = createAuthentication(); } catch { /* Configuration failures stay generic and do not expose values. */ }
const profiles = authentication ? new ProfileClient(authentication.profileRequest) : null;
function profileAccessDenied(userId: string) { if (authentication?.session.snapshot.phase === 'signedIn' && authentication.session.snapshot.user?.id === userId) void authentication.session.signOut('Please sign in again to access your profile.'); }
function signOut() { void authentication?.session.signOut(); }
export default function App() {
  const [state, setState] = useState<AuthState>({ phase: 'loading' });
  const [busy, setBusy] = useState(false);
  const [profileGate, setProfileGate] = useState(initialProfileGate);
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => {
    if (!authentication) return;
    const manager = authentication.session;
    const unsubscribe = manager.subscribe(next => {
      setState(next);
      setProfileGate(previous => profileGateForAuth(previous, next));
    });
    void manager.start();
    const events = AppState.addEventListener('change', next => manager.foreground(next === 'active'));
    return () => { events.remove(); unsubscribe(); manager.stop(); };
  }, []);
  async function action(run: () => Promise<unknown>, success = '') {
    setBusy(true); setNotice('');
    try { const result = await run(); setNotice(result === 'cancelled' ? 'Sign-in cancelled.' : success); }
    catch { setNotice('Sign-in could not be completed. Please retry.'); }
    finally { setBusy(false); setCode(''); }
  }
  const working = busy || ['loading', 'busy'].includes(state.phase);
  return <SafeAreaView style={[styles.container, profileGate.userId ? styles.profileContainer : undefined]}>
    <StatusBar style="auto" />
    <Text accessibilityRole="header" style={styles.title}>EntrCollab</Text>
    {profiles && profileGate.userId && <View style={[styles.workspace, !profileGate.visible && styles.hidden]} accessibilityElementsHidden={!profileGate.visible} importantForAccessibility={!profileGate.visible ? 'no-hide-descendants' : 'auto'}>
      <ProfileScreen key={`${profileGate.userId}:${profileGate.revision}`} client={profiles} userId={profileGate.userId} active={profileGate.visible} onAccessDenied={profileAccessDenied} onSignOut={signOut} />
    </View>}
    {!authentication ? <Text>Authentication is not configured for this development build.</Text> : <View style={styles.form}>
      {working && <ActivityIndicator accessibilityLabel="Signing in" />}
      {state.phase === 'signedIn' ? null : <>
        <Button title="Continue with Google" disabled={working} onPress={() => void action(() => authentication!.google())} />
        {authentication.emailOtpEnabled && <View style={styles.form}>
          <Text>Development testers only</Text>
          <TextInput accessibilityLabel="Tester email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
          <Button title="Send testing code" disabled={working || !email.trim()} onPress={() => void action(() => authentication!.sendOtp(email), 'If this tester is eligible, a code will arrive.')} />
          <TextInput accessibilityLabel="Email code" autoComplete="one-time-code" keyboardType="number-pad" secureTextEntry value={code} onChangeText={setCode} style={styles.input} />
          <Button title="Verify testing code" disabled={working || !code.trim()} onPress={() => void action(() => authentication!.verifyOtp(email, code))} />
        </View>}
        {state.phase === 'error' && <><Button title="Retry session" disabled={busy} onPress={() => void action(() => authentication!.session.restore())} /><Button title="Clear session" disabled={busy} onPress={() => void action(() => authentication!.session.signOut())} /></>}
      </>}
      {(notice || state.message) && <Text accessibilityLiveRegion="polite">{notice || state.message}</Text>}
    </View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: '#F4F7F2' }, profileContainer: { justifyContent: 'flex-start', gap: 12 }, workspace: { flex: 1 }, hidden: { display: 'none' }, title: { fontSize: 28, fontWeight: '600' }, form: { gap: 16 }, input: { borderWidth: 1, borderColor: '#777', padding: 12, borderRadius: 6 } });
