import type { ReactNode } from "react";

/** Scales real in-game cards for readable tutorial rows without rewriting card CSS. */
export function TutorialCardStage({
  children,
  size = "deed",
  label,
}: {
  children: ReactNode;
  size?: "deed" | "deck" | "corner";
  label?: string;
}) {
  return (
    <figure className={`tut-stage is-${size}`}>
      <div className="tut-stage-frame">{children}</div>
      {label ? <figcaption className="tut-stage-cap">{label}</figcaption> : null}
    </figure>
  );
}
