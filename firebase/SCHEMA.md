# Firestore data contract — EEE Club of HSTU

Shared by two apps that use the **same Firebase project**:

- **Public site** (`eee-club-hstu`, static HTML/JS, no login): reads published content, creates alumni registrations, contact messages and newsletter sign-ups.
- **Admin** (`eee-club-hstu-admin`, Next.js): signed-in admins manage everything.

`firestore.rules` in this folder enforces this contract. Both apps must follow it exactly.

## Conventions

- **Admin-managed collections** store `createdAt` / `updatedAt` as a number (`Date.now()`, milliseconds), the same as the `backend-model` repo.
- **Publicly created documents** (alumni registrations, contact messages, newsletter sign-ups) store `createdAt` as a Firestore server timestamp (`serverTimestamp()`); the rules require `createdAt == request.time`.
- Dates shown to people are strings: `"YYYY-MM-DD"` for days; ISO 8601 with offset for moments (`"2026-11-14T10:00:00+06:00"`). Bangladesh is UTC+6.
- An admin is a signed-in Firebase Auth user who has a document at `admins/{uid}`. Create that document by hand in the Firebase console (field `email`, string). Nothing in either app can create admins.

## Collections

### `admins/{uid}`
| field | type | notes |
|---|---|---|
| email | string | for display only |

Read: only the user themself. Write: nobody (console only).

### `event_logs/{autoId}` — events (upcoming and past)
| field | type | required | notes |
|---|---|---|---|
| title | string ≤ 160 | yes | |
| type | string | yes | one of `workshop`, `competition`, `seminar`, `trip`, `outreach` |
| startsAt | string | yes | ISO 8601 with offset |
| endsAt | string | no | ISO 8601 with offset |
| venue | string ≤ 160 | yes | |
| summary | string ≤ 600 | no | |
| link | string | no | relative page (`event.html`) or `https://…` URL |
| featured | boolean | yes | the next featured event drives the homepage countdown |
| published | boolean | yes | public site only sees `true` |
| createdAt, updatedAt | number (ms) | yes | |

Public site query: `where("published","==",true)`, then sorts by `startsAt` in the browser. Upcoming = `startsAt` ≥ now; archive = before now.

### `notices/{autoId}`
| field | type | required | notes |
|---|---|---|---|
| title | string ≤ 200 | yes | |
| body | string ≤ 1000 | yes | |
| category | string | yes | one of `general`, `events`, `lab`, `publication`, `alumni` |
| noticeDate | string | yes | `"YYYY-MM-DD"` |
| pinned | boolean | yes | pinned notices are listed first |
| link | string | no | |
| published | boolean | yes | |
| createdAt, updatedAt | number (ms) | yes | |

Public site query: `where("published","==",true)`; sorts pinned first, then `noticeDate` descending, in the browser.

### `certificates/{CERT-ID}`
The **document id is the certificate ID in upper case**, e.g. `EEE-HSTU-2026-0417`. The public site reads one document by id (`getDoc`); it can never list the collection.

| field | type | required | notes |
|---|---|---|---|
| type | string | yes | e.g. `Certificate of Achievement` |
| name | string | yes | recipient |
| details | string | yes | e.g. `Champion — Volt Rush 2026, Line follower` |
| issuedOn | string | yes | `"YYYY-MM-DD"` |
| status | string | yes | `valid` or `revoked` |
| createdAt, updatedAt | number (ms) | yes | |

### `alumni_registrations/{autoId}` — created by the public Alumni Association form
| field | type | required | notes |
|---|---|---|---|
| fullName | string 1–120 | yes | |
| session | string 1–20 | yes | academic session, e.g. `2013-14` |
| graduationYear | integer 2000–2100 | yes | |
| email | string ≤ 200, valid email | yes | |
| studentId | string ≤ 40 | no | |
| phone | string ≤ 40 | no | |
| currentRole | string ≤ 120 | no | job title |
| organization | string ≤ 160 | no | |
| city | string ≤ 80 | no | |
| linkedin | string ≤ 300 | no | |
| interests | list of strings, ≤ 6 | no | values from `mentoring`, `guest_talks`, `hiring`, `donations`, `events`, `research` |
| message | string ≤ 2000 | no | |
| consent | boolean | yes | must be `true` (agrees to be contacted by the association) |
| status | string | yes | always `pending` when created; admins change it to `approved` or `rejected` |
| source | string | no | `website` |
| createdAt | timestamp | yes | `serverTimestamp()` |
| reviewedAt | number (ms) | admin only | set when status changes |
| adminNote | string | admin only | |

No other fields are allowed on create. The public site never reads this collection.

### `contact_messages/{autoId}` — created by the public contact form
| field | type | required | notes |
|---|---|---|---|
| name | string 1–120 | yes | |
| email | string ≤ 200, valid email | yes | |
| organization | string ≤ 160 | no | |
| topic | string | yes | one of `general`, `partnership`, `alumni`, `media`, `sponsorship` |
| message | string 1–4000 | yes | |
| status | string | yes | `new` on create; admins set `read` or `archived` |
| createdAt | timestamp | yes | `serverTimestamp()` |

### `newsletter_subscribers/{autoId}` — created by the footer "Pulse" form
| field | type | required |
|---|---|---|
| email | string ≤ 200, valid email | yes |
| createdAt | timestamp | yes (`serverTimestamp()`) |

## Indexes

None needed: every public query is a single equality filter, and sorting happens in the browser. The admin app reads whole collections with `orderBy("createdAt","desc")`, which uses the automatic single-field index.

## Deploying the rules

From the admin repo: `npx firebase-tools deploy --only firestore:rules --project <project-id>` (uses `firebase.json` in the repo root).
