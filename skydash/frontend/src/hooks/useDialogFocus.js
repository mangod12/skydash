import { useEffect } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Focus handling for aria-modal dialogs: move focus inside on open (unless
 * something inside already has it), keep Tab and Shift+Tab inside, and give
 * focus back to whatever opened the dialog when it closes.
 */
export function useDialogFocus(open, panelRef) {
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const panel = () => panelRef.current;
    const focusables = () => (panel() ? [...panel().querySelectorAll(FOCUSABLE)] : []);

    const frame = requestAnimationFrame(() => {
      const el = panel();
      if (!el || el.contains(document.activeElement)) return;
      (focusables()[0] || el).focus?.();
    });

    const onKeyDown = (e) => {
      if (e.key !== 'Tab' || !panel()) return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel().contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (opener && opener !== document.body && document.contains(opener)) opener.focus?.();
    };
  }, [open, panelRef]);
}
