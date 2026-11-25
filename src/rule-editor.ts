import { describeRules } from "./format";
import type { Action, Rules } from "./settings";

const MAX_DELAY = 30;
const RATES = [2, 4, 8, 16];

const MARKUP = `
  <form>
    <div class="segments" role="radiogroup" aria-label="What happens to ads">
      <label><input type="radio" name="action" value="click"><span>Skip</span></label>
      <label><input type="radio" name="action" value="speed"><span>Speed up</span></label>
      <label><input type="radio" name="action" value="play"><span>Let play</span></label>
    </div>
    <label class="ad">
      <span class="field">Play before skipping <output></output></span>
      <input type="range" name="delay" min="0" max="${MAX_DELAY}" step="1">
      <span class="scale" aria-hidden="true"><i>0 s</i><i>10 s</i><i>20 s</i><i>30 s</i></span>
    </label>
    <label class="field rate">
      Speed
      <select name="rate">${RATES.map((rate) => `<option value="${rate}">${rate}x</option>`).join("")}</select>
    </label>
    <label class="field">
      Mute ads
      <input type="checkbox" role="switch" name="mute">
    </label>
    <p class="summary" aria-live="polite"></p>
    <p class="summary hold">YouTube holds the video back after a sped-up ad, so unskippable ads only get about 20% shorter.</p>
  </form>
`;

interface Fields extends HTMLFormControlsCollection {
  action: RadioNodeList;
  delay: HTMLInputElement;
  rate: HTMLSelectElement;
  mute: HTMLInputElement;
}

export class RuleEditor extends HTMLElement {
  private readonly form: HTMLFormElement;
  private readonly fields: Fields;
  private readonly delayText: HTMLOutputElement;
  private readonly summary: HTMLElement;

  constructor() {
    super();
    this.innerHTML = MARKUP;
    this.form = this.querySelector("form")!;
    this.fields = this.form.elements as Fields;
    this.delayText = this.form.querySelector("output")!;
    this.summary = this.form.querySelector(".summary")!;
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
