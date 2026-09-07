import { NextResponse } from "next/server";
import { handle, type RouteContext } from "@/lib/api/respond";
import { readSnapshot } from "@/lib/automation/snapshot-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<{ id: string }>): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const snapshot = await readSnapshot(id);
    return new NextResponse(JSON.stringify(snapshot), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${snapshot.provider}-draft-room-${snapshot.id}.json"`,
      },
    });
  });
}
