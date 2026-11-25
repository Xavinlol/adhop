interface RateBoost {
  source: string;
  original: number;
  applied: number;
}

export class PlaybackOverride {
  private boost: RateBoost | null = null;
  private mutedSource: string | null = null;

  setRate(video: HTMLVideoElement, rate: number | null): void {
    if (rate === null) {
      this.restoreRate(video);
      return;
    }
    if (video.playbackRate === rate) return;

    const original = this.boost?.source === video.src ? this.boost.original : video.playbackRate;
    this.boost = { source: video.src, original, applied: rate };
    video.playbackRate = rate;
  }

  setMuted(video: HTMLVideoElement, muted: boolean): void {
    if (!muted) {
      this.restoreSound(video);
    } else if (!video.muted) {
      video.muted = true;
      this.mutedSource = video.src;
    }
  }

  release(video: HTMLVideoElement): void {
    this.restoreRate(video);
    this.restoreSound(video);
  }

  private restoreRate(video: HTMLVideoElement): void {
    if (video.playbackRate === this.boost?.applied) {
      video.playbackRate = this.boost.original;
    }
    this.boost = null;
  }

  private restoreSound(video: HTMLVideoElement): void {
    if (this.mutedSource === video.src) {
      video.muted = false;
    }
    this.mutedSource = null;
  }
}
