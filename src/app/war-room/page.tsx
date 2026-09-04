import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listLeagues } from "@/lib/leagues/service";

export const dynamic = "force-dynamic";

export default async function WarRoomIndexPage() {
  const leagues = await listLeagues();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Select a league</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {leagues.length === 0 ? <div className="text-xs text-muted-foreground">No leagues configured. Add one from a provider tab or create a live sandbox.</div> : null}
        {leagues.map((league) => (
          <Button key={league.id} asChild variant="outline" size="sm">
            <Link href={`/war-room/${league.id}`}>{league.name}</Link>
          </Button>
        ))}
        <Button asChild size="sm">
          <Link href="/sandbox">Live sandbox</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
