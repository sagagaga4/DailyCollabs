# Agent 2 — community research and implementation decisions

Reviewed on 2026-11-04. These are 15 distinct sites/domains, each successfully opened and read with the web tool. Search-result snippets alone were not counted. Subdomains and repeated pages from a site were counted once. All takeaways below are paraphrases. The product decisions are our adaptations, rather than claims that these products implement DailyCollabs' exact behavior.

1. **Discord — discord.com**\
   Source: [Read the official guidance](https://support.discord.com/hc/en-us/articles/204155938-How-do-I-invite-friends-to-my-server)\
   Read: the instant-invite, copy/paste, and destination-channel guidance.\
   Takeaway: a copied invitation should land a newcomer in the intended community and explain how to join.\
   Applied: the invitation dialog names the board, generates its specific detail URL, and describes signing in before joining. The integration preserves that destination through authentication.

2. **Reddit Help — reddithelp.com**\
   Source: [Read the official guidance](https://support.reddithelp.com/hc/en-us/articles/15484258409492-How-to-create-a-community)\
   Read: name, description, topic, and community-type setup.\
   Takeaway: community creation needs a clear identity, purpose, and access model.\
   Applied: the create form requires name and description, offers a topic category, and explicitly says that the board is public and anyone can join.

3. **GitHub Docs — github.com**\
   Source: [Read the official guidance](https://docs.github.com/en/discussions/quickstart)\
   Read: welcome posts, contribution guidelines, and new-discussion setup.\
   Takeaway: opening prompts and visible contribution expectations help an empty community get started.\
   Applied: all five demo boards have a clearly labeled sample opening conversation and a visible rules panel; real member conversations persist separately from those sample labels.

4. **Discourse Meta — discourse.org**\
   Source: [Read the official guidance](https://meta.discourse.org/t/creating-and-using-invites/263314)\
   Read: shareable invitation creation, permissions, and invalid/expired-link guidance.\
   Takeaway: invitations need explicit permissions and an understandable recovery path when a link fails.\
   Applied: only community members can generate an invite. Invalid tokens show an error, while “Browse public board” removes the failed token and restores ordinary joining for these public communities.

5. **Slack — slack.com**\
   Source: [Read the official guidance](https://slack.com/help/articles/205239967-Join-a-channel)\
   Read: directory search by name/description, preview, then join.\
   Takeaway: discovering a space and becoming its member are separate decisions.\
   Applied: every community can be explored before joining; card discovery/search and board detail use separate Explore and Join actions.

6. **Stack Overflow — stackoverflow.com**\
   Source: [Read the official guidance](https://stackoverflow.com/help/how-to-ask)\
   Read: specific titles, explanatory message bodies, and proofreading guidance.\
   Takeaway: a useful conversation has a meaningful heading and enough context in its body.\
   Applied: the conversation composer has distinct required title and message fields, with bounds enforced again by the API.

7. **MediaWiki — mediawiki.org**\
   Source: [Read the official guidance](https://www.mediawiki.org/wiki/Help:DiscussionTools/en)\
   Read: starting a topic, subject requirement, and automatically added signature/date.\
   Takeaway: explicit subjects and author/time metadata make separate conversations easier to understand.\
   Applied: community threads show their subject, authenticated author identity, and creation time. The server assigns author identity rather than accepting it from client input.

8. **4chan — 4chan.org**\
   Source: [Read the official guidance](https://4chan.org/faq)\
   Read: the basic explanation of separate topic boards and guidance to learn board rules before posting.\
   Takeaway: compact board codes can provide identity, while each board still needs a readable topic and clear norms.\
   Applied: five topic-board demos use /g/, /v/, /mu/, /tv/, and /ic/ alongside full readable names, descriptions, and respectful contribution rules. This adapts topic organization only.

9. **Zulip — zulip.com**\
   Source: [Read the official guidance](https://zulip.com/help/introduction-to-channels)\
   Read: channel/topic organization, browse-and-subscribe search, and directory sorting choices.\
   Takeaway: interest discovery benefits from searching descriptions and choosing a useful list order.\
   Applied: community search matches names, descriptions, categories, and codes. Added a labeled sort control for featured order, name A–Z, and real member counts.

10. **Matrix — matrix.org**\
    Source: [Read the official guidance](https://matrix.org/docs/chat_basics/public-rooms/)\
    Read: room-link previews and public-directory search with name, topic, member count, and join actions.\
    Takeaway: a newcomer should understand a destination before committing to it.\
    Applied: board cards and detail views show readable names, descriptions, actual membership counts, and a deliberate Join/Accept invitation action.

11. **Material Design — material.io**\
    Source: [Read the official guidance](https://m1.material.io/components/dialogs.html)\
    Read: dialogs are interruptive, retain focus, and should remain visible within the viewport. This is the official legacy Material guidance, used for the stable dialog behavior rather than claimed as a 2026 visual trend.\
    Takeaway: reserve dialogs for focused tasks and keep longer reading in the page.\
    Applied: only community creation and copying an invite use dialogs. Board reading and starting a conversation remain inline; dialog dimensions remain within the mobile viewport.

12. **W3C WAI — w3.org**\
    Source: [Read the official guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)\
    Read: modal focus containment, initial focus, Escape, labels, and returning focus to the triggering control.\
    Takeaway: modal dismissal and focus restoration are part of the interaction contract.\
    Applied refinement: dialog titles and descriptions now use unique linked IDs; closing explicitly restores the connected opener's focus. Escape is intercepted so it cannot silently close a creation dialog while a save is pending.

13. **MDN — mozilla.org**\
    Source: [Read the official guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)\
    Read: native showModal/close behavior, cancel handling, autofocus, and light dismissal.\
    Takeaway: native modal dialogs provide useful platform behavior, but an app must coordinate its cancel event with application state.\
    Applied refinement: retained native showModal(), made cancel preventDefault before applying the controlled close policy, and disabled the close control during community creation.

14. **web.dev — web.dev**\
    Source: [Read the official guidance](https://web.dev/learn/accessibility/focus)\
    Read: logical keyboard order, built-in focusable controls, and visible focus.\
    Takeaway: links, buttons, and native inputs provide a more predictable keyboard experience than click-only text.\
    Applied: navigation remains real links, joins are buttons, sorting is a labeled native select, and visible focus styles cover each. Search result counts now announce changes politely.

15. **GOV.UK Design System — service.gov.uk**\
    Source: [Read the official guidance](https://design-system.service.gov.uk/components/error-summary/)\
    Read: error summaries, plain messages, and moving keyboard focus to errors.\
    Takeaway: a server-side error should be findable immediately without discarding the user's form input.\
    Applied refinement: API error panels receive programmatic focus and have alert semantics; community-creation errors keep the dialog and entered form values intact. Native constraints handle field validation, while general server errors remain clear inline messages.

## Research-driven changes and checks

- Added directory sorting (featured, alphabetical, most members) and live search-count announcements.
- Made dialog descriptions accessible, restored focus on close, and fixed Escape during a pending create request.
- Focused API error messages and marked save/post forms as busy.
- Retained preview-before-join behavior, public-access copy, labeled sample content, real counts, and member-authorized invitations after reviewing the source patterns.
- Ran `node --test Backend/tests/communities.test.cjs`: pass. It uses a fresh isolated database and removes only its test database.
- Ran scoped ESLint on `src/components/Communities`: pass.

# Round 2 — cinematic welcome and original laptop film

Read on 2026-11-04. This round adds 15 successfully fetched/read sites, counted once per domain within this round. The earlier community ledger remains above. The Apple documentation HTML/Markdown and an FFmpeg formats request failed through the browsing tool; those failed requests are not counted. The successful FFmpeg command-line documentation below is counted.

1. **Microsoft Learn — microsoft.com**\
   https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/motion\
   Takeaway: motion should connect interface states and preserve a sense of place.\
   Applied: the film follows one continuous laptop through search, topic results, community discovery, and sharing; brief eased movements connect those actions instead of unrelated decorative cuts.

2. **Framer — framer.com**\
   https://www.framer.com/help/articles/troubleshooting-animation-issues/\
   Takeaway: reduced-motion and device power settings can change whether effects play.\
   Applied: landing content remains visible and useful without effects; CSS transforms stop under reduced motion and the film presents a poster with an explicit Play action.

3. **Linear — linear.app**\
   https://linear.app/now/behind-the-latest-design-refresh\
   Takeaway: its March 2026 refresh emphasizes quieter supporting navigation and softer boundaries so the main task gets attention.\
   Applied: the welcome page uses muted, compact navigation and subtle borders, leaving the portal artwork, main headline, and one cyan registration action as the focus. The film's sidebar follows the same hierarchy.

4. **Section508.gov — section508.gov**\
   https://www.section508.gov/blog/avoid-auto-playing-content/\
   Takeaway: automatic motion needs a visible, clearly named, keyboard-operable stop or pause mechanism.\
   Applied: the film has a persistent Play/Pause button. Decorative scroll and star effects finish within five seconds, rather than continuing indefinitely. A readable film description provides a static alternative.

5. **WebKit — webkit.org**\
   https://webkit.org/blog/7551/responsive-design-for-motion/\
   Takeaway: scaling and parallax can trigger discomfort; matchMedia can adapt behavior to preference changes.\
   Applied: reduced motion disables the hero arrival transform and scroll reveals, pauses automatic film playback, and updates while the page remains open.

6. **Chrome for Developers — chrome.com**\
   https://developer.chrome.com/blog/autoplay\
   Takeaway: play() may reject; a UI must not assume autoplay succeeded.\
   Applied: automatic play handles the returned promise, playback state follows actual play/pause events, and an explicit Play button remains available when the browser prevents autoplay.

7. **MDN — mozilla.org**\
   https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API\
   Takeaway: a callback at a threshold still requires inspecting actual intersection state/ratio.\
   Applied refinement: playback requires at least one quarter of the film to be visible; threshold changes below that level pause it. Browsers without the observer retain manual playback.

8. **web.dev — web.dev**\
   https://web.dev/articles/lazy-loading-video\
   Takeaway: posters, media loading hints, and viewport-aware playback reduce unnecessary media work. The page was updated in July 2026.\
   Applied: the film has a real poster, metadata preload, progressive loading="lazy", and pauses offscreen. A fixed aspect ratio reserves layout space.

9. **W3C WAI — w3.org**\
   https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html\
   Takeaway: automatically moving information lasting more than five seconds needs a pause, stop, or hide mechanism.\
   Applied: the ten-second film has its own operable pause control; manual pause stays respected when returning to its viewport. Other decorative animations are finite and reduced-motion-safe.

10. **GSAP — gsap.com**\
    https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/\
    Takeaway: responsive and reduced-motion conditions should alter motion behavior and clean up when conditions change.\
    Applied: used the same principle through native CSS media queries and a cleaned-up matchMedia listener, avoiding an additional animation dependency for this small landing page.

11. **Motion — motion.dev**\
    https://motion.dev/docs/react-use-reduced-motion\
    Takeaway: device preference changes should affect both animation and component logic while the app is running.\
    Applied: the poster/playback caption and automatic playback policy react to motion preference changes. Manual Play remains an intentional user action.

12. **FFmpeg — ffmpeg.org**\
    https://ffmpeg.org/ffmpeg.html\
    Takeaway: raw frame inputs can be encoded into a real video stream, with input/output options explicitly ordered and frame rate selected.\
    Applied: the renderer pipes 240 original RGB frames to FFmpeg, encoding an actual silent H.264 MP4 at 24 fps. A complete decoding pass checks the finished movie.

13. **Pillow official documentation — pillow.readthedocs.io**\
    https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html\
    Takeaway: drawing primitives and text provide a reproducible way to create original UI frames with consistent geometry.\
    Applied: the film renders its branded interface, laptop shell, keyboard, captions, search interaction, and sharing circles directly from code. The generated portal hero is used unchanged and is not edited by this renderer.

14. **OpenCV — opencv.org**\
    https://docs.opencv.org/4.13.0/da/d6e/tutorial_py_geometric_transformations.html\
    Takeaway: a perspective transform maps four screen corners while keeping straight interface edges coherent.\
    Applied: each drawn interface frame is mapped onto a moving laptop screen using getPerspectiveTransform and warpPerspective, with a matching mask and subtle camera orbit.

15. **Python — python.org**\
    https://docs.python.org/3/library/subprocess.html\
    Takeaway: argument arrays and binary input pipes support predictable external-process encoding without shell interpretation.\
    Applied: the renderer invokes FFmpeg with a list of arguments, writes raw bytes to stdin, checks exit status, and terminates the process if rendering fails.

## Round 2 implementation and validation

- Original, generated portal artwork is preserved unchanged in the full-bleed welcome hero. All DailyCollabs copy and layout are distinct from the reference product.
- Real registration and sign-in links are used. No unsupported OAuth options or fabricated social proof were added.
- Added product, communities, how-it-works, and final CTA sections with responsive layouts and native navigation links.
- Added an original rendered laptop product film, poster, play/pause control, reduced-motion behavior, offscreen/hidden-tab pause, and an optional written description.
- Visual review of the first poster found the laptop base was too low; reduced scale and adjusted framing to show the complete device cleanly.
- Scoped Welcome ESLint: pass. Frontend production build: pass.
- FFmpeg complete decode: pass, no reported errors.
- OpenCV metadata: H.264, 1280×720, 24 fps, 240 frames, 10.0 seconds, 1,358,078 bytes. Sample frames at 0, 2.5, 5, 7.5, and 9.8 seconds decode successfully and contain changing content.

- A second film style-frame review caught unsupported font arrows in the share actions. Replaced those glyphs with code-drawn vector icons and rendered/decoded the final film again successfully. Staging HTTP checks on port 5174 return the correct image/png, image/jpeg, and video/mp4 MIME types.

## Latest landing-page steering

The user subsequently requested a professional landing page without the robot/fantasy hero, and required the exact actual app display. That steering supersedes the earlier portal-art decision above. Removed all illustration references and illustration CSS from the Welcome source. The hero now uses the unchanged `/welcome/app-preview.jpg` screenshot supplied by root in a neutral, thin-border browser frame, alongside the product copy and real account CTA. The film renderer accepts `--screen-capture`/`SCREEN_CAPTURE`; this mode preserves the whole actual screenshot and disables invented UI and drag overlays. Root supplies the browser capture before the final film render.
