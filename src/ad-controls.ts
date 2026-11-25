const STYLE = `
  :host {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 70;
  }
  div {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 6px 6px 14px;
    border-radius: 20px;
    background: rgb(23 23 26 / 85%);
    color: #f1f1f3;
    font: 13px/1 Bahnschrift, "DIN Alternate", system-ui, sans-serif;
    cursor: default;
  }
  button {
    padding: 8px 12px;
    border: 0;
    border-radius: 14px;
    background: #f2b61d;
    color: #1d1602;
    font: inherit;
    cursor: pointer;
  }
  button:hover { background: #ffc93c; }
  button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
`;

export class AdControls {
  private readonly host = document.createElement("div");
  private readonly status = document.createElement("span");
  private readonly button = document.createElement("button");

  constructor(
    private readonly player: HTMLElement,
    onToggle: () => void,
  ) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    this.button.type = "button";
    this.button.addEventListener("click", onToggle);
    const panel = document.createElement("div");
    panel.append(this.status, this.button);
    for (const type of ["click", "dblclick", "mousedown", "pointerdown"]) {
      this.host.addEventListener(type, (event) => event.stopPropagation());
    }
    this.host.dataset.adhopControls = "";
    this.host.attachShadow({ mode: "open" }).append(style, panel);
  }

  show(status: string, action: string): void {
    if (this.status.textContent !== status) {
      this.status.textContent = status;
    }
    if (this.button.textContent !== action) {
      this.button.textContent = action;
    }
    if (!this.host.isConnected) {
      this.player.append(this.host);
    }
  }

  hide(): void {
    this.host.remove();
  }
}
