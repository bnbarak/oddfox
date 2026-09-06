export type Tone = "hot" | "warm" | "cool" | "calm" | "paper" | "";

export const TONE_VAR: Record<string, string> = {
  hot: "var(--hot)", warm: "var(--warm)", cool: "var(--cool)",
  calm: "var(--calm)", paper: "var(--paper)", "": "var(--paper)",
};

export const CONF_TONE: Record<string, Tone> = { high: "calm", medium: "warm", low: "hot" };

export const PIE_TONES = [
  "var(--hot)", "var(--cool)", "var(--warm)", "var(--calm)",
  "#b48cff", "#8c8c8c", "#5f7d8c", "#d9d9d9",
];

/** Equirectangular, matching tools/build-world-path.py. */
export const lonlat = (lat: number, lon: number): [number, number] => [
  ((lon + 180) / 360) * 2000,
  ((90 - lat) / 180) * 1000,
];
