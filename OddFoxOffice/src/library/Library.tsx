import { Overview } from "./panels/Overview";
import { Threat } from "./panels/Threat";
import { History } from "./panels/History";
import { Attacks } from "./panels/Attacks";
import { Passages } from "./panels/Passages";
import { Owners } from "./panels/Owners";
import { Exposed } from "./panels/Exposed";
import { Segments } from "./panels/Segments";
import { GTM } from "./panels/GTM";
import { CrmAccounts } from "./panels/crm/Accounts";
import { CrmPeople } from "./panels/crm/People";
import { CrmCampaigns } from "./panels/crm/Campaigns";
import { CrmSequences } from "./panels/crm/Sequences";
import { CrmOutreach } from "./panels/crm/Outreach";
import { CrmInbox } from "./panels/crm/Inbox";
import { CrmSettings } from "./panels/crm/Settings";
import { Players } from "./panels/Players";
import { Dossier } from "./panels/Dossier";
import { Distance } from "./panels/Distance";
import { MatrixPanel, type MatrixFilters, type MatrixSort } from "./panels/MatrixPanel";
import { Platforms } from "./panels/Platforms";
import { Registries } from "./panels/Registries";
import { Economics } from "./panels/Economics";
import { Insurers } from "./panels/Insurers";
import { Sources } from "./panels/Sources";
import { Stats } from "./panels/Stats";
import { VC } from "./panels/VC";

export const GROUPS = [
  { id: "threat",  label: "Threat" },
  { id: "market",  label: "Market" },
  { id: "customers", label: "Customers" },
  { id: "crm",     label: "CRM" },
  { id: "sources", label: "Reference" },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"];

export const TABS = [
  { id: "overview",   label: "Overview",   group: "threat" },
  { id: "threat",     label: "Counts",     group: "threat" },
  { id: "history",    label: "1993–2020",  group: "threat" },
  { id: "attacks",    label: "How",        group: "threat" },
  { id: "passages",   label: "Passages",   group: "threat" },

  { id: "players",    label: "Profiles",   group: "market" },
  { id: "distance",   label: "Distance",   group: "market" },
  { id: "matrix",     label: "Matrix",     group: "market" },
  { id: "dossiers",   label: "Dossiers",   group: "market" },
  { id: "platforms",  label: "Platforms",  group: "market" },
  { id: "economics",  label: "Economics",  group: "market" },
  { id: "insurers",   label: "Insurers",   group: "market" },

  { id: "gtm",        label: "GTM",        group: "customers" },
  { id: "vc",         label: "VC",         group: "customers" },
  { id: "exposed",    label: "Exposed",    group: "customers" },
  { id: "segments",   label: "Segments",   group: "customers" },
  { id: "owners",     label: "Buying chain", group: "customers" },

  // Inbox is first because it is the CRM's landing page: the group nav
  // links to tabsIn(group)[0], so order here decides where "CRM" goes. Mail
  // waiting to be read is the first thing worth seeing on the way in.
  { id: "crm-inbox",     label: "Inbox",     group: "crm" },
  { id: "crm-outreach",  label: "Outreach",  group: "crm" },
  { id: "crm-campaigns", label: "Campaigns", group: "crm" },
  { id: "crm",           label: "Accounts",  group: "crm" },
  { id: "crm-people",    label: "People",    group: "crm" },
  { id: "crm-sequences", label: "Sequences", group: "crm" },
  { id: "crm-settings",  label: "Settings",  group: "crm" },

  { id: "stats",      label: "Stats",      group: "sources" },
  { id: "registries", label: "Registries", group: "sources" },
  { id: "sources",    label: "Sources",    group: "sources" },
] as const;

export const groupOf = (tab: string): GroupId =>
  (TABS.find((t) => t.id === tab)?.group ?? "threat") as GroupId;

export const tabsIn = (g: GroupId) => TABS.filter((t) => t.group === g);

export type TabId = (typeof TABS)[number]["id"];

export type ViewState = {
  geoSeries: string; playerCat: string; matrixF: MatrixFilters; matrixAllCols: boolean; matrixSort: MatrixSort; proxComp: string;
};

/** View state is owned by the router layout so it survives a tab change. */
export function Library({ tab, v, set }: {
  tab: TabId;
  v: ViewState;
  set: <K extends keyof ViewState>(k: K) => (val: ViewState[K]) => void;
}) {
  const panels: Record<TabId, React.ReactNode> = {
    overview:   <Overview geoSeries={v.geoSeries} setGeoSeries={set("geoSeries")} />,
    threat:     <Threat geoSeries={v.geoSeries} setGeoSeries={set("geoSeries")} />,
    history:    <History />,
    attacks:    <Attacks />,
    passages:   <Passages />,
    owners:     <Owners />,
    gtm:        <GTM />,
    vc:         <VC />,
    "crm":           <CrmAccounts />,
    "crm-people":    <CrmPeople />,
    "crm-sequences": <CrmSequences />,
    "crm-settings":  <CrmSettings />,
    "crm-outreach":  <CrmOutreach />,
    "crm-campaigns": <CrmCampaigns />,
    "crm-inbox":     <CrmInbox />,
    exposed:    <Exposed />,
    segments:   <Segments />,
    players:    <Players playerCat={v.playerCat} setPlayerCat={set("playerCat")} />,
    distance:   <Distance proxComp={v.proxComp} setProxComp={set("proxComp")} />,
    dossiers:   <Dossier />,
    matrix:     <MatrixPanel matrixF={v.matrixF} setMatrixF={set("matrixF")}
                             matrixAllCols={v.matrixAllCols} setMatrixAllCols={set("matrixAllCols")}
                             matrixSort={v.matrixSort} setMatrixSort={set("matrixSort")} />,
    platforms:  <Platforms />,
    stats:      <Stats />,
    registries: <Registries />,
    economics:  <Economics />,
    insurers:   <Insurers />,
    sources:    <Sources />,
  };

  return <div className="of-wrap">{panels[tab]}</div>;
}
