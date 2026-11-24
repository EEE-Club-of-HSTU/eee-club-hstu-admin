import { collection, doc, getDocs, limit, query, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { createCertificateIfAbsent } from "./certificates";

/** Seeds sample events, notices, and certificates only when all three collections are empty. */
export async function loadDemoContent(): Promise<void> {
  const [eventsCheck, noticesCheck, certsCheck] = await Promise.all([
    getDocs(query(collection(db, "event_logs"), limit(1))),
    getDocs(query(collection(db, "notices"), limit(1))),
    getDocs(query(collection(db, "certificates"), limit(1))),
  ]);

  if (!eventsCheck.empty || !noticesCheck.empty || !certsCheck.empty) {
    throw new Error(
      "Demo content was not loaded because events, notices, or certificates already contain data."
    );
  }

  const now = Date.now();
  const batch = writeBatch(db);

  const demoEvents = [
    {
      title: "Embedded Bootcamp",
      type: "workshop",
      startsAt: "2026-11-14T10:00:00+06:00",
      endsAt: "2026-11-14T16:30:00+06:00",
      venue: "EEE Microprocessor Lab, HSTU",
      summary:
        "Hands-on microcontroller programming session covering GPIO, interrupts, PWM, and sensor interfacing with ESP32 and STM32.",
      featured: true,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Volt Rush 2026",
      type: "competition",
      startsAt: "2026-11-22T09:00:00+06:00",
      endsAt: "2026-11-22T18:00:00+06:00",
      venue: "TSC Auditorium, HSTU",
      summary:
        "Annual inter-university robotics and hardware showcase featuring Line Follower, Robo Soccer, and Project Exhibition tracks.",
      link: "event.html",
      featured: false,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Grid of Tomorrow",
      type: "seminar",
      startsAt: "2026-12-03T15:00:00+06:00",
      endsAt: "2026-12-03T17:00:00+06:00",
      venue: "Engineering Gallery 2, HSTU",
      summary:
        "Technical seminar on smart grid protection, renewable integration, and power system stability in Bangladesh.",
      featured: false,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "PCB Design Clinic with KiCad 9",
      type: "workshop",
      startsAt: "2026-12-18T14:00:00+06:00",
      endsAt: "2026-12-18T17:30:00+06:00",
      venue: "EEE Simulation Lab, HSTU",
      summary:
        "Schematic capture, multi-layer routing, design rule checks, and Gerber generation using KiCad 9.",
      featured: false,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Field Trip: Barapukuria Power Station",
      type: "trip",
      startsAt: "2026-12-27T07:00:00+06:00",
      endsAt: "2026-12-27T17:00:00+06:00",
      venue: "Barapukuria, Parbatipur, Dinajpur",
      summary:
        "Industrial study tour for EEE undergraduates to observe thermal power generation, substation switchgear, and control rooms.",
      featured: false,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Volt Rush 2025",
      type: "competition",
      startsAt: "2025-11-23T09:00:00+06:00",
      endsAt: "2025-11-23T18:00:00+06:00",
      venue: "HSTU Central Auditorium",
      summary:
        "Flagship annual EEE Club robotics and circuit challenge with teams from northern Bangladesh universities.",
      featured: false,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const ev of demoEvents) {
    batch.set(doc(collection(db, "event_logs")), ev);
  }

  const demoNotices = [
    {
      title: "EEE Alumni Association registration is open",
      body: "Graduates of the Department of Electrical & Electronic Engineering, HSTU can now submit their details to join the official EEE Alumni Association directory and mentoring network.",
      category: "alumni",
      noticeDate: "2026-11-01",
      pinned: true,
      link: "alumni.html",
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Team slots open for Volt Rush 2026",
      body: "Registration is open for Line Follower Robot and Hardware Project Showcase tracks. Check the event page for rulebooks and arena specifications.",
      category: "events",
      noticeDate: "2026-11-10",
      pinned: false,
      link: "event.html",
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "EEE Club Robotics Lab open hours updated",
      body: "The club hardware bench and oscilloscope stations are open Sunday through Thursday from 2:00 PM to 6:00 PM for active project teams.",
      category: "lab",
      noticeDate: "2026-11-06",
      pinned: false,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Call for articles: Impulse Technical Bulletin",
      body: "EEE students and alumni are invited to submit short technical notes, circuit teardowns, and research summaries for the upcoming club bulletin.",
      category: "publication",
      noticeDate: "2026-10-28",
      pinned: false,
      published: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const notice of demoNotices) {
    batch.set(doc(collection(db, "notices")), notice);
  }

  await batch.commit();

  const demoCertificates = [
    {
      certId: "EEE-HSTU-2026-0417",
      type: "Certificate of Achievement",
      name: "Nusrat Jahan Mim",
      details: "Champion — Volt Rush 2026, Line follower",
      issuedOn: "2026-11-22",
      status: "valid" as const,
    },
    {
      certId: "EEE-HSTU-2025-0132",
      type: "Certificate of Participation",
      name: "Imran Hossain",
      details: "IoT Hackathon: Smart Campus",
      issuedOn: "2025-08-16",
      status: "valid" as const,
    },
  ];

  for (const cert of demoCertificates) {
    await createCertificateIfAbsent(cert.certId, {
      type: cert.type,
      name: cert.name,
      details: cert.details,
      issuedOn: cert.issuedOn,
      status: cert.status,
      createdAt: now,
      updatedAt: now,
    });
  }
}
