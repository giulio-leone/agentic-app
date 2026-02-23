/**
 * useScreenWatcher — Core logic for the screen-watcher feature.
 * Extracts state, callbacks, animations, and service lifecycle.
 */

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { v4 as uuidv4 } from 'uuid';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { ScreenWatcherService } from '../services/ScreenWatcherService';
import { useAppStore } from '../stores/appStore';
import type { SmartCameraViewHandle } from '../components/camera/SmartCameraView';
import type { Attachment } from '../acp/models/types';

const service = new ScreenWatcherService();

/** Save capture to gallery (fire-and-forget). */
async function saveToGallery(uri: string) {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      await MediaLibrary.createAssetAsync(uri);
    }
  } catch (e) {
    console.warn('[ScreenWatcher] gallery save failed', e);
  }
}

/** Build attachment + send to LLM if remote is enabled. */
function sendCaptureToLLM(
  uri: string,
  base64: string,
  label: string,
  sendPrompt: (text: string, attachments: Attachment[]) => void,
) {
  const state = useAppStore.getState();
  if (!state.isRemoteLLMEnabled) return;

  const attachment: Attachment = {
    id: uuidv4(),
    name: `${label}.jpg`,
    mediaType: 'image/jpeg',
    uri,
    base64,
  };
  sendPrompt(`[${label}] ${state.customPrompt}`, [attachment]);
}

export function useScreenWatcher() {
  const cameraRef = useRef<SmartCameraViewHandle>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const lastCaptureTime = useRef<number>(0);
  const hasAutoStarted = useRef(false);

  const {
    screenWatcherVisible, setScreenWatcherVisible,
    isWatching, setWatching,
    watcherStatus, setWatcherStatus,
    captureCount, incrementCapture,
    isAutoMode, setAutoMode,
    zoomLevel, setZoomLevel,
    customPrompt, setCustomPrompt,
    isRemoteLLMEnabled, setRemoteLLMEnabled,
    setWatcherProcessing,
    sendPrompt,
    isStreaming,
    chatMessages,
    motionThreshold, stableThreshold,
    setMotionThreshold, setStableThreshold,
    autoStartVisionDetect,
  } = useAppStore();

  // Latest assistant message
  const latestAssistantMessage = useMemo(() => {
    const reversed = [...chatMessages].reverse();
    return reversed.find((m) => m.role === 'assistant');
  }, [chatMessages]);

  // ── Animations ──
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isWatching) {
      pulse.value = withRepeat(
        withTiming(1.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1, true,
      );
    } else {
      pulse.value = 1;
    }
  }, [isWatching, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerFlash = useCallback(() => {
    setFlashVisible(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashVisible(false), 150);
  }, []);
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  // Resume polling when LLM finishes
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (prevStreaming.current && !isStreaming && watcherStatus === 'processing') {
      service.processingComplete();
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, watcherStatus]);

  // ── Start / Stop ──
  const handleToggle = useCallback(async () => {
    if (isWatching) {
      service.stop();
      setWatching(false);
      setWatcherStatus('idle');
    } else {
      setWatching(true);
      await service.start({
        captureFrame: async () => {
          const result = await cameraRef.current?.captureFrame();
          return result ?? null;
        },
        onScreenChanged: async (base64, captureNumber) => {
          triggerFlash();
          incrementCapture();

          const dirUri = FileSystem.cacheDirectory + 'screen_watcher/';
          const dirInfo = await FileSystem.getInfoAsync(dirUri);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
          }
          const filePath = dirUri + `capture_${captureNumber}.jpg`;
          await FileSystem.writeAsStringAsync(filePath, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Fire-and-forget
          saveToGallery(filePath);
          sendCaptureToLLM(filePath, base64, `Screen Capture #${captureNumber}`, sendPrompt);
          base64 = '';
        },
        onStatusChange: (status) => {
          setWatcherStatus(status);
          setWatcherProcessing(status === 'processing');
        },
      });
    }
  }, [isWatching, setWatching, setWatcherStatus, incrementCapture, sendPrompt, setWatcherProcessing, triggerFlash]);

  // Auto-start on mount
  useEffect(() => {
    if (!hasAutoStarted.current && autoStartVisionDetect && !isWatching) {
      hasAutoStarted.current = true;
      const timer = setTimeout(() => {
        setScreenWatcherVisible(true);
        handleToggle();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStartVisionDetect, isWatching, setScreenWatcherVisible, handleToggle]);

  // Cleanup
  useEffect(() => {
    return () => { if (service.status !== 'idle') service.stop(); };
  }, []);

  const handleClose = useCallback(() => {
    if (isWatching) {
      service.stop();
      setWatching(false);
      setWatcherStatus('idle');
    }
    setScreenWatcherVisible(false);
  }, [isWatching, setWatching, setWatcherStatus, setScreenWatcherVisible]);

  // Scene changed (auto mode) callback for SmartCameraView
  const handleSceneChanged = useCallback(async () => {
    if (!isAutoMode || !isWatching || watcherStatus === 'processing') return;
    if (Date.now() - lastCaptureTime.current < 5000) return;
    lastCaptureTime.current = Date.now();

    const result = await cameraRef.current?.captureFrame();
    if (!result) return;

    triggerFlash();
    incrementCapture();

    saveToGallery(result.uri);
    sendCaptureToLLM(result.uri, result.base64, 'Auto Scene Change Capture', sendPrompt);
    (result as { base64: string }).base64 = '';
  }, [isAutoMode, isWatching, watcherStatus, triggerFlash, incrementCapture, sendPrompt]);

  // Bluetooth shutter callback
  const handleShutterPressed = useCallback(async () => {
    if (!isWatching || watcherStatus === 'processing') return;

    const result = await cameraRef.current?.captureFrame();
    if (!result) return;

    triggerFlash();
    incrementCapture();

    saveToGallery(result.uri);
    sendCaptureToLLM(result.uri, result.base64, 'Manual Bluetooth Capture', sendPrompt);
    (result as { base64: string }).base64 = '';
  }, [isWatching, watcherStatus, triggerFlash, incrementCapture, sendPrompt]);

  return {
    cameraRef,
    showSettings, setShowSettings,
    flashVisible,
    // Store state
    screenWatcherVisible,
    isWatching, watcherStatus,
    captureCount,
    isAutoMode, setAutoMode,
    zoomLevel, setZoomLevel,
    customPrompt, setCustomPrompt,
    isRemoteLLMEnabled, setRemoteLLMEnabled,
    motionThreshold, stableThreshold,
    setMotionThreshold, setStableThreshold,
    latestAssistantMessage,
    // Animations
    pulseStyle,
    // Handlers
    handleToggle,
    handleClose,
    handleSceneChanged,
    handleShutterPressed,
  };
}
