import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isApprovedEmbedUrl, parseTrailerUrl, trailerEmbedUrl } from "./trailers.ts";

describe("trailer URL parsing", () => {
  test("understands the common YouTube URL shapes", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL1",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ]) {
      assert.equal(parseTrailerUrl(url)?.videoId, "dQw4w9WgXcQ", url);
    }
  });

  test("understands Vimeo URLs", () => {
    assert.deepEqual(parseTrailerUrl("https://vimeo.com/123456789"), { provider: "vimeo", videoId: "123456789", canonicalUrl: "https://vimeo.com/123456789" });
    assert.equal(parseTrailerUrl("https://player.vimeo.com/video/123456789?h=abc")?.videoId, "123456789");
  });

  test("rejects unsupported hosts, look-alike domains, bad ids and unsafe schemes", () => {
    for (const url of [
      "https://evil.example/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
      "https://www.dailymotion.com/video/x7tgad0",
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert('youtube.com')",
      "data:text/html,youtube.com",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ<script>",
      "https://www.youtube.com/channel/UC123",
      "https://vimeo.com/channels/staffpicks",
      "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
      "not a url",
    ]) {
      assert.equal(parseTrailerUrl(url), null, url);
    }
  });
});

describe("trailer embeds", () => {
  test("embed URLs are rebuilt on privacy-enhanced hosts", () => {
    assert.equal(trailerEmbedUrl("youtube", "dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
    assert.equal(trailerEmbedUrl("vimeo", "123456789"), "https://player.vimeo.com/video/123456789?dnt=1&title=0&byline=0");
  });

  test("an id that isn't valid for its provider produces no embed", () => {
    assert.equal(trailerEmbedUrl("youtube", "../../evil"), null);
    assert.equal(trailerEmbedUrl("vimeo", "dQw4w9WgXcQ"), null);
  });

  test("only approved hosts may be iframe sources", () => {
    assert.ok(isApprovedEmbedUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"));
    assert.ok(isApprovedEmbedUrl("https://player.vimeo.com/video/123456789"));
    for (const url of [
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://evil.example/embed",
      "http://player.vimeo.com/video/123456789",
      "javascript:alert(1)",
      "https://player.vimeo.com.evil.example/video/1",
      "",
    ]) {
      assert.equal(isApprovedEmbedUrl(url), false, url);
    }
  });
});
