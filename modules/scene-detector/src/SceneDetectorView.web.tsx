import * as React from 'react';

import { SceneDetectorViewProps } from './SceneDetector.types';

export default function SceneDetectorView(props: SceneDetectorViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
