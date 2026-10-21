import { Device } from '@nativescript/core';

/**
 * Tells an emulator from a real phone.
 *
 * The app reaches the gateway over the network, and where the gateway is
 * found depends on where the app runs:
 *
 *   • On an Android emulator `10.0.2.2` is the alias for the loopback
 *     interface of the host, so a gateway on the host is found there.
 *   • On a physical phone the loopback interface belongs to the phone. The
 *     port of the gateway is forwarded to the host with
 *     `adb reverse tcp:20128 tcp:20128`, which makes the plain loopback
 *     address work again.
 *
 * The emulators say so themselves: the model of the AVD images carries "sdk",
 * the hardware is "ranchu" or "goldfish", and the fingerprint is "generic".
 * A real phone reports its own name.
 */

/**
 * Reads a static field of `android.os.Build`.
 *
 * The field is returned by the runtime either as the value itself or as a
 * field object that carries it, so both are handled.
 */
function buildField(name: string): string {
  try {
    const build = (globalThis as any)?.android?.os?.Build;
    const field = build?.[name];
    const value =
      field && typeof field === 'object' && 'value' in field ? field.value : field;
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/** True when the app runs on an Android emulator rather than on hardware. */
export function isEmulator(): boolean {
  const fingerprint = buildField('FINGERPRINT').toLowerCase();
  const hardware = buildField('HARDWARE').toLowerCase();
  const product = buildField('PRODUCT').toLowerCase();
  const model = (Device.model || '').toLowerCase();
  const manufacturer = (Device.manufacturer || '').toLowerCase();

  if (fingerprint.includes('generic') || fingerprint.includes('emulator')) {
    return true;
  }
  if (hardware === 'ranchu' || hardware === 'goldfish' || hardware === 'cutf_cvm') {
    return true;
  }
  if (product.startsWith('sdk_') || product.includes('generic')) {
    return true;
  }
  if (model.includes('sdk') || model.includes('emulator') || model.includes('simulator')) {
    return true;
  }
  if (manufacturer === 'unknown' && model.startsWith('android sdk')) {
    return true;
  }

  return false;
}

/** A short description of the device, for the profile screen. */
export function deviceDescription(): string {
  const model = Device.model || 'device';
  const manufacturer = Device.manufacturer;
  const where = isEmulator() ? 'emulator' : 'device';
  return manufacturer && manufacturer !== 'unknown'
    ? `${manufacturer} ${model} · ${where}`
    : `${model} · ${where}`;
}
