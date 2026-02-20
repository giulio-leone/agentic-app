import { NativeModule, requireNativeModule } from 'expo';

import { SceneDetectorModuleEvents } from './SceneDetector.types';

declare class SceneDetectorModule extends NativeModule<SceneDetectorModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<SceneDetectorModule>('SceneDetector');
