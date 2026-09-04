"use client";

import { useCallback, useRef } from "react";

export type AlertTone = "info" | "warning" | "critical";

const TONES: Record<AlertTone, Array<{ frequency: number; durationMs: number }>> = {
  info: [{ frequency: 660, durationMs: 120 }],
  warning: [
    { frequency: 520, durationMs: 140 },
    { frequency: 700, durationMs: 140 },
  ],
  critical: [
    { frequency: 880, durationMs: 160 },
    { frequency: 440, durationMs: 160 },
    { frequency: 880, durationMs: 160 },
    { frequency: 440, durationMs: 160 },
  ],
};

export function useAudioAlert(enabled: boolean): (tone: AlertTone) => void {
  const contextRef = useRef<AudioContext | null>(null);

  return useCallback(
    (tone: AlertTone) => {
      if (!enabled || typeof window === "undefined") {
        return;
      }
      try {
        if (!contextRef.current) {
          contextRef.current = new AudioContext();
        }
        const context = contextRef.current;
        if (context.state === "suspended") {
          void context.resume();
        }
        let offset = context.currentTime;
        for (const step of TONES[tone]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = tone === "critical" ? "square" : "sine";
          oscillator.frequency.value = step.frequency;
          gain.gain.setValueAtTime(0.0001, offset);
          gain.gain.exponentialRampToValueAtTime(0.25, offset + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, offset + step.durationMs / 1000);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(offset);
          oscillator.stop(offset + step.durationMs / 1000 + 0.02);
          offset += step.durationMs / 1000 + 0.04;
        }
      } catch {
        // audio is best-effort
      }
    },
    [enabled],
  );
}
