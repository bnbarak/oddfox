import { MCPServer } from "@mastra/mcp";
import type { Request, Response } from "express";
import { t } from "./operator.js";

/* The outreach agent, over MCP.

   The panel's operator agent is a Mastra agent with a set of tools and a set
   of instructions. This exposes the same tools to an MCP client instead —
   Claude Code, Claude Desktop — and lets that client's model be the agent.
   Nothing here re-implements any of them: `t` is the exact object
   operator.ts hands to its own Agent, so the two can never drift, and the
   daily cap, the dry-run switch and the placeholder check are still enforced
   in send.ts underneath both.

   Read it as a third caller of the same functions the HTTP routes and the
   onsite agent already call, not as a second system. */

/** MCP tool names, fixed here rather than derived from the tool ids.

    They are the public surface: a client stores them in its own config and a
    conversation refers to them by name, so renaming one silently breaks
    somebody's setup. Underscored because several MCP clients namespace tools
    as `server_tool` and hyphens read badly through that. */
const exposed = {
  outreach_status: t.status,
  find_people: t.findPeople,
  list_campaigns: t.listCampaigns,
  set_campaign: t.setCampaign,
  start_campaign: t.launch,
  pause_campaign: t.pause,
  end_campaign: t.end,
  delete_campaign: t.drop,
  account_activity: t.activity,
  who_is_owed_a_follow_up: t.owed,
  draft_email: t.write,
  schedule_email: t.book,
  list_queue: t.queue,
  cancel_email: t.pull,
};

/* Deliberately not operator.ts's INSTRUCTIONS verbatim. Two of those rules
   are about being a Mastra agent with a filtered tool history and a chat
   panel to answer into, and neither is true here. What does carry over is
   the part that matters: nothing gets scheduled without a person seeing the
   exact words first. */
const INSTRUCTIONS = `
These tools drive the outreach side of Seaworth's CRM — a company that builds
autonomous vessels escorting commercial ships through high-risk passages. The
person you are talking to owns this pipeline.

- Look things up rather than guessing. There are tools for people, activity,
  who is owed a follow-up, the queue and system status.
- schedule_email sends real mail to real strangers. Never call it without
  first showing the person the exact subject and body and getting a clear yes
  in this conversation. Set confirmed_by_operator only after they have said
  so. "Draft one for Ana" is not permission to send it.
- Reaching several people is one question, not one per person: draft them all,
  show them, ask once.
- A refusal is usually correct. A full daily cap is normal and expected —
  never try another domain or another date to get past one unless asked.
- Report what actually happened, including which of a batch were refused.
- cancel_email works until the moment a message goes, and costs nothing.
- A campaign aims a persona and one tier's message at a chosen list of
  accounts, independent of those accounts' own tier. Use set_campaign for
  that rather than drafting around it; drafting for somebody in a campaign
  already uses that campaign's message.
- The campaign verbs are set_campaign (create or edit), start_campaign,
  pause_campaign, end_campaign and delete_campaign. Starting is the loud one
  — it buys addresses and queues round 1 to everybody, so say what it will
  cost and how many people it reaches, and get a yes, before calling it.
  Pausing and ending are always safe: pause leaves the queue alone, end pulls
  it back. Offer them freely when somebody sounds unsure.
`.trim();

let cached: MCPServer | null = null;

/** Built on first request, not at import, so a server with no MCP traffic
    never pays for it. */
function server(): MCPServer {
  if (!cached) {
    cached = new MCPServer({
      id: "seaworth-outreach",
      name: "Seaworth outreach",
      version: "1.0.0",
      description:
        "The Seaworth CRM's outreach agent: find people, run campaigns, draft, schedule, cancel.",
      instructions: INSTRUCTIONS,
      tools: exposed,
    });
  }
  return cached;
}

/** The route handler. Stateless on purpose: Cloud Run scales to more than one
    instance and there is no session affinity, so a transport held in memory
    on instance A is a 404 the moment the next request lands on instance B.
    Every call therefore stands alone, which is what `serverless` means here.

    The request body has already been parsed by express.json(); Mastra reads
    `req.body` when it is set rather than the stream, so the two coexist. */
export async function handleMcp(req: Request, res: Response): Promise<void> {
  await server().startHTTP({
    url: new URL(req.originalUrl, `http://${req.headers.host ?? "localhost"}`),
    httpPath: "/api/mcp",
    req,
    res,
    options: { serverless: true },
  });
}
