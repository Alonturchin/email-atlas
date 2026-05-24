"use client";

import { cn } from "@/lib/utils";

interface TemplatePreviewProps {
  html: string | null | undefined;
  /** Visual scale factor for the rendered email (0..1). Lower = more content visible. */
  scale?: number;
  className?: string;
  interactive?: boolean;
}

export function TemplatePreview({
  html,
  scale = 0.4,
  className,
  interactive = false,
}: TemplatePreviewProps) {
  if (!html) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-neutral-50 text-[10px] font-medium uppercase tracking-widest text-neutral-400",
          className,
        )}
      >
        no preview
      </div>
    );
  }

  // The iframe is sized to 1/scale of the container; transform: scale() then
  // shrinks it back to fit. This lets us render full-width email HTML at a
  // thumbnail size without touching the source markup. sandbox="" with no
  // allow-tokens means: no scripts, no top-nav, no forms, no popups. Tracking
  // pixels still load (they're just <img>), which is fine.
  const inverse = (1 / scale) * 100;

  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      <iframe
        srcDoc={html}
        title="email preview"
        sandbox=""
        loading="lazy"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${inverse}%`,
          height: `${inverse}%`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: interactive ? "auto" : "none",
          border: "none",
        }}
      />
    </div>
  );
}
