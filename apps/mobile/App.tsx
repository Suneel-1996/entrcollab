import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createAuthentication } from './src/auth/native';
import type { AuthState } from './src/auth/session';

let authentication: ReturnType<typeof createAuthentication> = null;
try { authentication = createAuthentication(); } catch { /* Configuration failures stay generic and do not expose values. */ }
export default function App() {
  const [state, setState] = useState<AuthState>({ phase: 'loading' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => {
    if (!authentication) return;
    const manager = authentication.session;
    const unsubscribe = manager.subscribe(setState);
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
  return <SafeAreaView style={styles.container}>
    <StatusBar style="auto" />
    <Text accessibilityRole="header" style={styles.title}>EntrCollab</Text>
    {!authentication ? <Text>Authentication is not configured for this development build.</Text> : <View style={styles.form}>
      {working && <ActivityIndicator accessibilityLabel="Signing in" />}
      {state.phase === 'signedIn' ? <><Text>You are signed in.</Text><Button title="Sign out" disabled={busy} onPress={() => void action(() => authentication!.session.signOut())} /></> : <>
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
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 }, title: { fontSize: 28, fontWeight: '600' }, form: { gap: 16 }, input: { borderWidth: 1, borderColor: '#777', padding: 12, borderRadius: 6 } });
