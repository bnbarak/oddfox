import { Note } from "../../../ui";

/** Says plainly whether what you are looking at can be edited — but only once
    the server has actually answered. Saying it while the first request is
    still in flight made every tab switch flash "read-only" for a second. */
export function ServerState({ live, settled = true, error }: {
  live: boolean; settled?: boolean; error: string | null;
}) {
  if (live || !settled) return null;
  return (
    <Note style={{ marginBottom: 16 }}>
      <strong>Read-only. </strong>
      The CRM server is not answering{error ? ` (${error})` : ""}, so this is the copy of
      data/json/crm on disk at build time. Start the server with <code>npm run dev</code> in
      <code> server/</code> to edit pipeline state.
    </Note>
  );
}
