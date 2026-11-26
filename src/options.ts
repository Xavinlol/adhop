import { find } from "./dom";
import { describeRules, describeStats } from "./format";
import { RuleEditor } from "./rule-editor";
import {
  loadSettings,
  onSettingsChange,
  removeChannel,
  saveChannel,
  savePreferences,
  type ChannelRules,
  type Settings,
  type Theme,
} from "./settings";
import { loadStats, onStatsChange, resetStats, type Stats } from "./stats";

const enabled = find<HTMLInputElement>("#enabled");
const body = find<HTMLFieldSetElement>("#body");
const editor = find<RuleEditor>("#general");
const showControls = find<HTMLInputElement>("#show-controls");
const hideSponsored = find<HTMLInputElement>("#hide-sponsored");
const channelList = find<HTMLUListElement>("#channels");
const channelTemplate = find<HTMLTemplateElement>("#channel");
const themes = find<HTMLFormElement>("#themes");
const theme = themes.elements.namedItem("theme") as RadioNodeList;
const statsText = find("#stats");
const resetButton = find<HTMLButtonElement>("#reset-stats");
const rows = new Map<string, HTMLLIElement>();

function createRow(channel: ChannelRules): HTMLLIElement {
  const row = find<HTMLLIElement>("li", document.importNode(channelTemplate.content, true));
  const rowEditor = find<RuleEditor>("rule-editor", row);
  find("summary strong", row).textContent = channel.name;
  rowEditor.addEventListener("change", () => saveChannel({ ...channel, rules: rowEditor.rules }));
  find("button", row).addEventListener("click", () => removeChannel(channel.id));
  return row;
}

function renderChannels(channels: Settings["channels"]): void {
  for (const [id, row] of rows) {
    if (!channels.has(id)) {
      row.remove();
      rows.delete(id);
    }
  }

  const sorted = [...channels.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const [index, channel] of sorted.entries()) {
    let row = rows.get(channel.id);
    if (!row) {
      row = createRow(channel);
      rows.set(channel.id, row);
    }
    if (channelList.children[index] !== row) {
      channelList.insertBefore(row, channelList.children[index] ?? null);
    }
    find<RuleEditor>("rule-editor", row).rules = channel.rules;
    find("summary span", row).textContent = describeRules(channel.rules);
  }
}

function render(settings: Settings): void {
  document.documentElement.dataset.theme = settings.theme;
  theme.value = settings.theme;
  enabled.checked = settings.enabled;
  body.disabled = !settings.enabled;
  editor.rules = settings.rules;
  showControls.checked = settings.showControls;
  hideSponsored.checked = settings.hideSponsored;
  renderChannels(settings.channels);
}

function renderStats(stats: Stats): void {
  statsText.textContent = describeStats(stats);
  resetButton.hidden = stats.ads === 0;
}

async function renderShortcuts(): Promise<void> {
  const commands = await chrome.commands.getAll();
  for (const { name, shortcut } of commands) {
    const key = document.querySelector(`[data-command="${name}"]`);
    if (key) {
      key.textContent = shortcut || "Not set";
    }
  }
}

function openShortcutSettings(): void {
  const commands: typeof chrome.commands & { openShortcutSettings?: () => Promise<void> } = chrome.commands;
  if (commands.openShortcutSettings) {
    void commands.openShortcutSettings();
  } else {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }
}

async function start(): Promise<void> {
  render(await loadSettings());
  renderStats(await loadStats());
  await renderShortcuts();

  onSettingsChange(render);
  onStatsChange(renderStats);
  window.addEventListener("focus", renderShortcuts);
  enabled.addEventListener("change", () => savePreferences({ enabled: enabled.checked }));
  editor.addEventListener("change", () => savePreferences({ rules: editor.rules }));
  showControls.addEventListener("change", () => savePreferences({ showControls: showControls.checked }));
  hideSponsored.addEventListener("change", () => savePreferences({ hideSponsored: hideSponsored.checked }));
  themes.addEventListener("change", () => savePreferences({ theme: theme.value as Theme }));
  resetButton.addEventListener("click", resetStats);
  find("#change-shortcuts").addEventListener("click", openShortcutSettings);
}

void start();
