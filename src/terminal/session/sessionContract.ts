import type {
  DetachTerminalSessionRequest,
  DetachTerminalSessionResponse,
  ListTerminalSessionsRequest,
  ListTerminalSessionsResponse,
  ResizeSessionRequest,
  ResizeSessionResponse,
  AcknowledgeSessionOutputRequest,
  AcknowledgeSessionOutputResponse,
  SignalSessionRequest,
  SignalSessionResponse,
  StartSessionRequest,
  StartSessionResponse,
  StopSessionRequest,
  StopSessionResponse,
  StopAllTerminalSessionsRequest,
  StopAllTerminalSessionsResponse,
  SubscribeSessionEventsRequest,
  SubscribeSessionEventsResponse,
  TerminalRuntimeErrorCode as NativeTerminalRuntimeErrorCode,
  TerminalSessionEvent,
  TerminalSessionExitEvent,
  TerminalSessionOutputEvent,
  TerminalSessionSignal,
  TerminalSessionSummary,
  TerminalToolchainTarget,
  WriteSessionInputRequest,
  WriteSessionInputResponse,
} from '../../native/NativeTerminalRuntime';
import {
  TERMINAL_RUNTIME_ERROR_CODES,
  TERMINAL_SESSION_EVENT_NAME,
  TERMINAL_SESSION_SIGNALS,
  TERMINAL_SESSION_OUTPUT_WINDOW,
} from '../../native/NativeTerminalRuntime';
import {isValidRequestId} from '../distroContract';

export {isValidRequestId};
export type {TerminalSessionSignal};

/**
 * JS-side validation for the Phase 2 native PTY session contract. Mirrors
 * the bounded-input rules TerminalSessionContract.kt enforces; the native
 * module stays the authority, this layer rejects malformed requests and
 * validates wire responses and events before callers see them.
 */

export {
  TERMINAL_SESSION_EVENT_NAME,
  TERMINAL_SESSION_SIGNALS,
};

export const TERMINAL_SESSION_MIN_ROWS = 2;
export const TERMINAL_SESSION_MAX_ROWS = 250;
export const TERMINAL_SESSION_MIN_COLUMNS = 2;
export const TERMINAL_SESSION_MAX_COLUMNS = 500;
export const TERMINAL_SESSION_MAX_INPUT_BYTES = 16 * 1024;
export const TERMINAL_SESSION_MAX_INPUT_BASE64_CHARS =
  Math.floor((TERMINAL_SESSION_MAX_INPUT_BYTES + 2) / 3) * 4;
/** Reader chunks are 8 KiB on the native side; events may not exceed that. */
export const TERMINAL_SESSION_MAX_OUTPUT_BYTES = 8 * 1024;
export const TERMINAL_SESSION_MAX_OUTPUT_BASE64_CHARS =
  Math.floor((TERMINAL_SESSION_MAX_OUTPUT_BYTES + 2) / 3) * 4;
export {TERMINAL_SESSION_OUTPUT_WINDOW};
export const TERMINAL_SESSION_DEFAULT_ROWS = 24;
export const TERMINAL_SESSION_DEFAULT_COLUMNS = 80;
export const TERMINAL_SESSION_MAX_COMMAND_LENGTH = 4096;
export const TERMINAL_SESSION_DEFAULT_ACTIVE = 1;
export const TERMINAL_SESSION_MAX_ACTIVE = 4;

/** Machine-readable stop reasons (native enforces the same shape). */
export const TERMINAL_SESSION_STOP_REASONS = [
  'user_stop',
  'screen_detach',
  'screen_lock',
  'bridge_invalidated',
  'runtime_reset',
] as const;
export type TerminalSessionStopReason =
  (typeof TERMINAL_SESSION_STOP_REASONS)[number];

export type ActiveTerminalSession = Readonly<TerminalSessionSummary>;
export type TrustedSessionList = Readonly<
  | {kind: 'success'; sessions: readonly ActiveTerminalSession[]}
  | {kind: 'error'; errorCode: TerminalSessionOperationErrorCode}
>;

const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const STOP_REASON_PATTERN = /^[a-z0-9_]{1,64}$/;

export type TerminalSessionOperationErrorCode =
  | NativeTerminalRuntimeErrorCode
  | 'unavailable'
  | 'invalid_response';

export type TerminalSessionErrorCode = NativeTerminalRuntimeErrorCode;

const SESSION_ERROR_CODES: readonly string[] = [
  ...TERMINAL_RUNTIME_ERROR_CODES,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isKnownErrorCode(value: unknown): value is TerminalSessionErrorCode {
  return (
    typeof value === 'string' && SESSION_ERROR_CODES.includes(value)
  );
}

function isTerminalSessionSignal(value: unknown): value is TerminalSessionSignal {
  return (
    typeof value === 'string' &&
    (TERMINAL_SESSION_SIGNALS as readonly string[]).includes(value)
  );
}

export function isValidTerminalSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

export function isValidTerminalSessionStopReason(value: unknown): value is string {
  return typeof value === 'string' && STOP_REASON_PATTERN.test(value);
}

export function isValidTerminalSessionRows(value: unknown): value is number {
  return isSafeIntegerInRange(
    value,
    TERMINAL_SESSION_MIN_ROWS,
    TERMINAL_SESSION_MAX_ROWS,
  );
}

export function isValidTerminalSessionColumns(value: unknown): value is number {
  return isSafeIntegerInRange(
    value,
    TERMINAL_SESSION_MIN_COLUMNS,
    TERMINAL_SESSION_MAX_COLUMNS,
  );
}

/** Strict canonical base64 (padded, no whitespace); null when malformed. */
export function decodeBase64(text: string): Uint8Array | null {
  if (typeof text !== 'string' || text.length === 0 || text.length % 4 !== 0) {
    return null;
  }
  const unpaddedLength = text.replace(/[=]+$/, '').length;
  const padding = text.length - unpaddedLength;
  if (padding > 2) return null;
  let carry = 0;
  let bits = 0;
  const bytes: number[] = [];
  let seenPadding = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '=') {
      seenPadding = true;
      continue;
    }
    if (seenPadding) return null; // data after padding
    const digit = BASE64_ALPHABET.indexOf(character);
    if (digit < 0) return null;
    carry = (carry << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((carry >> bits) & 0xff);
    }
  }
  // Canonical base64 requires unused bits in the final sextet to be zero.
  // Without this check strings such as `AB==` decode to a byte while carrying
  // a second, non-canonical representation of the same value.
  if (padding > 0) {
    const finalDigit = BASE64_ALPHABET.indexOf(text[unpaddedLength - 1]);
    const unusedBits = padding === 2 ? 4 : 2;
    if (finalDigit < 0 || (finalDigit & ((1 << unusedBits) - 1)) !== 0) {
      return null;
    }
  }
  // The trailing partial group must carry exactly the padding-implied bytes.
  const expectedLength = (text.length / 4) * 3 - padding;
  return bytes.length === expectedLength ? new Uint8Array(bytes) : null;
}

export function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const b0 = bytes[index];
    const b1 = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const b2 = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    out += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    out += index + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    out += index + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }
  return out;
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function buildStartSessionRequest(
  requestId: string,
  options?: {rows?: number; columns?: number; command?: string; toolchain?: TerminalToolchainTarget; countsAgainstSessionLimit?: boolean},
): StartSessionRequest | null {
  if (!isValidRequestId(requestId)) return null;
  const rows = options?.rows ?? TERMINAL_SESSION_DEFAULT_ROWS;
  const columns = options?.columns ?? TERMINAL_SESSION_DEFAULT_COLUMNS;
  if (!isValidTerminalSessionRows(rows) || !isValidTerminalSessionColumns(columns)) return null;
  return {
    requestId,
    rows,
    columns,
    ...(options?.command !== undefined ? {command: options.command} : {}),
    ...(options?.toolchain !== undefined ? {toolchain: options.toolchain} : {}),
    ...(options?.countsAgainstSessionLimit !== undefined ? {countsAgainstSessionLimit: options.countsAgainstSessionLimit} : {}),
  };
}

export function buildWriteSessionInputRequest(requestId: string, sessionId: string, bytes: Uint8Array): WriteSessionInputRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionId(sessionId) && bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= TERMINAL_SESSION_MAX_INPUT_BYTES
    ? {requestId, sessionId, base64: encodeBase64(bytes)}
    : null;
}

export function buildResizeSessionRequest(requestId: string, sessionId: string, rows: number, columns: number): ResizeSessionRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionId(sessionId) && isValidTerminalSessionRows(rows) && isValidTerminalSessionColumns(columns)
    ? {requestId, sessionId, rows, columns}
    : null;
}

export function buildSignalSessionRequest(requestId: string, sessionId: string, signal: TerminalSessionSignal): SignalSessionRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionId(sessionId) && isTerminalSessionSignal(signal)
    ? {requestId, sessionId, signal}
    : null;
}

export function buildStopSessionRequest(requestId: string, sessionId: string, reason: string): StopSessionRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionId(sessionId) && isValidTerminalSessionStopReason(reason)
    ? {requestId, sessionId, reason}
    : null;
}

export function buildListTerminalSessionsRequest(requestId: string): ListTerminalSessionsRequest | null {
  return isValidRequestId(requestId) ? {requestId} : null;
}

export function buildDetachTerminalSessionRequest(requestId: string, sessionId: string): DetachTerminalSessionRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionId(sessionId) ? {requestId, sessionId} : null;
}

export function buildStopAllTerminalSessionsRequest(requestId: string, reason: TerminalSessionStopReason): StopAllTerminalSessionsRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionStopReason(reason) ? {requestId, reason} : null;
}

export function buildSubscribeSessionEventsRequest(requestId: string, sessionId: string, afterSeq = 0): SubscribeSessionEventsRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionId(sessionId)
    ? {requestId, sessionId, ...(afterSeq === 0 ? {} : {afterSeq})}
    : null;
}

export function buildAcknowledgeSessionOutputRequest(requestId: string, sessionId: string, seq: number): AcknowledgeSessionOutputRequest | null {
  return isValidRequestId(requestId) && isValidTerminalSessionId(sessionId) && seq >= 1
    ? {requestId, sessionId, seq}
    : null;
}

function isSessionResponse<T extends {requestId: string; status: string; errorCode?: string}>(
  value: unknown,
  requestId: string,
  validateSuccess: (res: any) => boolean,
): value is T {
  if (!isRecord(value) || !isValidRequestId(requestId) || value.requestId !== requestId) return false;
  if (value.status === 'error') return isKnownErrorCode((value as {errorCode: unknown}).errorCode);
  return value.status === 'success' && validateSuccess(value);
}

export function isStartSessionResponse(value: unknown, requestId: string): value is StartSessionResponse {
  return isSessionResponse(value, requestId, v => isValidTerminalSessionId(v.sessionId) && Number.isSafeInteger(v.pid));
}

export function isWriteSessionInputResponse(value: unknown, requestId: string, expectedBytes?: number): value is WriteSessionInputResponse {
  return isSessionResponse(value, requestId, v => typeof v.bytesWritten === 'number' && (expectedBytes === undefined || v.bytesWritten === expectedBytes));
}

export function isResizeSessionResponse(value: unknown, requestId: string, expectedRows?: number, expectedColumns?: number): value is ResizeSessionResponse {
  return isSessionResponse(value, requestId, v => typeof v.rows === 'number' && typeof v.columns === 'number' && (expectedRows === undefined || v.rows === expectedRows) && (expectedColumns === undefined || v.columns === expectedColumns));
}

export function isSignalSessionResponse(value: unknown, requestId: string, expectedSignal?: TerminalSessionSignal): value is SignalSessionResponse {
  return isSessionResponse(value, requestId, v => isTerminalSessionSignal(v.signal) && (expectedSignal === undefined || v.signal === expectedSignal));
}

export function isStopSessionResponse(value: unknown, requestId: string, expectedSessionId?: string): value is StopSessionResponse {
  return isSessionResponse(value, requestId, v => isValidTerminalSessionId(v.sessionId) && (expectedSessionId === undefined || v.sessionId === expectedSessionId));
}

export function isListTerminalSessionsResponse(value: unknown, requestId: string): value is ListTerminalSessionsResponse {
  return isSessionResponse(value, requestId, v => Array.isArray(v.sessions));
}

export function isDetachTerminalSessionResponse(value: unknown, requestId: string): value is DetachTerminalSessionResponse {
  return isSessionResponse(value, requestId, () => true);
}

export function isStopAllTerminalSessionsResponse(value: unknown, requestId: string): value is StopAllTerminalSessionsResponse {
  return isSessionResponse(value, requestId, () => true);
}

export function isSubscribeSessionEventsResponse(value: unknown, requestId: string, expectedSessionId?: string, _afterSeq = 0): value is SubscribeSessionEventsResponse {
  return isSessionResponse(value, requestId, v => isValidTerminalSessionId(v.sessionId) && (expectedSessionId === undefined || v.sessionId === expectedSessionId) && (v.sessionState === 'running' || v.sessionState === 'exited'));
}

export function isAcknowledgeSessionOutputResponse(value: unknown, requestId: string, expectedSessionId?: string, expectedSeq?: number): value is AcknowledgeSessionOutputResponse {
  return isSessionResponse(value, requestId, v => isValidTerminalSessionId(v.sessionId) && (expectedSessionId === undefined || v.sessionId === expectedSessionId) && (expectedSeq === undefined || v.acknowledgedSeq >= expectedSeq));
}

export function isTerminalSessionOutputEvent(value: unknown): value is TerminalSessionOutputEvent {
  return isRecord(value) && value.type === 'output' && isValidTerminalSessionId(value.sessionId) && typeof value.seq === 'number' && typeof value.base64 === 'string';
}

export function isTerminalSessionExitEvent(value: unknown): value is TerminalSessionExitEvent {
  return isRecord(value) && value.type === 'exit' && isValidTerminalSessionId(value.sessionId) && typeof value.reason === 'string';
}

export function isTerminalSessionEvent(value: unknown): value is TerminalSessionEvent {
  return isTerminalSessionOutputEvent(value) || isTerminalSessionExitEvent(value);
}

/** The operation results a caller may trust, in one discriminated shape. */
export type TrustedSessionOperation = Readonly<
  | {kind: 'applied'}
  | {kind: 'error'; errorCode: TerminalSessionOperationErrorCode}
>;

export type TrustedSessionStart = Readonly<
  | {kind: 'success'; sessionId: string; pid: number; rows: number; columns: number}
  | {kind: 'error'; errorCode: TerminalSessionOperationErrorCode}
>;

export type TrustedSessionWrite = Readonly<
  | {kind: 'success'; bytesWritten: number}
  | {kind: 'error'; errorCode: TerminalSessionOperationErrorCode}
>;

export type TrustedSessionStop = Readonly<
  | {
      kind: 'success';
      sessionId: string;
      exitCode?: number;
      signal?: string;
      exitReason: string;
      remainingProcessCount: number;
      stoppedWithinDeadline: boolean;
    }
  | {
      /** Native completed its bounded attempt but observed a non-clean teardown. */
      kind: 'incomplete';
      sessionId: string;
      exitCode?: number;
      signal?: string;
      exitReason: string;
      remainingProcessCount: number;
      stoppedWithinDeadline: boolean;
    }
  | {kind: 'error'; errorCode: TerminalSessionOperationErrorCode}
>;

export type TrustedSessionSnapshot = Readonly<
  | {
      kind: 'success';
      sessionId: string;
      sessionState: 'running' | 'exited';
      firstAvailableSeq: number;
      lastEmittedSeq: number;
      replayAvailable: boolean;
      exitCode?: number;
      signal?: string;
      exitReason?: string;
    }
  | {kind: 'error'; errorCode: TerminalSessionOperationErrorCode}
>;

export type TrustedSessionAck = Readonly<
  | {
      kind: 'success';
      sessionId: string;
      acknowledgedSeq: number;
      outstandingChunks: number;
    }
  | {kind: 'error'; errorCode: TerminalSessionOperationErrorCode}
>;
