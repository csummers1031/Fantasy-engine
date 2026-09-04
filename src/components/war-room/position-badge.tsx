import { Badge } from "@/components/ui/badge";
import { cn, POSITION_COLORS } from "@/lib/utils";
import type { Position } from "@/lib/types";

export function PositionBadge({ position, className }: { position: Position; className?: string }) {
  return (
    <Badge variant="outline" className={cn("w-9 justify-center", POSITION_COLORS[position], className)}>
      {position}
    </Badge>
  );
}
