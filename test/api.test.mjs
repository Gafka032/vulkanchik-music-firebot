import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-test", "api.cjs");

await esbuild.build({
  entryPoints: [path.join(root, "src/api.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  write: true,
});

const require = createRequire(import.meta.url);
const apiMod = require(out);

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  };
}

function client() {
  return apiMod.createMusicApi({
    apiBaseUrl: "https://vulkanchik.com",
    apiToken: "mct_test",
  });
}

describe("music api client", () => {
  beforeEach(() => {
    globalThis.fetch = mock.fn();
  });

  it("normalizes base URL", async () => {
    globalThis.fetch = mock.fn(async () => okJson({ ok: true }));
    await client().getState();
    const url = globalThis.fetch.mock.calls[0].arguments[0];
    assert.equal(url, "https://vulkanchik.com/api/music/v1/state");
  });

  it("throws MusicApiError on 4xx", async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => JSON.stringify({ error: "nope", code: "MUSIC_API_UNAUTHORIZED" }),
    }));
    await assert.rejects(() => client().skip(), (err) => {
      assert.equal(err.name, "MusicApiError");
      assert.equal(err.code, "MUSIC_API_UNAUTHORIZED");
      return true;
    });
  });

  it("POSTs chat body", async () => {
    globalThis.fetch = mock.fn(async (_url, init) => {
      assert.equal(init.method, "POST");
      assert.match(init.headers.Authorization, /^Bearer mct_/);
      const body = JSON.parse(init.body);
      assert.equal(body.message, "!скіп");
      return okJson({ handled: true });
    });
    const res = await client().chat({ message: "!скіп", chatterTwitchId: "1" });
    assert.equal(res.handled, true);
  });

  it("queue group: enqueue / request / reorder / delete", async () => {
    const calls = [];
    globalThis.fetch = mock.fn(async (url, init) => {
      calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
      return okJson({ ok: true });
    });
    const api = client();
    await api.postQueue("Artist — Title");
    await api.postRequest({ query: "x", requesterName: "Bob", requesterTwitchId: "42" });
    await api.reorderQueue(["a", "b"]);
    await api.deleteQueueItem("item-1");
    await api.getQueue();
    assert.equal(calls[0].url.endsWith("/queue"), true);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].body.query, "Artist — Title");
    assert.equal(calls[1].url.endsWith("/requests"), true);
    assert.equal(calls[2].method, "PATCH");
    assert.deepEqual(calls[2].body.orderedIds, ["a", "b"]);
    assert.equal(calls[3].method, "DELETE");
    assert.match(calls[3].url, /\/queue\/item-1$/);
    assert.equal(calls[4].method, "GET");
  });

  it("transport group: skip / play / pause / volume / seek / leader", async () => {
    const calls = [];
    globalThis.fetch = mock.fn(async (url, init) => {
      calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
      return okJson({ ok: true });
    });
    const api = client();
    await api.skip();
    await api.play();
    await api.pause();
    await api.volume(40);
    await api.seek({ delta: 10 });
    await api.leader("sess-1");
    assert.equal(calls[0].url.endsWith("/skip"), true);
    assert.equal(calls[3].body.volume, 40);
    assert.equal(calls[4].body.delta, 10);
    assert.equal(calls[5].body.sessionId, "sess-1");
    const init = globalThis.fetch.mock.calls[0].arguments[1];
    assert.ok(init.signal, "requests carry an AbortSignal timeout");
  });

  it("togglePlayPause pauses when playing and plays otherwise", async () => {
    const calls = [];
    globalThis.fetch = mock.fn(async (url, init) => {
      calls.push({ url, method: init.method });
      if (String(url).endsWith("/state")) {
        return okJson({ playback: { state: "playing" } });
      }
      return okJson({ ok: true });
    });
    await client().togglePlayPause();
    assert.equal(calls[0].url.endsWith("/state"), true);
    assert.equal(calls[1].url.endsWith("/pause"), true);

    calls.length = 0;
    globalThis.fetch = mock.fn(async (url, init) => {
      calls.push({ url, method: init.method });
      if (String(url).endsWith("/state")) {
        return okJson({ playback: { state: "paused" } });
      }
      return okJson({ ok: true });
    });
    await client().togglePlayPause();
    assert.equal(calls[1].url.endsWith("/play"), true);
  });

  it("maps AbortError to MUSIC_API_TIMEOUT", async () => {
    globalThis.fetch = mock.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    await assert.rejects(() => client().skip(), (err) => {
      assert.equal(err.name, "MusicApiError");
      assert.equal(err.code, "MUSIC_API_TIMEOUT");
      assert.equal(err.status, 408);
      return true;
    });
  });

  it("settings / backup / roles / points groups", async () => {
    const calls = [];
    globalThis.fetch = mock.fn(async (url, init) => {
      calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
      return okJson({ ok: true });
    });
    const api = client();
    await api.getSettings();
    await api.patchSettings({ chatCommandsVia: "external" });
    await api.getBackup();
    await api.putBackup({ enabled: true, urls: ["https://youtu.be/a"], mode: "replace" });
    await api.importBackup({ playlistUrl: "https://open.spotify.com/playlist/x" });
    await api.getRoles();
    await api.putRoles({ custom: [], assignments: [] });
    await api.listPointsRewards();
    await api.listTwitchRewards();
    await api.addPointsReward({ rewardId: "r1", autoRefundPoints: true });
    await api.patchPointsReward("map1", { minRole: "everyone" });
    await api.deletePointsReward("map1");

    assert.equal(calls[0].url.endsWith("/settings"), true);
    assert.equal(calls[1].method, "PATCH");
    assert.equal(calls[3].method, "PUT");
    assert.equal(calls[4].url.endsWith("/backup/import"), true);
    assert.equal(calls[6].method, "PUT");
    assert.equal(calls[6].url.endsWith("/roles"), true);
    assert.equal(calls[9].method, "POST");
    assert.equal(calls[10].method, "PATCH");
    assert.match(calls[10].url, /\/points\/rewards\/map1$/);
    assert.equal(calls[11].method, "DELETE");
  });

  it("remembers snapshot fields", () => {
    apiMod.rememberSnapshot({
      current: { title: "Song", artist: "Band" },
      queue: [{ id: "1" }, { id: "2" }],
      playback: { state: "playing", volume: 40 },
    });
    assert.equal(apiMod.snapshotField("current.title"), "Song");
    assert.equal(apiMod.snapshotField("playback.volume"), 40);
  });
});
