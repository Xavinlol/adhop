import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const extension = fileURLToPath(new URL("../dist", import.meta.url));
const fakeYoutube = await readFile(new URL("fake-youtube.html", import.meta.url), "utf8");

const RULES = { action: "speed", delay: 0, rate: 16, mute: true };
const PREFERENCES = { enabled: true, rules: RULES, showControls: true, hideSponsored: true };

let context;
let worker;
let origin;

before(async () => {
  context = await chromium.launchPersistentContext("", {
    executablePath: process.env.CHROMIUM_PATH,
    channel: process.env.CHROMIUM_PATH ? undefined : "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  await context.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fakeYoutube }),
  );
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  origin = `chrome-extension://${new URL(worker.url()).host}`;
});

after(() => context?.close());

beforeEach(async () => {
  await worker.evaluate(() => Promise.all([chrome.storage.sync.clear(), chrome.storage.local.clear()]));
  await store(PREFERENCES);
});

function store(values) {
  return worker.evaluate((next) => chrome.storage.sync.set(next), values);
}

function storeRules(patch) {
  return store({ rules: { ...RULES, ...patch } });
}

function stored() {
  return worker.evaluate(() => chrome.storage.sync.get());
}

function storedStats() {
  return worker.evaluate(() => chrome.storage.local.get());
}

async function openVideo() {
  const page = await context.newPage();
  await page.goto("https://www.youtube.com/watch?v=fake");
  return page;
}

async function openPage(name) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error));
  await page.goto(`${origin}/${name}.html`);
  assert.deepEqual(errors, []);
  return page;
}

async function play(scenario) {
  const page = await openVideo();
  const state = await page.evaluate((next) => run(next), scenario);
  await page.close();
  return state;
}

function startAd(page, ad) {
  return page.evaluate((next) => void run({ ads: [next] }), ad);
}

function assertContentUntouched(state, { rate = 1, muted = false } = {}) {
  assert.deepEqual([...new Set(state.contentRates)], [rate]);
  assert.equal(state.contentMuted, muted);
  assert.equal(state.abnormal, 0);
}

async function eventually(check) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await check();
    } catch (error) {
      if (attempt === 40) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

test("speed up gets through an ad without a skip button", async () => {
  const state = await play({ ads: [{ seconds: 15 }] });
  assert.ok(state.ads[0].tookMs < 3000, `took ${state.ads[0].tookMs} ms`);
  assertContentUntouched(state);
});

test("speed up skips a long ad", async () => {
  const state = await play({ ads: [{ seconds: 60, skipAfter: 5 }] });
  assert.equal(state.skipped, 1);
  assert.ok(state.ads[0].tookMs < 2500, `took ${state.ads[0].tookMs} ms`);
  assertContentUntouched(state);
});

test("speed up uses the chosen rate", async () => {
  await storeRules({ rate: 4 });
  const state = await play({ ads: [{ seconds: 12 }] });
  assert.equal(state.ads[0].maxRate, 4);
  assertContentUntouched(state);
});

test("speed up lets an ad play for the chosen time first", async () => {
  await storeRules({ delay: 3 });
  const state = await play({ ads: [{ seconds: 60, skipAfter: 1 }] });
  assert.ok(state.ads[0].spedUpAt === null || state.ads[0].spedUpAt >= 3);
  assert.ok(state.ads[0].skippedAt >= 3, `skipped at ${state.ads[0].skippedAt}`);
  assertContentUntouched(state);
});

test("skip works at normal speed", async () => {
  await storeRules({ action: "click" });
  const state = await play({ ads: [{ seconds: 30, skipAfter: 5 }] });
  assert.equal(state.skipped, 1);
  assert.equal(state.ads[0].maxRate, 1);
  assert.ok(state.ads[0].tookMs < 7000, `took ${state.ads[0].tookMs} ms`);
  assertContentUntouched(state);
});

test("skip waits for the chosen time", async () => {
  await storeRules({ action: "click", delay: 4 });
  const state = await play({ ads: [{ seconds: 30, skipAfter: 1 }] });
  assert.ok(state.ads[0].skippedAt >= 4, `skipped at ${state.ads[0].skippedAt}`);
  assertContentUntouched(state);
});

test("skip works after the ad stalls", async () => {
  await storeRules({ action: "click" });
  const state = await play({ ads: [{ seconds: 30, skipAfter: 5, stallMs: 7000 }] });
  assert.equal(state.skipped, 1);
  assertContentUntouched(state);
});

test("skip works with the legacy button", async () => {
  await storeRules({ action: "click" });
  const state = await play({ ads: [{ seconds: 30, skipAfter: 2, legacy: true }] });
  assert.equal(state.skipped, 1);
  assertContentUntouched(state);
});

test("skip works for every ad of a pod", async () => {
  await storeRules({ action: "click" });
  const ad = { seconds: 30, skipAfter: 2 };
  const state = await play({ ads: [ad, ad, ad] });
  assert.equal(state.skipped, 3);
  assertContentUntouched(state);
  await eventually(async () => assert.equal((await storedStats()).ads, 3));
});

for (const action of ["click", "speed"]) {
  test(`${action} handles an ad in the middle of a video`, async () => {
    await storeRules({ action });
    const page = await openVideo();
    const state = await page.evaluate(() => runMidroll({ ad: { seconds: 60, skipAfter: 5 }, rate: 1.5 }));
    await page.close();
    assert.equal(state.skipped, 1);
    assert.ok(state.resumedAt > 0 && state.resumedAt < 3, `resumed ${state.resumedAt} s later`);
    assertContentUntouched(state, { rate: 1.5 });
  });
}

test("let play leaves the ad alone", async () => {
  await storeRules({ action: "play", mute: false });
  const state = await play({ ads: [{ seconds: 6, skipAfter: 1 }] });
  assert.equal(state.skipped, 0);
  assert.equal(state.ads[0].maxRate, 1);
  assert.equal(state.ads[0].mutedSamples, 0);
  assert.equal((await storedStats()).ads, undefined);
});

test("channel rules win over the general rules", async () => {
  await store({ "channel:UC_fake": { id: "UC_fake", name: "Fake Channel", rules: { ...RULES, action: "play" } } });
  const state = await play({ ads: [{ seconds: 5, skipAfter: 1 }] });
  assert.equal(state.skipped, 0);
  assert.equal(state.ads[0].maxRate, 1);
});

test("rules of other channels do not apply", async () => {
  await store({ "channel:UC_other": { id: "UC_other", name: "Other", rules: { ...RULES, action: "play" } } });
  const state = await play({ ads: [{ seconds: 30, skipAfter: 1 }] });
  assert.equal(state.skipped, 1);
});

test("ads stay muted throughout a pod", async () => {
  await storeRules({ action: "click" });
  const ad = { seconds: 30, skipAfter: 3 };
  const state = await play({ ads: [ad, ad] });
  for (const { mutedSamples, samples } of state.ads) {
    assert.ok(samples - mutedSamples <= 1, `${mutedSamples} of ${samples} samples muted`);
  }
  assertContentUntouched(state);
});

test("a viewer who muted the player stays muted", async () => {
  const state = await play({ ads: [{ seconds: 15 }], muted: true });
  assertContentUntouched(state, { muted: true });
});

test("ads are audible with muting off", async () => {
  await storeRules({ action: "click", mute: false });
  const state = await play({ ads: [{ seconds: 30, skipAfter: 2 }] });
  assert.equal(state.ads[0].mutedSamples, 0);
  assertContentUntouched(state);
});

test("the viewer's playback rate survives", async () => {
  const state = await play({ ads: [{ seconds: 15 }], rate: 1.5 });
  assertContentUntouched(state, { rate: 1.5 });
});

test("server-stitched ads are not sped up", async () => {
  const state = await play({ ads: [{ seconds: 20, skipAfter: 2, stitched: true }] });
  assert.equal(state.ads[0].maxRate, 1);
  assert.equal(state.skipped, 1);
  assertContentUntouched(state);
});

test("nothing happens when disabled", async () => {
  await store({ enabled: false });
  const state = await play({ ads: [{ seconds: 6, skipAfter: 2 }] });
  assert.equal(state.skipped, 0);
  assert.equal(state.ads[0].maxRate, 1);
  assert.equal(state.ads[0].mutedSamples, 0);
});

test("turning the extension off mid-ad restores rate and sound", async () => {
  const page = await openVideo();
  await startAd(page, { seconds: 600 });
  await page.waitForFunction(() => video.playbackRate === 16 && video.muted);
  await store({ enabled: false });
  await page.waitForFunction(() => video.playbackRate === 1 && !video.muted);
  assert.equal(await page.locator("[data-adhop-controls]").count(), 0);
  await page.close();
});

test("changing rules mid-ad applies immediately", async () => {
  const page = await openVideo();
  await startAd(page, { seconds: 600 });
  await page.waitForFunction(() => video.playbackRate === 16);
  await storeRules({ action: "click" });
  await page.waitForFunction(() => video.playbackRate === 1 && video.muted);
  await storeRules({ rate: 8 });
  await page.waitForFunction(() => video.playbackRate === 8);
  await page.close();
});

test("the player controls let an ad play and resume skipping", async () => {
  const page = await openVideo();
  await startAd(page, { seconds: 600 });
  const controls = page.locator("[data-adhop-controls]");
  await controls.getByText("Ad at 16x").waitFor();
  await controls.getByRole("button", { name: "Let it play" }).click();
  await page.waitForFunction(() => video.playbackRate === 1 && !video.muted);
  await controls.getByRole("button", { name: "Skip it" }).click();
  await page.waitForFunction(() => video.playbackRate === 16 && video.muted);
  assert.equal(await page.evaluate(() => state.playerClicks), 0);
  await page.close();
});

test("the player controls skip an ad on a channel whose ads play", async () => {
  await storeRules({ action: "play", delay: 20 });
  const page = await openVideo();
  await startAd(page, { seconds: 60, skipAfter: 1 });
  await page.locator("[data-adhop-controls]").getByRole("button", { name: "Skip it" }).click();
  await page.waitForFunction(() => state.skipped === 1);
  await page.close();
});

test("the player controls keep their look under page styles", async () => {
  const page = await openVideo();
  await startAd(page, { seconds: 600 });
  const status = page.locator("[data-adhop-controls]").getByText("Ad at 16x");
  await status.waitFor();
  const look = await status.evaluate((element) => {
    const { backgroundColor, paddingLeft } = getComputedStyle(element.parentElement);
    return { backgroundColor, paddingLeft };
  });
  assert.deepEqual(look, { backgroundColor: "rgba(23, 23, 26, 0.85)", paddingLeft: "14px" });
  await page.close();
});

test("the player controls can be hidden", async () => {
  await store({ showControls: false });
  const page = await openVideo();
  await startAd(page, { seconds: 600 });
  await page.waitForFunction(() => video.playbackRate === 16);
  assert.equal(await page.locator("[data-adhop-controls]").count(), 0);
  await page.close();
});

test("the let play shortcut reaches the player", async () => {
  const page = await openVideo();
  await page.bringToFront();
  await startAd(page, { seconds: 600 });
  await page.waitForFunction(() => video.playbackRate === 16);
  await worker.evaluate(() => chrome.commands.onCommand.dispatch("toggle-let-play"));
  await page.waitForFunction(() => video.playbackRate === 1);
  await page.close();
});

test("Chrome accepts both default shortcuts", async () => {
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  for (const { name, shortcut } of commands.filter((command) => command.name.startsWith("toggle-"))) {
    assert.notEqual(shortcut, "", `${name} has no shortcut`);
  }
});

test("the on and off shortcut updates settings and badge", async () => {
  const badge = () => worker.evaluate(() => chrome.action.getBadgeText({}));
  await worker.evaluate(() => chrome.commands.onCommand.dispatch("toggle-enabled"));
  await eventually(async () => assert.equal((await stored()).enabled, false));
  await eventually(async () => assert.equal(await badge(), "off"));
  await worker.evaluate(() => chrome.commands.onCommand.dispatch("toggle-enabled"));
  await eventually(async () => assert.equal(await badge(), ""));
});

test("sponsored tiles follow the setting", async () => {
  const page = await openVideo();
  await page.locator("#sponsored").waitFor({ state: "hidden" });
  await store({ hideSponsored: false });
  await page.locator("#sponsored").waitFor({ state: "visible" });
  await page.close();
});

test("stats count ads and avoided time", async () => {
  await play({ ads: [{ seconds: 60, skipAfter: 5 }] });
  await eventually(async () => {
    const { ads, seconds } = await storedStats();
    assert.equal(ads, 1);
    assert.ok(seconds > 55 && seconds < 60, `${seconds} s avoided`);
  });
});

test("stats subtract the time YouTube holds the content back", async () => {
  await play({ ads: [{ seconds: 15 }], holdMs: 5000 });
  await eventually(async () => {
    const { ads, seconds } = await storedStats();
    assert.equal(ads, 1);
    assert.ok(seconds > 6 && seconds < 10, `${seconds} s avoided`);
  });
});

test("an end card is skipped at once even with a delay", async () => {
  await storeRules({ action: "click", delay: 3 });
  const state = await play({ ads: [{ seconds: 4 }], endCardMs: 4000 });
  assert.equal(state.skipped, 1);
  assert.ok(state.endCardMs < 2000, `end card stayed ${state.endCardMs} ms`);
  assertContentUntouched(state);
});

test("an end card does not count as another ad", async () => {
  const state = await play({ ads: [{ seconds: 15 }], endCardMs: 4000 });
  assert.equal(state.skipped, 1);
  await eventually(async () => assert.equal((await storedStats()).ads, 1));
});

test("an ad announced before its source counts once", async () => {
  await play({ ads: [{ seconds: 15, sourceDelayMs: 700 }] });
  await eventually(async () => assert.equal((await storedStats()).ads, 1));
});

test("content that loads before the ad state clears keeps its rate and stays out of the stats", async () => {
  const state = await play({ ads: [{ seconds: 15 }], rate: 1.5, gapMs: 700 });
  assertContentUntouched(state, { rate: 1.5 });
  await eventually(async () => {
    const { ads, seconds } = await storedStats();
    assert.equal(ads, 1);
    assert.ok(seconds < 15, `${seconds} s avoided`);
  });
});

test("a player that leaves and rejoins the page is handled once", async () => {
  const page = await openVideo();
  await page.locator("#sponsored").waitFor({ state: "hidden" });
  await page.evaluate(async () => {
    const other = document.createElement("div");
    other.className = "html5-video-player";
    const preview = document.createElement("video");
    other.append(preview);
    player.remove();
    document.body.append(other);
    const loading = new Promise((resolve) => preview.addEventListener("loadstart", resolve, { once: true }));
    preview.src = silence(1);
    await loading;
    other.remove();
    document.body.prepend(player);
  });
  await startAd(page, { seconds: 600 });
  await page.waitForFunction(() => video.playbackRate === 16);
  await page.waitForTimeout(700);
  assert.equal(await page.locator("[data-adhop-controls]").count(), 1);
  await page.close();
});

test("switches do not animate with reduced motion", async () => {
  const options = await openPage("options");
  await options.emulateMedia({ reducedMotion: "reduce" });
  const duration = await options.evaluate(
    () => getComputedStyle(document.querySelector("#enabled"), "::before").transitionDuration,
  );
  assert.equal(duration, "0s");
  await options.close();
});

test("skip is the first choice and the default", async () => {
  await worker.evaluate(() => chrome.storage.sync.clear());
  const popup = await openPage("popup");
  const modes = popup.getByRole("radiogroup").getByRole("radio");
  assert.deepEqual(await popup.locator(".segments span").allTextContents(), ["Skip", "Speed up", "Let play"]);
  assert.ok(await modes.first().isChecked());
  await popup.close();
});

test("the popup edits the general rules", async () => {
  const popup = await openPage("popup");
  await popup.getByText("Skip", { exact: true }).click();
  await popup.getByRole("switch", { name: "Mute ads" }).uncheck();
  await popup.getByRole("slider").fill("7");
  await eventually(async () =>
    assert.deepEqual((await stored()).rules, { action: "click", delay: 7, rate: 16, mute: false }),
  );
  await popup.getByText("Ads play for 7 s, then are skipped as soon as YouTube allows it.").waitFor();
  assert.ok(await popup.getByRole("combobox", { name: "Speed" }).isDisabled());
  assert.ok(await popup.locator("#scope").isHidden());

  await popup.getByRole("switch", { name: "Enabled" }).uncheck();
  assert.ok(await popup.getByRole("slider").isDisabled());
  await popup.close();
});

test("the popup gives the current channel its own rules", async () => {
  const popup = await openPage("popup");
  const video = await openVideo();
  await video.bringToFront();
  await popup.reload();
  await popup.getByText("Fake Channel").click();
  await popup.getByText("Let play", { exact: true }).click();
  await eventually(async () => {
    const { rules, "channel:UC_fake": channel } = await stored();
    assert.deepEqual(rules, RULES);
    assert.deepEqual(channel, { id: "UC_fake", name: "Fake Channel", rules: { ...RULES, action: "play" } });
  });

  await popup.reload();
  assert.ok(await popup.getByRole("radio", { name: "Fake Channel" }).isChecked());
  await popup.getByRole("button", { name: "Use the rules for all channels" }).click();
  await eventually(async () => assert.equal((await stored())["channel:UC_fake"], undefined));
  await popup.getByText("Ads run at 16x until they can be skipped.").waitFor();
  await video.close();
  await popup.close();
});

test("the settings page edits and removes channels", async () => {
  const channel = (id, name) => ({ [`channel:${id}`]: { id, name, rules: RULES } });
  await store({ ...channel("UC_b", "Beta"), ...channel("UC_a", "Alpha") });
  const options = await openPage("options");
  assert.deepEqual(await options.locator("#channels strong").allTextContents(), ["Alpha", "Beta"]);

  const alpha = options.locator("#channels li").first();
  await alpha.locator("summary").click();
  await alpha.getByText("Let play", { exact: true }).click();
  await eventually(async () => assert.equal((await stored())["channel:UC_a"].rules.action, "play"));
  assert.ok(await alpha.getByRole("slider").isVisible());

  await alpha.getByRole("button", { name: "Remove channel" }).click();
  await eventually(async () =>
    assert.deepEqual(await options.locator("#channels strong").allTextContents(), ["Beta"]),
  );
  assert.equal((await stored())["channel:UC_a"], undefined);
  await options.close();
});

test("the settings page links to Ko-fi in a new tab", async () => {
  const options = await openPage("options");
  const link = options.getByRole("link", { name: "buy me a coffee" });
  assert.equal(await link.getAttribute("href"), "https://ko-fi.com/xavinlol");
  assert.equal(await link.getAttribute("target"), "_blank");
  await options.close();
});

test("themes apply to the settings page and the popup", async () => {
  const options = await openPage("options");
  const popup = await openPage("popup");
  const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const current = (page) => page.evaluate(() => document.documentElement.dataset.theme);
  assert.equal(await current(options), "graphite");
  assert.ok(await options.getByRole("radio", { name: "Graphite" }).isChecked());

  const seen = new Set([await background(popup)]);
  for (const name of ["Midnight", "Plum", "Red"]) {
    await popup.emulateMedia({ colorScheme: "dark" });
    await options.getByText(name, { exact: true }).click();
    await eventually(async () => assert.equal(await current(popup), name.toLowerCase()));
    assert.equal(await current(options), name.toLowerCase());
    seen.add(await background(popup));
  }
  assert.equal(seen.size, 4);
  assert.equal((await stored()).theme, "red");

  await popup.reload();
  await eventually(async () => assert.equal(await current(popup), "red"));
  await options.close();
  await popup.close();
});

test("the settings page saves switches and resets stats", async () => {
  await worker.evaluate(() => chrome.storage.local.set({ ads: 12, seconds: 4320 }));
  const options = await openPage("options");
  await options.getByText("12 ads skipped, 1 h 12 min avoided").waitFor();
  await options.getByRole("button", { name: "Reset" }).click();
  await options.getByText("No ads skipped yet").waitFor();

  await options.getByRole("switch", { name: "Show controls on ads" }).uncheck();
  await options.getByRole("switch", { name: "Hide sponsored tiles" }).uncheck();
  await eventually(async () => {
    const { showControls, hideSponsored } = await stored();
    assert.deepEqual([showControls, hideSponsored], [false, false]);
  });
  await options.close();
});
