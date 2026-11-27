# Adhop

YouTube ad skipper for Chrome and Firefox. [adhop.app](https://adhop.app)

It presses Skip for you as soon as it can, or speeds ads up if you prefer. You can set this for everything or per channel, so channels you want to support can keep their ads. Sponsored tiles are hidden unless you turn that off.

It's not an ad blocker. If an ad has no Skip button you still have to sit through it, but at least it's muted (unless you turn muting off).

No tracking. Adhop makes no network requests.

## Install

- Chrome: [Chrome Web Store](https://chromewebstore.google.com/detail/adhop/bhbkohkcmdbmhpcgjmcnpegkccdpigcn)
- Firefox: [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/adhop/)

Both update on their own.

### Chrome without the store

1. Download the Chrome zip from the [latest release](https://github.com/Xavinlol/adhop/releases/latest) and unpack it somewhere it can stay
2. Open `chrome://extensions` and turn on Developer mode (top right)
3. Click "Load unpacked" and pick the folder you unpacked

To update, put the new files in the same folder and hit reload on Adhop in `chrome://extensions`.

## Build it yourself

```
pnpm install
pnpm build
pnpm build:firefox
```

`pnpm build` writes the Chrome version to `dist`, `pnpm build:firefox` the Firefox version to `dist-firefox`. Load `dist` in Chrome like above. In Firefox, open `about:debugging`, click "This Firefox", then "Load Temporary Add-on" and pick `dist-firefox/manifest.json`. Firefox removes temporary add-ons when it restarts.

## License

[GPL-3.0-or-later](LICENSE)
