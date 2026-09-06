export type Facet = {
  id: string;
  name: string;
  /** OR within a facet, AND across facets. */
  options: { id: string; label: string; n: number }[];
};

export function Facets({ facets, value, toggle, reset, total, shown }: {
  facets: Facet[];
  value: Record<string, string[]>;
  toggle: (facet: string, option: string) => void;
  reset: () => void;
  total: number;
  shown: number;
}) {
  const active = Object.values(value).reduce((a, b) => a + b.length, 0);
  return (
    <div className="of-facets">
      <div className="of-facetbar">
        <div>
          <strong className="of-num">{shown}</strong>
          <span className="of-note"> of {total} companies</span>
          {active > 0 && <span className="of-note"> · {active} filter{active === 1 ? "" : "s"} on</span>}
        </div>
        <button className="of-reset" onClick={reset} disabled={active === 0}>Reset</button>
      </div>
      {facets.map((f) => (
        <div className="of-facet" key={f.id}>
          <div className="of-kicker of-facet__name">{f.name}</div>
          <div className="of-facet__opts">
            {f.options.map((o) => {
              const on = (value[f.id] ?? []).includes(o.id);
              return (
                <button key={o.id} className={`of-facet__b${on ? " is-on" : ""}`}
                        disabled={!on && o.n === 0}
                        aria-pressed={on}
                        onClick={() => toggle(f.id, o.id)}>
                  {o.label}<span className="of-facet__n">{o.n}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
