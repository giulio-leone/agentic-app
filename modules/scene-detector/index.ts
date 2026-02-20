// Reexport the native module. On web, it will be resolved to SceneDetectorModule.web.ts
// and on native platforms to SceneDetectorModule.ts
export { default } from './src/SceneDetectorModule';
export { default as SceneDetectorView } from './src/SceneDetectorView';
export * from  './src/SceneDetector.types';
