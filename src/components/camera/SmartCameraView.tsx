import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Platform, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { YStack, Text } from 'tamagui';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing } from '../../utils/theme';
import { volumeListenerService } from '../../services/VolumeListenerService';
import { runAsync } from 'react-native-vision-camera';
import { useCameraFormat } from 'react-native-vision-camera';
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
    zoom: number; // Optical multiplier (e.g. 0.6, 1, 3, 5) relative to neutral zoom
    size?: { width: number; height: number };
    showFlash?: boolean;
    onSceneChanged?: () => void;
    onShutterPressed?: () => void;
    enableAutoDetection?: boolean;
    motionThreshold?: number;
    stableThreshold?: number;
}

export const SmartCameraView = forwardRef<SmartCameraViewHandle, SmartCameraViewProps>(
    function SmartCameraView({ zoom, size, showFlash, onSceneChanged, onShutterPressed, enableAutoDetection, motionThreshold = 0.8, stableThreshold = 0.4 }, ref) {
        const cameraRef = useRef<Camera>(null);
        const { hasPermission, requestPermission } = useCameraPermission();
        const device = useCameraDevice('back');
        const { colors } = useDesignSystem();

        const [isReady, setIsReady] = useState(false);

        // Optical Zoom Mapping: Multiply the input optical factor (0.6x, 1x, 3x, 5x) by the camera's neutral zoom
        // This leverages OIS and switches physical lenses on multi-lens phones like the S25 Ultra
        const deviceZoom = device
            ? Math.max(device.minZoom, Math.min(device.maxZoom, device.neutralZoom * zoom))
            : 0;

        // Use useCameraFormat to enforce maximum resolution for text capture
        const format = useCameraFormat(device, [
            { photoResolution: 'max' },
            { videoResolution: 'max' }
        ]);

        const captureFrame = useCallback(async (): Promise<CaptureResult | null> => {
            if (!cameraRef.current) return null;
            try {
                const photo = await cameraRef.current.takePhoto({
                    flash: showFlash ? 'on' : 'off',
                    enableShutterSound: false,
                    enableAutoDistortionCorrection: true, // Critical for flat monitor text
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

            // thresholds from props
            const MOTION_THRESHOLD = motionThreshold;
            const STABLE_THRESHOLD = stableThreshold;

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

            // Always check for stability if we aren't moving right now
            if (diff < STABLE_THRESHOLD) {
                // If we were previously moving
                if (isStabilizing.value) {
                    // Must be considered stable for at least 200ms before triggering to ensure focus is acquired
                    if (Date.now() - lastMotionTime.value > 200) {
                        isStabilizing.value = false;
                        triggerFired = true;
                        onSceneChangedJS();
                    }
                } else {
                    // Safety catch: if we somehow missed the initial motion spike but the camera has been stable for a long time (e.g., 2.5 seconds) since last capture activity
                    if (Date.now() - lastMotionTime.value > 2500) {
                        lastMotionTime.value = Date.now(); // reset timer
                        triggerFired = true;
                        onSceneChangedJS();
                    }
                }
            }

            if (motionDetected || triggerFired) {
                logStateJS(diff, motionDetected, isStabilizing.value, triggerFired);
            }
        }, [enableAutoDetection, motionThreshold, stableThreshold]);

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
                    format={format}
                    photoQualityBalance="quality"
                    photoHdr={format?.supportsPhotoHdr}
                    lowLightBoost={device?.supportsLowLightBoost}
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
