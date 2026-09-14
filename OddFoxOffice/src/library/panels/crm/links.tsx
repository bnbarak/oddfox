import { useNavigate } from "react-router-dom";

/* Pointing at one account or one person, from any CRM table.

   Both detail pages live on a tab of their own — the account's on Accounts,
   the person's on People — so a row anywhere travels there rather than every
   table growing its own copy of the page. What is open lives in the URL, so
   the back button works and a link can be shared.

   They sit here, apart from the pages themselves, because the pages link to
   each other: a person's page names their company and a company's page lists
   its people, and importing each other's module would be a cycle. The URL
   params they read are in shared.ts, with the rest of the hooks. */

function Row({ to, title, children }: {
  to: string; title: string; children: React.ReactNode;
}) {
  const nav = useNavigate();
  return (
    <button className="co-row co-row--btn" title={title} onClick={() => nav(to)}>
      {children}
    </button>
  );
}

export function AccountLink({ id, children, title }: {
  id: string; children: React.ReactNode; title?: string;
}) {
  return (
    <Row to={`/library/crm?account=${encodeURIComponent(id)}`}
         title={title ?? "Open this account"}>{children}</Row>
  );
}

export function PersonLink({ id, children, title }: {
  id: string; children: React.ReactNode; title?: string;
}) {
  return (
    <Row to={`/library/crm-people?person=${encodeURIComponent(id)}`}
         title={title ?? "Open this person — everything said to them"}>{children}</Row>
  );
}
