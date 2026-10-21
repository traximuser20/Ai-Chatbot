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
 * Makes both bars transparent.
 *
 * The launch sequence is a dark moment that reaches to the edges of the
 * screen: the ink of the splash has to be seen under the notification bar
 * and under the navigation bar, so both are made transparent while the
 * splash is up. The window paints the given colour behind them, because
 * that is what a transparent bar shows.
 *
 * The icons of the bars stay light, because the splash is dark in every
 * theme.
 */
export function makeSystemBarsTransparent(behind: string): void {
  try {
    const window = currentWindow();
    if (!window) {
      return;
    }

    const colour = new Color(behind).android;
    window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(colour));
    window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
    window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);

    if (android.os.Build.VERSION.SDK_INT >= 30) {
      const controller = window.getInsetsController();
      const lightBars = (android.view as any).WindowInsetsController;
      controller?.setSystemBarsAppearance(
        0,
        lightBars.APPEARANCE_LIGHT_STATUS_BARS | lightBars.APPEARANCE_LIGHT_NAVIGATION_BARS,
      );
    }
  } catch (err) {
    // Not fatal - the bars simply keep the platform default.
    console.error('Could not make the system bars transparent:', err);
  }
}

/**
 * Paints the background of the page.
 *
 * The content of the app keeps its distance from the system bars, but the
 * background of the page reaches under them - and that is what a
 * transparent bar shows.
 */
export function paintPageBackground(background: string): void {
  try {
    const frame = Application.getRootView() as any;
    const page = frame?.currentPage;
    if (page) {
      page.backgroundColor = new Color(background);
    }
  } catch (err) {
    // Not fatal - the page simply keeps its colour.
    console.error('Could not paint the background of the page:', err);
  }
}

/**
 * Gives the window its background back and paints the bars with the colour
 * of the surface they sit on.
 */
export function restoreSystemBars(statusBar: string, navigationBar: string, dark: boolean): void {
  try {
    currentWindow()?.setBackgroundDrawable(null);
  } catch (err) {
    // Not fatal - the window simply keeps the background of the splash.
    console.error('Could not restore the background of the window:', err);
  }

  paintStatusBar(statusBar, dark);
  paintNavigationBar(navigationBar, dark);
}

