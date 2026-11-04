# Agent 3 — profile and appearance research

Reviewed 2026-11-04. **16 successfully read sources from 16 distinct website domains.** Each entry records the source, what it taught, and the decision applied to DailyCollabs. These are product or standards maintainers' own sites. Implementation decisions are our interpretation of the evidence, not claims that every cited product behaves identically.

1. **Discord — discord.com** · [Custom Profiles](https://support.discord.com/hc/en-us/articles/4403147417623-Custom-Profiles). Read the avatar, About Me, and profile-theme sections. Takeaway: preview identity and appearance changes before committing them. Decision: live profile card, immediate theme preview, and an explicit Save changes action; unsaved appearance resets on leaving Settings.

2. **GitHub — github.com** · [Personalize your profile](https://docs.github.com/en/account-and-profile/tutorials/personalize-your-profile). Takeaway: public profile name, photo, and short bio form a compact identity, while optional details stay optional. Decision: separate display name and username fields, optional 240-character bio, image removal, and initials fallback. The app uses its own bio limit rather than copying GitHub's.

3. **Slack — slack.com** · [Edit your profile](https://slack.com/help/articles/204092246-Edit-your-profile). The source redirected to its localized official help article. Takeaway: profile photos help identify people, editing is reached from the profile, and viewing a profile preview clarifies what colleagues see. Decision: sidebar identity links to Settings and a desktop preview shows the public result separately from private email.

4. **Notion — notion.com** · [Account settings & preferences](https://www.notion.com/help/account-settings). Takeaway: name and photo are straightforward preferences; changing account email involves verification and belongs in account-security handling. Decision: make public identity editable, show email as private read-only information, and keep unimplemented email/password changes out of the profile PATCH contract.

5. **Spotify — spotify.com** · [Your Spotify profile picture](https://support.spotify.com/us/article/profile-picture/). Takeaway: users need both replace and remove-photo actions and a clear save step. Decision: Change photo plus Remove photo controls, with preview and explicit server persistence; no external social account is required.

6. **Reddit Help — reddithelp.com** · [How do I update my avatar image?](https://support.reddithelp.com/hc/en-us/articles/360043036152-How-do-I-update-my-avatar-image). Takeaway: uploaded avatars belong in a discoverable Profile settings section. Decision: a dedicated Profile section with labeled file-picker action, kept accessible from the global profile control.

7. **X — x.com** · [How to customize your profile](https://help.x.com/en/managing-your-account/how-to-customize-your-profile). Takeaway: identity editing combines photo, name, and short bio; display preferences also include font size and background theme. Decision: separate Profile and Appearance sections, an @ username presentation, compact identity fields, and app-wide text-size controls.

8. **Microsoft — microsoft.com** · [Color in Windows](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/color). Takeaway: neutral surfaces establish hierarchy, accents should emphasize interaction, and themes need contrast across controls and content. Decision: shared semantic surface/text/border/accent variables for Midnight, Dim, and Daylight; selected controls use both border/check state and accent color.

9. **Google Account — google.com** · [Change your Google Account picture, name & other info](https://support.google.com/accounts/answer/27442?hl=en). Takeaway: initials are a useful no-photo fallback, public identity needs privacy boundaries, and stale cached identity can confuse people after updates. Decision: initials avatar, private email serialization, and immediate profile-change events for sidebar/feed updates; later stale reads cannot restore an older saved identity.

10. **Gravatar — gravatar.com** · [Avatars](https://docs.gravatar.com/sdk/images/). Takeaway: consistent sizing and default representations make avatar systems predictable; external avatar lookups can be keyed to email hashes. Decision: consistent local initials fallback and resized uploads. We deliberately use uploaded raster data rather than initiating email-derived third-party avatar lookups.

11. **web.dev — web.dev** · [prefers-reduced-motion: Sometimes less movement is more](https://web.dev/articles/prefers-reduced-motion). Takeaway: honor the device motion preference and reduce nonessential transitions; avoid forced autoplay. Decision: the global OS reduced-motion media query remains active, Settings adds an account-level Reduce motion option, and the media review confirmed user-triggered embedded playback.

12. **MDN — mozilla.org** · [input type=file](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file). Read the file-selection and accepted-types sections. Takeaway: `accept` guides selection but does not validate files. Decision: PNG/JPEG/WebP picker hints plus frontend decode/re-encode and server MIME/signature/byte-limit checks; reject SVG and remote avatar URLs.

13. **W3C WAI — w3.org** · [User Notification](https://www.w3.org/WAI/tutorials/forms/notifications/). Takeaway: successful and failed submissions need concise, understandable feedback; live regions and associated hints help assistive technology. Decision: success status, error alert, username/bio `aria-describedby`, selected section states, and a busy form while saving.

14. **Auth0 — auth0.com** · [Updating User Profile Root Attributes](https://support.auth0.com/center/s/article/Updating-User-Profile-Root-Attributes). Takeaway: distinguish editable profile data from identity-provider-controlled attributes, with special treatment of account email. Decision: an explicit whitelist for own-profile PATCH and read-only email; account ownership comes from the authenticated token, never a body-supplied id.

15. **Supabase — supabase.com** · [JavaScript: updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser). Takeaway: the ordinary user update operation targets the logged-in account and distinguishes metadata updates from administrative user management. Decision: GET/PATCH `/users/me`, reject attempts to set `_id`, password, or unrelated fields, and enforce own-account guards on legacy mutation routes.

16. **OWASP — owasp.org** · [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Read allowlisting, MIME/signature validation, limits, permissions, and image rewriting guidance. Takeaway: no single MIME or filename check is sufficient. Decision: authenticated uploads, restricted raster formats, 500 KB stored-image limit, browser decode/re-encode at a maximum 384-pixel edge, server signature checks, and no executable upload files written to a public directory.

## Refinement and verification

After the research and cross-review, profile editing is locked while a save is in flight, duplicate submissions are suppressed, late responses cannot cross account sessions, and stale profile reads cannot replace newer saves. The cache has an in-memory fallback for browser storage quota failures. Invalid cached appearance choices fall back to supported defaults. Username and bio hints are associated with their controls, and active settings sections expose their selected state.

Behavioral verification covers authenticated own-profile updates, private-field filtering, duplicate usernames, unsupported and spoofed avatar types, avatar size limits, account-scoped caching, stale async responses, logout resets, and browser storage failures. The media cross-review confirms signed-in author assignment, ownership-scoped deletion, and author projections compatible with the profile avatar format.

Validation: 5 profile tests plus 6 media tests pass; targeted frontend ESLint passes. Root performs the final integrated browser review and production build.
