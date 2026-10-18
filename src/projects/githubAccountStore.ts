import {NativeModules} from 'react-native';
import type {GithubAccount} from './githubRepositories';

const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const GITHUB_AVATAR_PATH_PATTERN = /^https:\/\/avatars\.githubusercontent\.com\/[A-Za-z0-9._~!$'()*+,;=:@%/-]{1,256}$/;

const dev = NativeModules.HorusDevice;

function isGithubAccount(value: unknown): value is GithubAccount {
  return typeof value === 'object' && value !== null &&
    typeof (value as GithubAccount).username === 'string' &&
    GITHUB_USERNAME_PATTERN.test((value as GithubAccount).username) &&
    ((value as GithubAccount).avatarUrl === undefined ||
      (typeof (value as GithubAccount).avatarUrl === 'string' && GITHUB_AVATAR_PATH_PATTERN.test((value as GithubAccount).avatarUrl!)));
}

export async function readStoredGithubAccount(): Promise<GithubAccount | undefined> {
  try {
    const res = await dev?.getGithubAccount?.();
    return isGithubAccount(res) ? res : undefined;
  } catch {
    return undefined;
  }
}

export async function saveGithubAccount(account: GithubAccount): Promise<boolean> {
  if (!isGithubAccount(account)) return false;
  try {
    const res = await dev?.saveGithubAccount?.(account);
    return res?.status === 'success';
  } catch {
    return false;
  }
}

export async function clearStoredGithubAccount(): Promise<boolean> {
  try {
    const res = await dev?.clearGithubAccount?.();
    return res?.status === 'success';
  } catch {
    return false;
  }
}

