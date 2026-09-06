import { useEffect, useState } from "react";
import {
  createBrowserRouter, RouterProvider, Outlet, NavLink, Navigate,
  useParams, useOutletContext, useNavigate,
} from "react-router-dom";
import { SlideDeck } from "./presentation/SlideDeck";
import { presentations } from "./presentations";
import { Library, TABS, GROUPS, groupOf, tabsIn, type TabId, type ViewState } from "./library/Library";
import { DB } from "./data";

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

  return (
    <div className="office">
      <header className="of-head">
        <div className="of-head-in">
          <div className="of-mark">Odd Fox <span>/ office</span></div>
          <div className="of-head-meta">
            v{DB.manifest.version} · {DB.manifest.datasets.length} datasets · updated {DB.manifest.updated}
          </div>
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
          {presentations.map((p) => (
            <NavLink key={p.id} to={`/deck/${p.id}`} className="of-tab of-tab--deck">
              ▶ {p.title}
            </NavLink>
          ))}
        </nav>
        <nav className="of-nav of-nav--sub" role="tablist" aria-label="Pages">
          {tabsIn(groupOf(tab ?? "")).map((t) => (
            <NavLink key={t.id} to={`/library/${t.id}`} role="tab" className="of-tab" end>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="of-main">
        <Outlet context={{ v, set } satisfies Ctx} />
      </main>
      <footer className="of-foot">
        <div className="of-wrap" style={{ display: "flex", gap: 18, flexWrap: "wrap", width: "100%" }}>
          <span>Internal. Not deployed.</span>
          <span style={{ marginLeft: "auto" }}>Every figure carries a source and a confidence level.</span>
        </div>
      </footer>
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
  return <RouterProvider router={router} />;
}
