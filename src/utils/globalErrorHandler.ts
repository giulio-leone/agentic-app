/**
 * Global error handler — catches unhandled JS errors and promise rejections.
 * Logs to developer console, shows toast feedback, and auto-restarts on fatal crashes.
 */

import { showErrorToast } from './toast';
import RNRestart from 'react-native-restart';

let initialized = false;

/** Delay before auto-restart on fatal crash (ms) */
const FATAL_RESTART_DELAY = 1500;

export function setupGlobalErrorHandler(): void {
  if (initialized) return;
  initialized = true;

  // Unhandled promise rejections
  const g = globalThis as typeof globalThis & {
    onunhandledrejection?: (event: { reason: unknown }) => void;
    ErrorUtils?: {
      getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  };
  const originalHandler = g.onunhandledrejection;
  g.onunhandledrejection = (event: { reason: unknown }) => {
    const message = event?.reason instanceof Error
      ? event.reason.message
      : String(event?.reason ?? 'Unknown rejection');
    console.warn('[UnhandledRejection]', message);
    showErrorToast('Unhandled Error', message);
    originalHandler?.(event);
  };

  // React Native global error handler
  const ErrorUtils = g.ErrorUtils;
  if (ErrorUtils) {
    const prevHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      console.error(`[GlobalError] ${isFatal ? 'FATAL' : 'non-fatal'}:`, error.message);
      if (isFatal) {
        // Auto-restart on fatal crash after brief delay
        setTimeout(() => RNRestart.restart(), FATAL_RESTART_DELAY);
      } else {
        showErrorToast('Error', error.message);
      }
      prevHandler?.(error, isFatal);
    });
  }
}
