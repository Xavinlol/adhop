export interface Stats {
  ads: number;
  seconds: number;
}

const EMPTY: Stats = { ads: 0, seconds: 0 };

export function loadStats(): Promise<Stats> {
  return chrome.storage.local.get<Stats>(EMPTY);
}

export async function addStats({ ads, seconds }: Stats): Promise<void> {
  const stats = await loadStats();
  await chrome.storage.local.set({ ads: stats.ads + ads, seconds: stats.seconds + seconds });
}

export function resetStats(): Promise<void> {
  return chrome.storage.local.set(EMPTY);
}

export function onStatsChange(listener: (stats: Stats) => void): void {
  chrome.storage.local.onChanged.addListener(async () => listener(await loadStats()));
}
