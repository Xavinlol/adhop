export type Action = "click" | "speed" | "play";
export type Theme = "graphite" | "midnight" | "plum" | "red";

export interface Rules {
  action: Action;
  delay: number;
  rate: number;
  mute: boolean;
}

export interface Channel {
  id: string;
  name: string;
}

export interface ChannelRules extends Channel {
  rules: Rules;
}

export interface Preferences {
  enabled: boolean;
  rules: Rules;
  showControls: boolean;
  hideSponsored: boolean;
  theme: Theme;
}

export interface Settings extends Preferences {
  channels: Map<string, ChannelRules>;
}

const CHANNEL_KEY = "channel:";

const DEFAULTS: Preferences = {
  enabled: true,
  rules: { action: "click", delay: 0, rate: 16, mute: true },
  showControls: true,
  hideSponsored: true,
  theme: "graphite",
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get();
  const settings: Settings = { ...DEFAULTS, channels: new Map() };
  for (const [key, value] of Object.entries(stored)) {
    if (key.startsWith(CHANNEL_KEY)) {
      const channel = value as ChannelRules;
      settings.channels.set(channel.id, channel);
    } else {
      Object.assign(settings, { [key]: value });
    }
  }
  return settings;
}

export function savePreferences(patch: Partial<Preferences>): Promise<void> {
  return chrome.storage.sync.set(patch);
}

export function saveChannel(channel: ChannelRules): Promise<void> {
  return chrome.storage.sync.set({ [CHANNEL_KEY + channel.id]: channel });
}

export function removeChannel(id: string): Promise<void> {
  return chrome.storage.sync.remove(CHANNEL_KEY + id);
}

export function onSettingsChange(listener: (settings: Settings) => void): void {
  chrome.storage.sync.onChanged.addListener(async () => listener(await loadSettings()));
}

export function rulesFor(settings: Settings, channelId: string | undefined): Rules {
  const channel = channelId === undefined ? undefined : settings.channels.get(channelId);
  return channel?.rules ?? settings.rules;
}
