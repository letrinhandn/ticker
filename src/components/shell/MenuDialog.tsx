"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * Shared glass card for home entry + room lobby — one shell, one look.
 */
export function MenuDialog({
  children,
  labelledBy,
  className = "",
  onClick,
}: {
  children: ReactNode;
  labelledBy?: string;
  className?: string;
  /** Stop backdrop dismiss when clicking inside the dialog. */
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`pointer-events-auto flex w-full max-w-[26rem] max-h-[min(90dvh,42rem)] flex-col gap-3 overflow-auto rounded-2xl border border-white/15 p-5 shadow-2xl ${className}`.trim()}
      style={{
        background: "rgba(14, 32, 22, 0.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** Full-screen stage: blurred board already behind; centers one dialog. */
export function MenuStage({
  children,
  onDismiss,
}: {
  children: ReactNode;
  /** Tap outside the dialog to peek the board / close the menu. */
  onDismiss?: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-5"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        boxSizing: "border-box",
      }}
      role={onDismiss ? "presentation" : undefined}
      onClick={onDismiss}
    >
      {children}
    </div>
  );
}
