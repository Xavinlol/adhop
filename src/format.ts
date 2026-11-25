import type { Rules } from "./settings";
import type { Stats } from "./stats";

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const rest = minutes % 60;
  const hours = `${Math.floor(minutes / 60)} h`;
  return rest === 0 ? hours : `${hours} ${rest} min`;
}

export function describeStats({ ads, seconds }: Stats): string {
  if (ads === 0) return "No ads skipped yet";
  return `${ads.toLocaleString()} ${ads === 1 ? "ad" : "ads"} skipped, ${formatDuration(seconds)} avoided`;
}

export function describeRules({ action, delay, rate, mute }: Rules): string {
  const sound = mute ? " Sound is off." : "";
  if (action === "play") return `Ads play in full.${sound}`;

  const start = delay === 0 ? "" : `Ads play for ${delay} s, then `;
  const rest =
    action === "speed" ? `run at ${rate}x until they can be skipped.` : "are skipped as soon as YouTube allows it.";
  return `${start || "Ads "}${rest}${sound}`;
}
