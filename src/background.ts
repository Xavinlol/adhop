import { toggleLetPlay } from "./messages";
import { loadSettings, onSettingsChange, savePreferences, type Settings } from "./settings";

async function showState({ enabled }: Settings): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: "#5d5d67" });
  await chrome.action.setBadgeText({ text: enabled ? "" : "off" });
}

async function runCommand(command: string): Promise<void> {
  if (command === "toggle-enabled") {
    const settings = await loadSettings();
    await savePreferences({ enabled: !settings.enabled });
  } else if (command === "toggle-let-play") {
    await toggleLetPlay();
  }
}

chrome.commands.onCommand.addListener(runCommand);
onSettingsChange(showState);
void loadSettings().then(showState);
