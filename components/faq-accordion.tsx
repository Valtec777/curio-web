"use client";

import { useState } from "react";

type FaqItem = readonly [question: string, answer: string];

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="faq-list">
      {items.map(([question, answer], index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-answer-${index}`;
        return (
          <article className={`faq-item${isOpen ? " is-open" : ""}`} key={question}>
            <button
              className="faq-trigger"
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{question}</span>
              <span className="faq-plus" aria-hidden="true">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="faq-answer" id={panelId}>
                <p>{answer}</p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
