import nativeTerminalRuntime, {type Spec} from '../../native/NativeTerminalRuntime';

export const TERMINAL_SESSION_LIMIT_MIN = 1 as const;
export const TERMINAL_SESSION_LIMIT_DEFAULT = 2 as const;
export const TERMINAL_SESSION_LIMIT_MAX = 4 as const;

export type SessionSettings = Readonly<{
  maxConcurrentSessions: number;
  minConcurrentSessions: number;
  maxSupportedConcurrentSessions: number;
}>;

export type SessionSettingsErrorCode =
  | 'unavailable'
  | 'internal_error'
  | 'invalid_request'
  | 'invalid_response';

export type SessionSettingsResult = Readonly<
  | {kind: 'success'; settings: SessionSettings}
  | {kind: 'error'; errorCode: SessionSettingsErrorCode}
>;

type SessionSettingsRuntime = Pick<Spec, 'getSessionSettings' | 'setSessionLimit'>;

function parseSessionSettings(value: unknown): SessionSettingsResult {
  if (!value || typeof value !== 'object') return {kind: 'error', errorCode: 'invalid_response'};
  const res = value as Record<string, unknown>;
  if (res.status === 'error') {
    return {kind: 'error', errorCode: res.errorCode === 'internal_error' || res.errorCode === 'invalid_request' ? res.errorCode : 'invalid_response'};
  }
  const max = res.maxConcurrentSessions;
  if (
    res.status !== 'success' ||
    typeof max !== 'number' ||
    max < TERMINAL_SESSION_LIMIT_MIN ||
    max > TERMINAL_SESSION_LIMIT_MAX ||
    res.minConcurrentSessions !== TERMINAL_SESSION_LIMIT_MIN ||
    res.maxSupportedConcurrentSessions !== TERMINAL_SESSION_LIMIT_MAX
  ) return {kind: 'error', errorCode: 'invalid_response'};
  return {
    kind: 'success',
    settings: {
      maxConcurrentSessions: max,
      minConcurrentSessions: res.minConcurrentSessions as number,
      maxSupportedConcurrentSessions: res.maxSupportedConcurrentSessions as number,
    },
  };
}

export async function readSessionSettings(
  runtime: SessionSettingsRuntime | null = nativeTerminalRuntime,
): Promise<SessionSettingsResult> {
  if (!runtime) return {kind: 'error', errorCode: 'unavailable'};
  try {
    return parseSessionSettings(await runtime.getSessionSettings());
  } catch {
    return {kind: 'error', errorCode: 'internal_error'};
  }
}

export async function writeSessionLimit(
  maxConcurrentSessions: number,
  runtime: SessionSettingsRuntime | null = nativeTerminalRuntime,
): Promise<SessionSettingsResult> {
  if (typeof maxConcurrentSessions !== 'number' || maxConcurrentSessions < TERMINAL_SESSION_LIMIT_MIN || maxConcurrentSessions > TERMINAL_SESSION_LIMIT_MAX) {
    return {kind: 'error', errorCode: 'invalid_request'};
  }
  if (!runtime) return {kind: 'error', errorCode: 'unavailable'};
  try {
    return parseSessionSettings(await runtime.setSessionLimit({maxConcurrentSessions}));
  } catch {
    return {kind: 'error', errorCode: 'internal_error'};
  }
}
