import { useGoogleAuth } from "./lib/googleAuth";

/** Gates the entire app behind Google Sign-In — every tab, every deck, not
    just the CRM. The bundled JSON datasets still ship inside the JS bundle
    (nothing server-side stops someone from reading the network tab), so
    this stops casual/accidental access and search-engine indexing, not a
    determined extraction. The CRM's live pipeline data is the one thing
    with a real server-side gate (see server/src/auth.ts) — this is the
    client-side counterpart for everything else. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, email, ready, buttonRef, signOut } = useGoogleAuth();

  if (!token) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
      }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Seaworth / office</div>
        <div ref={buttonRef} />
        {!ready && <div style={{ opacity: 0.5, fontSize: 13 }}>loading Google Sign-In…</div>}
      </div>
    );
  }

  return (
    <>
      <div style={{
        position: "fixed", top: 8, right: 12, zIndex: 1000,
        fontSize: 12, opacity: 0.7, display: "flex", gap: 8, alignItems: "center",
      }}>
        <span>{email}</span>
        <button onClick={signOut} style={{
          background: "none", border: "1px solid currentColor", borderRadius: 4,
          padding: "2px 8px", opacity: 0.8, cursor: "pointer", color: "inherit",
        }}>
          sign out
        </button>
      </div>
      {children}
    </>
  );
}
