import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSessionFromRequest } from "@/lib/auth-session";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import {
  buildNaboRoomView,
  getNaboRoomBundleByCode,
  grantNaboPremiumAccess,
  verifyNaboOwnerToken,
} from "@/lib/nabo-room.server";

const PREMIUM_ACCESS_CREDITS = 5;

type PremiumAccessRouteContext = {
  params: Promise<{ roomCode: string }>;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

export async function POST(request: NextRequest, { params }: PremiumAccessRouteContext) {
  const session = readSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      { error: "카카오 로그인 후 이용할 수 있습니다." },
      { status: 401 },
    );
  }

  const { roomCode } = await params;
  const body = await request.json().catch(() => ({}));
  const ownerToken = String(body?.ownerToken ?? "").trim();

  if (!ownerToken) {
    return NextResponse.json({ error: "방장 토큰이 필요합니다." }, { status: 400 });
  }

  const { bundle, error } = await getNaboRoomBundleByCode(roomCode);

  if (error || !bundle) {
    return NextResponse.json({ error: error ?? "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!verifyNaboOwnerToken(bundle.room, ownerToken)) {
    return NextResponse.json({ error: "결제 권한이 없습니다." }, { status: 403 });
  }

  if (bundle.room.premium_access_at) {
    return NextResponse.json({
      ok: true,
      chargedCredits: 0,
      view: buildNaboRoomView({
        bundle,
        role: "owner",
        ownerToken,
      }),
    });
  }

  const supabase = getSupabase();
  const { data: remainingCredits, error: deductError } = await supabase.rpc("deduct_credit", {
    p_user_id: session.id,
    p_amount: PREMIUM_ACCESS_CREDITS,
  });

  if (deductError || remainingCredits === null || remainingCredits === undefined) {
    return NextResponse.json(
      { error: "크레딧이 부족합니다. 5크레딧 충전 후 다시 시도해주세요." },
      { status: 429 },
    );
  }

  const granted = await grantNaboPremiumAccess({
    room: bundle.room,
    actorUserId: session.id,
    creditCost: PREMIUM_ACCESS_CREDITS,
  }, supabase);

  if (!granted.updated && granted.room?.premium_access_at) {
    await addCreditsWithPolicy(supabase, {
      userId: session.id,
      credits: PREMIUM_ACCESS_CREDITS,
      sourceType: "refund",
      sourceId: `nabo-premium-access-race-refund:${roomCode}:${session.id}`,
    }).catch(() => undefined);

    const refreshed = await getNaboRoomBundleByCode(roomCode, supabase);
    const nextBundle = refreshed.bundle ?? { room: granted.room, responses: bundle.responses };

    return NextResponse.json({
      ok: true,
      chargedCredits: 0,
      view: buildNaboRoomView({
        bundle: nextBundle,
        role: "owner",
        ownerToken,
      }),
    });
  }

  if (granted.error || !granted.room) {
    await addCreditsWithPolicy(supabase, {
      userId: session.id,
      credits: PREMIUM_ACCESS_CREDITS,
      sourceType: "refund",
      sourceId: `nabo-premium-access-refund:${roomCode}:${session.id}`,
    }).catch(() => undefined);

    return NextResponse.json(
      { error: granted.error ?? "전체 결과 처리에 실패했습니다." },
      { status: 500 },
    );
  }

  const refreshed = await getNaboRoomBundleByCode(roomCode, supabase);
  const nextBundle = refreshed.bundle ?? { room: granted.room, responses: bundle.responses };

  return NextResponse.json({
    ok: true,
    chargedCredits: PREMIUM_ACCESS_CREDITS,
    remainingCredits,
    view: buildNaboRoomView({
      bundle: nextBundle,
      role: "owner",
      ownerToken,
    }),
  });
}
