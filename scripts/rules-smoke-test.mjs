// Checks the deployed Firestore rules from the point of view of an anonymous
// visitor of the public site. Run from the repo root (needs .env):
//   node scripts/rules-smoke-test.mjs            -> read/deny checks only
//   node scripts/rules-smoke-test.mjs --write    -> also creates ONE test alumni
//                                                    registration (delete it in the admin)
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, query, where, serverTimestamp,
} from "firebase/firestore";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = getFirestore(app);
const doWrite = process.argv.includes("--write");

let failures = 0;
async function expect(label, shouldPass, fn) {
  try {
    await fn();
    console.log(`${shouldPass ? "ok  " : "FAIL"}  ${label}: allowed`);
    if (!shouldPass) failures++;
  } catch (err) {
    const denied = err.code === "permission-denied";
    const ok = !shouldPass && denied;
    console.log(`${ok ? "ok  " : "FAIL"}  ${label}: ${err.code || err.message}`);
    if (!ok) failures++;
  }
}

const goodAlumni = () => ({
  fullName: "Rules smoke test (delete me)",
  session: "2015-16",
  graduationYear: 2020,
  email: "smoke-test@example.com",
  interests: ["mentoring"],
  consent: true,
  status: "pending",
  source: "website",
  createdAt: serverTimestamp(),
});

await expect("read published events", true, () =>
  getDocs(query(collection(db, "event_logs"), where("published", "==", true))));
await expect("read published notices", true, () =>
  getDocs(query(collection(db, "notices"), where("published", "==", true))));
await expect("read ALL events (no published filter)", false, () => getDocs(collection(db, "event_logs")));
await expect("get one certificate by id", true, () => getDoc(doc(db, "certificates", "EEE-HSTU-0000-0000")));
await expect("list certificates", false, () => getDocs(collection(db, "certificates")));
await expect("list alumni registrations", false, () => getDocs(collection(db, "alumni_registrations")));
await expect("list contact messages", false, () => getDocs(collection(db, "contact_messages")));
await expect("list newsletter subscribers", false, () => getDocs(collection(db, "newsletter_subscribers")));
await expect("list admins", false, () => getDocs(collection(db, "admins")));
await expect("write an event", false, () =>
  addDoc(collection(db, "event_logs"), { title: "x", type: "workshop", startsAt: "2026-01-01T00:00:00+06:00", venue: "x", featured: false, published: true }));
await expect("alumni with status approved", false, () =>
  addDoc(collection(db, "alumni_registrations"), { ...goodAlumni(), status: "approved" }));
await expect("alumni with an extra field", false, () =>
  addDoc(collection(db, "alumni_registrations"), { ...goodAlumni(), isAdmin: true }));
await expect("alumni with an unknown interest", false, () =>
  addDoc(collection(db, "alumni_registrations"), { ...goodAlumni(), interests: ["hacking"] }));
await expect("alumni with graduationYear as text", false, () =>
  addDoc(collection(db, "alumni_registrations"), { ...goodAlumni(), graduationYear: "2020" }));
await expect("contact message with bad topic", false, () =>
  addDoc(collection(db, "contact_messages"), { name: "x", email: "a@b.co", topic: "membership", message: "x", status: "new", createdAt: serverTimestamp() }));
if (doWrite) {
  await expect("valid alumni registration (creates a test document)", true, () =>
    addDoc(collection(db, "alumni_registrations"), goodAlumni()));
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
