import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return <View style={styles.container}><Text accessibilityRole="header">EntrCollab</Text><Text>Engineering foundation</Text><StatusBar style="auto" /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
