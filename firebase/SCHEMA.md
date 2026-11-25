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

## Content collections (admin-managed, public reads `published == true`)

Images are stored as URLs (`https://…`, or a site-relative path such as `assets/advisory/19.jpg`); this project does not use Firebase Storage. Every document below also has `createdAt` and `updatedAt` as numbers (ms). Public site queries use a single `where("published","==",true)` and sort in the browser.

### `blogs/{autoId}`
| field | type | required | notes |
|---|---|---|---|
| title | string ≤ 200 | yes | |
| excerpt | string ≤ 400 | yes | shown on cards |
| content | string ≤ 60000 | yes | Markdown; `$…$` and `$$…$$` are LaTeX math |
| author | string ≤ 120 | yes | |
| authorRole | string ≤ 120 | no | e.g. `Head · Robotics` |
| tag | string | yes | one of `tutorial`, `recap`, `research`, `career`, `opinion`, `news` |
| coverImageUrl | string ≤ 500 | no | |
| readMinutes | integer | no | |
| publishedOn | string | yes | `"YYYY-MM-DD"`; newest first |
| featured | boolean | yes | the newest featured post leads the blog page |
| published | boolean | yes | |

Public post URL: `post.html?id=<document id>`.

### `leadership_members/{autoId}`
| field | type | required | notes |
|---|---|---|---|
| name | string ≤ 160 | yes | |
| role | string ≤ 120 | yes | e.g. `General Secretary`, `Professor` |
| category | string | yes | one of `executive`, `alumni`, `advisory`, `taskforce` |
| subtitle | string ≤ 160 | no | e.g. `Level 3 · Semester 2`, `Batch 2019 · Power systems engineer` |
| session | string ≤ 20 | no | e.g. `2026-27` |
| photoUrl | string ≤ 500 | no | no photo → initials tile |
| order | integer | yes | ascending within a category |
| published | boolean | yes | |

### `gallery_items/{autoId}`
| field | type | required | notes |
|---|---|---|---|
| title | string ≤ 160 | yes | caption |
| imageUrl | string ≤ 500 | yes | |
| category | string | yes | one of `competition`, `workshop`, `trip`, `people`, `other` |
| takenOn | string | no | `"YYYY-MM"` |
| order | integer | yes | ascending |
| published | boolean | yes | |

### `magazines/{autoId}` — Pulse issues
| field | type | required | notes |
|---|---|---|---|
| issueNumber | integer | yes | newest (highest) is the featured issue |
| title | string ≤ 160 | yes | e.g. `The Grid Issue` |
| season | string ≤ 60 | yes | e.g. `Winter 2026` |
| summary | string ≤ 1000 | no | |
| coverImageUrl | string ≤ 500 | no | no image → generated colour cover |
| coverColor | string | no | `#RRGGBB` for the generated cover |
| pdfUrl | string ≤ 500 | no | "Read issue" link |
| pages | integer | no | |
| contents | list of maps `{page: integer, title: string}` | no | table of contents, ≤ 30 entries |
| published | boolean | yes | |

### `resources/{autoId}`
| field | type | required | notes |
|---|---|---|---|
| title | string ≤ 200 | yes | |
| kind | string | yes | one of `notes`, `lab`, `code`, `exam`, `other` |
| course | string ≤ 60 | no | e.g. `EEE 2101` |
| fileType | string ≤ 20 | no | e.g. `PDF`, `ZIP` |
| size | string ≤ 20 | no | e.g. `14 MB` |
| url | string ≤ 500 | yes | download link (`https://…`) |
| published | boolean | yes | |

### `faqs/{autoId}`
| field | type | required | notes |
|---|---|---|---|
| question | string ≤ 300 | yes | |
| answer | string ≤ 3000 | yes | plain text (line breaks kept) |
| order | integer | yes | ascending |
| published | boolean | yes | |

### `partners/{autoId}`
| field | type | required | notes |
|---|---|---|---|
| name | string ≤ 160 | yes | |
| category | string ≤ 80 | no | e.g. `Academic partner` |
| logoUrl | string ≤ 500 | no | no logo → name set as a wordmark |
| website | string ≤ 500 | no | `https://…` |
| order | integer | yes | ascending |
| published | boolean | yes | |

## Singleton documents (public read, admin write)

### `pages_static/{pageId}` — `pageId` is one of `constitution`, `history`, `privacy`, `terms`
| field | type | required | notes |
|---|---|---|---|
| title | string ≤ 200 | yes | |
| content | string ≤ 100000 | yes | Markdown (LaTeX allowed) |
| updatedAt | number (ms) | yes | shown as "Last updated" |

When a document is missing, the public site shows its built-in default content.

### `site_settings/footer` — contact details and social links used in the site footer and contact page
| field | type | notes |
|---|---|---|
| email, phone, officeHours, room, address | string ≤ 300 each | |
| facebookUrl, instagramUrl, linkedinUrl, youtubeUrl, githubUrl | string ≤ 500 each | omit to hide that icon |
| updatedAt | number (ms) | |

### `site_settings/location`
| field | type | notes |
|---|---|---|
| name | string ≤ 160 | e.g. `Department of EEE, HSTU` |
| address | string ≤ 300 | |
| mapUrl | string ≤ 500 | "Open in Google Maps" link |
| updatedAt | number (ms) | |

## Indexes

None needed: every public query is a single equality filter, and sorting happens in the browser. The admin app reads whole collections with `orderBy("createdAt","desc")`, which uses the automatic single-field index.

## Deploying the rules

From the admin repo: `npx firebase-tools deploy --only firestore:rules --project <project-id>` (uses `firebase.json` in the repo root).
