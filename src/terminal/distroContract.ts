import type {
  InstallRootfsRequest,
  InstallRootfsResponse,
  ResetRuntimeRequest,
  ResetRuntimeResponse,
  TerminalResetScope,
  TerminalRuntimeStatusResponse,
  TerminalRuntimeErrorCode as NativeTerminalRuntimeErrorCode,
} from '../native/NativeTerminalRuntime';
import {
  TERMINAL_RUNTIME_ERROR_CODES,
  TERMINAL_RUNTIME_RESET_SCOPES,
  TERMINAL_RUNTIME_SCHEMA_VERSION as NATIVE_TERMINAL_RUNTIME_SCHEMA_VERSION,
  TERMINAL_RUNTIME_STATE_NOT_INSTALLED as NATIVE_TERMINAL_RUNTIME_STATE_NOT_INSTALLED,
  TERMINAL_RUNTIME_STATE_READY as NATIVE_TERMINAL_RUNTIME_STATE_READY,
  TERMINAL_RUNTIME_VERSION as NATIVE_TERMINAL_RUNTIME_VERSION,
} from '../native/NativeTerminalRuntime';

export const TERMINAL_RUNTIME_SCHEMA_VERSION = NATIVE_TERMINAL_RUNTIME_SCHEMA_VERSION;
export const TERMINAL_RUNTIME_VERSION = NATIVE_TERMINAL_RUNTIME_VERSION;
export const TERMINAL_RUNTIME_STATE_NOT_INSTALLED = NATIVE_TERMINAL_RUNTIME_STATE_NOT_INSTALLED;
export const TERMINAL_RUNTIME_STATE_READY = NATIVE_TERMINAL_RUNTIME_STATE_READY;
export const PINNED_ROOTFS_ID = 'alpine-3.24.0-aarch64';
export const PINNED_ROOTFS_SHA256 = '4b8cd66a6688b2a87276c39843ed89c3a06d9534fc6a5823c586aff2696c1f2a';
export const PINNED_ALPINE_RELEASE = '3.24.0';
export const PINNED_ROOTFS_SIZE_BYTES = 4_043_766;
export const PINNED_ROOTFS_URL = 'https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/aarch64/alpine-minirootfs-3.24.0-aarch64.tar.gz';
export const PINNED_PROBE_MARKERS = [
  'alpine_probe_begin',
  'aarch64',
  '3.24.0',
  '/root',
  '/sbin/apk',
  '/bin/sh',
  'alpine_probe_end',
] as const;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const ROOTFS_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type TerminalRuntimeOperationErrorCode =
  | NativeTerminalRuntimeErrorCode
  | 'unavailable'
  | 'invalid_response';

export type TerminalRuntimeErrorCode = NativeTerminalRuntimeErrorCode;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownErrorCode(value: unknown): value is TerminalRuntimeErrorCode {
  return typeof value === 'string' && (TERMINAL_RUNTIME_ERROR_CODES as readonly string[]).includes(value);
}

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

export function isValidRootfsId(value: unknown): value is string {
  return typeof value === 'string' && ROOTFS_ID_PATTERN.test(value);
}

export function isValidSha256Digest(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

export function isValidTerminalRuntimeErrorCode(value: unknown): value is TerminalRuntimeErrorCode {
  return isKnownErrorCode(value);
}

export function buildInstallRootfsRequest(requestId: string): InstallRootfsRequest | null {
  return isValidRequestId(requestId) ? {requestId, rootfsId: PINNED_ROOTFS_ID} : null;
}

export function buildResetRuntimeRequest(
  requestId: string,
  scope: TerminalResetScope,
): ResetRuntimeRequest | null {
  return isValidRequestId(requestId) && (TERMINAL_RUNTIME_RESET_SCOPES as readonly string[]).includes(scope)
    ? {requestId, scope}
    : null;
}

export function isTerminalRuntimeStatusResponse(
  value: unknown,
): value is TerminalRuntimeStatusResponse {
  if (!isRecord(value)) return false;
  if (value.status === 'error') return value.errorCode === 'internal_error';
  if (value.status !== 'success') return false;
  if (
    value.schemaVersion !== TERMINAL_RUNTIME_SCHEMA_VERSION ||
    (value.runtimeState !== TERMINAL_RUNTIME_STATE_NOT_INSTALLED && value.runtimeState !== TERMINAL_RUNTIME_STATE_READY) ||
    value.runtimeVersion !== TERMINAL_RUNTIME_VERSION ||
    typeof value.abi !== 'string' || value.abi.length === 0 ||
    typeof value.appVersion !== 'string' || value.appVersion.length === 0 ||
    typeof value.storageRoot !== 'string' || value.storageRoot.length === 0 ||
    typeof value.prootAvailable !== 'boolean' ||
    !Array.isArray(value.installedVersionIds)
  ) return false;

  if (value.runtimeState === TERMINAL_RUNTIME_STATE_READY) {
    return value.activeRootfsId === PINNED_ROOTFS_ID &&
      value.activeAlpineRelease === PINNED_ALPINE_RELEASE &&
      value.activeRootfsSha256 === PINNED_ROOTFS_SHA256 &&
      typeof value.activeInstalledAt === 'string';
  }
  return value.activeRootfsId === undefined && value.activeAlpineRelease === undefined;
}

export function isInstallRootfsResponse(value: unknown): value is InstallRootfsResponse {
  if (!isRecord(value) || !isValidRequestId(value.requestId)) return false;
  if (value.status === 'error') return isKnownErrorCode(value.errorCode);
  if (value.status !== 'success') return false;
  return value.rootfsId === PINNED_ROOTFS_ID &&
    value.archiveSha256 === PINNED_ROOTFS_SHA256 &&
    value.archiveBytes === PINNED_ROOTFS_SIZE_BYTES &&
    value.probeExitCode === 0 &&
    Array.isArray(value.probeMarkers) &&
    typeof value.reusedCache === 'boolean';
}

export function isResetRuntimeResponse(value: unknown): value is ResetRuntimeResponse {
  if (!isRecord(value) || !isValidRequestId(value.requestId)) return false;
  if (value.status === 'error') return isKnownErrorCode(value.errorCode);
  return value.status === 'success' &&
    Array.isArray(value.removedVersionIds) &&
    typeof value.homeRemoved === 'boolean' &&
    typeof value.workspacesRemoved === 'boolean';
}

export type TrustedInstallOutcome = Readonly<
  | {
      kind: 'success';
      requestId: string;
      rootfsId: string;
      archiveSha256: string;
      archiveBytes: number;
      extractionFiles: number;
      probeExitCode: number;
      probeMarkers: string[];
      reusedCache: boolean;
      durationMs: number;
    }
  | {
      kind: 'error';
      requestId: string;
      errorCode: TerminalRuntimeOperationErrorCode;
    }
>;

export type TrustedResetOutcome = Readonly<
  | {
      kind: 'success';
      requestId: string;
      removedVersionIds: string[];
      homeRemoved: boolean;
      workspacesRemoved: boolean;
    }
  | {
      kind: 'error';
      requestId: string;
      errorCode: TerminalRuntimeOperationErrorCode;
    }
>;

