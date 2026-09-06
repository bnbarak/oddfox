import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SlideMeta } from "./types";
import { slideTransition, slideVariants } from "./slideVariants";
import { useKeyboardNav } from "./useKeyboardNav";
import { broadcastSlideIndex, listenForNotesNavigation } from "./SpeakerNotes";
import { SlideListContext, SlidePositionContext } from "./SlideListContext";
import "./SlideDeck.css";

interface SlideDeckProps {
  slides: SlideMeta[];
  deckTitle?: string;
  watermark?: string;
}

function WatermarkOverlay({ text }: { text: string }) {
  const label = text.toUpperCase();
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='560' height='320' viewBox='0 0 560 320'>
      <g transform='rotate(-28 280 160)' fill='rgba(255,255,255,0.045)' font-family='ui-sans-serif, system-ui, sans-serif' font-size='36' font-weight='700' letter-spacing='6'>
        <text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle'>${label}</text>
      </g>
    </svg>`;
  const encoded = encodeURIComponent(svg.trim());
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 3,
        backgroundImage: `url("data:image/svg+xml;utf8,${encoded}")`,
        backgroundRepeat: "repeat",
        backgroundSize: "560px 320px",
      }}
    />
  );
}

function getInitialSlide(max: number): number {
  const params = new URLSearchParams(window.location.search);
  const s = params.get("slide");
  if (s !== null) {
    const n = parseInt(s, 10) - 1; // URL is 1-based, state is 0-based
    if (!isNaN(n) && n >= 0 && n < max) return n;
  }
  return 0;
}

export function SlideDeck({ slides, deckTitle, watermark }: SlideDeckProps) {
  const [[index, direction], setState] = useState<[number, number]>([
    getInitialSlide(slides.length),
    1,
  ]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      setState(([current]) => [clamped, clamped > current ? 1 : -1]);
    },
    [slides.length],
  );

  // Sync slide index to URL query param
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(index + 1));
    window.history.replaceState(null, "", url.toString());
  }, [index]);

  const onNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const onPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useKeyboardNav({ onNext, onPrev, onJump: goTo });

  useEffect(() => {
    broadcastSlideIndex(index);
    document.title = deckTitle
      ? `${slides[index].title} — ${deckTitle}`
      : slides[index].title;
  }, [index, slides, deckTitle]);

  // Listen for navigation commands from the speaker notes window
  useEffect(() => {
    return listenForNotesNavigation(goTo);
  }, [goTo]);

  const openSpeakerNotes = useCallback(() => {
    // Forward the current hash so the notes window loads the same deck.
    window.open(
      `/notes.html${window.location.hash}`,
      "speaker-notes",
      "width=700,height=500",
    );
    // Re-broadcast after a short delay so the new window picks up the current slide
    setTimeout(() => broadcastSlideIndex(index), 300);
  }, [index]);

  const currentSlide = slides[index];
  const ActiveComponent = currentSlide.Component;

  const { mainCount, appendixCount } = useMemo(() => {
    let main = 0;
    let appendix = 0;
    for (const s of slides) {
      if (s.kind === "appendix") appendix += 1;
      else main += 1;
    }
    return { mainCount: main, appendixCount: appendix };
  }, [slides]);

  const isAppendix = currentSlide.kind === "appendix";
  // Show the "(N appendix)" hint on the last main slide and on every
  // appendix slide, but hide it on earlier main slides to keep the counter clean.
  const showAppendixHint =
    appendixCount > 0 && (isAppendix || index === mainCount - 1);

  const progress = useMemo(() => {
    // Progress bar reflects progress through main deck; pins at 100% on appendix.
    if (isAppendix) return 100;
    return ((index + 1) / Math.max(mainCount, 1)) * 100;
  }, [index, mainCount, isAppendix]);

  return (
    <SlideListContext.Provider value={slides}>
      <div className="deck">
        {watermark && index === 0 && <WatermarkOverlay text={watermark} />}
        {isAppendix && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "1.25rem",
              right: "1.5rem",
              zIndex: 2,
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--color-accent-soft)",
              padding: "0.35rem 0.6rem",
              border: "1px solid var(--color-accent-soft)",
              borderRadius: "999px",
              background:
                "color-mix(in srgb, var(--color-accent) 8%, transparent)",
            }}
          >
            Appendix
          </div>
        )}
        <div className="deck__stage">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={currentSlide.id}
              className="deck__slide"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
            >
              <SlidePositionContext.Provider value={index}>
                <ActiveComponent />
              </SlidePositionContext.Provider>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="deck__chrome">
          <div className="deck__progress" aria-hidden>
            <motion.div
              className="deck__progress-bar"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="deck__controls">
            <button
              type="button"
              className="deck__btn"
              onClick={openSpeakerNotes}
              aria-label="Open speaker notes"
              title="Speaker notes"
            >
              N
            </button>
            <button
              type="button"
              className="deck__btn"
              onClick={onPrev}
              disabled={index === 0}
              aria-label="Previous slide"
            >
              ←
            </button>
            <span
              className="deck__counter"
              title={
                isAppendix
                  ? `Appendix slide ${index + 1 - mainCount} of ${appendixCount}`
                  : `Slide ${index + 1} of ${mainCount}${
                      appendixCount > 0 ? ` (+${appendixCount} appendix)` : ""
                    }`
              }
            >
              <span
                style={
                  isAppendix
                    ? { color: "var(--color-accent-soft)" }
                    : undefined
                }
              >
                {index + 1}
              </span>
              {" / "}
              {mainCount}
              {showAppendixHint && (
                <span
                  style={{
                    marginLeft: "0.35rem",
                    color: "var(--color-fg-muted)",
                    opacity: 0.7,
                  }}
                >
                  ({appendixCount})
                </span>
              )}
            </span>
            <button
              type="button"
              className="deck__btn"
              onClick={onNext}
              disabled={index === slides.length - 1}
              aria-label="Next slide"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </SlideListContext.Provider>
  );
}
