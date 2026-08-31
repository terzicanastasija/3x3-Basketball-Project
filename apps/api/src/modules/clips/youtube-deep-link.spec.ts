import { buildYoutubeDeepLink } from "./youtube-deep-link";

describe("buildYoutubeDeepLink", () => {
  it("builds a timestamped link from a youtube.com/watch?v= URL", () => {
    expect(buildYoutubeDeepLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 12.7)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s"
    );
  });

  it("builds a timestamped link from a youtu.be/ short URL", () => {
    expect(buildYoutubeDeepLink("https://youtu.be/dQw4w9WgXcQ", 45)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s"
    );
  });

  it("handles a watch URL with extra query params after the video id", () => {
    expect(buildYoutubeDeepLink("https://www.youtube.com/watch?v=abc123&list=xyz", 3)).toBe(
      "https://www.youtube.com/watch?v=abc123&t=3s"
    );
  });

  it("floors fractional timestamps rather than rounding", () => {
    expect(buildYoutubeDeepLink("https://youtu.be/abc123", 9.9)).toBe(
      "https://www.youtube.com/watch?v=abc123&t=9s"
    );
  });

  it("throws for a URL it can't extract a video id from", () => {
    expect(() => buildYoutubeDeepLink("https://example.com/not-youtube", 5)).toThrow();
  });
});
