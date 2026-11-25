import { AdControls } from "./ad-controls";
import { channelOf } from "./channel-bridge";
import { PlaybackOverride } from "./playback-override";
import { rulesFor, type Action, type Channel, type Rules, type Settings } from "./settings";
import { addStats } from "./stats";
import { AD_CLASS, SEPARATE_AD_CLASS, SKIP_BUTTON } from "./youtube";

const CLICK_COOLDOWN_MS = 1000;
const IDLE_TICK_MS = 500;
const TICK_EVENTS = ["loadedmetadata", "playing", "timeupdate"] as const;

interface Ad {
  source: string;
  startedAt: number;
  duration: number;
  separate: boolean;
  handled: boolean;
}

function secondsSince(start: number): number {
  return (performance.now() - start) / 1000;
}

export class AdSession {
  private readonly startedAt = performance.now();
  private readonly handled = { ads: 0, seconds: 0 };
  private readonly lifetime = new AbortController();
  private readonly playback = new PlaybackOverride();
  private readonly controls: AdControls;
  private readonly timer: number;
  private channel: Channel | null = null;
  private ad: Ad | null = null;
  private flipped = false;
  private lastClick = -Infinity;

  constructor(
    private readonly player: HTMLElement,
    private readonly settings: () => Settings,
  ) {
    this.controls = new AdControls(player, () => this.flip());
    for (const type of TICK_EVENTS) {
      player.addEventListener(type, () => this.tick(), { capture: true, signal: this.lifetime.signal });
    }
    this.timer = window.setInterval(() => this.tick(), IDLE_TICK_MS);
    this.tick();
  }

  tick(): void {
    const video = this.player.querySelector("video");
    if (!video) return;

    this.channel ??= channelOf(this.player);
    const settings = this.settings();
    const rules = rulesFor(settings, this.channel?.id);
    const ad = this.follow(video);
    const action = this.actionFor(rules);
    const wait = this.secondsUntilSkipping(video, ad, rules.delay);
    const skipping = action !== "play" && wait <= 0;
    const speeding = skipping && action === "speed" && ad.separate && video.src !== "";

    this.playback.setRate(video, speeding ? rules.rate : null);
    this.playback.setMuted(video, rules.mute && !(this.flipped && action === "play"));
    const clicked = skipping && this.clickSkip();
    ad.handled ||= speeding || clicked;

    if (!settings.showControls) {
      this.controls.hide();
    } else if (action === "play") {
      this.controls.show("Ad plays in full", "Skip it");
    } else if (!skipping) {
      this.controls.show(`Skipping in ${Math.ceil(wait)} s`, "Let it play");
    } else {
      this.controls.show(speeding ? `Ad at ${rules.rate}x` : "Waiting for Skip", "Let it play");
    }
  }

  flip(): void {
    this.flipped = !this.flipped;
    this.tick();
  }

  end(): void {
    this.lifetime.abort();
    clearInterval(this.timer);
    this.controls.hide();
    const video = this.player.querySelector("video");
    if (video) {
      this.playback.release(video);
    }
    if (this.player.classList.contains(AD_CLASS)) return;

    if (!this.tracksContent(video)) {
      this.finishAd();
    }
    if (this.handled.ads > 0) {
      this.recordOnceContentPlays();
    }
  }

  private actionFor(rules: Rules): Action {
    if (!this.flipped) return rules.action;
    return rules.action === "play" ? "click" : "play";
  }

  private follow(video: HTMLVideoElement): Ad {
    if (video.src !== "" && this.ad?.source !== video.src) {
      this.finishAd();
    }
    this.ad ??= { source: video.src, startedAt: performance.now(), duration: 0, separate: false, handled: false };
    this.ad.separate = this.player.classList.contains(SEPARATE_AD_CLASS);
    if (this.ad.separate && Number.isFinite(video.duration)) {
      this.ad.duration = video.duration;
    }
    return this.ad;
  }

  private tracksContent(video: HTMLVideoElement | null): boolean {
    return this.ad !== null && this.ad.separate && this.ad.source === video?.src;
  }

  private finishAd(): void {
    if (this.ad?.handled) {
      this.handled.ads += 1;
      this.handled.seconds += this.ad.duration;
    }
    this.ad = null;
  }

  private recordOnceContentPlays(): void {
    const listening = new AbortController();
    const record = ({ target }: Event): void => {
      const { currentTime, readyState, HAVE_FUTURE_DATA } = target as HTMLVideoElement;
      if (currentTime === 0 || readyState < HAVE_FUTURE_DATA) return;

      listening.abort();
      const { ads, seconds } = this.handled;
      void addStats({ ads, seconds: Math.max(0, seconds - secondsSince(this.startedAt)) });
    };
    this.player.addEventListener("timeupdate", record, { capture: true, signal: listening.signal });
  }

  private secondsUntilSkipping(video: HTMLVideoElement, ad: Ad, delay: number): number {
    if (this.flipped || video.src === "") return 0;

    const played = ad.separate ? video.currentTime : secondsSince(ad.startedAt);
    return delay - played;
  }

  private clickSkip(): boolean {
    const now = performance.now();
    if (now - this.lastClick < CLICK_COOLDOWN_MS) return false;

    for (const button of this.player.querySelectorAll<HTMLElement>(SKIP_BUTTON)) {
      if (button.checkVisibility()) {
        this.lastClick = now;
        button.click();
        return true;
      }
    }
    return false;
  }
}
