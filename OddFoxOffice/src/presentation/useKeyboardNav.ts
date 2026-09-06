import { useEffect } from "react";

interface Options {
  onNext: () => void;
  onPrev: () => void;
  onJump?: (index: number) => void;
}

export function useKeyboardNav({ onNext, onPrev, onJump }: Options) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        onNext();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        onPrev();
      } else if (event.key === "Home") {
        onJump?.(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onJump]);
}
