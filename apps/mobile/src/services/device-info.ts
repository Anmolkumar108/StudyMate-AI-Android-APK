export interface DeviceMetadata {
  deviceName: string;
  deviceOs: string;
  manufacturer?: string;
  modelName?: string;
  isDevice: boolean;
  appVersion: string;
}

function getPlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native');
    if (rn && rn.Platform && rn.Platform.OS) {
      return rn.Platform.OS;
    }
  } catch {
    // Fallback for Node test environments
  }
  return 'android';
}

export function getDeviceDetails(): DeviceMetadata {
  let manufacturer = '';
  let modelName = '';
  let osVersion = '';
  let isDevice = false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device');
    if (Device) {
      manufacturer = Device.manufacturer || '';
      modelName = Device.modelName || Device.deviceName || '';
      osVersion = Device.osVersion ? ` ${Device.osVersion}` : '';
      isDevice = Device.isDevice ?? false;
    }
  } catch {
    // Fallback for mock/test environments
  }

  const os = getPlatformOS();
  const osPrefix = os === 'android' ? 'Android' : os === 'ios' ? 'iOS' : os;
  const fullOs = `${osPrefix}${osVersion}`;

  let fullModel = modelName;
  if (!fullModel) {
    fullModel = os === 'android' ? 'Android Device' : 'Apple Device';
  } else if (manufacturer && !fullModel.toLowerCase().includes(manufacturer.toLowerCase())) {
    fullModel = `${manufacturer} ${fullModel}`;
  }

  return {
    deviceName: fullModel,
    deviceOs: fullOs,
    manufacturer: manufacturer || undefined,
    modelName: modelName || undefined,
    isDevice,
    appVersion: '1.0.0',
  };
}

