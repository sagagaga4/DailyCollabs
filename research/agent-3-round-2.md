# Agent 3 — channel communities and a distinct visual system

2026-11-04. This round applies evidence from **16 distinct website domains**. Discord channel/rules guidance, Slack channel/emoji guidance, and GitHub discussion guidance were freshly read for this round. The remaining official sources were read in round 1 and deliberately carried forward where they apply to identity, privacy, accessible interaction, and appearance inside the community experience; the earlier ledger is `research/agent-3.md`.

1. **discord.com** — [Rules Screening FAQ](https://support.discord.com/hc/en-us/articles/1500000466882-Rules-Screening-FAQ) and [Server Guide FAQ](https://support.discord.com/hc/en-us/articles/13497665141655-Server-Guide-FAQ). Freshly read. Rules screening is an explicit participation gate, but it also adds joining friction. A server guide provides an orienting resource space. Applied: a welcome-and-rules channel, owner-managed rules, optional acknowledgement only when the owner enables it, and rule-version checks so an outdated acknowledgement cannot join against changed rules.

2. **slack.com** — [Channel topics and descriptions](https://slack.com/help/articles/201654083-Set-a-conversation-topic-or-channel-description) and [Custom emoji and aliases](https://slack.com/help/articles/206870177-Add-custom-emoji-and-aliases-to-your-workspace). Freshly read. Channel topics clarify purpose; named custom expressions become part of a shared vocabulary. Applied: owner-editable channel topics in the conversation header, stable channel ids, and six original SVG expressions with readable `:name:` tokens and accessible labels.

3. **github.com** — [Managing discussions](https://docs.github.com/en/discussions/managing-discussions-for-your-community/managing-discussions). Freshly read. Organized discussion categories and maintainer-controlled resources support useful community conversations. Applied: separate persistent text channels and owner-only channel/rules management; existing board discussions remain visible in general rather than being discarded.

4. **reddithelp.com** — [Update an avatar image](https://support.reddithelp.com/hc/en-us/articles/360043036152-How-do-I-update-my-avatar-image). Carried forward. Identity editing should remain discoverable. Applied: safe current profile avatar/name projections in the member list and message authors, with initials when an uploaded avatar is absent.

5. **notion.com** — [Account settings and preferences](https://www.notion.com/help/account-settings). Carried forward. Public identity and account-security data have different purposes. Applied: public member projections contain name, avatar, and role; email and credentials never appear in chat or member responses.

6. **spotify.com** — [Profile pictures](https://support.spotify.com/us/article/profile-picture/). Carried forward. Avatar replacement/removal is an ordinary identity action and should produce a consistent result. Applied: chat and member lists display stored profile avatars and naturally fall back to initials after removal.

7. **x.com** — [Customize your profile](https://help.x.com/en/managing-your-account/how-to-customize-your-profile). Carried forward. Familiar identity hierarchy and compact profile information help people recognize one another. Applied: a clear username/time/message hierarchy and concise member identity rows, retaining the app’s own original glyphs and visual language.

8. **microsoft.com** — [Color in Windows](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/color). Carried forward. Neutral surfaces establish hierarchy while accent color communicates interactivity. Applied: distinct channel rail, conversation area, and member rail; restrained cyan selection; shared semantic theme tokens and sharper 4–6 px corners.

9. **google.com** — [Account picture, name, and other information](https://support.google.com/accounts/answer/27442?hl=en). Carried forward. Identity updates and privacy boundaries should be understandable, with a useful fallback when no picture exists. Applied: current populated author profiles, initials fallback, and explicit member/owner roles without invented online indicators.

10. **gravatar.com** — [Avatars](https://docs.gravatar.com/sdk/images/). Carried forward. Consistent avatar sizing and predictable defaults make identity legible. Applied: compact square avatar slots and local initials, using stored raster data instead of new email-derived external lookups.

11. **web.dev** — [Reduced motion](https://web.dev/articles/prefers-reduced-motion). Carried forward. Optional decorative motion should respect device preferences. Applied: restrained press feedback, slight emoji hover motion, and complete transform suppression for OS or account reduced-motion settings.

12. **mozilla.org** — [File inputs](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file). Carried forward. Browser file-type hints are not validation. Applied: community message/member avatars remain compatible with the restricted, validated raster profile format; community messages do not accept arbitrary uploaded executable content.

13. **w3.org** — [Form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/). Carried forward. Concise errors and successful-submit feedback need accessible announcement. Applied: status and alert messages, labeled controls, selected-channel semantics, a polite message log, and accessible named emoji buttons.

14. **auth0.com** — [Profile root attributes](https://support.auth0.com/center/s/article/Updating-User-Profile-Root-Attributes). Carried forward. Editable presentation and authoritative identity are distinct. Applied: message author and channel ownership come from verified session identity; body-supplied author or ownership fields cannot override them.

15. **supabase.com** — [Authenticated user updates](https://supabase.com/docs/reference/javascript/auth-updateuser). Carried forward. User-scoped operations should target the authenticated user rather than arbitrary ids provided in a request body. Applied: live membership checks before posting/reacting, owner checks before channel/rule updates, and signed-in identity for stored messages/reactions.

16. **owasp.org** — [File upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Carried forward. Restrict content formats and validate untrusted metadata rather than trusting client hints. Applied: channel message/attachment field allowlists, bounded text, HTTP/HTTPS source links without credentials, and no raw iframe or HTML ingestion.

## Applied refinements and verification

The UI now has persistent channel conversations, optional owner-enabled rules acknowledgement, owner-editable channel names/topics and read-only settings, safe member roles, original emoji insertion and stored reactions, and shared article/video attachments. Default general and welcome channels work on existing records. The original discussion history remains available in general.

Self-review added context guards so a late response from one board/channel cannot appear in another, revision guards against stale polling after a successful mutation, and acknowledgement tied to the specific rules version. Channel renames retain stable ids so saved links and shared-content destinations continue working. Directory message counts include both channel messages and original discussions.

Real MongoDB integration checks cover authenticated posting, membership, owner permissions, channel separation, read-only behavior, optional/versioned rules acknowledgement, stored reactions and toggling, legacy history, safe member data, and shared-source validation. Existing community lifecycle tests remain green. Scoped frontend lint and the production build pass. Root owns final integrated browser verification.
