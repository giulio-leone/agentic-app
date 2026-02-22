/**
 * Toast service — non-blocking feedback using react-native-toast-message.
 */

import Toast from 'react-native-toast-message';

const MAX_TEXT_LENGTH = 120;

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;
}

export function showSuccessToast(title: string, message?: string): void {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message ? truncate(message) : undefined,
    visibilityTime: 2500,
    topOffset: 60,
  });
}

export function showErrorToast(title: string, message?: string): void {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message ? truncate(message) : undefined,
    visibilityTime: 4000,
    topOffset: 60,
  });
}

export function showInfoToast(title: string, message?: string): void {
  Toast.show({
    type: 'info',
    text1: title,
    text2: message ? truncate(message) : undefined,
    visibilityTime: 3000,
    topOffset: 60,
  });
}
