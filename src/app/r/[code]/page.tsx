import { Suspense } from "react";
import { RoomClient } from "./room-client";

export const instant = false;

async function RoomBody({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{
    bot?: string;
    bots?: string;
    auto?: string;
    watch?: string;
    f1?: string;
    f2?: string;
  }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const preferWatch =
    sp.watch === "1" || sp.bots === "2" || sp.auto === "1";
  return (
    <RoomClient
      code={String(code ?? "").toUpperCase()}
      withBot={sp.bot === "1" && !preferWatch}
      preferWatch={preferWatch}
      fund1={sp.f1}
      fund2={sp.f2}
    />
  );
}

export default function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{
    bot?: string;
    bots?: string;
    auto?: string;
    watch?: string;
    f1?: string;
    f2?: string;
  }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="page-pad">
          <p className="muted">Loading room…</p>
        </div>
      }
    >
      <RoomBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}
