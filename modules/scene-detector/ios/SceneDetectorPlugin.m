#import <Foundation/Foundation.h>
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

@objc(SceneDetectorPlugin)
    @interface SceneDetectorPlugin(FrameProcessorPluginRegistry)
@end

@implementation SceneDetectorPlugin (FrameProcessorPluginRegistry)

VISION_EXPORT_FRAME_PROCESSOR(detectSceneChange, SceneDetectorPlugin)

@end
