import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { history } from "../data";
import { source, TONE } from "../slide-design-system";

export function WhoGetsHitSlide() {
  const rows = (history.by_vessel_type as { label: string; value: number }[]).slice(0, 6);
  const max = rows[0].value;
  const ds = history.distance_from_shore_km as { median: number; p90: number };
  return (
    <Slide align="start" tone="default">
      <Eyebrow>02 — Who gets hit</Eyebrow>
      <Title>Bulk carriers and tankers, close to shore</Title>
      <Body>
        {history.count.toLocaleString()} geocoded attacks, {history.date_range[0].slice(0, 4)}–
        {history.date_range[1].slice(0, 4)}. Median distance from shore {ds.median} km; ninetieth
        percentile {ds.p90} km.
      </Body>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "1rem" }}>
        {rows.map((r, i) => (
          <FadeItem key={r.label}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.1fr) 3fr auto", gap: "1rem", alignItems: "center" }}>
              <div style={{ fontSize: "1rem" }}>{r.label}</div>
              <div style={{ height: 8, background: "rgba(255,255,255,.08)", borderRadius: 1 }}>
                <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", background: i < 2 ? TONE.hot : TONE.paper, borderRadius: 1 }} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "right" }}>{r.value}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: Crime at Sea, IMB-derived, DOI 10.5334/johd.39</div>
    </Slide>
  );
}
