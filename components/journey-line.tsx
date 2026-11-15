"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "../app/home.module.css";

export function JourneyLine({ children }: { children: ReactNode }) {
  const journey = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = journey.current;
    if (!container) return;

    const markers = container.querySelectorAll<HTMLElement>("[data-journey-step]");
    const first = markers[0];
    const last = markers[markers.length - 1];
    if (!first || !last || first === last) return;

    let frame = 0;

    function update() {
      if (!container || !first || !last) return;

      const bounds = container.getBoundingClientRect();
      const start = first.getBoundingClientRect();
      const end = last.getBoundingClientRect();
      const firstCenter = start.top + start.height / 2;
      const lastCenter = end.top + end.height / 2;
      const scroll = window.scrollY;
      const viewport = window.innerHeight;
      const bottom = document.documentElement.scrollHeight - viewport;
      const drawFrom = scroll + firstCenter - viewport * 0.72;
      const drawTo = Math.min(bottom, scroll + lastCenter - viewport * 0.56);
      const progress = Math.max(0, Math.min(1, (scroll - drawFrom) / Math.max(1, drawTo - drawFrom)));

      container.style.setProperty("--journey-x", `${start.left + start.width / 2 - bounds.left}px`);
      container.style.setProperty("--journey-top", `${firstCenter - bounds.top}px`);
      container.style.setProperty("--journey-height", `${Math.max(0, lastCenter - firstCenter)}px`);
      container.style.setProperty("--journey-offset", String(100 * (1 - progress)));
    }

    function scheduleUpdate() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    }

    const resize = new ResizeObserver(scheduleUpdate);
    resize.observe(container);
    resize.observe(document.documentElement);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={journey} className={styles.journey} data-journey>
      <svg className={styles.journeyLine} aria-hidden="true" focusable="false">
        <line className={styles.journeyTrack} x1="50%" y1="0" x2="50%" y2="100%" />
        <line className={styles.journeyProgress} x1="50%" y1="0" x2="50%" y2="100%" pathLength="100" />
      </svg>
      {children}
    </div>
  );
}
