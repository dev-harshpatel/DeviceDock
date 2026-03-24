"use client";

import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const TRACK_PADDING_PX = 4;
const THUMB_SIZE_PX = 28;
const ICON_SIZE_CLASS = "h-[18px] w-[18px]";
const SUN_ICON_OFFSET_X_PX = -3;
const SUN_ICON_OFFSET_Y_PX = 0.5;
const MOON_ICON_OFFSET_X_PX = 0;
const MOON_ICON_OFFSET_Y_PX = 0.5;

export const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const previousIsDarkRef = useRef<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const isDarkRef = useRef(false);
  isDarkRef.current = isDark;

  /** Travel between the centers of the two equal-width button slots. */
  const getMaxX = () => {
    const track = trackRef.current;
    if (!track) {
      return 0;
    }
    return Math.max(0, track.offsetWidth / 2);
  };

  useLayoutEffect(() => {
    if (!mounted || !thumbRef.current || !trackRef.current) {
      return;
    }

    const thumb = thumbRef.current;
    const maxX = getMaxX();
    const targetX = isDark ? maxX : 0;

    if (previousIsDarkRef.current === null) {
      gsap.set(thumb, {
        x: targetX,
        scaleX: 1,
        scaleY: 1,
        transformOrigin: "50% 50%",
      });
      previousIsDarkRef.current = isDark;
      return;
    }

    if (previousIsDarkRef.current === isDark) {
      return;
    }

    previousIsDarkRef.current = isDark;

    gsap.killTweensOf(thumb);

    const timeline = gsap.timeline({ defaults: { transformOrigin: "50% 50%" } });

    timeline
      .to(thumb, {
        scaleX: 1.24,
        scaleY: 0.76,
        duration: 0.14,
        ease: "power2.out",
      })
      .to(
        thumb,
        {
          x: targetX,
          duration: 0.78,
          ease: "elastic.out(1, 0.42)",
        },
        0.05,
      )
      .to(
        thumb,
        {
          scaleX: 1,
          scaleY: 1,
          duration: 0.52,
          ease: "elastic.out(1, 0.5)",
        },
        0.05,
      );
  }, [mounted, isDark]);

  useLayoutEffect(() => {
    if (!mounted || !trackRef.current || !thumbRef.current) {
      return;
    }

    const track = trackRef.current;

    const handleResize = () => {
      const thumbEl = thumbRef.current;
      const trackEl = trackRef.current;
      if (!thumbEl || !trackEl) {
        return;
      }
      const maxX = Math.max(0, trackEl.offsetWidth / 2);
      const targetX = isDarkRef.current ? maxX : 0;
      gsap.killTweensOf(thumbEl);
      gsap.set(thumbEl, {
        x: targetX,
        scaleX: 1,
        scaleY: 1,
        transformOrigin: "50% 50%",
      });
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(track);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div
      ref={trackRef}
      className="relative inline-grid h-9 w-20 shrink-0 grid-cols-2 items-stretch rounded-full bg-muted p-1 shadow-inner"
      role="group"
      aria-label="Theme"
    >
      <div
        ref={thumbRef}
        aria-hidden
        className="pointer-events-none absolute z-0 h-7 w-7 rounded-full bg-white shadow-md ring-1 ring-black/[0.06] dark:bg-zinc-950 dark:ring-white/10"
        style={{
          left: `${TRACK_PADDING_PX}px`,
          top: `${TRACK_PADDING_PX}px`,
          width: `${THUMB_SIZE_PX}px`,
          height: `${THUMB_SIZE_PX}px`,
        }}
      />
      <button
        type="button"
        className="relative z-10 flex h-full min-h-0 min-w-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Use light theme"
        aria-pressed={mounted ? !isDark : false}
        tabIndex={0}
        onClick={() => setTheme("light")}
      >
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center"
          aria-hidden
        >
          <Sun
            className={cn(
              ICON_SIZE_CLASS,
              "block transition-colors",
              mounted && !isDark ? "text-foreground" : "text-muted-foreground",
            )}
            aria-hidden
            strokeWidth={2}
            style={{
              transform: `translate(${SUN_ICON_OFFSET_X_PX}px, ${SUN_ICON_OFFSET_Y_PX}px)`,
            }}
          />
        </span>
      </button>
      <button
        type="button"
        className="relative z-10 flex h-full min-h-0 min-w-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Use dark theme"
        aria-pressed={mounted ? isDark : false}
        tabIndex={0}
        onClick={() => setTheme("dark")}
      >
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center"
          aria-hidden
        >
          <Moon
            className={cn(
              ICON_SIZE_CLASS,
              "block transition-colors",
              mounted && isDark ? "text-foreground" : "text-muted-foreground",
            )}
            aria-hidden
            strokeWidth={2}
            style={{
              transform: `translate(${MOON_ICON_OFFSET_X_PX}px, ${MOON_ICON_OFFSET_Y_PX}px)`,
            }}
          />
        </span>
      </button>
    </div>
  );
};
