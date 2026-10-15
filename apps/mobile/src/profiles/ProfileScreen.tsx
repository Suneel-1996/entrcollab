import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ProfileClient } from './client';
import { ProfileController, type ProfileState } from './controller';
import { emptyDraft, fields, type Field } from './model';

const labels: Record<Field, string> = { displayName: 'Display name', bio: 'About you', skills: 'Skills', interests: 'Interests', availability: 'Availability' };
const hints: Record<Field, string> = { displayName: 'Required · up to 80 characters', bio: 'What would you like people to know? Up to 2,000 characters.', skills: 'Up to 20 skills, with 50 characters each', interests: 'Up to 20 interests, with 50 characters each', availability: 'For example, a few hours on weekends · up to 200 characters' };
const initialState: ProfileState = { phase: 'loading', profile: null, draft: emptyDraft(), errors: {}, dirty: false };
export function ProfileScreen({ client, userId, active, onAccessDenied, onSignOut }: {
  client: ProfileClient; userId: string; active: boolean; onAccessDenied: (userId: string) => void; onSignOut: () => void;
}) {
  const [state, setState] = useState<ProfileState>(initialState);
  const manager = useRef<ProfileController | null>(null);
  const inputs = useRef<Partial<Record<Field, TextInput | null>>>({});
  useEffect(() => {
    const controller = new ProfileController(client, userId, () => onAccessDenied(userId));
    manager.current = controller;
    const unsubscribe = controller.subscribe(setState); void controller.load();
    return () => { unsubscribe(); controller.stop(); manager.current = null; };
  }, [client, userId, onAccessDenied]);
  const busy = !active || state.phase === 'loading' || state.phase === 'saving';
  const editing = state.phase === 'edit' || state.phase === 'saving';
  function confirmDiscard(action: () => void) {
    if (state.dirty) Alert.alert('Discard unsaved changes?', 'Your unsaved profile changes will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard changes', style: 'destructive', onPress: action }]);
    else action();
  }
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active) return false;
      if (state.phase === 'saving') return true;
      if (state.phase !== 'edit' || !state.profile) return false;
      if (state.dirty) Alert.alert('Discard unsaved changes?', 'Your unsaved profile changes will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard changes', style: 'destructive', onPress: () => manager.current?.cancel() }]);
      else manager.current?.cancel();
      return true;
    });
    return () => back.remove();
  }, [active, state.phase, state.profile, state.dirty]);
  async function save() {
    const current = manager.current; await current?.save();
    const firstError = fields.find(field => current?.snapshot.errors[field]);
    if (firstError) inputs.current[firstError]?.focus();
  }
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>YOUR SPACE</Text>
        <Text accessibilityRole="header" style={styles.title}>{editing ? state.profile ? 'Edit your profile' : 'Let’s introduce you' : 'Your profile'}</Text>
        <Text style={styles.subtitle}>{editing ? 'Start with what you want to share. Everything is private unless you choose otherwise.' : 'A little about you, shared on your terms.'}</Text>
      </View>
      {state.phase === 'loading' && <View style={styles.card}><ActivityIndicator accessibilityLabel="Loading your profile" /><Text style={styles.body}>Loading your profile…</Text></View>}
      {state.message && <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.body}>{state.message}</Text></View>}
      {state.phase === 'loadError' && <Button title="Retry loading profile" disabled={busy} onPress={() => void manager.current?.load()} />}
      {editing && <>
        {fields.map(field => <View key={field} style={styles.card}>
          <Text style={styles.label}>{labels[field]}</Text>
          <Text style={styles.hint}>{hints[field]}</Text>
          {field === 'skills' || field === 'interests' ? <>
            {state.draft[field].map((value, index) => <View key={index} style={styles.tagRow}>
              <TextInput ref={input => { if (index === 0) inputs.current[field] = input; }} accessibilityLabel={`${labels[field]} entry ${index + 1}`} value={value} editable={!busy} multiline
                onChangeText={next => manager.current?.tags(field, state.draft[field].map((entry, i) => i === index ? next : entry))} style={[styles.input, styles.tagInput, state.errors[field] && styles.invalid]} />
              <Button title="Remove" accessibilityLabel={`Remove ${labels[field].toLowerCase()} entry ${index + 1}`} disabled={busy} onPress={() => manager.current?.tags(field, state.draft[field].filter((_, i) => i !== index))} color="#53645E" />
            </View>)}
            <Button title={field === 'skills' ? 'Add a skill' : 'Add an interest'} disabled={busy || state.draft[field].length >= 20} onPress={() => manager.current?.tags(field, [...state.draft[field], ''])} color="#205847" />
          </> : <TextInput ref={input => { inputs.current[field] = input; }} accessibilityLabel={labels[field]} accessibilityHint={state.errors[field] ?? hints[field]}
            value={state.draft[field]} editable={!busy} onChangeText={value => manager.current?.change(field, value)}
            multiline={field !== 'displayName'} autoCapitalize="sentences" style={[styles.input, field !== 'displayName' && styles.multiline, state.errors[field] && styles.invalid]} />}
          {state.errors[field] && <Text accessibilityLiveRegion="polite" style={styles.error}>{state.errors[field]}</Text>}
          <View style={styles.visibility}>
            <View style={styles.visibilityText}><Text style={styles.sharing}>Share with signed-in members</Text><Text style={styles.hint}>{state.draft.visibility[field] === 'MEMBERS' ? 'Members can see this field.' : 'Only you can see this field.'}</Text></View>
            <Switch accessibilityLabel={`Share ${labels[field].toLowerCase()} with signed-in members`} disabled={busy}
              value={state.draft.visibility[field] === 'MEMBERS'} onValueChange={value => manager.current?.visibility(field, value ? 'MEMBERS' : 'PRIVATE')} trackColor={{ false: '#CCD6D3', true: '#286656' }} thumbColor="#FFFFFF" />
          </View>
        </View>)}
        {state.dirty && <Text style={styles.hint}>You have unsaved changes.</Text>}
        {state.phase === 'saving' && <ActivityIndicator accessibilityLabel="Saving your profile" />}
        <Button title={state.phase === 'saving' ? 'Saving…' : state.profile ? 'Save changes' : 'Create profile'} disabled={busy} onPress={() => void save()} color="#205847" />
        {state.profile && <Button title="Cancel editing" disabled={busy} onPress={() => confirmDiscard(() => manager.current?.cancel())} color="#53645E" />}
        {state.message && <Button title="Reload saved profile" disabled={busy} onPress={() => confirmDiscard(() => void manager.current?.load())} color="#53645E" />}
      </>}
      {state.phase === 'view' && state.profile && <>
        {fields.map(field => <View key={field} style={styles.card}>
          <View style={styles.summaryHeading}><Text style={styles.label}>{labels[field]}</Text><Text style={styles.badge}>{state.profile!.visibility[field] === 'MEMBERS' ? 'Members' : 'Only you'}</Text></View>
          <Text selectable style={styles.body}>{Array.isArray(state.profile![field]) ? state.profile![field].join(' · ') || 'Not added' : state.profile![field] || 'Not added'}</Text>
        </View>)}
        <Button title="Edit profile" disabled={busy} onPress={() => manager.current?.edit()} color="#205847" />
      </>}
      <View style={styles.footer}><Button title="Sign out" disabled={busy} onPress={() => confirmDiscard(onSignOut)} color="#53645E" /><Text style={styles.hint}>Unsaved changes stay on this screen only.</Text></View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, content: { paddingBottom: 36, gap: 16, width: '100%', maxWidth: 680, alignSelf: 'center' },
  heading: { gap: 8, paddingVertical: 12 }, eyebrow: { color: '#286656', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#18362B', fontSize: 30, fontWeight: '700' }, subtitle: { color: '#53645E', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#FFFFFF', borderColor: '#DCE5DF', borderWidth: 1, borderRadius: 16, padding: 18, gap: 10 },
  label: { color: '#18362B', fontSize: 17, fontWeight: '600' }, hint: { color: '#53645E', fontSize: 13, lineHeight: 19 },
  body: { color: '#263D34', fontSize: 16, lineHeight: 24 }, input: { borderColor: '#879C91', borderWidth: 1, borderRadius: 10, padding: 12, color: '#18362B', fontSize: 16, backgroundColor: '#FAFCFA' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, tagInput: { flex: 1 },
  multiline: { minHeight: 92, textAlignVertical: 'top' }, invalid: { borderColor: '#AD362F', borderWidth: 2 }, error: { color: '#A12C26', fontSize: 14 },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 }, visibilityText: { flex: 1, gap: 4 }, sharing: { color: '#263D34', fontSize: 14, fontWeight: '500' },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }, badge: { color: '#205847', backgroundColor: '#EAF2EC', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, fontSize: 12 },
  notice: { backgroundColor: '#EAF2EC', borderRadius: 12, padding: 16 }, footer: { borderTopWidth: 1, borderColor: '#DCE5DF', paddingTop: 12, gap: 8 },
});
