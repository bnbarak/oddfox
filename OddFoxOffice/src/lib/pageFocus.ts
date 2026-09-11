import { useEffect, useId, useSyncExternalStore } from "react";

/* What the operator is looking at, for the agent in the dock.

   The dock is mounted by the layout and knows nothing about the panel under
   it, which is right for everything else it does. But "is this one worth
   chasing?" asked over an open email means that email, and the agent can only
   know so if the page says. So a panel, or a modal over it, states what it is
   showing with useFocus, and the dock sends the lot with each question.

   Ids rather than content: the server looks the thread or campaign up itself,
   so the agent reads the record as it stands, not whatever this tab last
   polled. The exception is a draft, which exists nowhere but here. */

export type FocusDraft = {
  reply: boolean; to: string[]; cc: string[]; bcc: string[]; subject: string; body: string;
};

export type Focus = {
  /** A few words for the dock's "on" line. Every part's label is shown, in order. */
  label?: string;
  /** An Inbox thread's key. */
  thread?: string;
  campaign?: string;
  /** The campaigns a table is listing, in the order it lists them. */
  campaigns?: string[];
  account?: string;
  tier?: number;
  /** A filter or search in force, in words. */
  view?: string;
  draft?: FocusDraft;
};

/** What goes to the server with a question. */
export type PageContext = Focus & { page: string; page_label: string; label: string };

const parts = new Map<string, Focus>();
const subs = new Set<() => void>();
let merged: Focus = {};

/* Parts merge in the order they arrived, later over earlier: a modal opens
   after the panel it sits on, and what it shows is what you are looking at.
   A part that updates keeps its place — Map.set on a key already there does
   not move it. */
function publish() {
  const next: Record<string, unknown> = {};
  const labels: string[] = [];
  for (const f of parts.values()) {
    for (const [k, v] of Object.entries(f)) {
      if (k !== "label" && v !== undefined && v !== null) next[k] = v;
    }
    if (f.label) labels.push(f.label);
  }
  if (labels.length) next.label = labels.join(" › ");
  merged = next as Focus;
  for (const s of subs) s();
}

/** Say what this component is showing; null for nothing in particular.
    Unmounting takes it back. */
export function useFocus(f: Focus | null): void {
  const id = useId();
  const key = JSON.stringify(f);
  useEffect(() => {
    if (f) parts.set(id, f); else parts.delete(id);
    publish();
    // `key` stands in for `f`, which is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);
  useEffect(() => () => { parts.delete(id); publish(); }, [id]);
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => { subs.delete(fn); };
};

/** The dock's "on" line. Only the words, so typing into a draft — which
    changes the focus on every key — re-renders the dock only when they change. */
export const useFocusLabel = (): string =>
  useSyncExternalStore(subscribe, () => merged.label ?? "");

/** All of it, read at the moment a question is sent. */
export const focusNow = (): Focus => merged;
