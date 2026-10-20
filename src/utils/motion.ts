/**
 * Motion helpers.
 *
 * Every animation in the app goes through here so that the timing feels like
 * one system: short and sharp for feedback, a little longer for entrances,
 * and springs for anything the finger is directly touching.
 *
 * Note: NativeScript 8+ takes a single definition object - the properties
 * and the timing live side by side (`animate({ opacity: 1, duration: 200 })`).
 */
import type { View } from '@nativescript/core';

/** Durations in milliseconds. */
export const DURATION = {
  /** Press down / press up. */
  instant: 90,
  /** Small state changes (a chip, a toggle). */
  fast: 170,
  /** Entrances and exits. */
  base: 280,
  /** Big moves (drawer, sheet, screen transitions). */
  slow: 420,
};

/** Curves used across the app. */
export const CURVE = {
  out: 'easeOut',
  in: 'easeIn',
  inOut: 'easeInOut',
  spring: 'spring',
};

/** Options accepted by {@link animate}. */
export interface AnimateOptions {
  duration?: number;
  delay?: number;
  curve?: string;
}

/** Animates a view, tolerating a missing view. */
export function animate(
  view: View | null | undefined,
  properties: Record<string, any>,
  options: AnimateOptions = {},
): Promise<void> {
  if (!view) {
    return Promise.resolve();
  }
  return view
    .animate({
      ...properties,
      duration: options.duration ?? DURATION.base,
      delay: options.delay ?? 0,
      curve: options.curve ?? CURVE.out,
    })
    .then(() => undefined)
    .catch((err) => {
      console.error('Animation failed:', err?.message ?? err);
    });
}

/**
 * The standard entrance: the view fades in while it travels up into place.
 */
export function enter(
  view: View | null | undefined,
  options: AnimateOptions & { distance?: number } = {},
): Promise<void> {
  if (!view) {
    return Promise.resolve();
  }
  const distance = options.distance ?? 14;
  const duration = options.duration ?? DURATION.base;

  view.opacity = 0;
  view.translateY = distance;

  const done = animate(
    view,
    { opacity: 1, translate: { x: 0, y: 0 } },
    { duration, delay: options.delay ?? 0, curve: CURVE.out },
  );

  /*
    Safety net: a view that is not attached to the window yet cannot be
    animated, and it would stay invisible forever. The animation usually
    wins the race, in which case this does nothing.
  */
  setTimeout(() => {
    if (view.opacity < 1) {
      view.opacity = 1;
      view.translateY = 0;
    }
  }, duration + (options.delay ?? 0) + 300);

  return done;
}

/** The standard exit: the view fades out while it drifts down. */
export function exit(
  view: View | null | undefined,
  options: AnimateOptions & { distance?: number } = {},
): Promise<void> {
  if (!view) {
    return Promise.resolve();
  }
  const distance = options.distance ?? 10;
  return animate(
    view,
    { opacity: 0, translate: { x: 0, y: distance } },
    { duration: options.duration ?? DURATION.fast, curve: CURVE.in },
  );
}

/** Press down: the control contracts a little. */
export function pressIn(view: View | null | undefined, scale = 0.93): Promise<void> {
  return animate(view, { scale: { x: scale, y: scale } }, { duration: DURATION.instant, curve: CURVE.out });
}

/** Press up: the control springs back. */
export function pressOut(view: View | null | undefined, scale = 0.93): Promise<void> {
  return animate(
    view,
    { scale: { x: 1, y: 1 } },
    { duration: DURATION.fast, curve: CURVE.spring },
  );
}

/**
 * A short pulse, used to draw the eye to something that just changed.
 */
export function pulse(view: View | null | undefined, to = 1.12): Promise<void> {
  if (!view) {
    return Promise.resolve();
  }
  return view
    .animate({ scale: { x: to, y: to }, duration: 180, curve: CURVE.out })
    .then(() => view.animate({ scale: { x: 1, y: 1 }, duration: 260, curve: CURVE.spring }))
    .then(() => undefined)
    .catch(() => undefined);
}

/** One step of a repeating animation. */
export interface LoopFrame {
  /** The properties to animate to. */
  properties: Record<string, any>;
  duration?: number;
  curve?: string;
}

/**
 * Runs an animation over and over.
 *
 * NativeScript's CSS `@keyframes` do not run inside a component's scoped
 * style block, so the ambient motion of the app is driven from here instead.
 * The frames are played one after the other, which gives a smooth ping-pong.
 *
 * Returns a function that stops the loop.
 */
export function loopAnimation(
  view: View | null | undefined,
  frames: LoopFrame[],
  options: { delay?: number } = {},
): () => void {
  let index = 0;
  let stopped = false;

  const step = () => {
    if (stopped || !view) {
      return;
    }
    /*
      A view that is not on screen cannot be animated: the animation is
      resolved at once. Without this guard the chain would start the next
      frame immediately, again and again - the thread then spins at full
      speed, the app stops answering and it runs out of memory.
    */
    if (view.isLoaded === false) {
      return;
    }

    const frame = frames[index % frames.length];
    const duration = frame.duration ?? DURATION.base;
    const started = Date.now();

    view
      .animate({
        ...frame.properties,
        duration,
        curve: frame.curve ?? CURVE.inOut,
      })
      .then(() => {
        // The same guard, for the case that the animation was skipped.
        if (Date.now() - started < duration / 2) {
          stopped = true;
          return;
        }
        index += 1;
        step();
      })
      .catch(() => {
        stopped = true;
      });
  };

  if (options.delay) {
    setTimeout(step, options.delay);
  } else {
    step();
  }

  return () => {
    stopped = true;
  };
}
