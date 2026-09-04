import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-2 text-xs">
      <div className="text-sm font-semibold">Not found</div>
      <div className="text-muted-foreground">The league or page you requested does not exist in this data directory.</div>
      <Button asChild size="sm" variant="outline">
        <Link href="/">Back to overview</Link>
      </Button>
    </div>
  );
}
