# EEE Club Admin

Admin dashboard for the **EEE Club of HSTU** (Department of Electrical & Electronic Engineering, Hajee Mohammad Danesh Science and Technology University, Bangladesh).

## How It Pairs With the Public Site

This Next.js admin application and the static HTML/JS public website (`eee-club-hstu`) share the **same Firebase project** and follow the fixed Firestore data contract in [`firebase/SCHEMA.md`](./firebase/SCHEMA.md) and [`firebase/firestore.rules`](./firebase/firestore.rules):

- **Public site**: reads published content collections (`event_logs`, `notices`, `blogs`, `leadership_members`, `gallery_items`, `magazines`, `resources`, `faqs`, `partners`), reads `pages_static/*` and `site_settings/*`, verifies individual `certificates` by uppercase ID (`getDoc`), and creates `alumni_registrations`, `contact_messages`, and `newsletter_subscribers`.
- **Admin dashboard**: authenticated admins manage:
  - **Inbox**: Alumni registrations, Contact messages, Newsletter subscribers
  - **Events**: Events, Notices, Certificates (including bulk CSV import)
  - **Content**: Blog posts (Markdown + GFM + LaTeX math preview), Pulse Magazine issues (with table of contents & cover colours), Academic Resources, Photo Gallery
  - **About**: Leadership directory (Executive, Alumni, Advisory, Taskforce with ordering), Partners, Static Pages (`constitution`, `history`, `privacy`, `terms` with Markdown editor & reset to site default)
  - **Support & Settings**: FAQs (with ordering), Footer contact & social links, Campus location & map link

## Images Without Firebase Storage

This project does **not** use Firebase Storage because Firebase Storage requires the paid **Blaze** plan. Instead, all images (blog covers, leadership portraits, gallery photos, magazine covers, partner logos) are stored as **`https://…` URLs** or **site-relative paths** (such as `assets/advisory/19.jpg`) served by the public website.

Set `NEXT_PUBLIC_SITE_URL` in `.env.local` (and in Vercel) to your public website origin so the admin can preview site-relative image paths. When `NEXT_PUBLIC_SITE_URL` is unset, leadership entries with relative paths display an initials tile in the admin preview.

## Demo Seeding

On the Dashboard, click **Load demo content** whenever any seedable collection is empty. The seeder checks each collection independently (`event_logs`, `notices`, `certificates`, `leadership_members`, `blogs`, `magazines`, `resources`, `faqs`, and `pages_static/constitution`) and seeds only the empty ones from the public site's built-in content, reporting what was added or skipped. `gallery_items`, `partners`, `pages_static/{history,privacy,terms}`, and `site_settings/*` are left empty so the public site displays its built-in defaults until customised.

## Firebase Setup

1. **Create a Firebase project** in the [Firebase Console](https://console.firebase.google.com/).
2. **Enable Email/Password sign-in**: Go to *Authentication → Sign-in method → Email/Password* and enable it.
3. **Create Cloud Firestore**: Create a Firestore database in **production mode**.
4. **Create an admin user**:
   - In *Authentication → Users*, add a user with email & password and copy their **User UID**.
   - In *Firestore Database*, create a document at `admins/<that user's uid>` with field `email` (type `string`, value matching the user's email). Neither app can create admin records; only users with an `admins/{uid}` document can access the admin panel.
5. **Configure environment variables**: Copy `.env.example` to `.env.local` and paste your Firebase Web App config values into the `NEXT_PUBLIC_FIREBASE_*` keys (plus optional `NEXT_PUBLIC_SITE_URL`).
6. **Deploy Firestore security rules**:
   ```bash
   npx firebase-tools deploy --only firestore:rules --project <project-id>
   ```

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your admin credentials.

## Deploying to Vercel

1. Push the repository to your Git provider and import it into Vercel.
2. Add all environment variables from `.env.example` (`NEXT_PUBLIC_FIREBASE_*` and optional `NEXT_PUBLIC_SITE_URL`) in the Vercel project settings.
3. Deploy with the default Next.js build settings (`npm run build`).
