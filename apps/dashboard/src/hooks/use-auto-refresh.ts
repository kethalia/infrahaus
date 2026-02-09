"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface UseAutoRefreshOptions {
  /** Interval in seconds (default: 30) */
  intervalSeconds?: number;
  /** Whether auto-refresh is enabled (default: true) */
  enabled?: boolean;
}

interface UseAutoRefreshReturn {
  /** Seconds remaining until next auto-refresh */
  countdown: number;
  /** Whether auto-refresh is paused (tab hidden) */
  isPaused: boolean;
  /** Trigger an immediate refresh */
  refreshNow: () => void;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
}

/**
 * Auto-refresh hook for server-rendered pages.
 * Uses Next.js router.refresh() to re-fetch server components.
 *
 * Features:
 * - Configurable interval (default 30s)
 * - Live countdown timer
 * - Pauses when tab is hidden (document.visibilityState)
 * - Immediate refresh on tab focus
 * - Manual "Refresh Now" trigger
 */
export function useAutoRefresh(
  options: UseAutoRefreshOptions = {},
): UseAutoRefreshReturn {
  const { intervalSeconds = 30, enabled = true } = options;
  const router = useRouter();

  const [countdown, setCountdown] = useState(intervalSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const countdownRef = useRef(intervalSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    // Reset countdown after refresh
    countdownRef.current = intervalSeconds;
    setCountdown(intervalSeconds);
    // Brief delay to show refresh state — tracked in ref for cleanup
    refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 500);
  }, [router, intervalSeconds]);

  const refreshNow = useCallback(() => {
    doRefresh();
  }, [doRefresh]);

  // Countdown tick
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "hidden") return;

      countdownRef.current -= 1;
      setCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        doRefresh();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [enabled, doRefresh]);

  // Visibility change handler
  useEffect(() => {
    if (!enabled) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        setIsPaused(true);
      } else {
        setIsPaused(false);
        // Immediate refresh on tab focus
        doRefresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, doRefresh]);

  return {
    countdown,
    isPaused,
    refreshNow,
    isRefreshing,
  };
}
