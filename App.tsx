import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { AppNavigator } from './src/navigation';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  const scheme = useColorScheme();
  return (
    <ErrorBoundary>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </ErrorBoundary>
  );
}
