import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './SceneDetector.types';

type SceneDetectorModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class SceneDetectorModule extends NativeModule<SceneDetectorModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(SceneDetectorModule, 'SceneDetectorModule');
