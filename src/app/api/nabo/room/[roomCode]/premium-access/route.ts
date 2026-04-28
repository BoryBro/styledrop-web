import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth-session";
import { addCreditsWithPolicy } from "@/lib/credits.server";
import {
  buildNaboRoomView,
  grantNaboPremiumAccess,
  getNaboRoomBundleByCode,
  NABO_EARLY_RESULT_CREDIT_COST,
  verifyNaboOwnerToken,
} from "@/lib/nabo-room.server";
import { loadNaboFeatureControl } from "@/lib/style-controls.server";
import { createClient } from "@supabase/supabase-js";

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
  const control = await loadNaboFeatureControl();
  if (!control.is_visible || !control.is_enabled) {
    return NextResponse.json({ error: "현재 이용할 수 없는 실험실 기능입니다." }, { status: 403 });
  }

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
  if (bundle.room.owner_user_id && bundle.room.owner_user_id !== session.id) {
    return NextResponse.json({ error: "방을 만든 계정으로만 열 수 있습니다." }, { status: 403 });
  }

  if (bundle.responses.length < 1) {
    return NextResponse.json({ error: "아직 응답이 없어 먼저 열 수 없습니다." }, { status: 400 });
  }

  if (bundle.room.premium_access_at) {
    return NextResponse.json({
      ok: true,
      chargedCredits: 0,
      message: "이미 1명 결과부터 바로 볼 수 있어요.",
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
    p_amount: NABO_EARLY_RESULT_CREDIT_COST,
  });

  if (deductError || remainingCredits === null || remainingCredits === undefined) {
    return NextResponse.json(
      { error: "크레딧이 부족합니다. 2크레딧 충전 후 다시 시도해주세요." },
      { status: 429 },
    );
  }

  const unlocked = await grantNaboPremiumAccess({
    room: bundle.room,
    actorUserId: session.id,
    creditCost: NABO_EARLY_RESULT_CREDIT_COST,
  }, supabase);

  if (unlocked.error || !unlocked.room) {
    await addCreditsWithPolicy(supabase, {
      userId: session.id,
      credits: NABO_EARLY_RESULT_CREDIT_COST,
      sourceType: "refund",
      sourceId: `nabo-early-result-refund:${roomCode}:${session.id}`,
    }).catch(() => undefined);

    return NextResponse.json(
      { error: unlocked.error ?? "결과를 열지 못했습니다." },
      { status: 500 },
    );
  }

  const nextBundle = {
    room: unlocked.room,
    responses: bundle.responses,
  };

  return NextResponse.json({
    ok: true,
    chargedCredits: unlocked.updated ? NABO_EARLY_RESULT_CREDIT_COST : 0,
    remainingCredits,
    message: "이제 1명 결과부터 바로 볼 수 있어요.",
    view: buildNaboRoomView({
      bundle: nextBundle,
      role: "owner",
      ownerToken,
    }),
  });
}
