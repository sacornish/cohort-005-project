# Notification vendors vs. build-our-own for Cadence v1

## Question

Cadence needs v1 in-app **Notifications**: a bell icon, an unread count, and an inbox with mark-read.
Recipients are **Students** (told about replies to their comments) and **Instructors** (told about any new comment or reply on lessons in courses they own).
Email may become an optional second channel later.
Scale is hundreds to low thousands of MAU.
Should we buy (Knock, Novu, MagicBell, Courier, Stream, SuprSend, Engagespot) or build on SQLite/Drizzle?

All pricing was read on **2026-11-10**. Where a primary source did not confirm a fact, the file says "not verified".

## Short answer

- **Build our own for v1.** One `notifications` table, an unread count in the authenticated layout loader, mark-read via actions, and polling with `useRevalidator`.
  It fits ADR 0006 (one process, one SQLite file, sync queries). Writing the Notification in the same transaction as the comment makes it atomic.
- Every vendor adds a second system of record, user sync, signed-token plumbing, SDK mocking in vitest, and a dev-user-switcher story. Our v1 needs one channel and no routing logic, so none of that buys us much.
- Free tiers (10k units/month at Knock, Novu, Courier, SuprSend) would cover our volume. Cost is not the reason to build. Lock-in and dev/test friction are.
- **If we buy later**, shortlist Novu (MIT core, headless hooks, US+EU, cheap Pro) and Knock (strongest docs, idempotency, sandbox mode). Triggers are in "What would change the recommendation".

## Context and constraints

- Stack: React Router v7 framework mode with SSR, loaders and actions, on one Node process with `better-sqlite3` + Drizzle (`docs/adr/0006-one-sqlite-file-through-drizzle.md`).
  Consequence recorded in the ADR: one writer, one machine.
- Comments already live in SQLite (`comments` table: `lessonId`, `userId`, nullable `parentId`, replies one level deep; `app/db/schema.ts:329-347`). Courses carry `instructorId` (`app/db/schema.ts:73`).
- The authenticated layout loader is `app/routes/layout.app.tsx:174` (it already calls `getCurrentUserId`). That is where an unread count belongs.
- Email already goes through `app/lib/mailer.server.ts`. Postmark is used when `POSTMARK_SERVER_TOKEN` is set. Otherwise each email is written to `.outbox/` as JSON (dev and tests).
- A DevUI user switcher swaps the current user in dev (`app/routes/api.switch-user.ts`). Tests use vitest.
- Glossary (`GLOSSARY.md:96-100`): **Notification** = a message to one Student or Instructor telling them something happened on Cadence that concerns them.
  Out of scope: mobile push and admin notifications.
- Volume assumption (ours, not a vendor number): a comment creates at most 2 Notifications (parent author + course Instructor). So 10,000 units/month is roughly 5,000 comments/month.

## Comparison table

Vendor wording differs: "messages", "workflow runs", "deliveries", "sends", "activities". They are not interchangeable.

| Criterion | Knock | Novu | MagicBell | Courier | Stream Feeds | SuprSend | Build own |
|---|---|---|---|---|---|---|---|
| **React UI** | Prebuilt `NotificationIconButton` + `NotificationFeedPopover`, plus headless hooks | Prebuilt `<Inbox />`, plus headless hooks (`useNotifications`, `useCounts`) | Prebuilt `FloatingInbox` / `Inbox` | Prebuilt `CourierInbox`; custom components; custom UI | React SDK with hooks (feed state over WebSocket) | Inbox feed component (details not verified) | Our own components, shadcn-style |
| **Auth to browser** | Public key + optional signed `userToken` (enhanced security mode) | `applicationIdentifier` + `subscriberId`; HMAC `subscriberHash` for production | User JWT (HS256) minted on our server | Server-minted scoped JWT via `POST /auth/issue-token` | Server-minted user token (client holds only API key) | Not verified | Existing session cookie |
| **Server trigger** | `@knocklabs/node` `knock.workflows.trigger(key, {...})` | `@novu/api` `POST /v1/events/trigger` | `magicbell-js` broadcasts (`createBroadcast`) | `@trycourier/courier` `client.send.message({message:{to:{user_id}, template}})` | `@stream-io/node-sdk` `client.feeds.addActivity` | Node SDK; workflow trigger | A function in the action |
| **Idempotency** | `Idempotency-Key` header on trigger, 24h | `Idempotency-Key` header (must be enabled by support) + `transactionId` | Not verified | `Idempotency-Key` header | Not verified (notification feed has a dedup window) | `idempotency_key`, 24h | Unique index (recipient, kind, comment) |
| **Free tier** | 10,000 messages/mo | 10,000 workflow runs/mo | 1,000 deliveries/mo | 10,000 sends/mo | 125k API calls + 5,000 activities | 10,000 notifications/mo | Free |
| **First paid tier** | $250/mo (50k msgs) | $30/mo (30k runs) | $249/mo (50k deliveries) | $0.005/send, pay-as-you-go | $499/mo billed annually ($599 monthly) | $100/mo billed annually (50k) | n/a |
| **Metered unit** | Message = 1 user x 1 channel | Workflow run | Delivery = user x channel | Send | Activities + API calls | Notification | n/a |
| **Open source / self-host** | SDKs MIT; service closed; no self-host on pricing page | Core MIT, `enterprise/` proprietary; self-hosted listed under Enterprise | Not verified | Not verified (no self-host on pricing page) | Not verified (SDK license "NOASSERTION" per GitHub API) | `suprsend-react-inbox` MIT; self-host / BYOC on Enterprise | Ours |
| **Regions** | Not verified | US + EU on Free | Not verified | US default; EU datacenter (Business plan) | Dedicated region stack (option); regions not verified | Multi-region on Enterprise | Wherever the VM is |
| **Email second channel** | Yes, workflows | Yes, 60+ providers | Yes (SES, Mailgun, SendGrid, SMTP) | Yes | Not a core feature (feeds product) | Yes | Existing `mailer.server.ts` |
| **Digest / batch** | Yes, on all plans | Digest step, all plans | Not verified | Digest and batch nodes in journeys | Aggregation of feed activities | Business plan and up | Build (cron + query) |
| **Preferences** | Yes, all plans | Yes, workflow + channel; `<Preferences />` | Yes (channel x category) | Yes; preference center | Not verified | Business plan and up | Build a small table |
| **Real-time** | WebSocket | WebSocket (`wss://...socket.novu.co`) | "Persistent connection" (mechanism not stated) | "Real time" (mechanism not stated) | WebSocket | Not verified | Polling or SSE |
| **Local dev / test** | Environments, `sandbox_mode` per trigger, test runner, CLI | Dev + Prod environments; dashboard "Test workflow" | Not verified | Test environment keys; Test key needs no provider | Not verified (a CLI exists) | CLI (workflow/template pull and push); Postman collection | vitest + in-memory SQLite; `.outbox/` |

## Per-option notes

### Knock

1. **React.** `@knocklabs/react` ships `KnockProvider`, `KnockFeedProvider`, `NotificationIconButton`, `NotificationFeedPopover`. `renderItem` customizes cells. A CSS import is required unless you override styling ([feed docs](https://docs.knock.app/in-app-ui/react/feed)). Headless hooks exist ([headless feed](https://docs.knock.app/in-app-ui/react/headless/feed.md)).
   - Security: by default feeds are open to anyone with the feed ID. Production should enable enhanced security mode and pass a signed `userToken` ([security docs](https://docs.knock.app/in-app-ui/security-and-authentication)).
   - SSR: the docs I read show no SSR guidance. The provider needs the browser (WebSocket), so we would render it client-only. **Not verified.**
2. **Trigger.** `import Knock from "@knocklabs/node"; await knock.workflows.trigger("comment-created", {...})` ([llms-full](https://docs.knock.app/llms-full.txt)). The REST call is `POST /v1/workflows/{key}/trigger` with `actor`, `recipients`, `data`, `tenant`, `cancellation_key`, `settings.sandbox_mode` ([trigger reference](https://docs.knock.app/api-reference/workflows/trigger)).
   - Idempotency: `Idempotency-Key` header, up to 255 chars, 24-hour replay. Only the trigger endpoint accepts it ([idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests.md)).
3. **Pricing** ([pricing](https://knock.app/pricing), read 2026-11-10). Free: $0, 10,000 messages/mo, unlimited stored profiles and workflows, "In-app feeds" unlimited. Starter: $250/mo, 50,000 messages, then $0.005 each; adds branding removal. A message is "a single message delivered to a single user on a single channel".
   - Ambiguity: the page does not say outright that in-app feed items count as messages. The definition implies it. "Guide recipients" (banners and popups) is a separate meter and does not apply to a feed.
4. **OSS and regions.** SDK repo is MIT ([knocklabs/javascript license](https://github.com/knocklabs/javascript/blob/main/LICENSE)). The service is closed SaaS. I found no EU region or self-host statement in the pricing page or `llms-full.txt`, so **not verified**.
5. **Email, digests.** Batching, conditional sending and cross-channel routing are on every plan ([pricing](https://knock.app/pricing)). Email client previews are Starter and up.
6. **Preferences.** On every plan. See the [preferences overview](https://docs.knock.app/preferences/overview.md).
7. **Real-time.** WebSocket; the `new-message` event carries updated badge counts and "might be throttled" ([in-app API overview](https://docs.knock.app/in-app-ui/api-overview.md)).
8. **Dev/test.** The test runner can run a whole workflow. `sandbox_mode` generates messages without delivering them, and `skip_delay` is available via `settings.sandbox_mode` / `settings.skip_delay` ([testing workflows](https://docs.knock.app/send-notifications/testing-workflows.md)). Environments and a CLI exist ([environments](https://docs.knock.app/version-control/environments.md), [CLI](https://docs.knock.app/ai/cli.md)). No local emulator found.

### Novu

1. **React.** `@novu/react` `<Inbox />` includes the bell, feed and preferences. Headless: `NovuProvider`, `useNotifications`, `useCounts`, `useNovu().notifications.read(...)` ([headless](https://docs.novu.co/platform/inbox/headless-mode.md)). Styling goes through an `appearance` prop ([styling](https://docs.novu.co/platform/inbox/configuration/styling.md)).
   - There is a Remix quickstart: the component goes in the root layout ([Remix quickstart](https://docs.novu.co/platform/quickstart/remix.md)). It is not React Router v7 specific. SSR behaviour is not documented there. **Not verified.**
   - Production: enable HMAC. `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` as hex, computed server-side. Without it a guessed `subscriberId` plus the public `applicationIdentifier` can read someone's feed ([prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production.md)). For the EU region, set `apiUrl=https://eu.api.novu.co` and `socketUrl=wss://eu.socket.novu.co`.
2. **Trigger.** `@novu/api`, `POST https://api.novu.co/v1/events/trigger`, max 100 recipients per call ([trigger event](https://docs.novu.co/api-reference/events/trigger-event.md)). `transactionId` in the body is for tracing/cancellation. For safe retries use the `Idempotency-Key` header, **but it is not enabled for all organizations and support must enable it** (same page).
3. **Pricing** ([pricing](https://www.novu.co/pricing/), read 2026-11-10). Free: $0, 10,000 workflow runs/mo, 5 workflows, 2 environments, 3 team members, 24h activity-feed retention, US + EU. Pro: from $30/mo, 30,000+ runs, 7-day retention, branding removed (compare table shows $1.20 per extra 1K runs). Team: from $250/mo, 250k+ runs.
   - Ambiguity: "Inbox feed retention" is a row in the compare table, but the values were cut off in the fetched output. Check how long Free keeps inbox items before relying on it. The free 5-workflow cap is fine for us (we need about 2).
4. **OSS and regions.** Repo `novuhq/novu` is MIT except the `enterprise/packages` directory, which is under a proprietary license ([LICENSE-ENTERPRISE](https://github.com/novuhq/novu/blob/next/LICENSE-ENTERPRISE), via the [GitHub license API](https://api.github.com/repos/novuhq/novu/license)). The OpenAPI spec also states MIT. The pricing page lists "Self-hosted (Enterprise)" as a hosting model, so whether community self-hosting is supported is ambiguous. I did not verify the self-host docs. Cloud has US + EU on every plan.
5. **Email, digests.** Email plus 60+ providers. Digest, delay and throttle steps ([workflow docs](https://docs.novu.co/platform/workflow/add-and-configure-steps/configure-action-steps/digest.md)). Free plan has a 24h digest window; custom windows are Enterprise ([pricing](https://www.novu.co/pricing/)).
6. **Preferences.** Workflow and channel level, with a `<Preferences />` component ([preferences](https://docs.novu.co/platform/concepts/preferences.md)).
7. **Real-time.** WebSocket (`socketUrl`).
8. **Dev/test.** Two environments on Free (Dev + Prod). Workflows can be tested from the dashboard against a real subscriber ([trigger workflow](https://docs.novu.co/platform/workflow/trigger-workflow.md)). The demo email integration only delivers to the account owner's address ([demo integrations](https://docs.novu.co/platform/integrations/demo-integration.md)). Code-first workflows via `@novu/framework` exist.

### MagicBell

1. **React.** `@magicbell/react` provides `ContextProvider` (takes a `token` User JWT) and `FloatingInbox` / `Inbox`, plus Preact, Svelte and web components ([React docs](https://www.magicbell.com/docs/libraries/magicbell-react)). The JWT is HS256-signed with the project secret and carries `user_external_id` or `user_email` plus `api_key` ([user JWT](https://www.magicbell.com/docs/api/authentication/user)). SSR guidance not verified.
2. **Trigger.** `magicbell-js`, `client.broadcasts.createBroadcast({title, content, recipients, category, topic, overrides...})` from `magicbell-js/project-client` ([JS SDK](https://www.magicbell.com/docs/libraries/magicbell-js)). Idempotency not verified.
3. **Pricing** ([pricing](https://www.magicbell.com/pricing), read 2026-11-10). Builder $0: 1,000 deliveries/mo, 1 project, unlimited users. Startup $249/mo: 50,000 deliveries, $0.0025 per extra, 5 projects. A delivery counts per user per channel (100 users on in-app, 50 also on email = 150 deliveries). The free cap is tight for us.
4. **OSS, regions.** Not verified.
5. **Email, preferences.** SES, Mailgun, SendGrid and SMTP channels ([channels](https://www.magicbell.com/docs/channels/in_app)). Per-channel and per-category preferences UI. Digest support not verified.
6. **Real-time.** "Persistent connection", mechanism not stated ([in-app channel](https://www.magicbell.com/docs/channels/in_app)).
7. **Dev/test.** The nav mentions a CLI and a "Push Notification Test Toolkit". Details not verified.

### Courier

1. **React.** `@trycourier/courier-react` (`CourierInbox`, `useCourier`) or web components. Three levels: prebuilt, custom components, custom UI ([inbox docs](https://www.courier.com/docs/in-app/inbox.md)).
   - Auth: the backend calls `POST /auth/issue-token` with a scope such as `user_id:user_123 inbox:read:messages inbox:write:events` and `expires_in`. The client calls `courier.shared.signIn({ userId, jwt })` ([authenticate users](https://www.courier.com/docs/in-app/authenticate-users.md)).
   - SSR: the Next.js guide says `"use client"` is required because the inbox is a browser-only custom element, with no `ssr: false` needed ([Next.js guide](https://www.courier.com/docs/guides/add-an-inbox-to-nextjs.md)). That maps cleanly onto a React Router client component plus a loader that mints the JWT.
2. **Trigger.** `client.send.message({ message: { to: { user_id }, template: "nt_..." } })` with `@trycourier/courier` v7+ ([send overview](https://www.courier.com/docs/send/overview.md)). The `Idempotency-Key` header replays the original response (same page).
3. **Pricing** ([pricing](https://www.courier.com/pricing), read 2026-11-10). Developer: free, 10,000 sends/mo. Business: $0.005 per send pay-as-you-go, includes EU data residency and cross-device email testing. Enterprise: custom. "No per-seat or channel add-on fees."
   - Ambiguity: the FAQ answers (what counts as a send, whether test messages count) were collapsed and not fetched.
4. **OSS, regions.** Closed SaaS; I found no self-host option (not verified beyond the pricing page). US hosts by default, EU datacenter selectable; client SDKs need `apiUrls` set for EU ([authenticate users, EU section](https://www.courier.com/docs/in-app/authenticate-users.md)).
5. **Email, digests.** Native. Digest and batch nodes are in Journeys ([digest node](https://www.courier.com/docs/journeys/nodes/digest.md)).
6. **Preferences.** Preference center, topics and sections ([preferences](https://www.courier.com/docs/recipients/preferences/overview.md)).
7. **Real-time.** Docs say "delivers it in real time" and syncs read state across devices. The transport is not stated in the pages I read.
8. **Dev/test.** Each environment has its own keys; start with Test. "A Test key works with no provider to connect" ([first in-app message](https://www.courier.com/docs/guides/send-your-first-in-app-message.md)).

### Stream (Activity Feeds)

A different category: feeds and social graph, with a built-in `notification` feed group.

1. **React.** The React SDK exposes hooks and context providers. State updates as WebSocket events arrive ([client-side overview](https://getstream.io/activity-feeds/docs/node/client-side.md)). Tokens must be minted on our server with the API secret.
2. **Trigger.** `@stream-io/node-sdk`: `new StreamClient(apiKey, secret)`, then `client.feeds.addActivity({...})` ([installation](https://getstream.io/activity-feeds/docs/node/installation.md)). Notification feeds can track `seen` and `read`, aggregate (default group by target/type/day) and dedupe, but "comments are not deduplicated" ([notification feeds](https://getstream.io/activity-feeds/docs/node/notification-feeds/)).
3. **Pricing** ([pricing](https://getstream.io/activity-feeds/pricing/), read 2026-11-10). Free: 125,000 API calls + 5,000 activities. Start: $499/mo billed annually ($599 monthly), 1.25M calls + 50k activities. A "Maker" plan gives $100/mo free credit if the team has under 5 people and under $10k monthly revenue. I did not check whether Cadence qualifies.
4. **OSS, regions.** Node SDK license shows as "Other / NOASSERTION" in the [GitHub API](https://api.github.com/repos/GetStream/stream-feeds-js/license), so license unverified. Dedicated region stacks are an option (pricing page).
5. **Email, preferences, digests.** Not a core feature of this product. Aggregation is the closest to digests.
6. **Fit.** We would mirror every comment as an activity into Stream and duplicate the comment-to-recipient graph. That is poor value when the source of truth is SQLite and our fan-out rules are two lines of SQL. The first paid tier is the most expensive here.

### SuprSend

- Free: 10k notifications/mo, in-app feed with SuprSend branding. Essentials $100/mo billed annually ($1,200), 50k, $2 per extra 1,000. Business $250/mo billed annually, adds **Batching & Digest and User Preferences** ([pricing](https://www.suprsend.com/pricing), read 2026-11-10). So preferences and digests are not available on the free tier here, unlike Knock and Novu.
- Enterprise: multi-region, self-hosted, BYOC (beta) ([pricing](https://www.suprsend.com/pricing)).
- Trigger: backend SDKs in Java, Python, Node, Go. Idempotency through `idempotency_key` in the workflow request, 24h ([idempotent requests](https://docs.suprsend.com/reference/idempotent-requests.md)). CLI for pulling and pushing workflows, templates and schemas ([CLI](https://docs.suprsend.com/reference/cli-workflow-pull.md)).
- `suprsend-react-inbox` is MIT ([license API](https://api.github.com/repos/suprsend/suprsend-react-inbox/license)). React/auth/real-time details were not verified.

### Engagespot

Not evaluated. `engagespot.co/pricing` and `engagespot.co` returned 404, `engagespot.com/pricing` returned no usable content, and the GitHub license check returned nothing. I will not guess at numbers. A follow-up should find its current pricing URL.

## Build-our-own on SQLite/Drizzle

### Schema sketch (`app/db/schema.ts`)

```ts
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // The Student or Instructor being told.
    recipientId: integer("recipient_id").notNull().references(() => users.id),
    // What happened. A reply to the recipient's own comment, or a new comment
    // on a lesson in a course the recipient owns.
    kind: text("kind", { enum: ["comment_reply", "lesson_comment"] }).notNull(),
    // The comment that caused it. Cascade: a deleted comment retracts its Notifications.
    commentId: integer("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
    // Denormalised for the link and for filtering; avoids a 3-table join per row.
    lessonId: integer("lesson_id").notNull().references(() => lessons.id),
    actorId: integer("actor_id").notNull().references(() => users.id),
    readAt: text("read_at"), // null = unread
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    // Idempotency: one Notification per recipient per comment.
    uniqueIndex("notifications_recipient_comment").on(t.recipientId, t.commentId),
    // Serves the inbox list and the unread count.
    index("notifications_recipient_read_created").on(t.recipientId, t.readAt, t.createdAt),
  ]
);
```

- Render text at read time by joining `comments` and `users`. This avoids stale copies and means an edited comment reads correctly. Store only references.
- Fan-out inside the same `db.transaction` that inserts the comment (synchronous with `better-sqlite3`, so atomic and no outbox is needed):
  1. If `parentId` is set, the parent's author gets `comment_reply`, unless they are the actor.
  2. The course's Instructor gets `lesson_comment`, unless they are the actor.
  3. If both rules hit the same person (an Instructor's own comment being replied to), the unique index plus `onConflictDoNothing()` keeps it to one Notification. Decide which `kind` wins.
- Open question for the product owner: should an Instructor get a Notification for their own Student-facing replies? Our rule above says no (the actor is excluded).

### Reading and writing

- **Unread count** in the root authenticated loader (`app/routes/layout.app.tsx:174`):
  `db.select({ n: count() }).from(notifications).where(and(eq(recipientId, userId), isNull(readAt)))`. The sync driver makes this about a microsecond-level index lookup, with no extra round trip. Return `unreadNotificationCount` in `loaderData`.
- **Inbox**: a route such as `notifications.tsx` listing the latest 50 joined rows (paginate later).
- **Mark-read** by action: `intent=read` (one id, scoped `WHERE recipient_id = currentUser`) and `intent=read-all`. Use `useFetcher` from the bell. React Router revalidates loaders after the action, so the count updates with no client state. Always scope by the current user's ID so one user cannot mark another's Notifications.
- **Auth** is the existing session cookie. No HMAC, no JWT, no third-party origin and no CSP changes.

### Real-time options (single Node process)

| Option | How | Fit |
|---|---|---|
| Revalidate on focus (default) | React Router already revalidates loaders after any action and can on window focus | Free; catches most cases |
| **Polling** | `useRevalidator()` in an interval (30-60s) while `document.visibilityState === "visible"` | Simplest; reruns the whole layout loader, so keep it cheap. **Recommended for v1** |
| **SSE resource route** | `GET /api/notifications/stream` returning a `text/event-stream` `Response`. The comment action emits on an in-process `EventEmitter` keyed by recipient ID; the stream calls `revalidate()` | Works only because ADR 0006 gives one process. Needs care: dev HMR duplicates module state (hold the emitter on `globalThis`), reverse proxies buffering, heartbeat comments, cleanup on abort. Breaks on a second machine |
| WebSocket | Extra server and upgrade handling | Overkill |

Polling plus focus revalidation is enough for comments (a delay of up to a minute is fine). Move to SSE only if the delay becomes a complaint.

### Email via the existing mailer

- After the transaction commits, call the existing `MailTransport.send({to, subject, body})` from `app/lib/mailer.server.ts`. In dev and tests it writes JSON into `.outbox/` (header comment, `mailer.server.ts:4-6`), so a test can assert on the file. No vendor sandbox is needed.
- Failure policy: email must never fail the comment. Catch and log, or queue as a row (`notification_deliveries`) with a periodic sweep if reliability matters. Do not do this in v1.
- Digest: a nightly job that groups unread, un-emailed Notifications per recipient. About half a day of work. Postmark is the production transport.

### Preferences (later)

```ts
export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: integer("user_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),               // "comment_reply" | "lesson_comment"
  channel: text("channel").notNull(),         // "in_app" | "email"
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.kind, t.channel] })]);
```

- No row means the default (in-app on, email off). Fan-out consults it before inserting. A settings page toggles it (`app/routes/settings.tsx` exists).

### Dev/test story

- The DevUI user switcher just changes the session user. Each user's Notifications are rows keyed on `users.id`, so the bell changes with the switcher for free. Vendors would need a subscriber/user sync plus a freshly signed token per switched user.
- vitest: use the existing in-memory or temp SQLite pattern. Test fan-out as a pure DB function (reply, top-level comment, self-reply, double-hit, delete cascade). No SDK mocks.

### Rough effort (our estimate, not sourced)

| Piece | Estimate |
|---|---|
| Schema + migration + seed (see `database-migrations` skill) | 0.5 day |
| Fan-out in the comment action + tests | 1 day |
| Layout-loader count, bell, inbox route, mark-read/all actions | 1-1.5 days |
| Polling | 0.25 day |
| **v1 total** | **about 3 days** |
| Email channel (outbox-backed) | 0.5-1 day |
| Preferences table + settings UI | 1 day |
| SSE (optional) | 1 day |

A vendor integration is not obviously cheaper: account, workflow definitions in a dashboard, user sync, token endpoint, client-only provider, SDK mocks and a CSP update for the vendor's hosts. Estimate 2-4 days for the same v1, plus ongoing dashboard-versus-code drift.

## Recommendation

**Build in-app Notifications ourselves for v1.**

Trade-offs:

| Build own | Vendor |
|---|---|
| (+) Atomic with the comment (same transaction), no dual-write | (-) Dual write: SQLite and vendor can drift. Failed trigger after a committed comment needs retry/idempotency logic |
| (+) Fits ADR 0006 and the dev user switcher; vitest needs no mocks | (-) Needs a sandbox project and signed tokens per switched user; tests mock the SDK |
| (+) No per-unit cost, no MAU tiers | (+) Free tiers (10k/mo at Knock, Novu, Courier, SuprSend) cover our scale |
| (+) No data leaves Cadence (no EU/US residency question) | (-) Student names and comment text go to a third party. Residency is only verified for Novu (US+EU) and Courier (EU on Business) |
| (-) We own UI polish (empty states, pagination, a11y) | (+) Prebuilt inboxes ship those |
| (-) Digests, preferences, multi-channel routing are ours | (+) Knock and Novu give batching and preferences on free plans |
| (-) Polling latency, or SSE we maintain | (+) WebSocket real-time (Knock, Novu, Stream) |

**What would change the recommendation:**

- We need more channels, such as Slack/Teams, SMS, or mobile push (currently out of scope), or non-engineers editing Notification copy. Then choose **Novu** (MIT core, headless hooks, `Idempotency-Key` header but enablement needed via support, US+EU, $30 Pro) or **Knock** (strong docs, `Idempotency-Key`, `sandbox_mode`, batching and preferences free, $250 Starter).
- We move to more than one machine. The in-process SSE option dies, and SQLite itself is limited (ADR 0006). A vendor's WebSocket service then starts to pay off, or we adopt Postgres plus LISTEN/NOTIFY.
- Digests or per-user preferences become complicated (quiet hours, per-course rules, per-Instructor schedules). Then re-evaluate Knock or Courier.
- Delivery SLAs, email deliverability analytics or compliance audits become requirements.
- Courier is the best fit if we ever want a vendor with the least client-side plumbing: it documents that `"use client"` is enough and `ssr: false` is not needed, though its pricing is pay-as-you-go beyond 10k sends.
- Stream and MagicBell are the weakest fits. Stream is a feed product with a $499/mo first tier. MagicBell's free tier is 1,000 deliveries.

**Mitigation if we build:** keep fan-out behind one function (`notifyForComment(tx, comment)`) so the persistence side can later be swapped for a vendor trigger without touching the comment action.

## Gaps and uncertainties

- Not verified from primary sources: Knock regions and self-host; MagicBell idempotency, regions, OSS and digests; Courier real-time transport and self-host; Stream license, idempotency and regions; SuprSend inbox React/auth/real-time details; every vendor's React Router v7 SSR specifics (Courier's Next.js guide is the only explicit SSR statement); Engagespot (pricing pages 404).
- Novu: compare-table cells for inbox feed retention were truncated in the fetch. Self-host community docs were not read.
- Pricing pages may show promotional or annual-billing numbers (Stream, SuprSend state "billed annually"). The monthly prices were read on 2026-11-10 and may change.
- Effort estimates and volume assumptions are ours.

## Sources

Pricing (read 2026-11-10):
- Knock: https://knock.app/pricing
- Novu: https://www.novu.co/pricing/
- MagicBell: https://www.magicbell.com/pricing
- Courier: https://www.courier.com/pricing
- Stream Activity Feeds: https://getstream.io/activity-feeds/pricing/
- SuprSend: https://www.suprsend.com/pricing

Knock:
- https://docs.knock.app/in-app-ui/react/feed
- https://docs.knock.app/in-app-ui/security-and-authentication
- https://docs.knock.app/in-app-ui/api-overview.md
- https://docs.knock.app/api-reference/workflows/trigger
- https://docs.knock.app/api-reference/overview/idempotent-requests.md
- https://docs.knock.app/send-notifications/testing-workflows.md
- https://docs.knock.app/llms.txt and https://docs.knock.app/llms-full.txt
- https://github.com/knocklabs/javascript/blob/main/LICENSE

Novu:
- https://docs.novu.co/llms.txt and https://docs.novu.co/_llms/notify.txt
- https://docs.novu.co/platform/quickstart/remix.md
- https://docs.novu.co/platform/inbox/headless-mode.md
- https://docs.novu.co/platform/inbox/prepare-for-production.md
- https://docs.novu.co/platform/workflow/trigger-workflow.md
- https://docs.novu.co/api-reference/events/trigger-event.md
- https://github.com/novuhq/novu (license: https://api.github.com/repos/novuhq/novu/license)

MagicBell:
- https://www.magicbell.com/docs/libraries/magicbell-react
- https://www.magicbell.com/docs/api/authentication/user
- https://www.magicbell.com/docs/libraries/magicbell-js
- https://www.magicbell.com/docs/channels/in_app

Courier:
- https://www.courier.com/docs/in-app/inbox.md
- https://www.courier.com/docs/in-app/add-an-inbox.md
- https://www.courier.com/docs/in-app/authenticate-users.md
- https://www.courier.com/docs/send/overview.md
- https://www.courier.com/docs/guides/add-an-inbox-to-nextjs.md
- https://www.courier.com/docs/llms.txt

Stream:
- https://getstream.io/activity-feeds/docs/node/notification-feeds/
- https://getstream.io/activity-feeds/docs/node/client-side.md
- https://getstream.io/activity-feeds/docs/node/installation.md
- https://api.github.com/repos/GetStream/stream-feeds-js/license

SuprSend:
- https://docs.suprsend.com/llms.txt
- https://docs.suprsend.com/reference/idempotent-requests.md
- https://api.github.com/repos/suprsend/suprsend-react-inbox/license

Repo references: `docs/adr/0006-one-sqlite-file-through-drizzle.md`, `GLOSSARY.md:96-100`, `app/db/schema.ts:329-347`, `app/lib/mailer.server.ts:1-40`, `app/routes/layout.app.tsx:174-228`.
