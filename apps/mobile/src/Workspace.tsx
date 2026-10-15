import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, View } from 'react-native';
import { ProfileClient } from './profiles/client';
import { ProfileScreen } from './profiles/ProfileScreen';
import { IdeaClient } from './ideas/client';
import { IdeaScreen } from './ideas/IdeaScreen';
import type { NavigationGuard, RegisterGuard } from './navigation';
export function Workspace({ profiles, ideas, userId, active, onAccessDenied, onSignOut }: {
  profiles: ProfileClient; ideas: IdeaClient; userId: string; active: boolean; onAccessDenied: (id: string) => void; onSignOut: (id: string) => void;
}) {
  const [tab, setTab] = useState<'profile' | 'ideas'>('profile');
  const [busy, setBusy] = useState(false);
  const guard = useRef<NavigationGuard | null>(null);
  const live = useRef({ mounted: true, active }); live.current.active = active;
  useEffect(() => { live.current.mounted = true; return () => { live.current.mounted = false; }; }, []);
  const register: RegisterGuard = useCallback((next, pending = false) => { guard.current = next; setBusy(pending); }, []);
  const signOut = useCallback(() => { if (live.current.mounted && live.current.active) onSignOut(userId); }, [onSignOut, userId]);
  function navigate(next: typeof tab) {
    const proceed = () => { if (live.current.mounted && live.current.active) setTab(next); };
    if (guard.current) guard.current(proceed); else proceed();
  }
  return <View style={styles.root}>
    <View style={styles.tabs}>
      <Button title="Profile" accessibilityLabel={tab === 'profile' ? 'Profile, selected' : 'Profile'} disabled={!active || busy || tab === 'profile'} onPress={() => navigate('profile')} color="#205847" />
      <Button title="My Ideas" accessibilityLabel={tab === 'ideas' ? 'My Ideas, selected' : 'My Ideas'} disabled={!active || busy || tab === 'ideas'} onPress={() => navigate('ideas')} color="#205847" />
    </View>
    {tab === 'profile' ? <ProfileScreen client={profiles} userId={userId} active={active} onAccessDenied={onAccessDenied} onSignOut={signOut} registerGuard={register} /> : <IdeaScreen client={ideas} userId={userId} active={active} onAccessDenied={onAccessDenied} onSignOut={signOut} registerGuard={register} />}
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, tabs: { flexDirection: 'row', gap: 20, paddingBottom: 8 } });
