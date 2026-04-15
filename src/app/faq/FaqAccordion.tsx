"use client";

import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-t border-white/10">
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <article key={item.question} className="border-b border-white/10">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-white"
              aria-expanded={isOpen}
            >
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-white sm:text-[19px]">
                {item.question}
              </span>
              <span className="shrink-0 text-[22px] font-light text-white/45">
                {isOpen ? "−" : "+"}
              </span>
            </button>

            <div
              className={`grid transition-all duration-200 ease-out ${
                isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl text-[14px] leading-7 text-white/62 sm:text-[15px]">
                  {item.answer}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
