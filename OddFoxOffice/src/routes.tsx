import { useEffect, useState } from "react";
import {
  createBrowserRouter, RouterProvider, Outlet, NavLink, Navigate,
  useParams, useOutletContext, useNavigate,
} from "react-router-dom";
import { SlideDeck } from "./presentation/SlideDeck";
import { presentations } from "./presentations";
import { DeckMenu } from "./DeckMenu";
import { Library, TABS, GROUPS, groupOf, tabsIn, type GroupId, type TabId, type ViewState } from "./library/Library";
import { AuthGate } from "./AuthGate";
import { Operator } from "./library/panels/crm/Operator";
import { InboxBadge } from "./library/panels/crm/InboxBadge";

/* Browser routing gives clean paths (/library/overview). It needs the host to
   serve index.html for unknown paths — Vite's dev server does this by default.
   If this is ever deployed statically, add the equivalent rewrite there.     */

/* ViewState is defined next to the panels that consume it; the layout only owns
   the value so a tab change does not reset the map series or a filter. */
const INITIAL: ViewState = {
  geoSeries: "recaap-2026-h1", playerCat: "all", matrixF: {}, matrixAllCols: false, matrixSort: null, proxComp: "category",
};

type Ctx = { v: ViewState; set: <K extends keyof ViewState>(k: K) => (val: ViewState[K]) => void };
export const useView = () => useOutletContext<Ctx>();

function LibraryLayout() {
  const [v, setV] = useState<ViewState>(INITIAL);
  // The phone gets one header row and a drawer; there is no room for two rows
  // of tabs, and a wrapped nav ate half the screen before the page began.
  const [menu, setMenu] = useState(false);
  // Which group the drawer has unfolded. Twenty-seven pages in one list is a
  // scroll; five headings with the section you are in already open is not.
  const [openGroup, setOpenGroup] = useState<GroupId | null>(null);
  const set = <K extends keyof ViewState>(k: K) => (val: ViewState[K]) =>
    setV((s) => ({ ...s, [k]: val }));
  const nav = useNavigate();

  // Left and right arrows step through tabs, as in the deck.
  const { tab } = useParams();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      const group = tabsIn(groupOf(tab ?? ""));
      const i = group.findIndex((t) => t.id === tab);
      if (i < 0) return;
      if (e.key === "ArrowRight" && i < group.length - 1) nav(`/library/${group[i + 1].id}`);
      if (e.key === "ArrowLeft" && i > 0) nav(`/library/${group[i - 1].id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, nav]);

  const here = TABS.find((t) => t.id === tab);
  const hereGroup = GROUPS.find((g) => g.id === groupOf(tab ?? ""));

  // Escape closes the drawer, and so does going somewhere.
  useEffect(() => { setMenu(false); }, [tab]);
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [menu]);

  return (
    <div className="office">
      <header className="of-head">
        <div className="of-head-in">
          <button className="of-burger"
                  onClick={() => { setOpenGroup(groupOf(tab ?? "")); setMenu(true); }}
                  aria-label="Open the menu" aria-expanded={menu} aria-controls="of-drawer">
            <span /><span /><span />
          </button>
          <div className="of-mark">Seaworth <span>/ office</span></div>
          {/* Where you are, since the tabs that used to say so are in the
              drawer now. */}
          <span className="of-head-here">
            {hereGroup?.label}<span className="of-head-here__s"> / </span>
            <strong>{here?.label}</strong>
            {tab === "crm-inbox" && <InboxBadge />}
          </span>
        </div>
        <nav className="of-nav of-nav--groups" aria-label="Sections">
          {GROUPS.map((g) => {
            const first = tabsIn(g.id)[0];
            const on = groupOf(tab ?? "") === g.id;
            return (
              <NavLink key={g.id} to={`/library/${first.id}`}
                       className={`of-tab of-tab--group${on ? " is-on" : ""}`}>
                {g.label}
              </NavLink>
            );
          })}
          <span className="of-nav__sep" />
          <DeckMenu />
        </nav>
        <nav className="of-nav of-nav--sub" role="tablist" aria-label="Pages">
          {tabsIn(groupOf(tab ?? "")).map((t) => (
            <NavLink key={t.id} to={`/library/${t.id}`} role="tab" className="of-tab" end>
              {t.label}{t.id === "crm-inbox" && <InboxBadge />}
            </NavLink>
          ))}
        </nav>
      </header>
      {menu && (
        <div className="of-drawer" role="dialog" aria-modal="true" aria-label="Sections"
             onMouseDown={(e) => { if (e.target === e.currentTarget) setMenu(false); }}>
          <nav className="of-drawer__panel" id="of-drawer">
            <div className="of-drawer__h">
              <span className="of-drawer__t">Sections</span>
              <button className="of-dock__x" onClick={() => setMenu(false)}>close</button>
            </div>
            <div className="of-drawer__body">
              {GROUPS.map((g) => {
                const on = openGroup === g.id;
                return (
                  <div className="of-drawer__g" key={g.id}>
                    <button className={`of-drawer__gn${on ? " is-on" : ""}`}
                            aria-expanded={on}
                            onClick={() => setOpenGroup(on ? null : g.id)}>
                      {g.label}
                      {g.id === "crm" && !on && <InboxBadge />}
                      <span className="of-drawer__caret">{on ? "–" : "+"}</span>
                    </button>
                    {on && tabsIn(g.id).map((t) => (
                      <NavLink key={t.id} to={`/library/${t.id}`} end
                               className={({ isActive }) => `of-drawer__l${isActive ? " is-on" : ""}`}>
                        {t.label}{t.id === "crm-inbox" && <InboxBadge />}
                      </NavLink>
                    ))}
                  </div>
                );
              })}
              <div className="of-drawer__g of-drawer__g--decks"><DeckMenu /></div>
            </div>
          </nav>
        </div>
      )}
      <main className="of-main">
        <Outlet context={{ v, set } satisfies Ctx} />
      </main>
      {/* The agent is docked for the whole CRM section, not one panel: the
          questions worth asking it are the same on every tab. */}
      {groupOf(tab ?? "") === "crm" && (
        <Operator page={{ id: tab ?? "", label: TABS.find((t) => t.id === tab)?.label ?? "" }} />
      )}
    </div>
  );
}

function LibraryTab() {
  const { tab } = useParams();
  const { v, set } = useView();
  const known = TABS.find((t) => t.id === tab);
  if (!known) return <Navigate to="/library/overview" replace />;
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  return <Library tab={tab as TabId} v={v} set={set} />;
}

function DeckView() {
  const { id } = useParams();
  const p = presentations.find((x) => x.id === id);
  if (!p) return <Navigate to="/library/overview" replace />;
  return (
    <div className="office-deck">
      <NavLink className="office-deck__back" to="/library/overview">← Library</NavLink>
      <SlideDeck key={p.id} slides={p.slides} deckTitle={p.title} watermark={p.watermark} />
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/library/overview" replace /> },
  {
    element: <LibraryLayout />,
    children: [{ path: "/library/:tab", element: <LibraryTab /> }],
  },
  { path: "/deck/:id", element: <DeckView /> },
  { path: "*", element: <Navigate to="/library/overview" replace /> },
]);

export default function App() {
  return (
    <AuthGate>
      <RouterProvider router={router} />
    </AuthGate>
  );
}
