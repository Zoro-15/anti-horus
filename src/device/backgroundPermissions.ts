import {NativeModules, PermissionsAndroid, Platform} from 'react-native';

export type BackgroundPermissions = Readonly<{
  notifications: boolean;
  batteryUnrestricted: boolean;
}>;

const device = NativeModules.HorusDevice;

export async function readBackgroundPermissions(): Promise<BackgroundPermissions | null> {
  try {
    const res = await device?.getBackgroundPermissions?.();
    return res && typeof res.notifications === 'boolean' && typeof res.batteryUnrestricted === 'boolean'
      ? {notifications: res.notifications, batteryUnrestricted: res.batteryUnrestricted}
      : null;
  } catch {
    return null;
  }
}

export async function requestNotifications(): Promise<void> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result === PermissionsAndroid.RESULTS.GRANTED || result === PermissionsAndroid.RESULTS.DENIED) return;
    } catch {
      // Fall through to settings
    }
  }
  await device?.openNotificationSettings?.().catch(() => undefined);
}

export async function requestBatteryUnrestricted(): Promise<void> {
  await device?.requestBatteryUnrestricted?.().catch(() => undefined);
}

