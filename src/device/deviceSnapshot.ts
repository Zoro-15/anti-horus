import {NativeModules} from 'react-native';

export type DeviceSnapshot = Readonly<{
  freeStorageBytes: number;
  totalStorageBytes: number;
  freeMemoryBytes: number;
  totalMemoryBytes: number;
  wifiConnected: boolean;
  batteryPercent: number;
  capturedAtMs: number;
}>;

export async function readDeviceSnapshot(): Promise<DeviceSnapshot | null> {
  try {
    const res = await NativeModules.HorusDevice?.getDeviceSnapshot?.();
    return res && typeof res === 'object' && typeof res.batteryPercent === 'number'
      ? (res as DeviceSnapshot)
      : null;
  } catch {
    return null;
  }
}

