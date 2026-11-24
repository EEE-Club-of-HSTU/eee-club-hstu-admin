# EEE Club Admin

Admin dashboard for the **EEE Club of HSTU** (Department of Electrical & Electronic Engineering, Hajee Mohammad Danesh Science and Technology University, Bangladesh).

## How It Pairs With the Public Site

This Next.js admin application and the static HTML/JS public website (`eee-club-hstu`) share the **same Firebase project** and follow the fixed Firestore data contract in [`firebase/SCHEMA.md`](./firebase/SCHEMA.md) and [`firebase/firestore.rules`](./firebase/firestore.rules):

- **Public site**: reads published `event_logs` and `notices`, verifies individual `certificates` by uppercase ID (`getDoc`), and creates `alumni_registrations`, `contact_messages`, and `newsletter_subscribers`.
- **Admin dashboard**: authenticated admins manage events, notices, certificates (including bulk CSV import), alumni registration reviews, contact messages, and newsletter subscribers.

## Firebase Setup

1. **Create a Firebase project** in the [Firebase Console](https://console.firebase.google.com/).
2. **Enable Email/Password sign-in**: Go to *Authentication → Sign-in method → Email/Password* and enable it.
3. **Create Cloud Firestore**: Create a Firestore database in **production mode**.
4. **Create an admin user**:
   - In *Authentication → Users*, add a user with email & password and copy their **User UID**.
   - In *Firestore Database*, create a document at `admins/<that user's uid>` with field `email` (type `string`, value matching the user's email). Neither app can create admin records; only users with an `admins/{uid}` document can access the admin panel.
5. **Configure environment variables**: Copy `.env.example` to `.env.local` and paste your Firebase Web App config values into the `NEXT_PUBLIC_FIREBASE_*` keys.
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

## Deploying to Netlify

The site is deployed on Netlify from the `main` branch. Build settings live in `netlify.toml` (`npm run build`, publishing `.next`), and Netlify applies its Next.js runtime automatically.

Set every `NEXT_PUBLIC_FIREBASE_*` variable from `.env.example` in the Netlify project's environment variables. They are compiled into the client bundle at build time, so start a new deploy whenever they change.
