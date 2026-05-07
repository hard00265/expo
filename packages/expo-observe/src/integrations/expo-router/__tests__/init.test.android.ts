/* eslint-disable @typescript-eslint/no-require-imports */
import AppMetrics from 'expo-app-metrics';
import type { ActionDispatchedEvent, PageFocusedEvent } from 'expo-router';

import { initListeners } from '../init';
import { createRouterIntegrationStorage, type RouterIntegrationStorage } from '../storage';

jest.mock('expo-app-metrics', () => {
  const addCustomMetricToSession = jest.fn();
  const getMainSessionId = jest.fn(() => 'session-1');
  return {
    __esModule: true,
    default: {
      markInteractive: jest.fn(),
      getMainSessionId,
      addCustomMetricToSession,
    },
  };
});

jest.mock('../router', () => ({ optionalRouter: undefined, isRouterInstalled: false }));

const mockGetMainSessionId = AppMetrics.getMainSessionId as jest.Mock;
const mockAddCustomMetric = AppMetrics.addCustomMetricToSession as jest.Mock;
const mockSessionId = 'session-1';

type Listener<T> = (event: T) => void;

interface FakeNavigationEvents {
  addListener<T>(type: string, cb: Listener<T>): () => void;
  emit<T>(type: string, event: T): void;
}

function createFakeNavigationEvents(): FakeNavigationEvents {
  const listeners: Record<string, Set<Listener<any>>> = {};
  return {
    addListener(type, cb) {
      listeners[type] = listeners[type] ?? new Set();
      listeners[type].add(cb);
      return () => listeners[type].delete(cb);
    },
    emit(type, event) {
      listeners[type]?.forEach((cb) => cb(event));
    },
  };
}

function dispatch(events: FakeNavigationEvents, actionType: string) {
  events.emit<Partial<ActionDispatchedEvent>>('actionDispatched', {
    type: 'actionDispatched',
    actionType: actionType as ActionDispatchedEvent['actionType'],
  });
}

function focus(events: FakeNavigationEvents, screenId: string) {
  events.emit<Partial<PageFocusedEvent>>('pageFocused', {
    type: 'pageFocused',
    screenId,
    pathname: `/${screenId}`,
    params: {},
  });
}

let storage: RouterIntegrationStorage;
let events: FakeNavigationEvents;
let cleanup: () => void;
let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  storage = createRouterIntegrationStorage();
  events = createFakeNavigationEvents();
  cleanup = initListeners(storage, events as any);
});

afterEach(() => {
  cleanup?.();
  expect(logSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  jest.clearAllMocks();
});

describe('initListeners (android)', () => {
  it('records TTR with isAppLaunch=true on the first focus after a non-PRELOAD action', () => {
    const now = performance.now();
    jest.spyOn(performance, 'now').mockReturnValue(now + 100);
    focus(events, 'a');

    expect(mockAddCustomMetric).toHaveBeenCalledTimes(1);
    expect(mockAddCustomMetric).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      timestamp: expect.any(String),
      category: 'navigation',
      name: 'ttr',
      value: expect.closeTo(0.1, 2),
      params: { isInitial: true, isAppLaunch: true },
    });
  });

  it('records TTR with isAppLaunch=false on subsequent focuses', () => {
    dispatch(events, 'NAVIGATE');
    focus(events, 'a');
    mockAddCustomMetric.mockClear();

    dispatch(events, 'NAVIGATE');
    focus(events, 'b');

    expect(mockAddCustomMetric).toHaveBeenCalledTimes(1);
    expect(mockAddCustomMetric.mock.calls[0][0].params).toEqual({
      isInitial: true,
      isAppLaunch: false,
    });
  });

  it('records TTR with isInitial=false when revisiting a previously rendered screen', () => {
    focus(events, 'a');

    dispatch(events, 'NAVIGATE');
    focus(events, 'b');

    dispatch(events, 'NAVIGATE');
    focus(events, 'a');

    expect(mockAddCustomMetric).toHaveBeenCalledTimes(3);
    expect(mockAddCustomMetric.mock.calls[0][0].params).toEqual({
      isInitial: true,
      isAppLaunch: true,
    });
    expect(mockAddCustomMetric.mock.calls[1][0].params).toEqual({
      isInitial: true,
      isAppLaunch: false,
    });
    expect(mockAddCustomMetric.mock.calls[2][0].params).toEqual({
      isInitial: false,
      isAppLaunch: false,
    });
  });

  it('does not record a TTR for a PRELOAD action', () => {
    storage.hasRecordedInitialTtr = true;

    dispatch(events, 'PRELOAD');
    focus(events, 'a');
    expect(mockAddCustomMetric).not.toHaveBeenCalled();
  });

  it('cleanup unsubscribes both listeners', () => {
    cleanup();
    dispatch(events, 'NAVIGATE');
    focus(events, 'a');
    expect(mockAddCustomMetric).not.toHaveBeenCalled();
    expect(storage.pendingActions).toHaveLength(0);
    cleanup = () => {};
  });

  it('uses getMainSessionId from AppMetrics for the metric session id', () => {
    mockGetMainSessionId.mockReturnValueOnce('custom-session');
    dispatch(events, 'NAVIGATE');
    focus(events, 'a');
    expect(mockAddCustomMetric).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'custom-session' })
    );
  });
});

describe('isInitialized + initRouterIntegration', () => {
  it('flips initialized when initRouterIntegration is called and stays decoupled from initListeners', () => {
    jest.isolateModules(() => {
      const init = require('../init');
      expect(init.isInitialized()).toBe(false);

      const fresh = createRouterIntegrationStorage();
      const fakeEvents = createFakeNavigationEvents();
      const dispose = init.initListeners(fresh, fakeEvents);
      expect(init.isInitialized()).toBe(false);
      dispose();

      init.initRouterIntegration();
      expect(init.isInitialized()).toBe(true);
    });
  });
});
