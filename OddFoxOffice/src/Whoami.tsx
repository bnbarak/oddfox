import { useEffect, useRef, useState } from "react";
import { Bell } from "./Bell";

/* Who is signed in, as an avatar with a menu.

   It replaces a line of build metadata — version, dataset count, build date —
   which was answering a question nobody in this app asks. Sign-out was a
   permanently visible button next to an email address; behind a click is
   where a destructive-ish action belongs, and it buys back the header space. */

export function Whoami({ email, name, picture, onSignOut }: {
  email: string | null;
  name: string | null;
  picture: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Click-away and Escape, so it behaves like every other menu.
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

  // Initials only when Google gave us no picture — two letters from the name,
  // falling back to the address, which is all we have for some accounts.
  const initials = (name ?? email ?? "?")
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

  return (
    <div className="of-whoami" ref={box}>
      <Bell />
      <button className="of-avatar" onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu" aria-expanded={open}
              title={email ?? "signed in"}>
        {picture
          ? <img src={picture} alt="" referrerPolicy="no-referrer" />
          : <span>{initials}</span>}
      </button>

      {open && (
        <div className="of-avatar__menu" role="menu">
          <div className="of-avatar__who">
            {name ? <strong>{name}</strong> : null}
            <span>{email}</span>
          </div>
          <button className="of-avatar__item" role="menuitem"
                  onClick={() => { setOpen(false); onSignOut(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
