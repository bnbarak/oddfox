import { Router, type Request, type Response } from "express";
import { getConfig } from "./store.js";
import { optOut } from "./optout.js";
import { addressIn } from "./unsubToken.js";

/* The public face of unsubscribing: unsubscribe.seaworth.ai.

   Mounted at the root and *above* the Google sign-in check in index.ts,
   because the person clicking it has no account here and never will. Nothing
   under it reads a session, takes a parameter that is not signed, or tells
   the caller anything it did not already know — the address is in the link
   they were sent.

   Its own hostname rather than a path on the office app, so "the public
   surface" is a whole domain that can be reasoned about at once rather than
   one route somebody has to remember is different. */

export const unsubscribeRouter: Router = Router();

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One self-contained page. No stylesheet, no font, no script, no image — a
    page that loads nothing cannot be slow, cannot be blocked, and cannot
    report back what the reader did, which is the right posture for a page
    somebody visits to get away from us. */
function page(title: string, lines: string[]): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · Seaworth</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #06090c; color: #e8eef2; padding: 24px;
         font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  main { max-width: 30rem; }
  h1 { font-size: 19px; font-weight: 600; margin: 0 0 14px; letter-spacing: -.01em; }
  p { margin: 0 0 12px; color: #9fb0bc; }
  strong { color: #e8eef2; font-weight: 600; }
  hr { border: 0; border-top: 1px solid #1b2530; margin: 22px 0 14px; }
  .m { font-size: 12px; letter-spacing: .09em; text-transform: uppercase; color: #63788a; margin-bottom: 18px; }
  a { color: #9fb0bc; }
</style>
</head><body><main>
<div class="m">Seaworth</div>
<h1>${esc(title)}</h1>
${lines.map((l) => `<p>${l}</p>`).join("\n")}
</main></body></html>`;
}

/** The address that receives opt-outs, for the "something went wrong" paths.
    Read from the config so there is one place it is set. */
async function mailtoLine(): Promise<string> {
  const box = (await getConfig().catch(() => null))?.unsubscribe_mailbox;
  return box
    ? `You can also email <a href="mailto:${esc(box)}?subject=unsubscribe">${esc(box)}</a> and we will take care of it by hand.`
    : `Reply "unsubscribe" to any message from us and we will take care of it by hand.`;
}

const html = (res: Response, status: number, body: string): void => {
  res.status(status)
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "no-store")
    .set("X-Robots-Tag", "noindex, nofollow")
    .send(body);
};

/* One handler, two methods.

   GET is the click. It opts the reader out immediately rather than showing a
   "are you sure" button, which means a link prefetched by a scanner can opt
   somebody out who never clicked. That is a deliberate trade and the same one
   readsAsOptOut() makes: a false opt-out costs one lead, a missed one costs a
   complaint. It also has to be this way for the header POST below to be
   honest — RFC 8058 promises no confirmation step.

   POST is what Gmail and Yahoo call when the reader uses the client's own
   "unsubscribe" control, driven by the List-Unsubscribe-Post header. Same
   work, no page: those clients show their own confirmation. */
async function handle(req: Request, res: Response): Promise<void> {
  const token = String(req.params.token ?? "");
  const email = addressIn(token);

  if (!email) {
    if (req.method === "POST") { res.status(400).json({ error: "invalid link" }); return; }
    html(res, 404, page("This link is not valid", [
      "It may have been altered in transit, or copied out of a message incompletely.",
      await mailtoLine(),
    ]));
    return;
  }

  // A HEAD is a scanner checking the link resolves, not a person asking to be
  // removed. Express routes HEAD to the GET handler, so it is caught here.
  if (req.method === "HEAD") { res.status(200).end(); return; }

  const note = [req.get("user-agent"), req.ip].filter(Boolean).join(" · ") || null;
  const done = await optOut(email, req.method === "POST" ? "one-click" : "link", note)
    .catch((e: unknown) => e instanceof Error ? e : new Error(String(e)));

  if (done instanceof Error) {
    // eslint-disable-next-line no-console
    console.error("unsubscribe failed", email, done);
    if (req.method === "POST") { res.status(500).json({ error: "could not record" }); return; }
    html(res, 500, page("Something went wrong at our end", [
      "We could not record that just now, and we would rather say so than pretend.",
      await mailtoLine(),
    ]));
    return;
  }

  if (req.method === "POST") { res.status(200).json({ ok: true }); return; }

  html(res, 200, page("You are unsubscribed", [
    `We will not email <strong>${esc(done.email)}</strong> again.`,
    done.canceled
      ? `${done.canceled} message${done.canceled === 1 ? "" : "s"} that had already been queued ${
          done.canceled === 1 ? "has" : "have"} been cancelled, so nothing further will arrive.`
      : "Nothing was queued, so nothing further will arrive.",
    "Sorry for the interruption.",
  ]));
}

unsubscribeRouter.get("/u/:token", (req, res) => void handle(req, res));
unsubscribeRouter.post("/u/:token", (req, res) => void handle(req, res));

/** The bare hostname, for anyone who trims the link back to the domain. */
unsubscribeRouter.get("/", (_req, res) => {
  void mailtoLine().then((line) => html(res, 200, page("Unsubscribe", [
    "This page removes an address from Seaworth's mailing list. Use the link at the "
    + "bottom of the message you received — it is what tells us which address to remove.",
    line,
  ])));
});
