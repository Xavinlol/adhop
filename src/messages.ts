import type { Channel } from "./settings";

export type Message = "get-channel" | "toggle-let-play";

export async function activeTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

export async function activeChannel(): Promise<Channel | null> {
  const tabId = await activeTabId();
  if (tabId === undefined) return null;

  const message: Message = "get-channel";
  return chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => null);
}

export async function toggleLetPlay(): Promise<void> {
  const tabId = await activeTabId();
  if (tabId === undefined) return;

  const message: Message = "toggle-let-play";
  await chrome.tabs.sendMessage(tabId, message).catch(() => undefined);
}
