# Adhop

YouTube ad skipper for Chrome.

It presses Skip for you as soon as it can. If you'd rather speed ads up or let them play, you can do that too, for everything or just for certain channels. Sponsored tiles are hidden unless you turn that off.

It's not an ad blocker. If an ad has no Skip button you still have to sit through it, but at least it's muted (unless you turn muting off).

No tracking. Adhop makes no network requests.

## Install

1. Download the zip from the [latest release](https://github.com/Xavinlol/adhop/releases/latest) and unpack it somewhere it can stay
2. Open `chrome://extensions` and turn on Developer mode (top right)
3. Click "Load unpacked" and pick the folder you unpacked

To update, put the new files in the same folder and hit reload on Adhop in `chrome://extensions`.

## Build it yourself

```
pnpm install
pnpm build
```

Then load the `dist` folder like above.

## License

[GPL-3.0-or-later](LICENSE)
