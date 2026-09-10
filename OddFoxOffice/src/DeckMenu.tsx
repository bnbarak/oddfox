import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { presentations } from "./presentations";

/* The decks, behind one control instead of a tab each.

   One deck fitted in the header; two already crowded it, and the count only
   goes up. Behaviour is copied from Whoami deliberately — click-away, Escape,
   aria-haspopup — so the two menus in this app work the same way.

   No active state: /deck/:id is a sibling of LibraryLayout, not a child, so
   this header never renders while a deck is open and there is nothing to
   mark as current. */

export function DeckMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  if (!presentations.length) return null;

  return (
    <div className="of-decks" ref={box}>
      <button className="of-tab of-tab--deck" onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu" aria-expanded={open}>
        ▶ Decks
        <span className="of-decks__caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="of-decks__menu" role="menu">
          {presentations.map((p) => (
            <button key={p.id} className="of-decks__item" role="menuitem"
                    onClick={() => { setOpen(false); nav(`/deck/${p.id}`); }}>
              <span className="of-decks__title">{p.title}</span>
              <span className="of-decks__count">{p.slides.length} slides</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
