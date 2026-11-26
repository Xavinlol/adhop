import { create } from "./dom";
import { describeRules } from "./format";
import type { Action, Rules } from "./settings";

const MAX_DELAY = 30;
const SCALE = [0, 10, 20, MAX_DELAY];
const RATES = [2, 4, 8, 16];
const ACTIONS: Record<Action, string> = { click: "Skip", speed: "Speed up", play: "Let play" };
const HOLD_NOTE = "YouTube holds the video back after a sped-up ad, so unskippable ads only get about 20% shorter.";

function createForm(delayText: HTMLOutputElement, summary: HTMLElement): HTMLFormElement {
  return create(
    "form",
    {},
    create(
      "div",
      { className: "segments", role: "radiogroup", ariaLabel: "What happens to ads" },
      ...Object.entries(ACTIONS).map(([value, label]) =>
        create("label", {}, create("input", { type: "radio", name: "action", value }), create("span", {}, label)),
      ),
    ),
    create(
      "label",
      { className: "ad" },
      create("span", { className: "field" }, "Play before skipping ", delayText),
      create("input", { type: "range", name: "delay", min: "0", max: String(MAX_DELAY), step: "1" }),
      create("span", { className: "scale", ariaHidden: "true" }, ...SCALE.map((mark) => create("i", {}, `${mark} s`))),
    ),
    create(
      "label",
      { className: "field rate" },
      "Speed",
      create("select", { name: "rate" }, ...RATES.map((rate) => new Option(`${rate}x`, String(rate)))),
    ),
    create(
      "label",
      { className: "field" },
      "Mute ads",
      create("input", { type: "checkbox", role: "switch", name: "mute" }),
    ),
    summary,
    create("p", { className: "summary hold" }, HOLD_NOTE),
  );
}

interface Fields extends HTMLFormControlsCollection {
  action: RadioNodeList;
  delay: HTMLInputElement;
  rate: HTMLSelectElement;
  mute: HTMLInputElement;
}

export class RuleEditor extends HTMLElement {
  private readonly delayText = create("output");
  private readonly summary = create("p", { className: "summary", ariaLive: "polite" });
  private readonly form = createForm(this.delayText, this.summary);
  private readonly fields = this.form.elements as Fields;

  constructor() {
    super();
    this.append(this.form);
    this.form.addEventListener("input", () => this.render());
    this.form.addEventListener("change", (event) => {
      event.stopPropagation();
      this.dispatchEvent(new Event("change"));
    });
  }

  get rules(): Rules {
    const { action, delay, rate, mute } = this.fields;
    return {
      action: action.value as Action,
      delay: delay.valueAsNumber,
      rate: Number(rate.value),
      mute: mute.checked,
    };
  }

  set rules(rules: Rules) {
    const { action, delay, rate, mute } = this.fields;
    action.value = rules.action;
    delay.valueAsNumber = rules.delay;
    rate.value = String(rules.rate);
    mute.checked = rules.mute;
    this.render();
  }

  private render(): void {
    const { rules } = this;
    this.dataset.action = rules.action;
    this.style.setProperty("--cut", String(rules.delay / MAX_DELAY));
    this.style.setProperty("--stripe", `${28 - rules.rate * 1.25}px`);
    this.fields.delay.disabled = rules.action === "play";
    this.fields.rate.disabled = rules.action !== "speed";
    this.delayText.value = rules.action === "play" ? "All of it" : `${rules.delay} s`;
    this.fields.delay.ariaValueText = this.delayText.value;
    this.summary.textContent = describeRules(rules);
  }
}

customElements.define("rule-editor", RuleEditor);
