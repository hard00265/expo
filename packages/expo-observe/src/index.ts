import ExpoObserve from './module';

export { default as AppMetrics } from 'expo-app-metrics';
export { AppMetricsRoot } from './AppMetricsRoot';

ExpoObserve.setBundleDefaults({
  environment: process.env.NODE_ENV ?? 'production',
  isJsDev: !!__DEV__,
});

export { default } from './module';
export * from './types';
export { useObserve } from './useObserve';
