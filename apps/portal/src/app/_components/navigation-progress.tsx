"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Complete progress bar on route change
  useEffect(() => {
    if (visible) {
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on internal links to start progress
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        anchor.target === "_blank"
      ) {
        return;
      }

      // Check if URL is internal and different from current location
      const currentUrl = window.location.pathname + window.location.search;
      const targetUrl = new URL(anchor.href, window.location.origin);

      if (
        targetUrl.origin === window.location.origin &&
        targetUrl.pathname + targetUrl.search !== currentUrl
      ) {
        setVisible(true);
        setProgress(30);

        const timer1 = setTimeout(() => setProgress(60), 200);
        const timer2 = setTimeout(() => setProgress(85), 600);

        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  if (!visible) return null;

  return (
    <div className="nav-progress-bar-container" aria-hidden="true">
      <div
        className="nav-progress-bar"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1
        }}
      />
    </div>
  );
}
