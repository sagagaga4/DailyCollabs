# Agent 4 — media research and implementation review

**Later product update:** the user explicitly requested muted autoplay in For you. That view now keeps players visible, starts muted, supports unmute, and pauses offscreen. The initial watch-only decisions below describe the earlier implementation; other views retain deliberate playback. Missing/broken images also receive distinct card-specific artwork, and shared topic covers have unique framing.

Reviewed on November 4, 2026. **15 distinct successfully read registrable domains.** Every source below is first-party documentation. Failed/empty attempts at developer.vimeo.com and support.apple.com are excluded; Vimeo's readable Help Center is used instead. Video.js redirected from videojs.com to videojs.org and counts once.

| # | Distinct domain and source | What I learned | Applied decision |
|---|---|---|---|
| 1 | google.com — [YouTube embedded players and parameters](https://developers.google.com/youtube/player_parameters) | YouTube documents supported player parameters and requires an embedded viewport of at least 200×200. | Use provider-generated, validated embed URLs; preserve controls, request inline playback/captions, and ensure a 200px minimum iframe height on narrow cards. |
| 2 | vimeo.com — [About player parameters](https://help.vimeo.com/hc/en-us/articles/12426260232977-About-Player-Parameters) | Vimeo documents inline playback and DNT; DNT reduces analytics but does not eliminate essential cookies. | Retain click-to-load Vimeo frames with dnt=1 and explicit inline playback. Avoid claims of cookie-free Vimeo playback. |
| 3 | mozilla.org — [HTML video element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video) | Native video supports controls, inline playback, source fallback, and accessibility text. Autoplay is enabled by the presence of its attribute. | Keep native browser controls and playsInline, omit autoplay entirely, add source-error feedback, and offer readable transcripts. |
| 4 | web.dev — [Lazy loading video](https://web.dev/articles/lazy-loading-video) | Metadata preloading can still download significant video bytes; delaying player/source creation gives better control. | Direct MP4/WebM now waits for the visitor's click before creating a native video/source, matching the existing deferred provider embeds. |
| 5 | w3.org — [Making audio and video media accessible](https://www.w3.org/WAI/media/av/) | Accessible media needs usable controls and alternatives, including captions and descriptive transcripts. | Preserve provider caption controls; add an optional persisted transcript/visual description with an accessible disclosure below a shared video. |
| 6 | cloudflare.com — [Use the Stream Player](https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/) | Provider iframe integrations have specific source formats, compatibility requirements, and fullscreen permissions. | Build each supported embed from recognized IDs and retain fullscreen. Do not accept arbitrary pasted iframe HTML or enable unsupported providers. |
| 7 | videojs.org — [Video.js options](https://legacy.videojs.org/guides/options/) | Controls, aspect ratio, poster, and preload are separate player choices; metadata may fetch frames. | Keep a stable 16:9 media area and poster facade, with browser controls after loading, without adding an unnecessary player dependency. |
| 8 | twitch.tv — [Video and clips embeds](https://dev.twitch.tv/docs/embed/video-and-clips/) | Twitch requires an embedding parent domain and larger minimum dimensions; it is not a generic iframe substitution. | Keep Twitch outside the current allowlist rather than claiming support with an unreliable generic embed. |
| 9 | webkit.org — [New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/) | Inline playback and user gestures are important on iPhone; programmatic play can be rejected. | Use playsInline for native files and provider inline options; avoid automatic play calls or forced fullscreen. |
| 10 | chromium.org — [Autoplay policy](https://www.chromium.org/audio-video/autoplay/) | Chromium prioritizes user control and blocks many unsolicited audio/video starts. | Keep all videos user initiated and do not use browser-policy workarounds. |
| 11 | wistia.com — [Player attributes and properties](https://docs.wistia.com/docs/player-attributes-and-properties) | Preload, tracking, control visibility, poster, and accessibility controls are independent concerns. | Retain a clear watch action and poster; create no video source before that action and add no viewing analytics. |
| 12 | jwplayer.com — [Setup options](https://docs.jwplayer.com/players/reference/setup-options) | A visible play call to action, preserved aspect ratio, controls, captions, and static posters are explicit player choices. | Keep an accessible watch button, static artwork, no animated preview, and the original-provider fallback link. |
| 13 | mux.com — [Player API reference](https://www.mux.com/docs/guides/player-api-reference/html) | Native-equivalent preload and control properties coexist with caption preferences and user settings. | Retain user-operable player controls and avoid suppressing captions; use plain transcript text without requiring an analytics/player SDK. |
| 14 | brightcove.com — [Autoplay considerations](https://player.support.brightcove.com/playback/autoplay-considerations.html) | Browser autoplay behavior varies; inline playback is important on iPhone. | Prefer the explicit watch flow, preserve inline viewing, and provide a source link when an embed is unavailable. |
| 15 | react.dev — [useEffect](https://react.dev/reference/react/useEffect) | Effects that fetch data need cleanup/response guards because older responses can arrive after newer requests. | Abort the initial feed request on cleanup, prevent pagination during initial loading, and ignore stale responses after a new search replaces the feed. |

## Refinement and verification

- Provider URL parsing remains strict HTTPS with exact supported hosts/IDs and no arbitrary iframe input.
- Refined responsive player dimensions and mobile/caption parameters.
- Deferred native video network loading until the user chooses to watch.
- Added an optional saved transcript/visual description; provider caption availability remains controlled by the source owner.
- Corrected the Home initial-load/pagination race and stale-result behavior found during the React effect review.
- Reran media validation/ownership tests, scoped Home/media ESLint, and the frontend production build after these changes.

The sources informed these decisions; this research does not imply integrations with every provider listed.

## Round 2 — community recommendations, long press, reposting, and sharing

Reviewed during the second implementation pass on November 4, 2026. The following **15 distinct websites** were successfully read for this feature. These are additional round-specific evidence; domains already present in the media section are counted once within this table. An inaccessible developer.chrome.com page is excluded.

| # | Website and primary source | Takeaway | Applied behavior |
|---|---|---|---|
| 1 | mozilla.org — [Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) | Sharing support, secure contexts, and completion semantics differ by browser. | Feature-detect native sharing; retain copy/email/WhatsApp alternatives and avoid claiming a message was sent. |
| 2 | w3.org — [WCAG dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Drag actions need a simple pointer alternative. | Every card has an accessible More actions button leading to the same three choices. |
| 3 | react.dev — [createPortal](https://react.dev/reference/react-dom/createPortal) | Portals can escape clipping and stacking contexts while retaining context. | Render drag bubbles and native dialogs under document.body, outside transformed cards. |
| 4 | atlassian.design — [Drag accessibility guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines) | Accessible alternatives should let users trigger, understand, and repeat an outcome. | Labeled action chooser, persisted-success feedback, and links to the resulting community/channel. |
| 5 | radix-ui.com — [Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) | Modal focus containment, names, and Escape handling are essential. | Use native showModal dialogs with accessible headings and Cancel/Escape behavior rather than adding a new dialog dependency. |
| 6 | microsoft.com — [Drag and drop](https://learn.microsoft.com/en-us/windows/apps/develop/data/drag-and-drop) | Drag source, payload, hover feedback, and release are distinct phases. | Keep a validated source snapshot; highlight the closest drop bubble and act only on release. |
| 7 | dndkit.com — [Drag overlay](https://dndkit.com/legacy/api-documentation/draggable/drag-overlay/) | A viewport overlay avoids scroll container clipping. | Drag token and drop targets use fixed viewport coordinates in a body portal. |
| 8 | owasp.org — [Input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Syntax validation and authorization are separate; allowlist accepted fields. | Strict HTTP(S) URLs and bounded metadata, server-assigned actor/owner, live membership, and self-only saved-post access/deletion. |
| 9 | service.gov.uk — [GOV.UK buttons](https://design-system.service.gov.uk/components/button/) | Button text should describe the action performed. | Explicit “Share with community” and “Repost to my channel” confirmation buttons. |
| 10 | whatwg.org — [URL Standard](https://url.spec.whatwg.org/) | Parse/serialize URLs with a standards-based parser; parsing alone is not a protocol policy. | Use URL(), then reject unsupported schemes, credentials, control characters, and excessive lengths. |
| 11 | discord.com — [Forum channels FAQ](https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ) | Topic tags and destination channels help organize conversations. | Recommend real communities by topic, then choose a real writable channel before posting an attachment. |
| 12 | nngroup.com — [Drag-and-drop usability](https://www.nngroup.com/articles/drag-drop/) | Clear feedback and a precise alternative reduce drag errors. | Visible action labels, generous hit circles, hover feedback, cancellation outside targets, and the More actions fallback. |
| 13 | web.dev — [OS sharing UI](https://web.dev/articles/web-share) | Native sharing must follow an explicit user action and should share the content's actual URL. | Invoke navigator.share only from its button and use each article/video's source URL. |
| 14 | github.com — [W3C Web Share repository](https://github.com/w3c/web-share) | Share destinations belong to the user's selected target. | Prepare share intent and let the user finish sending in their chosen app; no background sending or invented delivery status. |
| 15 | whatsapp.com — [Click to chat](https://faq.whatsapp.com/5913398998672934/?locale=en_US) | A wa.me link can supply encoded text while letting the user choose contacts. | Build wa.me/?text= links with encoded title/source, without preselecting recipients or sending automatically. |

Instagram is offered as copy-link plus opening Instagram, with clear text that the user must finish sharing there. No generic Instagram auto-post API is claimed or fabricated.

### Round 2 checks

- Tests cover unsafe sources, field limits, trusted ownership, private saved-channel reads/deletes, live membership, attachment creation, rollback when a channel rejects a share, drag geometry, genuine community recommendation IDs, and encoded share intent links.
- A long press starts only in non-interactive card space. Movement before activation cancels it; links, controls, text inputs, and video players keep their normal behavior.
- Memberships requiring rule acceptance route to the community welcome/rules channel instead of consenting on the user's behalf.
- Inline membership state refreshes on app navigation. Community share success links directly to the destination channel; personal reposts are stored in MongoDB, not a simulated local feed.

## Topic image refinement

The generic galaxy fallback has been removed. Publisher/enclosure and publisher Open Graph artwork stay first; only missing artwork uses a topic lookup. Wikipedia PageImages and Commons ImageInfo are queried through fixed trusted API endpoints. Topic asset URLs are accepted only from HTTPS upload.wikimedia.org or thumb.wikimedia.org; file credit pages stay on the matching Wikipedia edition or Commons.

Primary documentation: [MediaWiki PageImages API](https://www.mediawiki.org/wiki/Extension:PageImages#API). It returns an article thumbnail and its source filename, so the application can display the topic's real image and link to its source rather than fabricating artwork.

The resolver deduplicates pending lookups, caps cache size, caches failures briefly, and enforces a total request deadline. It supports Unicode queries and validated Wikipedia language editions, including Hebrew; known Skyrim and Redis aliases map to verified source subjects. Unrelated/ambiguous results or unavailable APIs produce no fallback image.

Live verification on November 4, 2026 resolved Skyrim to its actual cover art and Redis to its current Commons logo; both asset requests returned HTTP 200 with image content types. Repeat with:

```sh
RUN_LIVE_TOPIC_IMAGES=1 node --test Backend/tests/topic-images.test.cjs
```

This run passed all seven tests, including live network checks. The normal test run keeps the live check optional and passes six deterministic cache, timeout, validation, locale, publisher-precedence, and no-image tests.
