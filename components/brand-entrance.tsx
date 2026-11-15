"use client";

import { useLayoutEffect, useRef, useState } from "react";
import styles from "../app/home.module.css";

const sessionKey = "carecircle-intro-seen";

export function BrandEntrance() {
  const [visible, setVisible] = useState(true);
  const overlay = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cover = overlay.current;
    const start = cover?.firstElementChild;
    const finish = document.querySelector<HTMLElement>("[data-hero-brand]");
    let alreadySeen = false;

    try {
      alreadySeen = sessionStorage.getItem(sessionKey) === "yes";
    } catch {
      // The intro also works when browser storage is disabled.
    }

    if (alreadySeen || prefersReduced.matches || window.location.hash || window.scrollY > 0 ||
        !(start instanceof HTMLElement) || !finish || !cover) {
      setVisible(false);
      return;
    }

    try {
      sessionStorage.setItem(sessionKey, "yes");
    } catch {
      // Session storage is only used to avoid repeating the intro.
    }

    const alignLogo = () => {
      const from = cover.getBoundingClientRect();
      const to = finish.getBoundingClientRect();
      cover.style.setProperty("--intro-x", (to.left + to.width / 2 - from.left - from.width / 2) + "px");
      cover.style.setProperty("--intro-y", (to.top + to.height / 2 - from.top - from.height / 2) + "px");
      cover.style.setProperty("--intro-scale", String(to.width / start.offsetWidth));
    };
    alignLogo();

    const end = () => setVisible(false);
    const skipWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab" || event.key === "Escape") end();
    };
    const fallback = window.setTimeout(end, 4000);
    window.addEventListener("resize", alignLogo);
    window.addEventListener("keydown", skipWithKeyboard);
    window.addEventListener("scroll", end, { passive: true });
    prefersReduced.addEventListener("change", end);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("resize", alignLogo);
      window.removeEventListener("keydown", skipWithKeyboard);
      window.removeEventListener("scroll", end);
      prefersReduced.removeEventListener("change", end);
    };
  }, []);

  if (!visible) return null;

  return (
    <div ref={overlay} className={styles.brandEntrance} aria-hidden="true"
      onAnimationEnd={(event) => { if (event.currentTarget === event.target) setVisible(false); }}>
      <span className={`brand-mark ${styles.entranceMark}`} />
    </div>
  );
}
