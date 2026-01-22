/**
 * React integration components for Faro.
 *
 * @packageDocumentation
 */

export { useFaro, type UseFaroReturn } from './useFaro';
export {
  useWebVitals,
  getWebVitalsSummary,
  WEB_VITALS_THRESHOLDS,
  type WebVitalsData,
  type WebVitalRating,
  type UseWebVitalsOptions,
} from './useWebVitals';
export {
  FaroErrorBoundary,
  withFaroErrorBoundary,
  type FaroErrorBoundaryProps,
} from './FaroErrorBoundary';
export { FaroRouteTracker, parameterizePath, type FaroRouteTrackerProps } from './FaroRouteTracker';
