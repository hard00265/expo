import { jsx as _jsx } from "react/jsx-runtime";
import { AppMetricsRoot as RawAppMetricsRoot } from 'expo-app-metrics';
import { ObserveProvider } from './ObserveProvider';
export function AppMetricsRoot({ children, ...props }) {
    return (_jsx(RawAppMetricsRoot, { ...props, children: _jsx(ObserveProvider, { children: children }) }));
}
//# sourceMappingURL=AppMetricsRoot.js.map