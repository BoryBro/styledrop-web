"use client";

import { useState } from "react";
import Link from "next/link";

type GiftCodePanelAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  className: string;
  disabled?: boolean;
};

type GiftCodePanelProps = {
  title: string;
  subtitle: string;
  expiryText?: string;
  giftCode: string;
  helperLines: string[];
  topEmoji?: string;
  actions?: GiftCodePanelAction[];
  footerAction?: GiftCodePanelAction;
};

export default function GiftCodePanel({
  title,
  subtitle,
  expiryText,
  giftCode,
  helperLines,
  topEmoji = "🎁",
  actions = [],
  footerAction,
}: GiftCodePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(giftCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 max-w-xs w-full text-center">
        <div className="w-20 h-20 rounded-full bg-[#C9571A]/15 border-2 border-[#C9571A]/40 flex items-center justify-center text-3xl">
          {topEmoji}
        </div>

        <div>
          <p className="text-white font-bold text-2xl">{title}</p>
          <p className="text-[#999] text-sm mt-2">{subtitle}</p>
          {expiryText && <p className="text-[#666] text-xs mt-1">{expiryText}</p>}
        </div>

        <div className="w-full bg-[#1A1A1A] border border-[#333] rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-[#666] text-xs">선물 코드</p>
          <p className="text-white font-mono font-extrabold text-2xl tracking-widest">{giftCode}</p>
          <button
            type="button"
            onClick={handleCopyCode}
            className="w-full h-[44px] rounded-xl bg-[#C9571A] text-white font-bold text-[14px] transition-colors"
          >
            {copied ? "복사됨 ✓" : "코드 복사하기"}
          </button>
        </div>

        {actions.length > 0 && (
          <div className="w-full flex flex-col gap-2.5">
            {actions.map((action) => (
              action.href ? (
                <Link key={action.label} href={action.href} className={action.className}>
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={action.className}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              )
            ))}
          </div>
        )}

        <p className="text-[#555] text-xs leading-relaxed">
          {helperLines.map((line) => (
            <span key={line} className="block">{line}</span>
          ))}
        </p>

        {footerAction && (
          footerAction.href ? (
            <Link href={footerAction.href} className={footerAction.className}>
              {footerAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={footerAction.onClick}
              className={footerAction.className}
              disabled={footerAction.disabled}
            >
              {footerAction.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
