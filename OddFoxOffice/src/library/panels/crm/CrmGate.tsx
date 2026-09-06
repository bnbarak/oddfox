import { useGoogleAuth } from "../../../lib/googleAuth";
import { H1, Note } from "../../../ui";

/** Gates the CRM tabs behind Google Sign-In. Children only mount once
    signed in, so useCrmAccounts/useCrmContacts never fire a fetch without
    a token — the server would reject it anyway, but there's no reason to
    let the browser try. */
export function CrmGate({ children }: { children: React.ReactNode }) {
  const { token, email, ready, buttonRef, signOut } = useGoogleAuth();

  if (!token) {
    return (
      <>
        <H1>Sign in</H1>
        <Note style={{ marginBottom: 20 }}>
          The CRM holds outreach state for real accounts and contacts. Sign in with an allow-listed
          Google account to view or edit it.
        </Note>
        <div ref={buttonRef} />
        {!ready && <Note style={{ marginTop: 12 }}>loading Google Sign-In…</Note>}
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <span className="of-note">
          {email} · <button className="of-link" onClick={signOut} style={{ background: "none", border: 0, padding: 0 }}>
            sign out
          </button>
        </span>
      </div>
      {children}
    </>
  );
}
