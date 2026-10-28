"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** Animations enhance visible content; no hidden-content dependency. */
export function MarketingExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const animations = new Set<Animation>();
    const stop = () => {
      observer?.disconnect();
      animations.forEach((a) => a.cancel());
      animations.clear();
      host.style.removeProperty("--depth-x");
      host.style.removeProperty("--depth-y");
    };
    const start = () => {
      stop();
      if (motion.matches) return;
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry, index) => {
            if (!entry.isIntersecting) return;
            const a = entry.target.animate(
              [
                { opacity: 0.3, transform: "translateY(24px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              {
                duration: 750,
                delay: Math.min(index * 85, 255),
                easing: "cubic-bezier(.16,1,.3,1)",
              },
            );
            animations.add(a);
            a.onfinish = () => animations.delete(a);
            observer?.unobserve(entry.target);
          }),
        { threshold: 0.08 },
      );
      host
        .querySelectorAll("[data-reveal]")
        .forEach((el) => observer?.observe(el));
    };
    const hero = host.querySelector<HTMLElement>(".p-hero");
    const pointer = (e: PointerEvent) => {
      if (motion.matches || e.pointerType !== "mouse" || innerWidth < 1000)
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = hero!.getBoundingClientRect();
        host.style.setProperty(
          "--depth-x",
          `${((e.clientX - box.left) / box.width - 0.5) * 3}deg`,
        );
        host.style.setProperty(
          "--depth-y",
          `${-((e.clientY - box.top) / box.height - 0.5) * 3}deg`,
        );
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      host.style.setProperty("--depth-x", "0deg");
      host.style.setProperty("--depth-y", "0deg");
    };
    start();
    motion.addEventListener("change", start);
    hero?.addEventListener("pointermove", pointer);
    hero?.addEventListener("pointerleave", reset);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", start);
      hero?.removeEventListener("pointermove", pointer);
      hero?.removeEventListener("pointerleave", reset);
    };
  }, []);
  return (
    <div ref={root} className="m-home p-home">
      {children}
    </div>
  );
}
