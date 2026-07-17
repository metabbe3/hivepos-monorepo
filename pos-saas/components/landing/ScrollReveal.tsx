"use client";

import { type ElementType, type ReactNode } from "react";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";

interface ScrollRevealProps {
  children: ReactNode;
  /** Stagger delay in steps (1-4). Maps to `.stagger-1` – `.stagger-4`. */
  delay?: 1 | 2 | 3 | 4;
  /** Semantic element to render. Defaults to `div`. */
  as?: ElementType;
  className?: string;
}

/**
 * Wraps children in a scroll-triggered reveal animation.
 * Adds `.scroll-reveal` (initially hidden) and `.is-visible`
 * (fades/slides in) when the element enters the viewport.
 *
 * The `delay` prop applies a stagger delay (0.1s increments) so
 * multiple `ScrollReveal` siblings cascade instead of all appearing
 * at once.
 */
export function ScrollReveal({
  children,
  delay,
  as: Tag = "div",
  className = "",
}: ScrollRevealProps) {
  const [ref, isVisible] = useScrollReveal<HTMLElement>();

  const delayClass = delay ? ` stagger-${delay}` : "";
  const visibleClass = isVisible ? " is-visible" : "";

  return (
    <Tag
      ref={ref as never}
      className={`scroll-reveal${delayClass}${visibleClass} ${className}`}
    >
      {children}
    </Tag>
  );
}
