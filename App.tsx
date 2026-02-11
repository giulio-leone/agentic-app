import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { AppNavigator } from './src/navigation';

export default function App() {
  const scheme = useColorScheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}
