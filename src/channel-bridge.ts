import type { Channel } from "./settings";

const REQUEST = "adhop-channel";

interface YouTubePlayer extends HTMLElement {
  getPlayerResponse?(): { videoDetails?: { channelId: string; author: string } } | undefined;
}

export function answerChannelRequests(): void {
  document.addEventListener(REQUEST, (event) => {
    const player = event.target as YouTubePlayer;
    const details = player.getPlayerResponse?.()?.videoDetails;
    if (details) {
      const channel: Channel = { id: details.channelId, name: details.author };
      player.dataset.adhopChannel = JSON.stringify(channel);
    } else {
      delete player.dataset.adhopChannel;
    }
  });
}

export function channelOf(player: HTMLElement): Channel | null {
  player.dispatchEvent(new Event(REQUEST, { bubbles: true }));
  const channel = player.dataset.adhopChannel;
  return channel ? JSON.parse(channel) : null;
}
