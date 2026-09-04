import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Position } from "@/lib/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const POSITION_COLORS: Record<Position, string> = {
  QB: "text-pos-qb border-pos-qb/40 bg-pos-qb/10",
  RB: "text-pos-rb border-pos-rb/40 bg-pos-rb/10",
  WR: "text-pos-wr border-pos-wr/40 bg-pos-wr/10",
  TE: "text-pos-te border-pos-te/40 bg-pos-te/10",
  K: "text-pos-k border-pos-k/40 bg-pos-k/10",
  DEF: "text-pos-def border-pos-def/40 bg-pos-def/10",
};

export function formatSeconds(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function formatDelta(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }
  return value.toFixed(1);
}

export function formatTime(timestamp: number): string {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour12: false });
}

export function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
