import { Application, Color } from '@nativescript/core';

/**
 * The status bar of the Android window.
 *
 * The bar is not a view, so it cannot be styled with CSS - it has to be
 * painted from code. The page owns the window, which is the supported way to
 * recolour it.
 *
 * `dark` tells whether the surface behind the bar is dark: the icons of the
 * bar then have to be light, or they would disappear into the background.
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
      controller.setSystemBarsAppearance(dark ? 0 : lightBars, lightBars);
    }
  } catch (err) {
    // Not fatal - the bar simply keeps the platform default.
    console.error('Could not restyle the status bar:', err);
  }
}
