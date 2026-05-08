import { AppMetricsRoot as RawAppMetricsRoot } from 'expo-app-metrics';
import type { ComponentProps, ReactNode } from 'react';

import { ObserveProvider } from './ObserveProvider';

type RawProps = ComponentProps<typeof RawAppMetricsRoot>;

export function AppMetricsRoot({ children, ...props }: RawProps & { children: ReactNode }) {
  return (
    <RawAppMetricsRoot {...props}>
      <ObserveProvider>{children}</ObserveProvider>
    </RawAppMetricsRoot>
  );
}
