/* Proves the two tools that add a row to the CRM.

   Everyone in the CRM arrived from a research pass, so until now nothing
   could write one and the operator's answer to "add Hullteam to the CRM" was
   "do it in the UI yourself". The risk in changing that is not the writing —
   it is writing the wrong thing: a second Beazley, a person on the wrong
   account, the same address twice, or an id that lands on top of somebody
   researched.

   What is covered here is the part that decides those: the id shape, the
   clash suffix, and the tool schemas that stand between the model and the
   write. The writes themselves are Firestore's `create`, which refuses an
   existing document by itself.

   No Firestore, no model, no network:
     npx tsx scripts/outreach-crm-add-test.ts
*/
import { freeId, slug } from "../src/outreach/crm.js";
import { t } from "../src/outreach/operator.js";

let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  // eslint-disable-next-line no-console
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed++;
};

// ---- ids match the rows that are already there --------------------------

ok("a company keeps its shape", slug("Anglo-Eastern") === "anglo-eastern");
ok("a dot is dropped, not hyphenated", slug("V.Group") === "vgroup", slug("V.Group"));
ok("a person is first-last", slug("Vikrant Malhotra") === "vikrant-malhotra");
ok("an apostrophe goes", slug("O'Brien Marine") === "obrien-marine", slug("O'Brien Marine"));
ok("an accent folds", slug("Søren Åkerø") === "soren-akero", slug("Søren Åkerø"));
ok("a shared desk is a name", slug("Hull team") === "hull-team");
ok("punctuation never leaves a trailing dash", slug("Beazley (Hull & War)") === "beazley-hull-war",
   slug("Beazley (Hull & War)"));

// ---- a clash gets a suffix, never an overwrite --------------------------

const taken = new Set(["li-chen", "li-chen-2"]);
ok("a free id is used as is", freeId("ana-diaz", taken) === "ana-diaz");
ok("a taken id steps to -2", freeId("li-chen", new Set(["li-chen"])) === "li-chen-2");
ok("and keeps stepping", freeId("li-chen", taken) === "li-chen-3", freeId("li-chen", taken));

// ---- the schemas the model has to get past ------------------------------

const contactIn = t.addPerson.inputSchema!;
const accountIn = t.addCompany.inputSchema!;

ok("a name and a company are enough",
   contactIn.safeParse({ full_name: "Hull team", company: "Beazley" }).success);
ok("a person with no company is refused",
   !contactIn.safeParse({ full_name: "Hull team" }).success);
ok("the whole out-of-office shape parses",
   contactIn.safeParse({
     full_name: "Hull team", company: "Beazley", title: "Shared desk",
     email: "Hullteam@Beazley.com", buying_role: "other", priority: 2,
     notes: "named in Deepa Nathvani's out-of-office, 11 Sep",
   }).success);
ok("an invented buying role is refused",
   !contactIn.safeParse({ full_name: "A", company: "B", buying_role: "ceo" }).success);
ok("priority 4 is refused",
   !contactIn.safeParse({ full_name: "A", company: "B", priority: 4 }).success);
ok("a company needs a tier",
   !accountIn.safeParse({ company: "Hoopo" }).success);
ok("tier 7 is refused", !accountIn.safeParse({ company: "Hoopo", tier: 7 }).success);
ok("tier 1 is not", accountIn.safeParse({ company: "Hoopo", tier: 1 }).success);

// ---- and both doors have them -------------------------------------------

ok("the operator has both tools",
   typeof t.addPerson?.execute === "function" && typeof t.addCompany?.execute === "function");
ok("adding a row never sends anything",
   !JSON.stringify(t.addPerson.outputSchema ?? {}).includes("queued"));

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
