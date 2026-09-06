import { Note } from "../../../ui";

/** Says plainly whether what you are looking at can be edited. */
export function ServerState({ live, error }: { live: boolean; error: string | null }) {
  if (live) return null;
  return (
    <Note style={{ marginBottom: 16 }}>
      <strong>Read-only. </strong>
      The CRM server is not answering{error ? ` (${error})` : ""}, so this is the copy of
      data/json/crm on disk at build time. Start the server with <code>npm run dev</code> in
      <code> server/</code> to edit pipeline state.
    </Note>
  );
}
