import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { companies, usvBuilders, byMarket, players } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../slide-design-system";

export function FieldSlide() {
  const countries = new Set(companies.map((c) => c.country as string)).size;
  const stats = [
    { v: String(companies.length), l: "companies catalogued", s: `${countries} countries`, t: TONE.paper },
    { v: String(usvBuilders.length), l: "build uncrewed surface vessels", s: "worldwide", t: TONE.cool },
    { v: String(byMarket(usvBuilders, "military").length), l: "of those serve defence programmes", s: "military positioning", t: TONE.hot },
    { v: String(byMarket(usvBuilders, "commercial").length), l: "serve commercial customers only", s: "and none of them do security", t: TONE.calm },
  ];
  return (
    <Slide align="start" tone="default">
      <Eyebrow>04 — The field</Eyebrow>
      <Title>Who is already selling</Title>
      <Body>
        Escort vessels, armed teams, autonomous platforms, counter-drone, domain awareness,
        non-lethal hardware, underwater detection and cyber — {players.categories.length} categories.
      </Body>
      <div className="slide__grid">
        {stats.map((s) => (
          <FadeItem key={s.l}>
            <div style={card}>
              <div style={{ ...statValue, color: s.t }}>{s.v}</div>
              <div style={statLabel}>{s.l}</div>
              <div style={statSub}>{s.s}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>
        Source: Odd Fox market-players dataset, {companies.filter((c) => (c.source_ids as string[])?.length).length} of{" "}
        {companies.length} records sourced
      </div>
    </Slide>
  );
}
