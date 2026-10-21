/**
 * The parallax of the launch sequence.
 *
 * The composition of the splash is built from planes, and every plane sits at
 * its own depth. When the phone is tilted, the planes travel at different
 * rates: the mark in front follows the hand the most, the light behind it
 * lags, and the far background leans against the movement so that the depth
 * of the scene is read as depth.
 *
 * Every plane also drifts on its own, at its own rate. The drift is what
 * keeps the scene alive when the phone lies still on a table, and it is the
 * reason no two planes are ever in step.
 *
 * The motion is written straight onto the views, one frame at a time. The
 * animation API is for the beats of the entrance; a loop that has to follow
 * the hand is better served by a frame callback, which never queues work and
 * never leaves an animation running behind it.
 */
import { cancelAnimationFrame, requestAnimationFrame } from '@nativescript/core/animation-frame';
import type { View } from '@nativescript/core';
import { startTilt, type Tilt } from './tilt';

/** The slow movement a plane makes on its own. */
export interface ParallaxDrift {
  /** How far the plane travels along the x axis, in pixels. */
  x: number;
  /** How far the plane travels along the y axis, in pixels. */
  y: number;
  /** How long one swing takes, in milliseconds. */
  period: number;
  /** Where in the swing the plane starts, in radians. */
  phase?: number;
}

/** One plane of the composition. */
export interface ParallaxLayer {
  /** The view that moves. */
  view: View | null;
  /** How far the plane travels at a full tilt, in pixels. */
  depth: number;
  /**
   * Which way the plane travels: with the tilt (1) or against it (-1). A
   * plane behind the eye of the scene leans the other way, which is what
   * makes the depth read.
   */
  direction?: number;
  /** The slow movement the plane makes on its own. */
  drift?: ParallaxDrift;
  /** How fast the plane turns, in degrees per second. */
  spin?: number;
}

/** The state of a plane between two frames. */
interface LayerState {
  layer: ParallaxLayer;
  /** Where the plane is now, in pixels. */
  x: number;
  y: number;
  /** How far the plane has turned, in degrees. */
  angle: number;
}

/**
 * How long the plane takes to reach the place it is asked for. The movement
 * has a little weight: the scene follows the hand, it does not snap to it.
 */
const FOLLOW = 0.16;

/** The longest frame that is taken into account, in seconds. */
const MAX_FRAME = 0.064;

export class Parallax {
  private readonly states: LayerState[];
  private tilt: Tilt = { x: 0, y: 0 };
  private frame = 0;
  private last = 0;
  private clock = 0;
  private stopTilt: (() => void) | undefined;

  constructor(layers: ParallaxLayer[]) {
    this.states = layers.map((layer) => ({
      layer,
      x: 0,
      y: 0,
      angle: 0,
    }));
  }

  /** Starts the scene. */
  start(): void {
    if (this.frame) {
      return;
    }

    this.last = Date.now();
    this.frame = requestAnimationFrame(this.tick);
    this.stopTilt = startTilt((tilt) => {
      this.tilt = tilt;
    });
  }

  /** Stops the scene. The planes keep the place they are in. */
  stop(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    this.stopTilt?.();
    this.stopTilt = undefined;
  }

  /**
   * One frame.
   *
   * The planes are moved towards the place the tilt asks for, a little at a
   * time, and the amount depends on the length of the frame - so the scene
   * feels the same on a slow device and on a fast one.
   */
  private readonly tick = () => {
    const now = Date.now();
    const elapsed = Math.min(now - this.last, MAX_FRAME * 1000) / 1000;
    this.last = now;
    this.clock += elapsed;

    const follow = 1 - Math.exp(-elapsed / FOLLOW);

    for (const state of this.states) {
      const view = state.layer.view;
      if (!view) {
        continue;
      }

      const { depth, direction = 1, drift, spin } = state.layer;

      // The tilt of the phone.
      let targetX = this.tilt.x * depth * direction;
      let targetY = this.tilt.y * depth * direction;

      // The movement of the plane on its own.
      if (drift) {
        const phase = (drift.phase ?? 0) + (this.clock / drift.period) * Math.PI * 2;
        targetX += drift.x * Math.sin(phase);
        targetY += drift.y * Math.cos(phase);
      }

      state.x += (targetX - state.x) * follow;
      state.y += (targetY - state.y) * follow;

      view.translateX = state.x;
      view.translateY = state.y;
      if (spin) {
        state.angle = (state.angle + spin * elapsed) % 360;
        view.rotate = state.angle;
      }
    }

    this.frame = requestAnimationFrame(this.tick);
  };
}
