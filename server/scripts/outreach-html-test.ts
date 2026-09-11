/* The formatted-mail path: what the composer's editor sends, cleaned and
   turned into both halves of one message. Pure functions — no key, no
   network. Run: UNSUBSCRIBE_SECRET=anything npx tsx scripts/outreach-html-test.ts */
import { cleanHtml, compose, htmlToText } from "../src/outreach/render.js";
import { OutreachConfig } from "../src/outreach/schemas.js";

let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  // eslint-disable-next-line no-console
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed++;
};

const cfg = OutreachConfig.parse({
  sender_name: "Barak",
  postal_address: "Seaworth, 1 Example Street, London",
  unsubscribe_mailbox: "optout@seaworth.ai",
});

// ---- cleaning: the HTML came from a browser --------------------------------

const dirty = `<p onclick="x()">Hi <strong>Ana</strong>,</p><script>alert(1)</script>` +
  `<p style="color:red">Two</p><a href="javascript:alert(1)">bad</a><img src="x">`;
const c = cleanHtml(dirty);
ok("a script is dropped, contents and all", !/script|alert/.test(c), c);
ok("event handlers are dropped", !/onclick/.test(c));
ok("the writer's own styles give way to Gmail's", !/color:red/.test(c) && /font-family:Arial/.test(c));
ok("a javascript: link loses its href", !/javascript/.test(c));
ok("images are dropped", !/<img/.test(c));
ok("formatting survives", /<strong>Ana<\/strong>/.test(c));
ok("an empty paragraph keeps its blank line", /<p[^>]*><br><\/p>/.test(cleanHtml("<p>a</p><p></p><p>b</p>")));
ok("a real link keeps its href, and nothing else",
   /<a href="https:\/\/seaworth\.ai">site<\/a>/.test(
     cleanHtml('<p><a href="https://seaworth.ai" target="_blank" rel="noopener">site</a></p>')));

// ---- the plain-text half ----------------------------------------------------

const t = htmlToText(cleanHtml(
  '<p>Hi Ana,</p><p></p><p>See <a href="https://seaworth.ai">our site</a> &amp; ' +
  '<a href="https://x.io">https://x.io</a>.</p><ul><li><p>one</p></li><li><p>two</p></li></ul>'));
ok("a line per paragraph, and a blank one where one was typed", t.startsWith("Hi Ana,\n\nSee"), JSON.stringify(t));
ok("a link keeps its address in brackets", t.includes("our site (https://seaworth.ai)"), JSON.stringify(t));
ok("an address that is its own text is not repeated", t.includes("https://x.io.") && !t.includes("(https://x.io)"));
ok("entities are decoded", t.includes(" & "));
ok("list items are one per line, not double-spaced", t.includes("- one\n- two"), JSON.stringify(t));
ok("a numbered list is numbered",
   htmlToText(cleanHtml("<ol><li><p>a</p></li><li><p>b</p></li></ol>")) === "1. a\n2. b");

// ---- compose ----------------------------------------------------------------

const m = compose("ignored", cfg, null, false, "ana@example.com", "<p>Hello <em>Ana</em></p>");
ok("the text half comes from the HTML, not the body argument",
   m.text.startsWith("Hello Ana") && !m.text.includes("ignored"), JSON.stringify(m.text));
ok("the HTML half carries the formatting", m.html.includes("<em>Ana</em>"));
ok("a hand-written message still has no unsubscribe line", !/unsubscribe/i.test(m.text + m.html));
const plain = compose("Hello Ana", cfg, null, false, "ana@example.com");
ok("without HTML, compose is unchanged",
   plain.html.includes("Hello Ana") && !plain.html.includes('<div style="margin:0 0 1em">'));

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
if (failed) process.exit(1);
