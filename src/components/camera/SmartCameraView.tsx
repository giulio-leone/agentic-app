import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Platform, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { YStack, Text } from 'tamagui';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing } from '../../utils/theme';
import { volumeListenerService } from '../../services/VolumeListenerService';
import { runAsync } from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { detectSceneChange } from './useSceneDetector';

export interface CaptureResult {
    uri: string;
    base64: string;
}

export interface SmartCameraViewHandle {
    captureFrame: () => Promise<CaptureResult | null>;
}

interface SmartCameraViewProps {
    zoom: number; // 0-1 mapped to device min/max
    size?: { width: number; height: number };
    showFlash?: boolean;
    onSceneChanged?: () => void;
    onShutterPressed?: () => void;
    enableAutoDetection?: boolean;
}

export const SmartCameraView = forwardRef<SmartCameraViewHandle, SmartCameraViewProps>(
    function SmartCameraView({ zoom, size, showFlash, onSceneChanged, onShutterPressed, enableAutoDetection }, ref) {
        const cameraRef = useRef<Camera>(null);
        const { hasPermission, requestPermission } = useCameraPermission();
        const device = useCameraDevice('back');
        const { colors } = useDesignSystem();

        const [isReady, setIsReady] = useState(false);

        // Map abstract zoom (0-1) to actual device zoom range (device.minZoom..device.maxZoom)
        const deviceZoom = device
            ? device.minZoom + zoom * (device.maxZoom - device.minZoom)
            : 0;

        const captureFrame = useCallback(async (): Promise<CaptureResult | null> => {
            if (!cameraRef.current) return null;
            try {
                const photo = await cameraRef.current.takePhoto({
                    flash: showFlash ? 'on' : 'off',
                    enableShutterSound: false,
                });

                // vision-camera v4 doesn't return base64 directly from takePhoto. 
                // We use expo-file-system/legacy as a safe fallback for base64 reading on local file URIs to avoid native crashes
                // with Expo's experimental file system node abstractions.
                const uri = 'file://' + photo.path;
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

                return { uri, base64 };
            } catch (err) {
                console.warn('[SmartCameraView] capture error:', err);
                return null;
            }
        }, [showFlash]);

        useImperativeHandle(ref, () => ({ captureFrame }), [captureFrame]);

        // Hardware volume shutter listener
        useEffect(() => {
            const handleShutter = () => {
                onShutterPressed?.();
            };
            volumeListenerService.addListener(handleShutter);
            volumeListenerService.startListening();

            return () => {
                volumeListenerService.removeListener(handleShutter);
                volumeListenerService.stopListening();
            };
        }, [onShutterPressed]);

        // Auto-detection logic (Frame Processor)
        // This utilizes our custom native vision-camera-plugin (SceneDetector) 
        // to perform real-time pixel diffing between consecutive frames directly in C++/Kotlin/Swift.
        // It provides the average difference value to JS without the overhead of passing image buffers.
        const onSceneChangedJS = Worklets.createRunOnJS(() => {
            onSceneChanged?.();
        });

        const lastMotionTime = useSharedValue(0);
        const isStabilizing = useSharedValue(false);

        const logStateJS = Worklets.createRunOnJS((diff: number, motion: boolean, stabilizing: boolean, trigger: boolean) => {
            if (trigger) {
                console.log(`[SmartCameraView] TRIGGER EVENT! diff=${diff.toFixed(2)}`);
            } else if (motion) {
                console.log(`[SmartCameraView] MOTION DETECTED! diff=${diff.toFixed(2)}`);
            }
        });

        const frameProcessor = useFrameProcessor((frame) => {
            'worklet';
            if (!enableAutoDetection) return;

            const diff = detectSceneChange(frame);

            // Motion threshold: when the average diff exceeds this, we consider the camera to be moving
            const MOTION_THRESHOLD = 3.5;
            // Stable threshold: when the average diff stays below this for a certain period, we consider it stable
            const STABLE_THRESHOLD = 2.0;

            let motionDetected = false;
            let triggerFired = false;

            // If significant difference is detected, we're moving. Start the stabilization timer.
            if (diff > MOTION_THRESHOLD) {
                lastMotionTime.value = Date.now();
                if (!isStabilizing.value) {
                    isStabilizing.value = true;
                    motionDetected = true;
                }
            }

            // If we were previously moving, and now we are stable...
            if (isStabilizing.value && diff < STABLE_THRESHOLD) {
                // Must be considered stable for at least 600ms before triggering to ensure focus is acquired
                if (Date.now() - lastMotionTime.value > 600) {
                    isStabilizing.value = false;
                    triggerFired = true;
                    onSceneChangedJS();
                }
            }

            if (motionDetected || triggerFired) {
                logStateJS(diff, motionDetected, isStabilizing.value, triggerFired);
            }
        }, [enableAutoDetection]);

        if (!hasPermission) {
            return (
                <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background" gap={Spacing.md}>
                    <Text color="$color" fontSize={FontSize.body} textAlign="center">
                        📷 Camera permission required
                    </Text>
                    <Text color={colors.primary} fontSize={FontSize.body} fontWeight="600" onPress={requestPermission}>
                        Grant Permission
                    </Text>
                </YStack>
            );
        }

        if (device == null) {
            return (
                <YStack flex={1} justifyContent="center" alignItems="center">
                    <Text color="$color">No camera device found</Text>
                </YStack>
            );
        }

        const w = size?.width ?? '100%';
        const h = size?.height ?? 300;

        return (
            <View style={[styles.container, { width: w as number, height: h as number }]}>
                <Camera
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={true}
                    photo={true}
                    zoom={deviceZoom}
                    frameProcessor={frameProcessor}
                    onInitialized={() => setIsReady(true)}
                />
            </View>
        );
    },
);

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
});
