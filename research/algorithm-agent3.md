# Agent 3 — discovery and reader control research

Read on 2026-11-04. **22 distinct first-party website domains, all successfully opened and read. No replacements were needed.** Product decisions below are implementation interpretations of the sources, not claims that DailyCollabs duplicates those services’ algorithms.

1. **daily.dev** — [Feeds](https://docs.daily.dev/feeds/)
   Takeaway: Personalized, Following, and date-oriented feeds serve different reading intentions. Decision: Expose Balanced, Fresh, Discover, and Following choices instead of one opaque ranking.

2. **discord.com** — [Community Onboarding FAQ](https://support.discord.com/hc/en-us/articles/11074987197975-Community-Onboarding-FAQ)
   Takeaway: Members can choose relevant channels and roles and revise those choices later. Decision: Treat joined communities and explicitly followed topics as editable interests.

3. **reddithelp.com** — [Reddit’s Approach to Content Recommendations](https://support.reddithelp.com/hc/en-us/articles/23511859482388-Reddit-s-Approach-to-Content-Recommendations)
   Takeaway: Recommendations combine content, activity, subscriptions, settings, filtering, explanations, and negative feedback. Decision: Provide personalization off, muted topics, truthful story reasons, and explicit more/less feedback.

4. **discourse.org** — [Understanding Discourse Trust Levels](https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/)
   Takeaway: Community participation and permission systems need explicit, understandable rules; newer permissions can target groups. Decision: Keep owner/member permissions distinct from feed ranking and avoid fabricated reputation inputs.

5. **stackoverflow.com** — [What are tags, and how should I use them?](https://stackoverflow.com/help/tagging)
   Takeaway: Clear topic tags connect people to relevant questions and explain what a category means. Decision: Use visible followed-topic chips as explicit interest signals rather than hidden broad category assumptions.

6. **mediawiki.org** — [Help:Watchlist](https://www.mediawiki.org/wiki/Help:Watchlist)
   Takeaway: A personal watchlist narrows a busy update stream to pages the reader chooses and can unwatch. Decision: Store followed topics per authenticated account and make removal easy.

7. **zulip.com** — [Reading strategies](https://zulip.com/help/reading-strategies)
   Takeaway: Conversation, recent, combined, and focused views support different ways of catching up. Decision: Offer a Fresh reading mode and keep channel conversation navigation separate from discovery controls.

8. **matrix.org** — [Public Rooms](https://matrix.org/docs/chat_basics/public-rooms/)
   Takeaway: People discover communities through topic search, directories, previews, and explicit joining. Decision: Use real community joins as an interest source and preserve an easy path from discovery into community channels.

9. **circle.so** — [Get to know Feed](https://help.circle.so/p/basics/home/home-overview)
   Takeaway: Membership shapes the feed, and the For you sort combines recent and active posts. Decision: Combine community affinity with recency while keeping freshness adjustable and the cold-start feed usable.

10. **bettermode.com** — [Understanding and setting up a Feed](https://bettermode.com/hub/content-management/post/understanding-and-setting-up-a-feed-dG1qPBbU4OiTEOb)
   Takeaway: The feed aggregates posts from spaces a member has joined. Decision: Label community-derived interests plainly and keep a Following balance option.

11. **mightynetworks.com** — [Community Features](https://www.mightynetworks.com/community)
   Takeaway: Community spaces combine feeds, chat, questions, events, and member discovery. Decision: Connect feed discovery to actual community participation instead of inventing engagement activity.

12. **substack.com** — [How can I recommend other publications on Substack?](https://support.substack.com/hc/en-us/articles/5036794583828-How-can-I-recommend-other-publications-on-Substack)
   Takeaway: A short reason can help readers decide whether a recommendation is worth exploring; recommendations can be removed. Decision: Show Why this story only when real backend explanations exist, and keep topic choices reversible.

13. **ghost.org** — [Recommendations](https://ghost.org/help/recommendations/)
   Takeaway: Publishers can recommend other sites with a customized title and description. Decision: Retain recognizable source metadata and explain discovery without suggesting an unverified endorsement.

14. **wordpress.org** — [WordPress Feeds](https://developer.wordpress.org/advanced-administration/wordpress/feeds/)
   Takeaway: RSS and Atom expose recent publisher content, while comment feeds are a distinct stream. Decision: Preserve publisher source and publication metadata so freshness ranking reflects actual article data.

15. **medium.com** — [Refine recommendations](https://help.medium.com/hc/en-us/articles/224488047-Refine-recommendations)
   Takeaway: Readers can manage follows and mutes, hide stories, and clear reading history to adjust recommendations. Decision: Add followed and muted topic controls plus a clearly scoped reset of learned reading feedback.

16. **dev.to** — [Customizing Your Feed](https://dev.to/help/customizing-your-feed)
   Takeaway: Followed tags/users shape recommendations; hidden tags can be managed and restored; saved reading lists are separate. Decision: Keep explicit follows, mutes, and bookmarks distinct from learned history, with editable topic chips.

17. **hashnode.com** — [The journey behind Hashnode’s new personalized feed](https://townhall.hashnode.com/revamped-personalized-feed)
   Takeaway: Followed tags, authors, subscriptions, and reading interests help make a feed relevant. Decision: Use real explicit and behavioral interests and expose their provenance in the Tune your feed dialog.

18. **feedly.com** — [How can I add/create a Mute Filter?](https://docs.feedly.com/article/109-how-can-i-add-create-a-mute-filter)
   Takeaway: Keyword or phrase filters can remove unwanted content across chosen feeds. Decision: Allow up to 20 editable muted topics and persist them on the server.

19. **inoreader.com** — [Read only the articles you want](https://www.inoreader.com/features/filters)
   Takeaway: Server-side filters keep or remove matching articles consistently across devices; duplicate filtering reduces repeated stories. Decision: Apply muted preferences before ranking and preserve source diversity and duplicate suppression in the feed.

20. **flipboard.com** — [How to Personalize Flipboard](https://about.flipboard.com/inside-flipboard/how-to-personalize-flipboard/)
   Takeaway: Readers can tune followed topics, request less of a story type, mute sources, and inspect why a story appeared. Decision: Make Tune your feed accessible from the feed and pair adjustable recommendations with honest reasons.

21. **readwise.io** — [Daily Digest](https://docs.readwise.io/reader/docs/faqs/daily-digest)
   Takeaway: Discovery can resurface saved content alongside new feed items, while the digest remains optional. Decision: Keep bookmarks useful after a history reset and avoid forced streaks or attention-pressure badges.

22. **theguardian.com** — [Guardian app](https://www.theguardian.com/info/2026/aug/27/discover-a-better-way-to-experience-the-guardian-with-the-guardian-app)
   Takeaway: Followed topics personalize news. Decision: Keep followed topics explicit and editable.

## Implemented controls

The isolated FeedControls component reads and saves authenticated preferences through GET/PATCH /feed/preferences, supports Balanced/Fresh/Discover/Following, personalization on/off, freshness and source-variety weighting, followed topics, muted topics, and an explicitly confirmed POST /feed/reset. Reset copy explains that reading/search feedback is cleared while bookmarks, followed topics, and community memberships remain relevant. Interest chips display server-provided provenance. WhyThisStory renders only backend-provided reason strings.

The UI uses a native focus-trapping dialog, labeled radio/range/toggle controls, save/error feedback, session guards, and disabled fields while requests are in flight. It introduces no automatic reactions, sharing, streaks, or fabricated activity. Root owns ranking implementation and final browser integration.
