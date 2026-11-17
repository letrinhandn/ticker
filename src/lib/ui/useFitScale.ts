"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export type FitScaleOptions = {
  /** Multiply fit ratio (e.g. 0.96 for breathing room). Default 1. */
  factor?: number;
  /** Cap scale so large desktops don't balloon the board. */
  maxScale?: number;
  /** Floor so tiny windows don't collapse to illegible. */
  minScale?: number;
  /**
   * Subtract CSS padding from the shell before fitting.
   * Board uses this so HUD corner insets stay clear of the table.
   */
  subtractPadding?: boolean;
};

export type FitScale = {
  shellRef: RefObject<HTMLDivElement | null>;
  tableRef: RefObject<HTMLDivElement | null>;
  scale: number;
  w: number;
  h: number;
};

/**
 * Fit a fixed-size table inside a shell via transform: scale.
 * Batches ResizeObserver + visualViewport with rAF to avoid layout thrash.
 */
export function useFitScale(options: FitScaleOptions = {}): FitScale {
  const {
    factor = 1,
    maxScale = 1.4,
    minScale = 0.28,
    subtractPadding = false,
  } = options;

  const shellRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, w: 0, h: 0 });

  useEffect(() => {
    const shell = shellRef.current;
    const table = tableRef.current;
    if (!shell || !table) return;

    let raf = 0;
    let lastKey = "";

    const measure = () => {
      raf = 0;
      const style = subtractPadding ? getComputedStyle(shell) : null;
      const padX = style
        ? (parseFloat(style.paddingLeft) || 0) +
          (parseFloat(style.paddingRight) || 0)
        : 0;
      const padY = style
        ? (parseFloat(style.paddingTop) || 0) +
          (parseFloat(style.paddingBottom) || 0)
        : 0;
      // Prefer shell box; if it hasn't been laid out yet (height 0), fall back
      // to the visual viewport so we don't lock onto minScale forever.
      const vv = window.visualViewport;
      const fallbackW = vv?.width ?? window.innerWidth;
      const fallbackH = vv?.height ?? window.innerHeight;
      const rawW = shell.clientWidth > 1 ? shell.clientWidth : fallbackW;
      const rawH = shell.clientHeight > 1 ? shell.clientHeight : fallbackH;
      const sw = Math.max(0, rawW - padX);
      const sh = Math.max(0, rawH - padY);
      // offsetWidth/Height ignore transform — base board size stays fixed.
      const tw = table.offsetWidth;
      const th = table.offsetHeight;
      if (sw < 1 || sh < 1 || tw < 1 || th < 1) return;

      let next = Math.min(sw / tw, sh / th) * factor;
      if (!Number.isFinite(next) || next <= 0) next = 1;
      next = Math.min(maxScale, Math.max(minScale, next));

      const w = tw * next;
      const h = th * next;
      const key = `${next.toFixed(4)}:${Math.round(w)}:${Math.round(h)}`;
      if (key === lastKey) return;
      lastKey = key;
      setFit({ scale: next, w, h });
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(shell);
    // Table size is fixed in CSS, but observe in case fonts/border load shift it.
    ro.observe(table);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      ro.disconnect();
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [factor, maxScale, minScale, subtractPadding]);

  return { shellRef, tableRef, ...fit };
}
