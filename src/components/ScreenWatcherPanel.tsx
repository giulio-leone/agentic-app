/**
 * ScreenWatcherPanel — Full-screen modal UI for the screen-watcher feature.
 * Shows camera preview (with zoom), controls (start/stop), status indicator,
 * zoom slider, and wires everything to the useScreenWatcher hook.
 */

import React from 'react';
import {
    Modal,
    StyleSheet,
    TouchableOpacity,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import Animated from 'react-native-reanimated';
import { SmartCameraView } from './camera/SmartCameraView';
import { MarkdownContent } from './chat/MarkdownContent';
import { ZoomControls } from './screenwatcher/ZoomControls';
import { WatcherSettings } from './screenwatcher/WatcherSettings';
import { useDesignSystem } from '../utils/designSystem';
import { FontSize, Spacing } from '../utils/theme';
import { Settings, X, Square, Play, Eye, Brain } from 'lucide-react-native';
import { useScreenWatcher } from '../hooks/useScreenWatcher';
import type { WatcherStatus } from '../services/ScreenWatcherService';

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
    const w = useScreenWatcher();

    const statusInfo = STATUS_LABELS[w.watcherStatus];
    const cameraH = Math.round(height * 0.45);
    const cameraW = Math.round(width - 32);

    return (
        <Modal
            visible={w.screenWatcherVisible}
            animationType="slide"
            presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
            onRequestClose={w.handleClose}
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
                    <TouchableOpacity onPress={w.handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                        onPress={() => w.setShowSettings(!w.showSettings)}
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
                                ref={w.cameraRef}
                                zoom={w.zoomLevel}
                                size={{ width: cameraW, height: cameraH }}
                                showFlash={w.flashVisible}
                                enableAutoDetection={w.isWatching}
                                motionThreshold={w.motionThreshold}
                                stableThreshold={w.stableThreshold}
                                onSceneChanged={w.handleSceneChanged}
                                onShutterPressed={w.handleShutterPressed}
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
                                w.pulseStyle,
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
                        {w.captureCount > 0 && (
                            <Text fontSize={FontSize.footnote} color={colors.textTertiary}>
                                ({w.captureCount} captures)
                            </Text>
                        )}
                    </XStack>



                    {/* Latest Cloud LLM Response Overlay */}
                    {w.isRemoteLLMEnabled && w.latestAssistantMessage && w.captureCount > 0 && (
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
                            <MarkdownContent content={w.latestAssistantMessage!.content} colors={colors} />
                        </YStack>
                    )}

                    {/* Hardware Optical Zoom */}
                    <ZoomControls
                        zoomLevel={w.zoomLevel}
                        setZoomLevel={w.setZoomLevel}
                        colors={colors}
                        dark={dark}
                    />

                    {/* Start / Stop Button */}
                    <YStack paddingHorizontal={Spacing.xl} paddingTop={Spacing.lg}>
                        <TouchableOpacity
                            style={[
                                styles.mainButton,
                                {
                                    backgroundColor: w.isWatching ? '#EF4444' : colors.primary,
                                },
                            ]}
                            onPress={w.handleToggle}
                            activeOpacity={0.8}
                        >
                            <XStack alignItems="center" justifyContent="center" gap={8}>
                                {w.isWatching ? <Square size={18} fill="#FFFFFF" color="#FFFFFF" /> : <Play size={18} fill="#FFFFFF" color="#FFFFFF" />}
                                <Text fontSize={FontSize.title3} color="#FFFFFF" fontWeight="700">
                                    {w.isWatching ? 'Stop Watching' : 'Start Watching'}
                                </Text>
                            </XStack>
                        </TouchableOpacity>
                    </YStack>

                    {/* Settings Panel (collapsible) */}
                    {w.showSettings && (
                        <WatcherSettings
                            isAutoMode={w.isAutoMode}
                            setAutoMode={w.setAutoMode}
                            isRemoteLLMEnabled={w.isRemoteLLMEnabled}
                            setRemoteLLMEnabled={w.setRemoteLLMEnabled}
                            motionThreshold={w.motionThreshold}
                            setMotionThreshold={w.setMotionThreshold}
                            stableThreshold={w.stableThreshold}
                            setStableThreshold={w.setStableThreshold}
                            customPrompt={w.customPrompt}
                            setCustomPrompt={w.setCustomPrompt}
                            colors={colors}
                            dark={dark}
                        />
                    )}
                </ScrollView>
            </YStack>
        </Modal>
    );
});

const styles = StyleSheet.create({
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
});
