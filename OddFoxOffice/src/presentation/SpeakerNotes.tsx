import { useCallback, useEffect, useMemo, useState } from "react";
import type { SlideMeta } from "./types";

const CHANNEL_NAME = "blueplan-deck-sync";

interface SpeakerNotesProps {
  slides: SlideMeta[];
  deckTitle?: string;
  deckId?: string;
}

/**
 * Standalone speaker notes view — opened in a separate window.
 * Listens on a BroadcastChannel for slide index changes from the main deck.
 * Also sends navigation commands back to the deck via keyboard + slide rail.
 */
export function SpeakerNotes({ slides, deckTitle, deckId }: SpeakerNotesProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (e) => {
      if (typeof e.data?.index === "number") setIndex(e.data.index);
    };
    return () => ch.close();
  }, []);

  const navigateTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      if (clamped === index) return;
      setIndex(clamped);
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ navigate: clamped });
      ch.close();
    },
    [index, slides.length],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          navigateTo(index + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          navigateTo(index - 1);
          break;
        case "Home":
          e.preventDefault();
          navigateTo(0);
          break;
        case "End":
          e.preventDefault();
          navigateTo(slides.length - 1);
          break;
      }
    },
    [index, slides.length, navigateTo],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const currentTitle = slides[index]?.title ?? "";
    document.title = deckTitle
      ? `Notes — ${currentTitle} — ${deckTitle}`
      : `Notes — ${currentTitle}`;
  }, [index, slides, deckTitle]);

  const { mainCount, appendixCount } = useMemo(() => {
    let main = 0;
    let appendix = 0;
    for (const s of slides) {
      if (s.kind === "appendix") appendix += 1;
      else main += 1;
    }
    return { mainCount: main, appendixCount: appendix };
  }, [slides]);

  const current = slides[index];
  const next = slides[index + 1];
  const isAppendix = current?.kind === "appendix";
  // Hint at appendix count on the last main slide and on every appendix slide.
  const showAppendixHint =
    appendixCount > 0 && (isAppendix || index === mainCount - 1);

  return (
    <div
      style={{
        background: "var(--color-bg)",
        color: "var(--color-fg)",
        fontFamily: "var(--font-display)",
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "minmax(260px, 22%) 1fr",
      }}
    >
      <SlideRail
        slides={slides}
        activeIndex={index}
        mainCount={mainCount}
        onSelect={navigateTo}
        deckTitle={deckTitle}
      />

      <div
        style={{
          padding: "3rem 4rem",
          maxHeight: "100vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2.5rem",
            paddingBottom: "1.25rem",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span
            style={{
              fontSize: "1rem",
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent-soft)",
              letterSpacing: "0.12em",
            }}
          >
            SPEAKER NOTES
          </span>
          <span
            style={{
              fontSize: "1rem",
              fontFamily: "var(--font-mono)",
              color: "var(--color-fg-muted)",
            }}
          >
            <span
              style={
                isAppendix ? { color: "var(--color-accent-soft)" } : undefined
              }
            >
              {index + 1}
            </span>
            {" / "}
            {mainCount}
            {showAppendixHint && (
              <span style={{ marginLeft: "0.4rem", opacity: 0.7 }}>
                ({appendixCount})
              </span>
            )}
          </span>
        </div>

        <div style={{ marginBottom: "3rem" }}>
          <div
            style={{
              fontSize: "0.9rem",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--color-accent-soft)",
              marginBottom: "0.75rem",
            }}
          >
            {isAppendix ? "Appendix · " : "Current: "}
            {current?.title}
          </div>
          <NotesBody
            key={current?.id ?? ""}
            notes={current?.notes}
            slideId={current?.id ?? ""}
            deckId={deckId}
            fontSize="1.6rem"
            muted={false}
          />
        </div>

        {next && (
          <div
            style={{
              paddingTop: "1.5rem",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "var(--color-fg-muted)",
                marginBottom: "0.75rem",
              }}
            >
              {next.kind === "appendix" ? "Up next · Appendix: " : "Up next: "}
              {next.title}
            </div>
            <NotesBody
              key={next.id}
              notes={next.notes}
              slideId={next.id}
              deckId={deckId}
              fontSize="1.15rem"
              muted
            />
          </div>
        )}

        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1.5rem",
            fontSize: "0.75rem",
            color:
              "color-mix(in srgb, var(--color-fg-muted) 40%, transparent)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Click a slide or use arrow keys
        </div>
      </div>
    </div>
  );
}

interface SlideRailProps {
  slides: SlideMeta[];
  activeIndex: number;
  mainCount: number;
  onSelect: (index: number) => void;
  deckTitle?: string;
}

function SlideRail({
  slides,
  activeIndex,
  mainCount,
  onSelect,
  deckTitle,
}: SlideRailProps) {
  return (
    <nav
      aria-label="Slide list"
      style={{
        background:
          "color-mix(in srgb, var(--color-bg) 70%, black)",
        borderRight: "1px solid var(--color-border)",
        padding: "2rem 0",
        maxHeight: "100vh",
        overflowY: "auto",
      }}
    >
      {deckTitle && (
        <div
          style={{
            padding: "0 1.5rem 1.5rem",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--color-fg-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {deckTitle}
        </div>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {slides.map((s, i) => {
          const isActive = i === activeIndex;
          const isAppendix = s.kind === "appendix";
          const isAppendixBoundary =
            isAppendix &&
            (i === 0 || slides[i - 1]?.kind !== "appendix");
          return (
            <li key={s.id}>
              {isAppendixBoundary && (
                <div
                  style={{
                    margin: "0.75rem 1.5rem 0.5rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--color-border)",
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "var(--color-accent-soft)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Appendix
                </div>
              )}
              <button
                type="button"
                onClick={() => onSelect(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.6rem 1.5rem",
                  background: isActive
                    ? "color-mix(in srgb, var(--color-accent) 14%, transparent)"
                    : "transparent",
                  border: "none",
                  borderLeft: isActive
                    ? "3px solid var(--color-accent)"
                    : "3px solid transparent",
                  color: isActive
                    ? "var(--color-fg)"
                    : "var(--color-fg-muted)",
                  fontFamily: "var(--font-display)",
                  fontSize: "0.95rem",
                  lineHeight: 1.4,
                  cursor: "pointer",
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    color: isAppendix
                      ? "var(--color-accent-soft)"
                      : "color-mix(in srgb, var(--color-fg-muted) 60%, transparent)",
                    minWidth: "2.25rem",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                  {isAppendix && "*"}
                </span>
                <span style={{ flex: 1 }}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div
        style={{
          padding: "1rem 1.5rem 0",
          fontSize: "0.75rem",
          color:
            "color-mix(in srgb, var(--color-fg-muted) 60%, transparent)",
          fontFamily: "var(--font-mono)",
          borderTop: "1px solid var(--color-border)",
          marginTop: "1rem",
        }}
      >
        {mainCount} main
        {slides.length - mainCount > 0 &&
          ` · ${slides.length - mainCount} appendix`}
      </div>
    </nav>
  );
}

interface NotesBodyProps {
  notes?: string;
  slideId: string;
  deckId?: string;
  fontSize: string;
  muted: boolean;
}

/**
 * Renders a slide's speaker notes, splitting on newlines. Lines that start
 * with "• " render as interactive checkboxes; their checked state persists
 * in localStorage per (deckId, slideId, bulletIdx). Other lines render as
 * plain text so section headers (e.g. "DISCOVERY ASK →") stay untouched.
 */
function NotesBody({
  notes,
  slideId,
  deckId,
  fontSize,
  muted,
}: NotesBodyProps) {
  const storageKey = `notes-checked:${deckId ?? "default"}:${slideId}`;
  const [checked, setChecked] = useState<Set<number>>(() =>
    loadCheckedSet(storageKey),
  );

  useEffect(() => {
    setChecked(loadCheckedSet(storageKey));
  }, [storageKey]);

  if (!notes) {
    return (
      <div
        style={{
          fontSize,
          lineHeight: 1.65,
          color: muted ? "var(--color-fg-muted)" : "var(--color-fg)",
          maxWidth: "72ch",
        }}
      >
        {muted ? "No notes." : "No notes for this slide."}
      </div>
    );
  }

  const lines = notes.split("\n");
  const color = muted ? "var(--color-fg-muted)" : "var(--color-fg)";

  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      saveCheckedSet(storageKey, next);
      return next;
    });
  };

  return (
    <div
      style={{
        fontSize,
        lineHeight: 1.7,
        color,
        maxWidth: "72ch",
      }}
    >
      {lines.map((line, i) => {
        if (line.startsWith("• ")) {
          const isChecked = checked.has(i);
          const label = line.slice(2);
          return (
            <label
              key={i}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                padding: "0.15rem 0",
                cursor: "pointer",
                opacity: isChecked ? 0.5 : 1,
                textDecoration: isChecked ? "line-through" : "none",
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(i)}
                style={{
                  marginTop: "0.55em",
                  width: "1.1em",
                  height: "1.1em",
                  accentColor: "var(--color-accent)",
                  cursor: "pointer",
                  flex: "none",
                }}
              />
              <span>{label}</span>
            </label>
          );
        }
        if (line.trim() === "") {
          return <div key={i} style={{ height: "0.6em" }} />;
        }
        return (
          <div key={i} style={{ padding: "0.15rem 0" }}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

function loadCheckedSet(key: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((n) => typeof n === "number"));
    }
  } catch {
    // ignore corrupt storage
  }
  return new Set();
}

function saveCheckedSet(key: string, set: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    if (set.size === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify([...set]));
    }
  } catch {
    // ignore quota/serialization errors
  }
}

/**
 * Persistent BroadcastChannel for the main deck.
 * Kept alive so messages reliably reach the notes window.
 */
let deckChannel: BroadcastChannel | null = null;

function getDeckChannel(): BroadcastChannel {
  if (!deckChannel) {
    deckChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return deckChannel;
}

/** Broadcast current slide index to any open speaker-notes windows. */
export function broadcastSlideIndex(index: number) {
  getDeckChannel().postMessage({ index });
}

/** Listen for navigation commands from the notes window. */
export function listenForNotesNavigation(
  goTo: (index: number) => void,
): () => void {
  const ch = getDeckChannel();
  const handler = (e: MessageEvent) => {
    if (typeof e.data?.navigate === "number") {
      goTo(e.data.navigate);
    }
  };
  ch.addEventListener("message", handler);
  return () => ch.removeEventListener("message", handler);
}
