import { requireNativeView } from 'expo';
import * as React from 'react';

import { SceneDetectorViewProps } from './SceneDetector.types';

const NativeView: React.ComponentType<SceneDetectorViewProps> =
  requireNativeView('SceneDetector');

export default function SceneDetectorView(props: SceneDetectorViewProps) {
  return <NativeView {...props} />;
}
