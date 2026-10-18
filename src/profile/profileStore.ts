import {NativeModules} from 'react-native';

export type UserProfile = Readonly<{
  hasPassword: boolean;
}>;

function getDevice() {
  return NativeModules.HorusDevice;
}

export async function readUserProfile(): Promise<UserProfile | null> {
  try {
    const res = await getDevice()?.getProfile?.();
    return res && res.configured === true && typeof res.hasPassword === 'boolean'
      ? {hasPassword: res.hasPassword}
      : null;
  } catch {
    return null;
  }
}

export async function saveUserProfile(password: string): Promise<boolean> {
  if (password.length < 4 || password.length > 128) return false;
  try {
    const res = await getDevice()?.saveProfile?.({password});
    return res?.status === 'success';
  } catch {
    return false;
  }
}

export type PasswordCheck =
  | Readonly<{kind: 'success'}>
  | Readonly<{kind: 'incorrect'}>
  | Readonly<{kind: 'locked'; retryAfterMs: number}>;

export async function verifyUserPassword(password: string): Promise<PasswordCheck> {
  try {
    const res = await getDevice()?.verifyPassword?.({password});
    if (res?.status === 'success') return {kind: 'success'};
    if (res?.status === 'locked' && typeof res.retryAfterMs === 'number' && res.retryAfterMs > 0) {
      return {kind: 'locked', retryAfterMs: res.retryAfterMs};
    }
    return {kind: 'incorrect'};
  } catch {
    return {kind: 'incorrect'};
  }
}

export function lockedOutMessage(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000);
  const wait = seconds < 60 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`;
  return `Too many incorrect attempts. Try again in ${wait}.`;
}
