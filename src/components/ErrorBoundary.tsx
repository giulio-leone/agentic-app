/**
 * Error boundary — catches unhandled React errors and shows a recovery UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

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

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>The app encountered an unexpected error.</Text>
          {this.state.error && (
            <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorContent}>
              <Text style={styles.errorText}>{this.state.error.message}</Text>
            </ScrollView>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#212121',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ECECEC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8EA0',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: '#2F2F2F',
    borderRadius: 8,
    marginBottom: 24,
  },
  errorContent: {
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#F87171',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#10A37F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
