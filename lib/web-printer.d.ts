/**
 * Type declarations for Web Bluetooth and Web Serial APIs.
 * These are browser-only APIs not included in the default TypeScript lib.
 */

// Web Bluetooth API
interface BluetoothDevice {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  // ponytail: optional — only Chromium 103+; used for silent auto-reconnect.
  watchAdvertisements?(): Promise<void>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothDeviceRequestOptions {
  filters?: Array<{ services: string[] }>;
  optionalServices?: string[];
}

interface Bluetooth {
  requestDevice(options: BluetoothDeviceRequestOptions): Promise<BluetoothDevice>;
  getAvailability(): Promise<boolean>;
  // ponytail: Chromium 103+ — returns previously-permitted devices for silent reconnect.
  getDevices?(): Promise<BluetoothDevice[]>;
  requestWatchAdvertisements?(device: BluetoothDevice): Promise<void>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}

// Web Serial API
interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPort {
  getInfo(): SerialPortInfo;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable?: WritableStream<Uint8Array>;
}

interface Serial {
  requestPort(): Promise<SerialPort>;
}

interface Navigator {
  serial?: Serial;
}
