import nativeTerminalRuntime from '../native/NativeTerminalRuntime';
import type {
  InstallRootfsRequest,
  InstallRootfsResponse,
  ProvisionToolchainResponse,
  ResetRuntimeResponse,
  Spec,
  TerminalToolchainTarget,
  TerminalResetScope,
  TerminalRuntimeStatusResponse,
} from '../native/NativeTerminalRuntime';

import {
  buildInstallRootfsRequest,
  buildResetRuntimeRequest,
  isInstallRootfsResponse,
  isResetRuntimeResponse,
  isValidTerminalRuntimeErrorCode,
  isTerminalRuntimeStatusResponse as isDistroTerminalRuntimeStatusResponse,
  TERMINAL_RUNTIME_SCHEMA_VERSION,
  type TerminalRuntimeOperationErrorCode,
  type TrustedInstallOutcome,
  type TrustedResetOutcome,
} from './distroContract';

export {TERMINAL_RUNTIME_SCHEMA_VERSION};

export type TerminalRuntimeErrorCode =
  | 'unavailable'
  | 'invalid_response'
  | 'internal_error';

export type TerminalRuntimeStatusSuccess = Readonly<{
  kind: 'success';
  schemaVersion: number;
  runtimeState: 'not_installed' | 'ready';
  runtimeVersion: string;
  abi: string;
  apiLevel: number;
  appVersion: string;
  storageRoot: string;
  prootAvailable: boolean;
  prootVersion: string;
  installedVersionIds: readonly string[];
  activeRootfsId?: string;
  activeAlpineRelease?: string;
  activeRootfsSha256?: string;
  activeInstalledAt?: string;
}>;

export type TerminalRuntimeStatusView = Readonly<
  | TerminalRuntimeStatusSuccess
  | {kind: 'error'; errorCode: TerminalRuntimeErrorCode}
>;

export type TerminalDebugLogView = Readonly<
  | {kind: 'success'; path: string; externalPath?: string; bytes: number; tail: string}
  | {kind: 'error'; errorCode: 'unavailable' | 'invalid_response' | 'internal_error'}
>;

export async function readTerminalDebugLog(
  runtime: Pick<Spec, 'getDebugLog'> | null = nativeTerminalRuntime,
): Promise<TerminalDebugLogView> {
  if (runtime === null) return {kind: 'error', errorCode: 'unavailable'};
  try {
    const res = (await runtime.getDebugLog()) as {status: string; path?: string; externalPath?: string; bytes?: number; tail?: string; errorCode?: string};
    if (res && res.status === 'success' && typeof res.path === 'string' && typeof res.tail === 'string') {
      return {kind: 'success', path: res.path, ...(res.externalPath !== undefined ? {externalPath: res.externalPath} : {}), bytes: res.bytes ?? 0, tail: res.tail};
    }
    return {kind: 'error', errorCode: res?.status === 'error' ? 'internal_error' : 'invalid_response'};
  } catch {
    return {kind: 'error', errorCode: 'internal_error'};
  }
}

export function isTerminalRuntimeStatusResponse(
  value: unknown,
): value is TerminalRuntimeStatusResponse {
  return isDistroTerminalRuntimeStatusResponse(value);
}

export async function readTerminalRuntimeStatus(
  runtime: Spec | null = nativeTerminalRuntime,
): Promise<TerminalRuntimeStatusView> {
  if (runtime === null) return {kind: 'error', errorCode: 'unavailable'};
  try {
    const response = await runtime.getRuntimeStatus();
    if (!isTerminalRuntimeStatusResponse(response)) return {kind: 'error', errorCode: 'invalid_response'};
    if (response.status === 'error') return {kind: 'error', errorCode: 'internal_error'};
    const s = response as any;
    return {
      kind: 'success',
      schemaVersion: s.schemaVersion,
      runtimeState: s.runtimeState,
      runtimeVersion: s.runtimeVersion,
      abi: s.abi,
      apiLevel: s.apiLevel,
      appVersion: s.appVersion,
      storageRoot: s.storageRoot,
      prootAvailable: s.prootAvailable,
      prootVersion: s.prootVersion,
      installedVersionIds: s.installedVersionIds,
      ...(s.activeRootfsId !== undefined ? {activeRootfsId: s.activeRootfsId} : {}),
      ...(s.activeAlpineRelease !== undefined ? {activeAlpineRelease: s.activeAlpineRelease} : {}),
      ...(s.activeRootfsSha256 !== undefined ? {activeRootfsSha256: s.activeRootfsSha256} : {}),
      ...(s.activeInstalledAt !== undefined ? {activeInstalledAt: s.activeInstalledAt} : {}),
    };
  } catch {
    return {kind: 'error', errorCode: 'internal_error'};
  }
}

function operationError(
  requestId: string,
  errorCode: TerminalRuntimeOperationErrorCode,
): {kind: 'error'; requestId: string; errorCode: TerminalRuntimeOperationErrorCode} {
  return {kind: 'error', requestId, errorCode};
}

export async function installRootfs(
  requestId: string,
  runtime: Pick<Spec, 'installRootfs'> | null = nativeTerminalRuntime,
): Promise<TrustedInstallOutcome> {
  return runRootfsInstall(requestId, runtime === null ? null : request => runtime.installRootfs(request));
}

export async function importRootfs(
  requestId: string,
  runtime: Pick<Spec, 'importRootfs'> | null = nativeTerminalRuntime,
): Promise<TrustedInstallOutcome> {
  return runRootfsInstall(requestId, runtime === null ? null : request => runtime.importRootfs(request));
}

async function runRootfsInstall(
  requestId: string,
  call: ((request: InstallRootfsRequest) => Promise<unknown>) | null,
): Promise<TrustedInstallOutcome> {
  const request = buildInstallRootfsRequest(requestId);
  if (request === null) return operationError(requestId, 'invalid_request');
  if (call === null) return operationError(requestId, 'unavailable');

  try {
    const response = (await call(request)) as InstallRootfsResponse;
    if (!isInstallRootfsResponse(response) || response.requestId !== requestId) {
      return operationError(requestId, 'invalid_response');
    }
    if (response.status === 'error') {
      return isValidTerminalRuntimeErrorCode(response.errorCode)
        ? operationError(requestId, response.errorCode)
        : operationError(requestId, 'invalid_response');
    }
    const s = response as any;
    return {
      kind: 'success',
      requestId,
      rootfsId: s.rootfsId,
      archiveSha256: s.archiveSha256,
      archiveBytes: s.archiveBytes,
      extractionFiles: s.extractionFiles,
      probeExitCode: s.probeExitCode,
      probeMarkers: s.probeMarkers,
      reusedCache: s.reusedCache,
      durationMs: s.durationMs,
    };
  } catch {
    return operationError(requestId, 'internal_error');
  }
}

export async function provisionAlpineToolchain(
  requestId: string,
  target: TerminalToolchainTarget,
  runtime: Pick<Spec, 'provisionToolchain'> | null = nativeTerminalRuntime,
): Promise<{kind: 'success'; requestId: string} | {kind: 'error'; requestId: string; errorCode: TerminalRuntimeOperationErrorCode}> {
  if (runtime === null) return operationError(requestId, 'unavailable');
  try {
    const response = (await runtime.provisionToolchain({requestId, target})) as ProvisionToolchainResponse;
    if (response.requestId !== requestId || (response.status !== 'success' && response.status !== 'error')) {
      return operationError(requestId, 'invalid_response');
    }
    if (response.status === 'error') {
      return operationError(
        requestId,
        isValidTerminalRuntimeErrorCode(response.errorCode) ? response.errorCode : 'invalid_response',
      );
    }
    return {kind: 'success', requestId};
  } catch {
    return operationError(requestId, 'internal_error');
  }
}

export async function resetRuntime(
  requestId: string,
  scope: TerminalResetScope,
  runtime: Pick<Spec, 'resetRuntime'> | null = nativeTerminalRuntime,
): Promise<TrustedResetOutcome> {
  const request = buildResetRuntimeRequest(requestId, scope);
  if (request === null) return operationError(requestId, 'invalid_request');
  if (runtime === null) return operationError(requestId, 'unavailable');

  try {
    const response = (await runtime.resetRuntime(request)) as ResetRuntimeResponse;
    if (!isResetRuntimeResponse(response) || response.requestId !== requestId) {
      return operationError(requestId, 'invalid_response');
    }
    if (response.status === 'error') {
      return isValidTerminalRuntimeErrorCode(response.errorCode)
        ? operationError(requestId, response.errorCode)
        : operationError(requestId, 'invalid_response');
    }
    const s = response as any;
    return {
      kind: 'success',
      requestId,
      removedVersionIds: s.removedVersionIds,
      homeRemoved: s.homeRemoved,
      workspacesRemoved: s.workspacesRemoved,
    };
  } catch {
    return operationError(requestId, 'internal_error');
  }
}

