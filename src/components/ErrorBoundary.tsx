/**
 * Error boundary — catches unhandled React errors and shows a recovery UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { YStack, Text } from 'tamagui';
import { AlertTriangle } from 'lucide-react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  private autoRecoverTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (!prevState.hasError && this.state.hasError) {
      this.autoRecoverTimer = setTimeout(() => {
        if (this.state.hasError) {
          this.handleReset();
        }
      }, 1500);
    }
  }

  componentWillUnmount() {
    if (this.autoRecoverTimer) {
      clearTimeout(this.autoRecoverTimer);
      this.autoRecoverTimer = null;
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <YStack flex={1} justifyContent="center" alignItems="center" padding={32} backgroundColor="#212121">
          <AlertTriangle size={48} color="#F59E0B" style={errStyles.icon} />
          <Text fontSize={20} fontWeight="600" color="#ECECEC" marginBottom={8}>Something went wrong</Text>
          <Text fontSize={16} color="#8E8EA0" textAlign="center" marginBottom={24}>The app encountered an unexpected error.</Text>
          {this.state.error && (
            <ScrollView style={errStyles.errorScroll} contentContainerStyle={errStyles.errorPad}>
              <Text fontSize={12} color="#F87171" fontFamily="monospace">{this.state.error.message}</Text>
            </ScrollView>
          )}
          <TouchableOpacity
            style={errStyles.resetBtn}
            onPress={this.handleReset}
            accessibilityLabel="Try again"
          >
            <Text color="$contrastText" fontSize={16} fontWeight="600">Try Again</Text>
          </TouchableOpacity>
        </YStack>
      );
    }

    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  icon: { marginBottom: 16 },
  errorScroll: { maxHeight: 120, width: '100%', backgroundColor: '#2F2F2F', borderRadius: 8, marginBottom: 24 },
  errorPad: { padding: 12 },
  resetBtn: { backgroundColor: '#10A37F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, minWidth: 120, alignItems: 'center' },
});
