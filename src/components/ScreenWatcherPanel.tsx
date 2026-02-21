/**
 * ScreenWatcherPanel — Full-screen modal UI for the screen-watcher feature.
 * Shows camera preview (with zoom), controls (start/stop), status indicator,
 * zoom slider, and wires everything to ScreenWatcherService + Zustand store.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
    Modal,
    StyleSheet,
    TouchableOpacity,
    Platform,
    TextInput,
    useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, ScrollView, Slider } from 'tamagui';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { v4 as uuidv4 } from 'uuid';
import * as FileSystem from 'expo-file-system/legacy';
import { SmartCameraView, type SmartCameraViewHandle } from './camera/SmartCameraView';
import { MarkdownContent } from './chat/MarkdownContent';
import { ScreenWatcherService, type WatcherStatus } from '../services/ScreenWatcherService';
import * as MediaLibrary from 'expo-media-library';
import { useAppStore } from '../stores/appStore';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing, Radius } from '../utils/theme';
import { Settings, X, Square, Play, Eye, Brain } from 'lucide-react-native';
import type { Attachment } from '../acp/models/types';

// Single service instance
const service = new ScreenWatcherService();

const STATUS_LABELS: Record<WatcherStatus, { icon: React.ReactNode; label: string; color: string }> = {
    idle: { icon: <Square size={12} color="#6B7280" />, label: 'Ready', color: '#6B7280' },
    loading_model: { icon: <Brain size={12} color="#8B5CF6" />, label: 'Loading AI...', color: '#8B5CF6' },
    watching: { icon: <Eye size={12} color="#10A37F" />, label: 'Watching...', color: '#10A37F' },
    change_detected: { icon: null, label: 'Change detected!', color: '#F59E0B' },
    stabilizing: { icon: null, label: 'Capturing...', color: '#3B82F6' },
    processing: { icon: <Brain size={12} color="#8B5CF6" />, label: 'Processing...', color: '#8B5CF6' },
};

export const ScreenWatcherPanel = React.memo(function ScreenWatcherPanel() {
    const { colors, dark } = useDesignSystem();
    const { width, height } = useWindowDimensions();
    const cameraRef = useRef<SmartCameraViewHandle>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [flashVisible, setFlashVisible] = useState(false);
    const lastCaptureTime = useRef<number>(0);

    const {
        screenWatcherVisible,
        setScreenWatcherVisible,
        isWatching,
        setWatching,
        watcherStatus,
        setWatcherStatus,
        captureCount,
        incrementCapture,
        isAutoMode,
        setAutoMode,
        zoomLevel,
        setZoomLevel,
        customPrompt,
        setCustomPrompt,
        isRemoteLLMEnabled,
        setRemoteLLMEnabled,
        setWatcherProcessing,
        sendPrompt,
        isStreaming,
        chatMessages,
        motionThreshold,
        stableThreshold,
        setMotionThreshold,
        setStableThreshold,
        autoStartVisionDetect,
    } = useAppStore();

    // Find the latest assistant message
    const latestAssistantMessage = React.useMemo(() => {
        const reversed = [...chatMessages].reverse();
        return reversed.find((m) => m.role === 'assistant');
    }, [chatMessages]);

    // Pulsing animation for status dot
    const pulse = useSharedValue(1);
    useEffect(() => {
        if (isWatching) {
            pulse.value = withRepeat(
                withTiming(1.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true,
            );
        } else {
            pulse.value = 1;
        }
    }, [isWatching, pulse]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    // Flash effect on capture
    const triggerFlash = useCallback(() => {
        setFlashVisible(true);
        setTimeout(() => setFlashVisible(false), 150);
    }, []);

    // When LLM finishes streaming, tell the service to resume polling
    const prevStreaming = useRef(isStreaming);
    useEffect(() => {
        if (prevStreaming.current && !isStreaming && watcherStatus === 'processing') {
            service.processingComplete();
        }
        prevStreaming.current = isStreaming;
    }, [isStreaming, watcherStatus]);



    // Start/Stop handler
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

                    // Save to temp dir to avoid flooding AsyncStorage
                    const dirUri = FileSystem.cacheDirectory + 'screen_watcher/';
                    const dirInfo = await FileSystem.getInfoAsync(dirUri);
                    if (!dirInfo.exists) {
                        await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
                    }
                    const filePath = dirUri + `capture_${captureNumber}.jpg`;
                    await FileSystem.writeAsStringAsync(filePath, base64, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    // Build attachment — URI points to temp file, base64 kept only for AI
                    const attachment: Attachment = {
                        id: uuidv4(),
                        name: `screen_capture_${captureNumber}.jpg`,
                        mediaType: 'image/jpeg',
                        uri: filePath,
                        base64,
                    };

                    // Release the large string from the local scope variable right after we copy it into the attachment
                    // This helps mitigate the V8 or Hermes out-of-memory crashes on repeated snaps
                    base64 = '';

                    // FIRE AND FORGET ASYNC: Do not block the camera thread
                    const processCaptureAsync = async () => {
                        try {
                            const { status } = await MediaLibrary.requestPermissionsAsync();
                            if (status === 'granted') {
                                // Save to the user's native phone gallery
                                await MediaLibrary.createAssetAsync(filePath);
                                console.log('[ScreenWatcherPanel] Captured frame saved to gallery async');
                            }

                            if (useAppStore.getState().isRemoteLLMEnabled) {
                                const prompt = useAppStore.getState().customPrompt;
                                sendPrompt(
                                    `[Screen Capture #${captureNumber}] ${prompt}`,
                                    [attachment],
                                );
                            }
                        } catch (e) {
                            console.error("[ScreenWatcherPanel] Async Process Failed:", e);
                        }
                    };

                    // Execute without awaiting
                    processCaptureAsync();
                },
                onStatusChange: (status) => {
                    setWatcherStatus(status);
                    if (status === 'processing') {
                        setWatcherProcessing(true);
                    } else if (status === 'watching') {
                        setWatcherProcessing(false);
                    }
                },
            });
        }
    }, [isWatching, setWatching, setWatcherStatus, incrementCapture, sendPrompt, setWatcherProcessing, triggerFlash]);

    // Internal ref to prevent auto-starting multiple times
    const hasAutoStarted = useRef(false);

    // Auto-start logic on initial mount
    useEffect(() => {
        if (!hasAutoStarted.current && autoStartVisionDetect && !isWatching) {
            hasAutoStarted.current = true;
            // Delay slightly to allow the UI and Camera to mount properly
            setTimeout(() => {
                setScreenWatcherVisible(true);
                handleToggle();
            }, 500);
        }
    }, [autoStartVisionDetect, isWatching, setScreenWatcherVisible, handleToggle]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (service.status !== 'idle') {
                service.stop();
            }
        };
    }, []);

    const handleClose = useCallback(() => {
        if (isWatching) {
            service.stop();
            setWatching(false);
            setWatcherStatus('idle');
        }
        setScreenWatcherVisible(false);
    }, [isWatching, setWatching, setWatcherStatus, setScreenWatcherVisible]);

    const statusInfo = STATUS_LABELS[watcherStatus];
    const cameraH = Math.round(height * 0.45);
    const cameraW = Math.round(width - 32);

    return (
        <Modal
            visible={screenWatcherVisible}
            animationType="slide"
            presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
            onRequestClose={handleClose}
        >
            <YStack flex={1} backgroundColor={dark ? '#0F0F0F' : '#F5F5F5'}>
                {/* Header */}
                <XStack
                    paddingHorizontal={Spacing.lg}
                    paddingTop={Platform.OS === 'ios' ? 56 : Spacing.lg}
                    paddingBottom={Spacing.md}
                    alignItems="center"
                    justifyContent="space-between"
                    backgroundColor={dark ? '#1A1A1A' : '#FFFFFF'}
                >
                    <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <XStack alignItems="center" gap={4}>
                            <X size={16} color={colors.primary} />
                            <Text fontSize={FontSize.body} color={colors.primary} fontWeight="600">
                                Close
                            </Text>
                        </XStack>
                    </TouchableOpacity>
                    <Text fontSize={FontSize.headline} fontWeight="700" color={colors.text}>
                        Screen Watcher
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowSettings(!showSettings)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Settings size={20} color={colors.text} />
                    </TouchableOpacity>
                </XStack>

                <ScrollView flex={1} contentContainerStyle={{ paddingBottom: 40 }}>
                    {/* Camera Preview */}
                    <YStack paddingHorizontal={Spacing.lg} paddingTop={Spacing.md}>
                        <YStack borderRadius={20} overflow="hidden" elevation={8}>
                            <SmartCameraView
                                ref={cameraRef}
                                zoom={zoomLevel}
                                size={{ width: cameraW, height: cameraH }}
                                showFlash={flashVisible}
                                enableAutoDetection={isWatching}
                                motionThreshold={motionThreshold}
                                stableThreshold={stableThreshold}
                                onSceneChanged={async () => {
                                    // Only auto-capture if auto mode is enabled
                                    if (isAutoMode && isWatching && watcherStatus !== 'processing') {
                                        // 5-SECOND COOLDOWN DEBOUNCE
                                        if (Date.now() - lastCaptureTime.current < 5000) {
                                            console.log('[ScreenWatcherPanel] Auto mode skipped: recovering from previous capture cooldown (5s)');
                                            return;
                                        }
                                        lastCaptureTime.current = Date.now();

                                        console.log('Scene changed detected by SmartCameraView (Auto Mode)');
                                        const result = await cameraRef.current?.captureFrame();
                                        if (result) {
                                            triggerFlash();
                                            incrementCapture();

                                            // FIRE AND FORGET ASYNC: Do not block the camera thread
                                            const processAutoCaptureAsync = async () => {
                                                try {
                                                    const { status } = await MediaLibrary.requestPermissionsAsync();
                                                    if (status === 'granted') {
                                                        // Save to the user's native phone gallery
                                                        await MediaLibrary.createAssetAsync(result.uri);
                                                        console.log('[ScreenWatcherPanel] Auto mode captured frame saved to gallery async');
                                                    }

                                                    if (isRemoteLLMEnabled) {
                                                        const attachment: Attachment = {
                                                            id: uuidv4(),
                                                            name: `auto_capture.jpg`,
                                                            mediaType: 'image/jpeg',
                                                            uri: result.uri,
                                                            base64: result.base64,
                                                        };

                                                        // Explicitly remove base64 from the source dictionary so it can be GC'ed
                                                        delete (result as any).base64;

                                                        const prompt = useAppStore.getState().customPrompt;
                                                        sendPrompt(`[Auto Scene Change Capture] ${prompt}`, [attachment]);
                                                    }
                                                } catch (e) {
                                                    console.error("[ScreenWatcherPanel] Auto mode async process failed", e);
                                                }
                                            };

                                            // Execute without awaiting
                                            processAutoCaptureAsync();
                                        }
                                    }
                                }}
                                onShutterPressed={async () => {
                                    if (isWatching && watcherStatus !== 'processing') {
                                        console.log('Bluetooth remote shutter pressed');
                                        // We can perform an instant capture and send to LLM
                                        const result = await cameraRef.current?.captureFrame();
                                        if (result) {
                                            // Trigger flash & send
                                            triggerFlash();
                                            incrementCapture();

                                            // FIRE AND FORGET ASYNC: Do not block the camera thread
                                            const processManualCaptureAsync = async () => {
                                                try {
                                                    const { status } = await MediaLibrary.requestPermissionsAsync();
                                                    if (status === 'granted') {
                                                        // Save to the user's native phone gallery
                                                        await MediaLibrary.createAssetAsync(result.uri);
                                                        console.log('[ScreenWatcherPanel] Manual mode captured frame saved to gallery async');
                                                    }

                                                    if (isRemoteLLMEnabled) {
                                                        const attachment: Attachment = {
                                                            id: uuidv4(),
                                                            name: `manual_capture.jpg`,
                                                            mediaType: 'image/jpeg',
                                                            uri: result.uri,
                                                            base64: result.base64,
                                                        };

                                                        // Explicitly remove base64 from the source dictionary so it can be GC'ed
                                                        delete (result as any).base64;

                                                        const prompt = useAppStore.getState().customPrompt;
                                                        sendPrompt(`[Manual Bluetooth Capture] ${prompt}`, [attachment]);
                                                    }
                                                } catch (e) {
                                                    console.error("[ScreenWatcherPanel] Manual mode async process failed", e);
                                                }
                                            };

                                            // Execute without awaiting
                                            processManualCaptureAsync();
                                        }
                                    }
                                }}
                            />
                        </YStack>
                    </YStack>

                    {/* Status Badge */}
                    <XStack
                        justifyContent="center"
                        alignItems="center"
                        gap={Spacing.sm}
                        paddingVertical={Spacing.md}
                    >
                        <Animated.View
                            style={[
                                pulseStyle,
                                {
                                    width: 12,
                                    height: 12,
                                    borderRadius: 6,
                                    backgroundColor: statusInfo.color,
                                },
                            ]}
                        />
                        {statusInfo.icon}
                        <Text fontSize={FontSize.body} fontWeight="600" color={statusInfo.color}>
                            {statusInfo.label}
                        </Text>
                        {captureCount > 0 && (
                            <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
                                ({captureCount} captures)
                            </Text>
                        )}
                    </XStack>



                    {/* Latest Cloud LLM Response Overlay */}
                    {isRemoteLLMEnabled && latestAssistantMessage && captureCount > 0 && (
                        <YStack
                            marginHorizontal={Spacing.lg}
                            marginBottom={Spacing.md}
                            padding={Spacing.md}
                            borderRadius={12}
                            backgroundColor={dark ? '#1A1A1A' : '#FFFFFF'}
                            elevation={2}
                            shadowColor="#000"
                            shadowOffset={{ width: 0, height: 2 }}
                            shadowOpacity={0.1}
                            shadowRadius={4}
                            borderWidth={1}
                            borderColor={dark ? '#333' : '#E5E7EB'}
                        >
                            <Text fontSize={FontSize.caption} fontWeight="600" color={colors.primary} marginBottom={Spacing.xs}>
                                ☁️ Remote AI Response
                            </Text>
                            <MarkdownContent content={latestAssistantMessage.content} colors={colors} />
                        </YStack>
                    )}

                    {/* Hardware Optical Zoom */}
                    <YStack paddingHorizontal={Spacing.xl} gap={Spacing.md}>
                        <XStack justifyContent="space-between" alignItems="center">
                            <Text fontSize={FontSize.footnote} fontWeight="600" color={colors.textSecondary}>
                                🔍 Hardware Optical Zoom
                            </Text>
                            <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="bold">
                                {zoomLevel.toFixed(1)}x
                            </Text>
                        </XStack>

                        {/* Optical Lens buttons */}
                        <XStack justifyContent="center" gap={Spacing.md}>
                            {[0.6, 1.0, 3.0, 5.0, 10.0].map((z) => (
                                <TouchableOpacity
                                    key={z}
                                    style={[
                                        styles.zoomBtn,
                                        {
                                            flex: 1,
                                            backgroundColor:
                                                Math.abs(zoomLevel - z) < 0.01
                                                    ? colors.primary
                                                    : dark
                                                        ? '#2F2F2F'
                                                        : '#E5E7EB',
                                        },
                                    ]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setZoomLevel(z);
                                    }}
                                >
                                    <Text
                                        fontSize={FontSize.caption}
                                        fontWeight="600"
                                        color={
                                            Math.abs(zoomLevel - z) < 0.01 ? '#FFF' : colors.text
                                        }
                                    >
                                        {z === 0.6 ? '.6x' : `${z}x`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </XStack>
                    </YStack>

                    {/* Start / Stop Button */}
                    <YStack paddingHorizontal={Spacing.xl} paddingTop={Spacing.lg}>
                        <TouchableOpacity
                            style={[
                                styles.mainButton,
                                {
                                    backgroundColor: isWatching ? '#EF4444' : colors.primary,
                                },
                            ]}
                            onPress={handleToggle}
                            activeOpacity={0.8}
                        >
                            <XStack alignItems="center" justifyContent="center" gap={8}>
                                {isWatching ? <Square size={18} fill="#FFFFFF" color="#FFFFFF" /> : <Play size={18} fill="#FFFFFF" color="#FFFFFF" />}
                                <Text fontSize={FontSize.title3} color="#FFFFFF" fontWeight="700">
                                    {isWatching ? 'Stop Watching' : 'Start Watching'}
                                </Text>
                            </XStack>
                        </TouchableOpacity>
                    </YStack>

                    {/* Settings Panel (collapsible) */}
                    {showSettings && (
                        <YStack
                            paddingHorizontal={Spacing.xl}
                            paddingTop={Spacing.lg}
                            gap={Spacing.md}
                        >
                            <XStack justifyContent="space-between" alignItems="center" paddingBottom={Spacing.sm}>
                                <Text fontSize={FontSize.body} fontWeight="600" color={colors.text}>
                                    Modalità Auto-Scatto
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.autoSwitch,
                                        { backgroundColor: isAutoMode ? colors.primary : dark ? '#2F2F2F' : '#E5E7EB' }
                                    ]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setAutoMode(!isAutoMode);
                                    }}
                                >
                                    <Text fontSize={FontSize.footnote} fontWeight="600" color={isAutoMode ? '#FFF' : colors.text}>
                                        {isAutoMode ? 'ON' : 'OFF'}
                                    </Text>
                                </TouchableOpacity>
                            </XStack>

                            <XStack justifyContent="space-between" alignItems="center" paddingBottom={Spacing.sm}>
                                <Text fontSize={FontSize.body} fontWeight="600" color={colors.text}>
                                    Abilita Chiamata Cloud (Remote LLM)
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.autoSwitch,
                                        { backgroundColor: isRemoteLLMEnabled ? colors.primary : dark ? '#2F2F2F' : '#E5E7EB' }
                                    ]}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setRemoteLLMEnabled(!isRemoteLLMEnabled);
                                    }}
                                >
                                    <Text fontSize={FontSize.footnote} fontWeight="600" color={isRemoteLLMEnabled ? '#FFF' : colors.text}>
                                        {isRemoteLLMEnabled ? 'ON' : 'OFF'}
                                    </Text>
                                </TouchableOpacity>
                            </XStack>

                            {/* Sensitivity Controls */}
                            <YStack gap={Spacing.xs} paddingTop={Spacing.sm}>
                                <XStack justifyContent="space-between" alignItems="center">
                                    <Text fontSize={FontSize.footnote} fontWeight="600" color={colors.text}>
                                        Soglia Movimento (Cattura testi)
                                    </Text>
                                    <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="bold">
                                        {motionThreshold.toFixed(1)}
                                    </Text>
                                </XStack>
                                <Slider
                                    defaultValue={[motionThreshold]}
                                    min={0.1}
                                    max={3.0}
                                    step={0.1}
                                    onValueChange={(val) => setMotionThreshold(val[0])}
                                >
                                    <Slider.Track backgroundColor={dark ? '#333' : '#E5E7EB'}>
                                        <Slider.TrackActive backgroundColor={colors.primary} />
                                    </Slider.Track>
                                    <Slider.Thumb index={0} circular size="$1" backgroundColor={colors.primary} elevation={2} />
                                </Slider>
                                <Text fontSize={11} color={colors.textTertiary}>
                                    Più basso = fotocamera più reattiva ai tasti digitati.
                                </Text>
                            </YStack>

                            <YStack gap={Spacing.xs} paddingBottom={Spacing.md}>
                                <XStack justifyContent="space-between" alignItems="center">
                                    <Text fontSize={FontSize.footnote} fontWeight="600" color={colors.text}>
                                        Soglia Stabilità (Auto-focus)
                                    </Text>
                                    <Text fontSize={FontSize.footnote} color={colors.primary} fontWeight="bold">
                                        {stableThreshold.toFixed(1)}
                                    </Text>
                                </XStack>
                                <Slider
                                    defaultValue={[stableThreshold]}
                                    min={0.1}
                                    max={1.5}
                                    step={0.1}
                                    onValueChange={(val) => setStableThreshold(val[0])}
                                >
                                    <Slider.Track backgroundColor={dark ? '#333' : '#E5E7EB'}>
                                        <Slider.TrackActive backgroundColor={colors.primary} />
                                    </Slider.Track>
                                    <Slider.Thumb index={0} circular size="$1" backgroundColor={colors.primary} elevation={2} />
                                </Slider>
                                <Text fontSize={11} color={colors.textTertiary}>
                                    Più basso = aspetta totale immobilità per evitare il micromosso.
                                </Text>
                            </YStack>

                            <Text fontSize={FontSize.subheadline} fontWeight="600" color={colors.text}>
                                Custom Prompt
                            </Text>
                            <TextInput
                                style={[
                                    styles.promptInput,
                                    {
                                        color: colors.text,
                                        backgroundColor: dark ? '#2F2F2F' : '#FFFFFF',
                                        borderColor: dark ? '#424242' : '#D9D9E3',
                                    },
                                ]}
                                value={customPrompt}
                                onChangeText={setCustomPrompt}
                                multiline
                                placeholder="Es: Analizza la domanda e rispondi..."
                                placeholderTextColor={colors.textTertiary}
                            />
                            <Text fontSize={FontSize.caption} color={colors.textTertiary}>
                                Questo prompt viene inviato con ogni screenshot catturato.
                            </Text>
                        </YStack>
                    )}
                </ScrollView>
            </YStack>
        </Modal>
    );
});

const styles = StyleSheet.create({
    sliderTrack: {
        flex: 1,
        justifyContent: 'center',
    },
    zoomBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 44,
        alignItems: 'center',
    },
    mainButton: {
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    autoSwitch: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    promptInput: {
        fontSize: 15,
        lineHeight: 22,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 80,
        textAlignVertical: 'top',
    },
});
