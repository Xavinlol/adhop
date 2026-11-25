import { AdSession } from "./ad-session";
import type { Settings } from "./settings";
import { AD_CLASS } from "./youtube";

export class PlayerWatcher {
  private readonly observer = new MutationObserver(() => this.sync());
  private session: AdSession | null = null;

  constructor(
    private readonly player: HTMLElement,
    private readonly settings: () => Settings,
  ) {
    this.observer.observe(player, { attributes: true, attributeFilter: ["class"] });
    this.sync();
  }

  refresh(): void {
    this.sync();
    this.session?.tick();
  }

  flip(): void {
    this.session?.flip();
  }

  stop(): void {
    this.observer.disconnect();
    this.session?.end();
    this.session = null;
  }

  private sync(): void {
    if (this.settings().enabled && this.player.classList.contains(AD_CLASS)) {
      this.session ??= new AdSession(this.player, this.settings);
    } else {
      this.session?.end();
      this.session = null;
    }
  }
}
