import type { ReactNode } from "react";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function SectionHeading({ id, eyebrow, title, description, action }: SectionHeadingProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
          <span aria-hidden="true" className="weave-bar h-0.5 w-8 rounded-full" />
          {eyebrow}
        </p>
        <h2 id={id} className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">
          {title}
        </h2>
        {description && <p className="mt-3 text-base leading-relaxed text-cream-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
