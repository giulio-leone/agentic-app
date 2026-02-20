import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Platform, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { YStack, Text } from 'tamagui';
import { useDesignSystem } from '../../utils/designSystem';
import { FontSize, Spacing } from '../../utils/theme';
import { volumeListenerService } from '../../services/VolumeListenerService';
import { runAsync } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

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
                // We use expo-file-system to read the saved file.
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
        // Note: Real scene change detection requires comparing image buffers. 
        // For this demo, we can simulate or use simple heuristics if OpenCV is not installed.
        // Doing full image diffing in JS is slow, so we just stub the worklet.
        const onSceneChangedJS = Worklets.createRunOnJS(() => {
            onSceneChanged?.();
        });

        const frameProcessor = useFrameProcessor((frame) => {
            'worklet';
            if (!enableAutoDetection) return;

            // Pseudo-logic for scene detection:
            // 1. Calculate average brightness/color or use a native plugin.
            // 2. Diff with previous frame.
            // 3. If difference > threshold, mark as moving.
            // 4. If moving stops, trigger onSceneChangedJS().

            // To do this for real, a VisionCamera Frame Processor Plugin (Native) is recommended.
            // e.g. vision-camera-image-processing or similar.
            // Because we don't have a C++ plugin installed, this is a placeholder.
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
