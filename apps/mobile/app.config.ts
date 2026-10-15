import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => {
  const redirect = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URI;
  // Register only the owner-provided scheme; missing config never invents a URI.
  const scheme = redirect ? new URL(redirect).protocol.slice(0, -1) : undefined;
  if (scheme && ['http', 'https', 'exp', 'exps', 'file', 'javascript', 'data'].includes(scheme)) throw new Error('An approved native redirect scheme is required');
  return { ...config, name: 'EntrCollab', slug: 'entrcollab', scheme, plugins: ['expo-secure-store', 'expo-web-browser'] };
};
