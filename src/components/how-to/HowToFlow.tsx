"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { GUIDE_STEPS, type GuideStep, writeHowToHiddenPreference } from "@/lib/how-to";

type HowToFlowProps = {
  mode: "page" | "modal";
  onClose?: () => void;
  onComplete?: (options: { hideForFuture: boolean }) => void;
};

function clampStep(index: number) {
  return Math.max(0, Math.min(GUIDE_STEPS.length - 1, index));
}

export default function HowToFlow({ mode, onClose, onComplete }: HowToFlowProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [hideForFuture, setHideForFuture] = useState(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const isModal = mode === "modal";

  const tone = useMemo(
    () => ({
      shell: isModal
        ? "fixed inset-0 z-[59] bg-[#F5F7FB]"
        : "h-[100dvh] overflow-hidden bg-[#F5F7FB] text-[#1A1A2E]",
      modalCard: "flex h-full w-full flex-col bg-[#F5F7FB]",
      modalHeader: "mx-auto flex w-full max-w-[430px] items-center justify-between px-5 pt-[max(env(safe-area-inset-top),18px)]",
      modalBody: "mx-auto flex min-h-0 h-full w-full max-w-[430px] flex-1 flex-col px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3",
      stepBadge: "bg-[#4B82FF] text-white",
      label: "text-[#4B82FF]",
      title: "text-[#1A1A2E]",
      desc: "text-[#7C8798]",
      detail: "text-[#A4ADBF]",
      indicatorInactive: "bg-[#DCE4F2]",
      indicatorActive: "bg-[#4B82FF]",
      close: "text-[#1A1A2E]/55 hover:bg-[#EEF2F8] hover:text-[#1A1A2E]",
      secondary: "border border-[#E4E9F2] bg-white text-[#5C6576]",
      primary: "bg-[#1A1A2E] text-white",
      checkbox: "border-[#D6DDE9] bg-[#F7F9FC]",
    }),
    [isModal]
  );

  useEffect(() => {
    if (mode !== "page") return;
    const slider = sliderRef.current;
    if (!slider) return;
    const width = slider.clientWidth;
    slider.scrollTo({
      left: width * stepIndex,
      behavior: "smooth",
    });
  }, [mode, stepIndex]);

  useEffect(() => {
    if (mode !== "page") return;

    const handleResize = () => {
      const slider = sliderRef.current;
      if (!slider) return;
      slider.scrollTo({
        left: slider.clientWidth * stepIndex,
        behavior: "auto",
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mode, stepIndex]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/studio");
  };

  const handleFinish = () => {
    if (!onComplete && hideForFuture) {
      writeHowToHiddenPreference(user?.id ?? null, true);
    }
    onComplete?.({ hideForFuture });
    if (!onComplete) {
      router.push("/studio");
    }
  };

  const goToStep = (index: number) => {
    setStepIndex(clampStep(index));
  };

  const handleSliderScroll = () => {
    const slider = sliderRef.current;
    if (!slider) return;

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const width = slider.clientWidth || 1;
      const nextIndex = clampStep(Math.round(slider.scrollLeft / width));
      setStepIndex((prev) => (prev === nextIndex ? prev : nextIndex));
    }, 40);
  };

  const renderProgress = (activeIndex: number) => (
    <div>
      <div className="flex items-center gap-1.5">
        {GUIDE_STEPS.map((guideStep, index) => (
          <span
            key={guideStep.number}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index <= activeIndex ? tone.indicatorActive : tone.indicatorInactive
            }`}
          />
        ))}
      </div>
      <p className={`mt-2 text-right text-[12px] font-semibold ${tone.detail}`}>
        {activeIndex + 1} / {GUIDE_STEPS.length}
      </p>
    </div>
  );

  const renderCardBody = ({
    guideStep,
    guideIndex,
    compact,
    showHideOption,
  }: {
    guideStep: GuideStep;
    guideIndex: number;
    compact: boolean;
    showHideOption: boolean;
  }) => {
    const isLastStep = guideIndex === GUIDE_STEPS.length - 1;

    return (
      <>
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-extrabold ${tone.stepBadge}`}>
            {guideStep.number}
          </span>
          <p className={`text-[13px] font-bold ${tone.label}`}>{guideStep.label}</p>
        </div>

        <div className={`relative mt-4 w-full overflow-hidden rounded-[28px] bg-[#F6F8FC] ${compact ? "h-[clamp(220px,35dvh,320px)]" : "h-[clamp(248px,41dvh,360px)]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={guideStep.image}
            alt={guideStep.imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading={guideIndex === 0 ? "eager" : "lazy"}
          />
        </div>

        <div className="mt-5">
          {renderProgress(guideIndex)}
        </div>

        <div className="mt-4 flex-1">
          <h2
            style={{ fontFamily: "Pretendard, sans-serif" }}
            className={`whitespace-pre-line font-extrabold tracking-[-0.05em] text-[#1A1A2E] ${compact ? "text-[clamp(1.6rem,7vw,2rem)] leading-[1.12]" : "text-[28px] leading-[1.24]"}`}
          >
            {guideStep.title}
          </h2>
          <p className={`mt-3 text-[#7C8798] ${compact ? "text-[14px] leading-[1.5]" : "text-[15px] leading-[1.6]"}`}>
            {guideStep.description}
          </p>
          {guideStep.detail ? (
            <p className={`mt-2 text-[#A4ADBF] ${compact ? "text-[13px] leading-[1.45]" : "text-[13px] leading-5"}`}>
              {guideStep.detail}
            </p>
          ) : null}
        </div>

        <div className={`mt-4 ${showHideOption ? "min-h-[56px]" : "min-h-[24px]"}`}>
          {showHideOption ? (
            <label className={`${tone.checkbox} flex h-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3`}>
              <input
                type="checkbox"
                checked={hideForFuture}
                onChange={(event) => setHideForFuture(event.target.checked)}
                className="h-4 w-4 accent-[#4B82FF]"
              />
              <span className="text-[14px] font-medium text-[#7C8798]">두번 다시 보지 않기</span>
            </label>
          ) : null}
        </div>

        <div className={`mt-4 flex gap-3 ${compact ? "pb-0" : ""}`}>
          <button
            type="button"
            onClick={() => goToStep(guideIndex - 1)}
            disabled={guideIndex === 0}
            className={`flex-1 rounded-2xl font-bold transition-opacity disabled:opacity-35 ${compact ? "px-4 py-3.5 text-[15px]" : "px-4 py-4 text-[14px]"} ${tone.secondary}`}
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLastStep) {
                handleFinish();
                return;
              }
              goToStep(guideIndex + 1);
            }}
            className={`flex-[1.35] rounded-2xl font-bold ${compact ? "px-4 py-3.5 text-[15px]" : "px-4 py-4 text-[14px]"} ${tone.primary}`}
          >
            {isLastStep ? "시작하기" : "다음"}
          </button>
        </div>
      </>
    );
  };

  if (isModal) {
    const step = GUIDE_STEPS[stepIndex];

    return (
      <div className={tone.shell} onClick={handleClose}>
        <div className={tone.modalCard} onClick={(event) => event.stopPropagation()}>
          <div className={tone.modalHeader}>
            <div />
            <button
              type="button"
              aria-label="닫기"
              onClick={handleClose}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-[26px] transition-colors ${tone.close}`}
            >
              ×
            </button>
          </div>

          <div className={tone.modalBody}>
            {renderCardBody({
              guideStep: step,
              guideIndex: stepIndex,
              compact: true,
              showHideOption: stepIndex === GUIDE_STEPS.length - 1,
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={tone.shell}>
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
        <div className="flex items-center justify-between px-5 pb-2 pt-[max(env(safe-area-inset-top),18px)]">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#6C7484] transition-colors hover:text-[#1A1A2E]"
          >
            <span className="text-[16px] leading-none">←</span>
            스튜디오로 돌아가기
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A4ADBF]">
            CARD GUIDE
          </p>
        </div>

        <div
          ref={sliderRef}
          onScroll={handleSliderScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex h-full">
            {GUIDE_STEPS.map((guideStep, guideIndex) => (
              <section
                key={guideStep.number}
                className="h-full min-w-full snap-center px-5 pb-5 pt-2"
                aria-hidden={guideIndex !== stepIndex}
              >
                <div className="flex h-full flex-col rounded-[32px] border border-[#E4E9F2] bg-white px-5 pb-5 pt-5 shadow-[0_22px_48px_rgba(122,139,179,0.16)]">
                  {renderCardBody({
                    guideStep,
                    guideIndex,
                    compact: false,
                    showHideOption: guideIndex === GUIDE_STEPS.length - 1,
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
