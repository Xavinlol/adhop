import { find } from "./dom";
import { describeStats } from "./format";
import { activeChannel } from "./messages";
import { RuleEditor } from "./rule-editor";
import { loadSettings, onSettingsChange, removeChannel, rulesFor, saveChannel, savePreferences } from "./settings";
import { loadStats } from "./stats";

const enabled = find<HTMLInputElement>("#enabled");
const body = find<HTMLFieldSetElement>("#body");
const scope = find<HTMLFormElement>("#scope");
const channelScope = find<HTMLInputElement>("#scope-channel");
const editor = find<RuleEditor>("rule-editor");
const reset = find<HTMLButtonElement>("#reset");

async function start(): Promise<void> {
  const [loaded, stats, channel] = await Promise.all([loadSettings(), loadStats(), activeChannel()]);
  let settings = loaded;

  const selected = () => (channelScope.checked ? channel : null);

  function render(): void {
    const target = selected();
    document.documentElement.dataset.theme = settings.theme;
    enabled.checked = settings.enabled;
    body.disabled = !settings.enabled;
    editor.rules = rulesFor(settings, target?.id);
    reset.hidden = target === null || !settings.channels.has(target.id);
  }

  scope.hidden = channel === null;
  if (channel) {
    find("#channel-name").textContent = channel.name;
    channelScope.checked = settings.channels.has(channel.id);
  }
  find("#stats").textContent = describeStats(stats);
  render();

  onSettingsChange((next) => {
    settings = next;
    render();
  });
  scope.addEventListener("change", render);
  enabled.addEventListener("change", () => savePreferences({ enabled: enabled.checked }));
  editor.addEventListener("change", () => {
    const target = selected();
    const { rules } = editor;
    return target ? saveChannel({ ...target, rules }) : savePreferences({ rules });
  });
  reset.addEventListener("click", () => {
    const target = selected();
    if (target) {
      void removeChannel(target.id);
    }
  });
  find("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

void start();
