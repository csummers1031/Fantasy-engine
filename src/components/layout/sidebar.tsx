"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FlaskConical, LayoutDashboard, Radio, Settings, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/leagues/sleeper", label: "Sleeper", icon: Radio },
  { href: "/leagues/espn", label: "ESPN", icon: Shield },
  { href: "/leagues/yahoo", label: "Yahoo", icon: Sparkles },
  { href: "/war-room", label: "War Room", icon: Activity },
  { href: "/sandbox", label: "Sandbox", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-48 shrink-0 flex-col border-r border-desk-line bg-desk-panel md:flex">
      <div className="border-b border-desk-line px-3 py-3">
        <div className="text-sm font-bold tracking-tight">Fantasy Engine</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Draft war room</div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", active && "bg-accent text-foreground")}>
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-desk-line px-3 py-2 text-[10px] text-muted-foreground">v1.0.0</div>
    </aside>
  );
}
