import { Application, Color } from '@nativescript/core';

/**
 * The system bars of the Android window: the notification bar at the top and
 * the navigation bar at the bottom.
 *
 * The bars are not views, so they cannot be styled with CSS - they have to
 * be painted from code. The page owns the window, which is the supported way
 * to recolour them.
 *
 * `dark` tells whether the surface behind a bar is dark: the icons of the
 * bar then have to be light, or they would disappear into the background.
 *
 * The bars themselves are transparent (see the theme of the app), so what is
 * seen under them is the background of the app. The launch sequence paints
 * that background with its ink, so the splash reaches to the edges of the
 * screen.
 */

/** The window of the activity that is on screen. */
function currentWindow(): any {
  return Application.android?.foregroundActivity?.getWindow();
}

/**
 * Paints the notification bar.
 */
export function paintStatusBar(background: string, dark: boolean): void {
  try {
    const frame = Application.getRootView() as any;
    const page = frame?.currentPage;
    if (page) {
      page.androidStatusBarBackground = new Color(background);
    }

    const activity = Application.android?.foregroundActivity;
    if (activity && android.os.Build.VERSION.SDK_INT >= 30) {
      const controller = activity.getWindow().getInsetsController();
      const lightBars = (android.view as any).WindowInsetsController
        .APPEARANCE_LIGHT_STATUS_BARS;
      controller?.setSystemBarsAppearance(dark ? 0 : lightBars, lightBars);
    }
  } catch (err) {
    // Not fatal - the bar simply keeps the platform default.
    console.error('Could not restyle the status bar:', err);
  }
}

/**
 * Paints the navigation bar.
 */
export function paintNavigationBar(background: string, dark: boolean): void {
  try {
    const window = currentWindow();
    if (!window) {
      return;
    }

    window.setNavigationBarColor(new Color(background).android);

    if (android.os.Build.VERSION.SDK_INT >= 30) {
      const controller = window.getInsetsController();
      const lightBars = (android.view as any).WindowInsetsController;
      const lightNavigationBars = lightBars.APPEARANCE_LIGHT_NAVIGATION_BARS;
      // The icons of the bar follow the surface behind it.
      controller?.setSystemBarsAppearance(dark ? 0 : lightNavigationBars, lightNavigationBars);
    }
  } catch (err) {
    // Not fatal - the bar simply keeps the platform default.
    console.error('Could not restyle the navigation bar:', err);
  }
}

/**
 * Paints the background of the root view.
 *
 * The content of the app keeps its distance from the system bars, but the
 * background of the root view reaches under them - and that is what a
 * transparent bar shows.
 */
export function paintRootBackground(background: string): void {
  try {
    const frame = Application.getRootView() as any;
    if (frame) {
      frame.backgroundColor = new Color(background);
    }
  } catch (err) {
    // Not fatal - the root view simply keeps its colour.
    console.error('Could not paint the background of the root view:', err);
  }
}

/**
 * Paints both bars with the ink of the launch sequence.
 *
 * The splash is a dark moment in every theme, so the icons of the bars stay
 * light while it is up.
 */
export function paintSplashBars(ink: string): void {
  paintStatusBar(ink, true);
  paintNavigationBar(ink, true);
}

/**
 * Hides the system bars entirely, so a surface (the splash) can reach every
 * edge of the screen.
 */
export function hideSystemBars(): void {
  try {
    const window = currentWindow();
    if (!window) {
      return;
    }

    if (android.os.Build.VERSION.SDK_INT >= 30) {
      const controller = window.getInsetsController();
      const types =
        (android.view as any).WindowInsets.Type.statusBars() |
        (android.view as any).WindowInsets.Type.navigationBars();
      controller?.hide(types);
      controller?.setSystemBarsBehavior(
        (android.view as any).WindowInsetsController
          .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE,
      );
    } else {
      const decorView = window.getDecorView();
      const flags =
        (android.view as any).View.SYSTEM_UI_FLAG_FULLSCREEN |
        (android.view as any).View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
        (android.view as any).View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
        (android.view as any).View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
        (android.view as any).View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
        (android.view as any).View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
      decorView.setSystemUiVisibility(flags);
    }
  } catch (err) {
    console.error('Could not hide the system bars:', err);
  }
}

/**
 * Brings the system bars back after they have been hidden.
 */
export function showSystemBars(): void {
  try {
    const window = currentWindow();
    if (!window) {
      return;
    }

    if (android.os.Build.VERSION.SDK_INT >= 30) {
      const controller = window.getInsetsController();
      const types =
        (android.view as any).WindowInsets.Type.statusBars() |
        (android.view as any).WindowInsets.Type.navigationBars();
      controller?.show(types);
    } else {
      window.getDecorView().setSystemUiVisibility(0);
    }
  } catch (err) {
    console.error('Could not show the system bars:', err);
  }
}

/**
 * Gives the bars back the colour of the surface they sit on.
 */
export function restoreSystemBars(statusBar: string, navigationBar: string, dark: boolean): void {
  paintStatusBar(statusBar, dark);
  paintNavigationBar(navigationBar, dark);
}
