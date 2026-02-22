/**
 * Global error handler — catches unhandled JS errors and promise rejections.
 * Logs to developer console and optionally shows toast feedback.
 */

import { showErrorToast } from './toast';

let initialized = false;

export function setupGlobalErrorHandler(): void {
  if (initialized) return;
  initialized = true;

  // Unhandled promise rejections
  const originalHandler = (globalThis as any).onunhandledrejection;
  (globalThis as any).onunhandledrejection = (event: { reason: unknown }) => {
    const message = event?.reason instanceof Error
      ? event.reason.message
      : String(event?.reason ?? 'Unknown rejection');
    console.warn('[UnhandledRejection]', message);
    showErrorToast('Unhandled Error', message);
    originalHandler?.(event);
  };

  // React Native global error handler (non-fatal)
  const ErrorUtils = (globalThis as any).ErrorUtils;
  if (ErrorUtils) {
    const prevHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      console.error(`[GlobalError] ${isFatal ? 'FATAL' : 'non-fatal'}:`, error.message);
      if (!isFatal) {
        showErrorToast('Error', error.message);
      }
      prevHandler?.(error, isFatal);
    });
  }
}
