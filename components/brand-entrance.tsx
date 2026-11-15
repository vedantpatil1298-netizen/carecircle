"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "../app/home.module.css";

const sessionKey = "carecircle-intro-seen";

export function BrandEntrance() {
  const [visible, setVisible] = useState(true);
  const overlay = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = image.current;
    const finish = document.querySelector<HTMLElement>("[data-hero-brand]");
    let alreadySeen = false;

    try {
      alreadySeen = sessionStorage.getItem(sessionKey) === "yes";
      sessionStorage.setItem(sessionKey, "yes");
    } catch {
      // The intro also works when browser storage is disabled.
    }

    if (alreadySeen || prefersReduced.matches || window.location.hash || !start || !finish || !overlay.current) {
      setVisible(false);
      return;
    }

    const mark = overlay.current;
    const from = mark.getBoundingClientRect();
    const to = finish.getBoundingClientRect();

    mark.style.setProperty("--intro-x", (to.left + to.width / 2 - from.left - from.width / 2) + "px");
    mark.style.setProperty("--intro-y", (to.top + to.height / 2 - from.top - from.height / 2) + "px");
    mark.style.setProperty("--intro-scale", String(to.width / start.offsetWidth));

    const end = () => setVisible(false);
    const fallback = window.setTimeout(end, 1550);
    prefersReduced.addEventListener("change", end);
    return () => {
      window.clearTimeout(fallback);
      prefersReduced.removeEventListener("change", end);
    };
  }, []);

  if (!visible) return null;

  return (
    <div ref={overlay} className={styles.brandEntrance} aria-hidden="true"
      onAnimationEnd={(event) => { if (event.currentTarget === event.target) setVisible(false); }}>
      <Image ref={image} src="/carecircle-mark.png" width={192} height={192} alt="" priority unoptimized />
    </div>
  );
}
