import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Button, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { RegisterGuard } from '../navigation';
import { IdeaClient } from './client';
import { IdeaController, initialState } from './controller';
import { audience, fields, statuses, type Field } from './model';
const labels: Record<Field, string> = { title: 'Title', summary: 'Summary', description: 'Description', neededSkills: 'Needed skills', tags: 'Tags', visibility: 'Visibility' };
const limits = { title: 120, summary: 280, description: 5000 };
export function IdeaScreen({ client, userId, active, onAccessDenied, onSignOut, registerGuard }: {
  client: IdeaClient; userId: string; active: boolean; onAccessDenied: (id: string) => void; onSignOut: () => void; registerGuard: RegisterGuard;
}) {
  const [state, setState] = useState(initialState);
  const manager = useRef<IdeaController | null>(null);
  const inputs = useRef<Partial<Record<Field, TextInput | null>>>({});
  const live = useRef(active); live.current = active;
  useEffect(() => {
    const controller = new IdeaController(client, userId, () => onAccessDenied(userId)); manager.current = controller;
    const unsubscribe = controller.subscribe(setState); void controller.list();
    return () => { unsubscribe(); controller.stop(); manager.current = null; };
  }, [client, userId, onAccessDenied]);
  const busy = !active || state.busy || !!state.confirmation;
  function discard(proceed: () => void) {
    if (busy) return;
    const current = manager.current;
    const safeProceed = () => { if (live.current && current && manager.current === current) proceed(); };
    if (state.dirty || state.uncertainCreate) Alert.alert('Discard unsaved changes?', state.uncertainCreate ? 'A saved copy may exist. Discarding only clears this local draft.' : 'Your unsaved idea changes will be lost.', [{ text: 'Keep draft', style: 'cancel' }, { text: 'Discard draft', style: 'destructive', onPress: safeProceed }]);
    else safeProceed();
  }
  useEffect(() => {
    registerGuard(proceed => {
      if (busy) return;
      const controller = manager.current;
      if (state.dirty || state.uncertainCreate) Alert.alert('Discard unsaved changes?', 'Leaving this screen clears your local draft. An uncertain save may already exist on the server.', [{ text: 'Stay here', style: 'cancel' }, { text: 'Discard and leave', style: 'destructive', onPress: () => { if (live.current && manager.current === controller) proceed(); } }]);
      else proceed();
    }, busy);
    return () => registerGuard(null);
  }, [registerGuard, busy, state.dirty, state.uncertainCreate]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active) return false;
      if (busy) return true;
      if (state.screen === 'form' || state.uncertainCreate) {
        const controller = manager.current;
        const proceed = () => { if (live.current && manager.current === controller) controller?.cancel(); };
        if (state.dirty || state.uncertainCreate) Alert.alert('Discard unsaved changes?', 'Your local draft will be cleared. An uncertain save may already exist.', [{ text: 'Keep draft', style: 'cancel' }, { text: 'Discard draft', style: 'destructive', onPress: proceed }]); else proceed();
        return true;
      }
      if (state.screen === 'detail') { void manager.current?.list(); return true; }
      return false;
    });
    return () => back.remove();
  }, [active, busy, state.screen, state.dirty, state.uncertainCreate]);
  async function save() {
    const controller = manager.current; await controller?.requestSave();
    const first = fields.find(field => controller?.snapshot.errors[field]); if (first) inputs.current[first]?.focus();
  }
  const idea = state.idea;
  const frozen = busy || state.needsReload || state.uncertainCreate;
  const confirmation = state.confirmation;
  const confirmationText = confirmation === 'archive' ? 'Archived ideas are visible only to you and cannot be edited or restored. This does not delete the idea.' : confirmation === 'share' ? 'Save these changes for signed-in members to read? Other members may already have seen earlier content.' : idea?.visibility === 'MEMBERS' ? 'Publish this idea for signed-in members to read?' : 'Publish privately? Only you will be able to read it until you explicitly change visibility.';
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text accessibilityRole="header" style={styles.title}>{state.screen === 'list' ? 'My Ideas' : state.screen === 'form' ? idea ? 'Edit idea' : 'New idea' : 'Your idea'}</Text>
      {state.busy && <ActivityIndicator accessibilityLabel="Loading or saving ideas" />}
      {!!state.message && <Text accessibilityLiveRegion="polite" style={styles.notice}>{state.message}</Text>}
      {state.screen === 'list' && <>
        <Text style={styles.hint}>Your drafts and archives stay private. Publishing keeps your chosen visibility.</Text>
        <View style={styles.row}>{([undefined, ...statuses] as const).map(status => <Button key={status ?? 'all'} title={status ? status.toLowerCase() : 'All'} accessibilityLabel={`${status ?? 'All'} ideas${state.filter === status ? ', selected' : ''}`} disabled={busy || state.filter === status} onPress={() => void manager.current?.list(status ?? 'ALL')} color="#205847" />)}</View>
        <Button title="New idea" disabled={busy || state.uncertainCreate} onPress={() => manager.current?.newDraft()} color="#205847" />
        <Button title="Refresh My Ideas" disabled={busy} onPress={() => void manager.current?.list()} color="#53645E" />
        {state.uncertainCreate && <View style={styles.card}><Text style={styles.body}>Check this list for the idea you just saved. Resubmitting could create a duplicate.</Text><Button title="Return to draft" disabled={busy} onPress={() => {
          const controller = manager.current;
          Alert.alert('Submit this draft again?', 'Only return to saving after checking that no saved copy exists. A duplicate is possible.', [{ text: 'Keep checking', style: 'cancel' }, { text: 'I checked; return to draft', onPress: () => { if (live.current && manager.current === controller) controller?.resumeDraft(); } }]);
        }} /></View>}
        {!state.busy && !state.items.length && !state.retry && <Text style={styles.body}>No ideas here yet. Start with a private draft.</Text>}
        {state.items.map(item => <View key={item.id} style={styles.card}>
          <Text style={styles.label}>{item.title}</Text><Text style={styles.badge}>{item.status.toLowerCase()} · {audience(item)}</Text>
          {!!item.summary && <Text style={styles.body}>{item.summary}</Text>}
          <Button title="View idea" accessibilityLabel={`View idea: ${item.title}`} disabled={busy} onPress={() => { if (state.uncertainCreate) discard(() => void manager.current?.open(item.id)); else void manager.current?.open(item.id); }} color="#205847" />
        </View>)}
        {state.cursor && <Button title="Load more ideas" disabled={busy} onPress={() => void manager.current?.list(state.filter, true)} />}
      </>}
      {state.screen === 'detail' && <>
        {idea && <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.label}>{idea.title}</Text><Text style={styles.badge}>{idea.status.toLowerCase()} · {audience(idea)}</Text>
          <Text selectable style={styles.body}>{idea.summary || 'No summary added'}</Text><Text selectable style={styles.body}>{idea.description || 'No description added'}</Text>
          <Text style={styles.label}>Needed skills</Text><Text selectable style={styles.body}>{idea.neededSkills.join(' · ') || 'None added'}</Text>
          <Text style={styles.label}>Tags</Text><Text selectable style={styles.body}>{idea.tags.join(' · ') || 'None added'}</Text>
          {idea.status === 'ARCHIVED' ? <Text style={styles.hint}>Archived · only you · read-only</Text> : <>
            <Button title="Edit idea" disabled={busy || state.needsReload} onPress={() => manager.current?.edit()} color="#205847" />
            {idea.status === 'DRAFT' && <Button title="Publish idea" disabled={busy || state.needsReload} onPress={() => manager.current?.requestAction('publish')} color="#205847" />}
            <Button title="Archive idea" disabled={busy || state.needsReload} onPress={() => manager.current?.requestAction('archive')} color="#53645E" />
          </>}
        </View>}
        {(idea || state.targetId) && <Button title="Reload saved idea" disabled={busy} onPress={() => void manager.current?.open(idea?.id ?? state.targetId!)} />}
        <Button title="Back to My Ideas" disabled={busy} onPress={() => void manager.current?.list()} color="#53645E" />
      </>}
      {state.screen === 'form' && <>
        {(['title', 'summary', 'description', 'neededSkills', 'tags'] as const).map(field => <View key={field} style={styles.card}>
          <Text style={styles.label}>{labels[field]}</Text><Text style={styles.hint}>{field === 'neededSkills' || field === 'tags' ? 'Up to 20 different entries, 1–50 characters each' : `${field === 'title' ? 'Required · ' : ''}Up to ${limits[field]} characters`}</Text>
          {field === 'neededSkills' || field === 'tags' ? <>
            {state.draft[field].map((value, index) => <View key={index} style={styles.row}>
              <TextInput ref={node => { if (index === 0) inputs.current[field] = node; }} accessibilityLabel={`${labels[field]} entry ${index + 1}`} value={value} editable={!frozen} multiline style={[styles.input, styles.grow]} onChangeText={next => manager.current?.change(field, state.draft[field].map((v, i) => i === index ? next : v))} />
              <Button title="Remove" accessibilityLabel={`Remove ${labels[field]} entry ${index + 1}`} disabled={frozen} onPress={() => manager.current?.change(field, state.draft[field].filter((_, i) => i !== index))} />
            </View>)}
            <Button title={`Add ${field === 'tags' ? 'tag' : 'needed skill'}`} disabled={frozen || state.draft[field].length >= 20} onPress={() => manager.current?.change(field, [...state.draft[field], ''])} />
          </> : <TextInput ref={node => { inputs.current[field] = node; }} accessibilityLabel={labels[field]} accessibilityHint={state.errors[field]} value={state.draft[field]} editable={!frozen} multiline={field !== 'title'} style={[styles.input, field !== 'title' && styles.multiline]} onChangeText={value => manager.current?.change(field, value)} />}
          {state.errors[field] && <Text style={styles.error} accessibilityLiveRegion="polite">{state.errors[field]}</Text>}
        </View>)}
        <View style={styles.card}><View style={styles.row}><Text style={[styles.body, styles.grow]}>Share with signed-in members when published</Text><Switch accessibilityLabel="Share with signed-in members when published" disabled={frozen} value={state.draft.visibility === 'MEMBERS'} onValueChange={value => manager.current?.change('visibility', value ? 'MEMBERS' : 'PRIVATE')} /></View>
          <Text style={styles.hint}>{idea?.status === 'PUBLISHED' ? state.draft.visibility === 'MEMBERS' ? 'Saving will share this content with members after confirmation.' : 'Saving makes the idea private. Previously seen copies cannot be recalled.' : 'Drafts are always visible only to you. Creating or saving never publishes.'}</Text>
          {state.errors.visibility && <Text style={styles.error}>{state.errors.visibility}</Text>}
        </View>
        {state.dirty && <Text style={styles.hint}>You have unsaved changes. Drafts are kept on this screen only.</Text>}
        <Button title={state.busy ? 'Saving…' : idea ? 'Save changes' : 'Save private draft'} disabled={frozen} onPress={() => void save()} color="#205847" />
        {state.uncertainCreate && <Button title="Check My Ideas for saved copy" disabled={busy} onPress={() => void manager.current?.list('ALL')} />}
        {state.needsReload && idea && <Button title="Discard draft and reload saved idea" disabled={busy} onPress={() => discard(() => void manager.current?.open(idea.id))} />}
        <Button title="Cancel editing" disabled={busy} onPress={() => discard(() => manager.current?.cancel())} color="#53645E" />
      </>}
      <Button title="Sign out" disabled={busy} onPress={() => discard(onSignOut)} color="#53645E" />
    </ScrollView>
    <Modal visible={!!confirmation && active} transparent animationType="fade" onRequestClose={() => manager.current?.cancelConfirmation()}>
      <View style={styles.overlay}><View style={styles.dialog} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.label}>{confirmation === 'archive' ? 'Archive idea?' : confirmation === 'share' ? 'Share saved changes?' : 'Publish idea?'}</Text>
        <Text style={styles.body}>{confirmationText}</Text>
        <Button title="Cancel" onPress={() => manager.current?.cancelConfirmation()} />
        <Button title={confirmation === 'archive' ? 'Confirm archive' : confirmation === 'share' ? 'Confirm share and save' : 'Confirm publish'} onPress={() => { if (live.current) void manager.current?.confirm(); }} color="#205847" />
      </View></View>
    </Modal>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, content: { paddingBottom: 36, gap: 16, width: '100%', maxWidth: 680, alignSelf: 'center' },
  title: { color: '#18362B', fontSize: 30, fontWeight: '700', paddingVertical: 12 }, label: { color: '#18362B', fontSize: 18, fontWeight: '600' },
  body: { color: '#263D34', fontSize: 16, lineHeight: 24 }, hint: { color: '#53645E', fontSize: 13, lineHeight: 19 }, badge: { color: '#205847', fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderColor: '#DCE5DF', borderWidth: 1, borderRadius: 16, padding: 18, gap: 12 },
  input: { borderColor: '#879C91', borderWidth: 1, borderRadius: 10, padding: 12, color: '#18362B', fontSize: 16, backgroundColor: '#FAFCFA' }, multiline: { minHeight: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, grow: { flex: 1 }, error: { color: '#A12C26', fontSize: 14 }, notice: { color: '#263D34', backgroundColor: '#EAF2EC', borderRadius: 12, padding: 16 },
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 24 }, dialog: { padding: 24, borderRadius: 16, gap: 16, backgroundColor: '#FFFFFF', width: '100%', maxWidth: 560, alignSelf: 'center' },
});
