import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';

const pluginName = 'detectSceneChange';
const globalAny = global as unknown as Record<string, ReturnType<typeof VisionCameraProxy.initFrameProcessorPlugin> | undefined>;

if (!globalAny.__sceneDetectorPlugin) {
    try {
        globalAny.__sceneDetectorPlugin = VisionCameraProxy.initFrameProcessorPlugin(pluginName, {});
    } catch (e) {
        console.warn(`[useSceneDetector] warning initializing plugin:`, e);
    }
}
const plugin = globalAny.__sceneDetectorPlugin;

export function detectSceneChange(frame: Frame): number {
    'worklet';
    if (plugin == null) {
        return 0;
    }
    const result = plugin.call(frame) as { difference?: number } | undefined;
    return result?.difference ?? 0;
}
