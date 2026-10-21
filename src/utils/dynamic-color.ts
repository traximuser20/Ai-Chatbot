import { Application } from '@nativescript/core';
import { cssVariableName, SCHEME_ROLES, type MaterialScheme } from './material';

/**
 * Dynamic colour - the palette of the app follows the route.
 *
 * Material You derives the whole palette from a source colour. Here that
 * source is the provider that answers, so switching the route repaints the
 * interface in the colours of the new provider.
 *
 * The palette is written into the CSS variables of the root view. They are
 * *unscoped* variables, which take precedence over the ones a stylesheet
 * declares, so the palette of the route wins over the fallback of
 * `src/app.css` - and the fallback is still there if anything goes wrong.
 *
 * A CSS variable is resolved while the styles are applied, so the tree has to
 * be re-styled after the variables have changed. That is what
 * `refreshStyles` does.
 */

/** Writes a scheme into the CSS variables of a view. */
export function applyScheme(scheme: MaterialScheme, target?: any): void {
  const root = target ?? (Application.getRootView() as any);
  const style = root?.style;
  if (!style || typeof style.setUnscopedCssVariable !== 'function') {
    console.error('Could not reach the root view to apply the palette.');
    return;
  }

  try {
    for (const role of SCHEME_ROLES) {
      style.setUnscopedCssVariable(cssVariableName(role), scheme[role]);
    }
  } catch (err) {
    console.error('Could not write the palette into the CSS variables:', err);
    return;
  }

  refreshStyles(root);
}

/**
 * Re-applies the styles of a whole tree.
 *
 * The class of a view is what triggers it - changing it walks the tree and
 * applies the rules again, which resolves the CSS variables with their new
 * values. The framework does the work through `_onCssStateChange`; the
 * fallback re-assigns the class name, which is a different string and
 * therefore re-applies the rules as well.
 */
export function refreshStyles(root: any): void {
  if (!root) {
    return;
  }

  try {
    if (typeof root._onCssStateChange === 'function') {
      root._onCssStateChange();
      return;
    }
  } catch (err) {
    console.error('Could not re-apply the styles of the tree:', err);
  }

  try {
    root.className = `${root.className ?? ''} `;
  } catch (err) {
    console.error('Could not re-apply the styles of the tree:', err);
  }
}
