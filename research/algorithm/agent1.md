# Agent 1 algorithm research notes

23 distinct registrable domains were read. Entries name the actual page domain after redirects. Abstract/landing pages are described as such; reading an abstract is not claimed as reading the full paywalled paper. Documentation pages, original engineering articles, official research summaries, and the opened academic PDFs informed the decisions.

Accounting replacements:
- pinterestlabs.com redirects to labs.pinterest.com: counted as pinterest.com.
- recbole.io timed out or was unreadable: replaced with jmlr.org.
- ieee.org/Xplore returned bot verification: replaced with scipy.org.
- Supplemental Spotify Research pages at atspotify.com were read but not counted; the counted entry is newsroom.spotify.com.
- An old Microsoft publication link redirected to a generic homepage and was excluded; a relevant Microsoft Learn ranking page was successfully read instead.
- A stale Amazon PDF returned404 and was excluded; the original Amazon Science explanatory article was read instead.

Recommended implementation baseline: eligibility by topic/language first; bounded recent explicit/implicit signals; explainable weighted relevance and freshness; dedupe and source diversity; account-private state; chronology/pause/reset controls. Evaluate ranking correctness and coverage separately from any unmeasured business outcome.
