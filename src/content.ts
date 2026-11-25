import { channelOf } from "./channel-bridge";
import type { Message } from "./messages";
import { PlayerWatcher } from "./player-watcher";
import { loadSettings, onSettingsChange, type Channel, type Settings } from "./settings";
import { MAIN_PLAYER, PLAYER, VIDEO_PAGE } from "./youtube";

const watchers = new Map<HTMLElement, PlayerWatcher>();
let settings: Settings;

function watch(player: HTMLElement): void {
  if (watchers.has(player)) return;

  for (const [known, watcher] of watchers) {
    if (!known.isConnected) {
      watcher.stop();
      watchers.delete(known);
    }
  }
  watchers.set(player, new PlayerWatcher(player, () => settings));
}

function watchPlayerOf(event: Event): void {
  if (!(event.target instanceof HTMLVideoElement)) return;

  const player = event.target.closest<HTMLElement>(PLAYER);
  if (player) {
    watch(player);
  }
}

function apply(next: Settings): void {
  settings = next;
  document.documentElement.toggleAttribute("data-adhop-hide-sponsored", next.enabled && next.hideSponsored);
  for (const watcher of watchers.values()) {
    watcher.refresh();
  }
}

function currentChannel(): Channel | null {
  if (!VIDEO_PAGE.test(location.pathname)) return null;

  const player = document.querySelector<HTMLElement>(MAIN_PLAYER);
  return player && channelOf(player);
}

async function start(): Promise<void> {
  apply(await loadSettings());
  onSettingsChange(apply);
  chrome.runtime.onMessage.addListener((message: Message, _sender, respond) => {
    if (message === "get-channel") {
      respond(currentChannel());
    } else {
      for (const watcher of watchers.values()) {
        watcher.flip();
      }
    }
  });

  document.addEventListener("loadstart", watchPlayerOf, true);
  document.addEventListener("playing", watchPlayerOf, true);
  document.querySelectorAll<HTMLElement>(PLAYER).forEach(watch);
}

void start();
