/**
 * The tilt of the device.
 *
 * The launch sequence leans with the phone: the mark and the light behind it
 * travel at different rates, so a small movement of the hand shows the depth
 * of the composition.
 *
 * The reading comes from the gravity sensor of Android. The sensor reports
 * the direction of "up" in the coordinates of the device, so the tilt is the
 * difference between that direction now and the direction it had when the
 * splash opened. The difference is a rotation, and the rotation is read on
 * the two axes a screen knows: the roll (the phone leaning to the left or to
 * the right) and the pitch (the top of the phone coming towards the user or
 * going away).
 *
 * The reading is relative, so it does not matter how the phone is held: the
 * splash starts centred in whatever posture the hand is in, and the scene
 * follows from there.
 *
 * A platform without the sensor never calls the listener. The scene then
 * keeps its ambient drift - the tilt is an extra, never a requirement.
 */
import { Application } from '@nativescript/core';

/** The tilt of the device: both axes run from -1 to 1. */
export interface Tilt {
  /** The phone leaning to the right (positive) or to the left (negative). */
  x: number;
  /** The top of the phone towards the user (positive) or away (negative). */
  y: number;
}

/** A direction in the coordinates of the device. */
interface Vector {
  x: number;
  y: number;
  z: number;
}

/** The gravity of the earth, in m/s^2. */
const GRAVITY = 9.80665;

/**
 * How far the phone has to lean for the tilt to reach its limit: about 24
 * degrees. Past that the reading is not a tilt any more but a new posture,
 * and the scene follows it without a jump.
 */
const LIMIT = 0.42;

/**
 * How many readings are averaged into the reference. The hand is rarely
 * perfectly still when the app opens, so the first readings are averaged
 * instead of taken as they come - otherwise the zero point would be a
 * movement and the splash would sit off centre.
 */
const REFERENCE_SAMPLES = 3;

type Listener = (tilt: Tilt) => void;

let manager: android.hardware.SensorManager | undefined;
let sensor: android.hardware.Sensor | undefined;
let nativeListener: android.hardware.SensorEventListener | undefined;

/** The direction of "up" when the splash opened. */
let reference: Vector | undefined;
/** The readings that are averaged into the reference. */
let samples: Vector[] = [];

const listeners: Listener[] = [];

/**
 * Starts listening for the tilt of the device.
 *
 * Returns a function that stops the listener again.
 */
export function startTilt(listener: Listener): () => void {
  listeners.push(listener);

  if (!nativeListener) {
    openSensor();
  }

  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
    if (!listeners.length) {
      closeSensor();
    }
  };
}

/**
 * Opens the gravity sensor.
 *
 * The sensor is Android's. Another platform has no tilt to offer, so the
 * scene simply keeps its drift.
 */
function openSensor(): void {
  if (!Application.android) {
    return;
  }

  try {
    manager = (Application.android as any).getSystemService(
      android.content.Context.SENSOR_SERVICE,
    ) as android.hardware.SensorManager;

    if (!manager) {
      return;
    }

    /*
      The gravity sensor is the accelerometer with the movement of the hand
      filtered out, so the reading stays quiet while the phone is turned. It
      is not on every device, and the plain accelerometer is the fallback.
    */
    sensor =
      manager.getDefaultSensor(android.hardware.Sensor.TYPE_GRAVITY) ??
      manager.getDefaultSensor(android.hardware.Sensor.TYPE_ACCELEROMETER) ??
      undefined;

    if (!sensor) {
      return;
    }

    nativeListener = new android.hardware.SensorEventListener({
      onAccuracyChanged: () => undefined,
      onSensorChanged: (event: android.hardware.SensorEvent) => {
        const values = event.values;
        if (!values || values.length < 3) {
          return;
        }
        onReading({
          x: values[0] / GRAVITY,
          y: values[1] / GRAVITY,
          z: values[2] / GRAVITY,
        });
      },
    });

    // The UI rate: fast enough for a scene that follows the hand, slow
    // enough not to wake the radio of the device for a splash screen.
    manager.registerListener(nativeListener, sensor, android.hardware.SensorManager.SENSOR_DELAY_UI);
  } catch (err) {
    console.error('The tilt sensor could not be opened:', err);
    manager = undefined;
    sensor = undefined;
    nativeListener = undefined;
  }
}

/** Closes the gravity sensor. */
function closeSensor(): void {
  if (manager && nativeListener) {
    manager.unregisterListener(nativeListener);
  }

  manager = undefined;
  sensor = undefined;
  nativeListener = undefined;
  reference = undefined;
  samples = [];
}

/**
 * A reading of the sensor.
 *
 * The first readings become the reference - the direction of "up" as the
 * splash opened. Every reading after that is the tilt away from it.
 */
function onReading(current: Vector): void {
  if (!reference) {
    samples.push(current);

    if (samples.length < REFERENCE_SAMPLES) {
      return;
    }

    reference = samples.reduce(
      (sum, sample) => ({
        x: sum.x + sample.x / samples.length,
        y: sum.y + sample.y / samples.length,
        z: sum.z + sample.z / samples.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
    samples = [];

    return;
  }

  const tilt = tiltOf(current);
  for (const listener of listeners) {
    listener(tilt);
  }
}

/**
 * The tilt of the device away from the reference.
 *
 * The difference between the direction of "up" now and the direction it had
 * is a rotation. The rotation is written as a vector - the axis it turns
 * around, scaled by the angle - and the two components that a screen knows
 * are read from it: the roll around the axis that points out of the screen
 * (the phone leaning left or right) and the pitch around the axis that points
 * to the right (the top of the phone coming towards or away from the user).
 */
function tiltOf(current: Vector): Tilt {
  const ref = reference as Vector;

  // The axis of the rotation that brings "up" back to where it was.
  const axis = {
    x: current.y * ref.z - current.z * ref.y,
    y: current.z * ref.x - current.x * ref.z,
    z: current.x * ref.y - current.y * ref.x,
  };

  const sin = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
  const cos = current.x * ref.x + current.y * ref.y + current.z * ref.z;

  if (sin < 1e-6) {
    return { x: 0, y: 0 };
  }

  // The angle of the rotation, and the rotation vector itself.
  const angle = Math.atan2(sin, cos) / sin;
  const omega = {
    x: axis.x * angle,
    y: axis.y * angle,
    z: axis.z * angle,
  };

  return {
    x: clamp(-omega.z / LIMIT),
    y: clamp(omega.x / LIMIT),
  };
}

/** Keeps a number inside the range -1 to 1. */
function clamp(value: number): number {
  if (value > 1) {
    return 1;
  }
  if (value < -1) {
    return -1;
  }
  return value;
}
