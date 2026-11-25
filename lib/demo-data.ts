import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { createCertificateIfAbsent } from "./certificates";
import type {
  BlogTag,
  EventType,
  LeadershipCategory,
  MagazineTocEntry,
  NoticeCategory,
  ResourceKind,
} from "./types";

export interface SeedResultItem {
  key: string;
  label: string;
  status: "added" | "skipped" | "error";
  count: number;
  /** Set when status is "error". */
  message?: string;
}

const STM32_MARKDOWN = `Most of us meet microcontrollers through a library: call \`HAL_GPIO_TogglePin()\`, watch an LED blink, move on. It works — until something doesn’t, and you realise you have no idea what that function actually did. This tutorial strips the library away. By the end you’ll blink an LED on an STM32F4 by writing to the chip’s registers yourself.

## 1. Every peripheral is just memory

On an ARM Cortex-M chip, peripherals like GPIO ports live at fixed memory addresses. Writing a value to one of those addresses doesn’t store data — it flips real hardware. The reference manual (RM0090 for the F4 family) lists every one of them. GPIO port A starts at \`0x40020000\`; its output data register sits \`0x14\` bytes later.

## 2. Turn the clock on first

Peripherals are switched off at reset to save power. Before GPIOA will respond, you enable its clock in the RCC (reset and clock control) block. Forgetting this step is the single most common reason a first bare-metal program “does nothing”.

\`\`\`c
#define RCC_AHB1ENR  (*(volatile unsigned int *)0x40023830)
#define GPIOA_MODER  (*(volatile unsigned int *)0x40020000)
#define GPIOA_ODR    (*(volatile unsigned int *)0x40020014)

RCC_AHB1ENR |= (1 << 0);        // enable GPIOA clock
\`\`\`

## 3. Make the pin an output

Each pin gets two bits in \`MODER\`. \`01\` means general-purpose output. The on-board LED of a Nucleo-F401 is on PA5, so we clear bits 11:10 and set bit 10.

\`\`\`c
GPIOA_MODER &= ~(3u << (5 * 2));
GPIOA_MODER |=  (1u << (5 * 2));
\`\`\`

## 4. Blink

Toggling bit 5 of the output data register turns the LED on and off. A crude busy-wait loop is enough for now — we’ll replace it with the SysTick timer next week.

\`\`\`c
while (1) {
    GPIOA_ODR ^= (1u << 5);
    for (volatile int i = 0; i < 400000; i++) { }
}
\`\`\`

> The HAL isn’t magic. It’s these same three register writes, wrapped in a lot of good manners.

## Why bother?

Because the next time an interrupt doesn’t fire or a UART prints garbage, you’ll know where to look. Bare-metal knowledge is what lets you debug the abstractions instead of being stuck behind them. Bring your Nucleo board to the Embedded Bootcamp on 14 November and we’ll go further: timers, interrupts and a UART driver.`;

const CONSTITUTION_MARKDOWN = `Version 3.1 · Ratified at the Annual General Meeting, 12 October 2025 · 11 articles

## Summary

The club is a non-political, non-profit student organisation of the Department of EEE, HSTU. Every enrolled EEE student is a member automatically. The Executive Committee is elected each year; the Chairman of the department serves as President.

- **Version:** 3.1
- **Ratified:** 12 Oct 2025
- **Amendments:** 2 / 3 AGM vote

## Article 1 — Name & identity

The organisation shall be called the “EEE Club of HSTU”. It operates under the Department of Electrical & Electronic Engineering, Hajee Mohammad Danesh Science and Technology University, Dinajpur. Its motto is “Join the Innovation”.

## Article 2 — Aims & objectives

To promote practical engineering skills, research culture and professional growth among students; to organise workshops, competitions, seminars and outreach; and to build lasting links between students, alumni, faculty and industry.

## Article 3 — Membership

Every enrolled student of the Department of EEE is automatically a General Member for as long as they are enrolled. No registration or fee is required. Students of other departments may attend selected events as guests.

## Article 4 — Rights & duties of members

Members may attend all club events, vote at the AGM and stand for election after one completed session. Members are expected to follow lab safety rules, respect fellow members and represent the club with integrity.

## Article 5 — Executive Committee

The Executive Committee consists of the President (the Chairman of the department), a Vice President, General Secretary, Treasurer, Organizing Secretary and one Head for each wing. It meets at least twice a month during the academic session.

## Article 6 — Elections

Elections are held every October. Candidates must be General Members in good standing. Voting is by secret ballot supervised by an Election Commission of two faculty advisors. A simple majority wins.

## Article 7 — Wings

The club runs six wings: Robotics & Automation, Power & Energy, Embedded & IoT, VLSI & Electronics, Signal & Comms, and Research & Career. New wings may be created by a two-thirds vote of the Executive Committee.

## Article 8 — Advisory panel

Faculty members of the Department of EEE form the Advisory Panel. They guide the club’s academic direction, approve major events and mentor the wings.

## Article 9 — Finance

Funds come from department support, sponsorship, alumni donations and event income. The Treasurer keeps open accounts, reviewed every semester by an advisor and published to members at the AGM.

## Article 10 — Amendments

This constitution may be amended by a two-thirds majority of members present at an AGM or a Special General Meeting, with at least 14 days’ notice of the proposed change.

## Article 11 — Alumni Association

Graduates of the Department of EEE may register with the EEE Alumni Association. Registrations are verified by the Executive Committee. Alumni may mentor students, speak at events, offer internships and support the club, but do not vote at the AGM.`;

/** Seeds each supported collection/document independently only if it is currently empty. */
export async function loadDemoContent(): Promise<SeedResultItem[]> {
  const [
    eventsCheck,
    noticesCheck,
    certsCheck,
    leadershipCheck,
    blogsCheck,
    magazinesCheck,
    resourcesCheck,
    faqsCheck,
    constitutionSnap,
  ] = await Promise.all([
    getDocs(query(collection(db, "event_logs"), limit(1))),
    getDocs(query(collection(db, "notices"), limit(1))),
    getDocs(query(collection(db, "certificates"), limit(1))),
    getDocs(query(collection(db, "leadership_members"), limit(1))),
    getDocs(query(collection(db, "blogs"), limit(1))),
    getDocs(query(collection(db, "magazines"), limit(1))),
    getDocs(query(collection(db, "resources"), limit(1))),
    getDocs(query(collection(db, "faqs"), limit(1))),
    getDoc(doc(db, "pages_static", "constitution")),
  ]);

  const now = Date.now();
  const results: SeedResultItem[] = [];
  // Documents to write, grouped per collection; each collection is committed on its own below.
  const pending = new Map<string, Record<string, unknown>[]>();
  const queue = (name: string, data: Record<string, unknown>) => {
    const list = pending.get(name) ?? [];
    list.push(data);
    pending.set(name, list);
  };

  // 1. event_logs
  const demoEvents: Array<{
    title: string;
    type: EventType;
    startsAt: string;
    endsAt?: string;
    venue: string;
    summary: string;
    link?: string;
    featured: boolean;
    published: boolean;
  }> = [
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
    },
  ];

  if (eventsCheck.empty) {
    for (const ev of demoEvents) {
      queue("event_logs", {
        ...ev,
        createdAt: now,
        updatedAt: now,
      });
    }
    results.push({
      key: "event_logs",
      label: "Events",
      status: "added",
      count: demoEvents.length,
    });
  } else {
    results.push({
      key: "event_logs",
      label: "Events",
      status: "skipped",
      count: 0,
    });
  }

  // 2. notices
  const demoNotices: Array<{
    title: string;
    body: string;
    category: NoticeCategory;
    noticeDate: string;
    pinned: boolean;
    link?: string;
    published: boolean;
  }> = [
    {
      title: "EEE Alumni Association registration is open",
      body: "Graduates of the Department of Electrical & Electronic Engineering, HSTU can now submit their details to join the official EEE Alumni Association directory and mentoring network.",
      category: "alumni",
      noticeDate: "2026-11-01",
      pinned: true,
      link: "alumni.html",
      published: true,
    },
    {
      title: "Team slots open for Volt Rush 2026",
      body: "Registration is open for Line Follower Robot and Hardware Project Showcase tracks. Check the event page for rulebooks and arena specifications.",
      category: "events",
      noticeDate: "2026-11-10",
      pinned: false,
      link: "event.html",
      published: true,
    },
    {
      title: "EEE Club Robotics Lab open hours updated",
      body: "The club hardware bench and oscilloscope stations are open Sunday through Thursday from 2:00 PM to 6:00 PM for active project teams.",
      category: "lab",
      noticeDate: "2026-11-06",
      pinned: false,
      published: true,
    },
    {
      title: "Call for articles: Impulse Technical Bulletin",
      body: "EEE students and alumni are invited to submit short technical notes, circuit teardowns, and research summaries for the upcoming club bulletin.",
      category: "publication",
      noticeDate: "2026-10-28",
      pinned: false,
      published: true,
    },
  ];

  if (noticesCheck.empty) {
    for (const notice of demoNotices) {
      queue("notices", {
        ...notice,
        createdAt: now,
        updatedAt: now,
      });
    }
    results.push({
      key: "notices",
      label: "Notices",
      status: "added",
      count: demoNotices.length,
    });
  } else {
    results.push({
      key: "notices",
      label: "Notices",
      status: "skipped",
      count: 0,
    });
  }

  // 3. leadership_members (from ech/leadership.html and ech/advisory.html)
  const demoLeadership: Array<{
    name: string;
    role: string;
    category: LeadershipCategory;
    subtitle?: string;
    session?: string;
    photoUrl?: string;
    order: number;
  }> = [
    // Executive (2026-27)
    {
      name: "Prof. Dr. Md. Zamil Sultan",
      role: "President",
      category: "executive",
      subtitle: "Chairman, Department of EEE",
      session: "2026-27",
      photoUrl: "assets/advisory/19.jpg",
      order: 0,
    },
    {
      name: "Rashedul Islam Rony",
      role: "Vice President",
      category: "executive",
      subtitle: "EEE Club of HSTU",
      session: "2026-27",
      order: 1,
    },
    {
      name: "Tanvir Ahmed",
      role: "General Secretary",
      category: "executive",
      subtitle: "Level 4 · Semester 1",
      session: "2026-27",
      order: 2,
    },
    {
      name: "Nusrat Jahan Mim",
      role: "Treasurer",
      category: "executive",
      subtitle: "Level 3 · Semester 2",
      session: "2026-27",
      order: 3,
    },
    {
      name: "Sabbir Hossain",
      role: "Organizing Secretary",
      category: "executive",
      subtitle: "Level 3 · Semester 2",
      session: "2026-27",
      order: 4,
    },
    {
      name: "Arif Mahmud",
      role: "Head · Robotics",
      category: "executive",
      subtitle: "Level 4 · Semester 1",
      session: "2026-27",
      order: 5,
    },
    {
      name: "Farhana Akter",
      role: "Head · Power & Energy",
      category: "executive",
      subtitle: "Level 3 · Semester 1",
      session: "2026-27",
      order: 6,
    },
    {
      name: "Mehedi Hasan",
      role: "Head · Media & Design",
      category: "executive",
      subtitle: "Level 2 · Semester 2",
      session: "2026-27",
      order: 7,
    },
    // Alumni
    {
      name: "Shamim Reza",
      role: "Founding President",
      category: "alumni",
      subtitle: "Batch 2013 · Power systems engineer",
      order: 0,
    },
    {
      name: "Lamia Khatun",
      role: "Former GS",
      category: "alumni",
      subtitle: "Batch 2015 · Embedded firmware",
      order: 1,
    },
    {
      name: "Rakibul Islam",
      role: "Volt Rush founder",
      category: "alumni",
      subtitle: "Batch 2016 · Robotics researcher",
      order: 2,
    },
    {
      name: "Tasnim Sultana",
      role: "Pulse founding editor",
      category: "alumni",
      subtitle: "Batch 2018 · Telecom engineer",
      order: 3,
    },
    {
      name: "Kamrul Hasan",
      role: "Former President",
      category: "alumni",
      subtitle: "Batch 2019 · VLSI design",
      order: 4,
    },
    {
      name: "Priya Barman",
      role: "Former Treasurer",
      category: "alumni",
      subtitle: "Batch 2020 · Grad student",
      order: 5,
    },
    // Advisory (from advisory.html, Chairman order 0)
    {
      name: "Prof. Dr. Md. Zamil Sultan",
      role: "Chairman · President of the club",
      category: "advisory",
      subtitle: "Professor & Chairman, Department of EEE, HSTU",
      photoUrl: "assets/advisory/19.jpg",
      order: 0,
    },
    {
      name: "Dr. Md. Faruk Kibria",
      role: "Professor",
      category: "advisory",
      photoUrl: "assets/advisory/21.jpg",
      order: 1,
    },
    {
      name: "Md. Mizanur Rahman",
      role: "Associate Professor",
      category: "advisory",
      photoUrl: "assets/advisory/22.jpg",
      order: 2,
    },
    {
      name: "Md. Safiqul Islam",
      role: "Assistant Professor",
      category: "advisory",
      photoUrl: "assets/advisory/20.jpg",
      order: 3,
    },
    {
      name: "Md. Ferdous Wahid",
      role: "Assistant Professor",
      category: "advisory",
      photoUrl: "assets/advisory/23.jpg",
      order: 4,
    },
    {
      name: "Md. Ilius Hasan Pathan",
      role: "Assistant Professor",
      category: "advisory",
      photoUrl: "assets/advisory/332.jpg",
      order: 5,
    },
    {
      name: "Rony Tota",
      role: "Assistant Professor",
      category: "advisory",
      photoUrl: "assets/advisory/333.jpg",
      order: 6,
    },
    {
      name: "Md. Hassanul Karim Roni",
      role: "Assistant Professor",
      category: "advisory",
      photoUrl: "assets/advisory/350.jpg",
      order: 7,
    },
    {
      name: "Md. Sazedur Rahman",
      role: "Assistant Professor",
      category: "advisory",
      photoUrl: "assets/advisory/351.jpg",
      order: 8,
    },
    {
      name: "Md. Motiur Rahman Tareq",
      role: "Assistant Professor",
      category: "advisory",
      photoUrl: "assets/advisory/352.jpg",
      order: 9,
    },
    // Taskforce (2026-27)
    {
      name: "Imran Hossain",
      role: "Event operations",
      category: "taskforce",
      subtitle: "Level 2",
      session: "2026-27",
      order: 0,
    },
    {
      name: "Sumaiya Akter",
      role: "Registration desk",
      category: "taskforce",
      subtitle: "Level 2",
      session: "2026-27",
      order: 1,
    },
    {
      name: "Rifat Hasan",
      role: "Lab logistics",
      category: "taskforce",
      subtitle: "Level 3",
      session: "2026-27",
      order: 2,
    },
    {
      name: "Jannatul Ferdous",
      role: "Social media",
      category: "taskforce",
      subtitle: "Level 1",
      session: "2026-27",
      order: 3,
    },
    {
      name: "Nayeem Islam",
      role: "Photography",
      category: "taskforce",
      subtitle: "Level 2",
      session: "2026-27",
      order: 4,
    },
    {
      name: "Mahfuz Rahman",
      role: "Web & tech",
      category: "taskforce",
      subtitle: "Level 3",
      session: "2026-27",
      order: 5,
    },
  ];

  if (leadershipCheck.empty) {
    for (const member of demoLeadership) {
      queue("leadership_members", {
        ...member,
        published: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    results.push({
      key: "leadership_members",
      label: "Leadership",
      status: "added",
      count: demoLeadership.length,
    });
  } else {
    results.push({
      key: "leadership_members",
      label: "Leadership",
      status: "skipped",
      count: 0,
    });
  }

  // 4. blogs (from ech/blog.html and ech/post.html)
  const demoBlogs: Array<{
    title: string;
    excerpt: string;
    content: string;
    author: string;
    authorRole: string;
    tag: BlogTag;
    readMinutes: number;
    publishedOn: string;
    featured: boolean;
    published: boolean;
  }> = [
    {
      title: "Writing your first bare-metal driver for STM32 — no HAL, no fear",
      excerpt:
        "Registers, clocks and a blinking LED: what actually happens between main() and the pin.",
      content: STM32_MARKDOWN,
      author: "Arif Mahmud",
      authorRole: "Head · Robotics",
      tag: "tutorial",
      readMinutes: Math.max(1, Math.round(STM32_MARKDOWN.split(/\s+/).length / 200)),
      publishedOn: "2026-10-28",
      featured: true,
      published: true,
    },
    {
      title:
        "Inside Circuit Sprint: 24 hours, 41 teams, one very tired soldering iron",
      excerpt:
        "What worked, what melted, and the winning team’s air-quality monitor.",
      content:
        "Forty-one undergraduate teams packed into the EEE Hardware Lab for twenty-four hours of breadboarding, firmware debugging, and soldering.\n\nThe winning build paired an ESP32 node with calibrated particulate and VOC sensors, logging telemetry over MQTT with a battery-backed power rail.",
      author: "Sabbir Hossain",
      authorRole: "Organizing Secretary",
      tag: "recap",
      readMinutes: 5,
      publishedOn: "2026-10-22",
      featured: false,
      published: false,
    },
    {
      title:
        "How our solar micro-grid kept a school lit through monsoon season",
      excerpt:
        "Six months of load data from the Power & Energy wing’s 5 kW installation.",
      content:
        "Over six months of cloud cover and heavy monsoon rain, the Power & Energy wing logged inverter efficiency, battery depth-of-discharge, and feeder voltage across our 5 kW solar micro-grid.\n\nLoad prioritization kept classroom lighting and lab fans online even during three-day overcast stretches.",
      author: "Farhana Akter",
      authorRole: "Head · Power & Energy",
      tag: "research",
      readMinutes: 8,
      publishedOn: "2026-10-15",
      featured: false,
      published: false,
    },
    {
      title:
        "From EEE Club to silicon: three alumni on breaking into chip design",
      excerpt:
        "Advice on courses, tools and the first interview from people who did it.",
      content:
        "Three HSTU EEE graduates working in RTL design and physical verification share how digital logic projects, Verilog testbenches, and timing closure fundamentals helped them land their first semiconductor engineering roles.",
      author: "Kamrul Hasan",
      authorRole: "Alumni · Batch 2019",
      tag: "career",
      readMinutes: 6,
      publishedOn: "2026-10-08",
      featured: false,
      published: false,
    },
    {
      title:
        "Your oscilloscope is lying to you: probes, bandwidth and grounding",
      excerpt:
        "Five measurement mistakes every second-year makes, and how to avoid them.",
      content:
        "Long ground leads add parasitic inductance that rings like crazy on fast SPI edges. Switching to a 10x probe, using a ground spring, and minding your bandwidth limit cleans up the trace before you blame your circuit.",
      author: "Arif Mahmud",
      authorRole: "Head · Robotics",
      tag: "tutorial",
      readMinutes: 10,
      publishedOn: "2026-09-30",
      featured: false,
      published: false,
    },
    {
      title: "KiCad in an afternoon: from schematic to Gerbers",
      excerpt:
        "A guided first PCB — a USB-C powered LED badge you can actually order.",
      content:
        "Starting from a clean two-sheet schematic, we assign footprints, configure 5.1 kΩ CC pulldowns for USB-C power, route differential and power traces cleanly, pass DRC, and export fabrication-ready Gerbers.",
      author: "Mehedi Hasan",
      authorRole: "Head · Media & Design",
      tag: "tutorial",
      readMinutes: 7,
      publishedOn: "2026-09-21",
      featured: false,
      published: false,
    },
    {
      title: "Field notes: a day inside a 132 kV substation",
      excerpt:
        "What the Power wing learned from the protection engineers at the grid substation.",
      content:
        "During our substation visit, protection engineers walked our student group through SF6 circuit breakers, current transformers, distance relays, and SCADA dispatch panels keeping regional feeders synchronized.",
      author: "Farhana Akter",
      authorRole: "Head · Power & Energy",
      tag: "recap",
      readMinutes: 4,
      publishedOn: "2026-09-10",
      featured: false,
      published: false,
    },
  ];

  if (blogsCheck.empty) {
    for (const post of demoBlogs) {
      queue("blogs", {
        ...post,
        createdAt: now,
        updatedAt: now,
      });
    }
    results.push({
      key: "blogs",
      label: "Blog Posts",
      status: "added",
      count: demoBlogs.length,
    });
  } else {
    results.push({
      key: "blogs",
      label: "Blog Posts",
      status: "skipped",
      count: 0,
    });
  }

  // 5. magazines (from ech/magazine.html, issues 01-07)
  const demoMagazines: Array<{
    issueNumber: number;
    title: string;
    season: string;
    summary?: string;
    coverColor: string;
    pages?: number;
    contents?: MagazineTocEntry[];
    published: boolean;
  }> = [
    {
      issueNumber: 7,
      title: "The Grid Issue",
      season: "Winter 2026",
      summary:
        "Written, designed and edited by members since 2021. Issue 07 goes deep on the grid: how it works, why it fails, and what our generation can build.",
      coverColor: "#D7FF3D",
      pages: 56,
      contents: [
        { page: 4, title: "Editor’s note: why the grid?" },
        { page: 10, title: "Load shedding, explained in one diagram" },
        { page: 22, title: "How a smart meter actually measures your power" },
        { page: 34, title: "Build log: our 5 kW solar micro-grid" },
        { page: 48, title: "Crossword: circuits edition" },
      ],
      published: true,
    },
    {
      issueNumber: 6,
      title: "The Chip Issue",
      season: "Summer 2026",
      coverColor: "#4D6BFF",
      pages: 48,
      published: true,
    },
    {
      issueNumber: 5,
      title: "Robots Everywhere",
      season: "Winter 2025",
      coverColor: "#FF5A1F",
      pages: 52,
      published: true,
    },
    {
      issueNumber: 4,
      title: "Signals & Noise",
      season: "Summer 2025",
      coverColor: "#EDECE6",
      pages: 40,
      published: true,
    },
    {
      issueNumber: 3,
      title: "Power to the People",
      season: "2024",
      coverColor: "#181B21",
      pages: 44,
      published: true,
    },
    {
      issueNumber: 2,
      title: "First Light",
      season: "2022",
      coverColor: "#D7FF3D",
      pages: 32,
      published: true,
    },
    {
      issueNumber: 1,
      title: "Hello, World",
      season: "2021",
      coverColor: "#4D6BFF",
      pages: 24,
      published: true,
    },
  ];

  if (magazinesCheck.empty) {
    for (const issue of demoMagazines) {
      queue("magazines", {
        ...issue,
        createdAt: now,
        updatedAt: now,
      });
    }
    results.push({
      key: "magazines",
      label: "Pulse Magazine",
      status: "added",
      count: demoMagazines.length,
    });
  } else {
    results.push({
      key: "magazines",
      label: "Pulse Magazine",
      status: "skipped",
      count: 0,
    });
  }

  // 6. resources (from ech/resources.html, 10 rows)
  const demoResources: Array<{
    title: string;
    kind: ResourceKind;
    course: string;
    fileType: string;
    size: string;
    url: string;
    published: boolean;
  }> = [
    {
      title: "Circuit Analysis II — complete lecture notes",
      kind: "notes",
      course: "EEE 2101",
      fileType: "PDF",
      size: "14 MB",
      url: "https://example.com/resources/circuit-analysis-ii-notes",
      published: false,
    },
    {
      title: "STM32F4 starter kit & peripheral cheatsheet",
      kind: "code",
      course: "EEE 3203",
      fileType: "ZIP",
      size: "2 MB",
      url: "https://example.com/resources/stm32f4-starter-kit",
      published: false,
    },
    {
      title: "Power Systems I lab manual (annotated)",
      kind: "lab",
      course: "EEE 3105",
      fileType: "PDF",
      size: "8 MB",
      url: "https://example.com/resources/power-systems-i-lab-manual",
      published: false,
    },
    {
      title: "Question bank — Level 2 Semester 1 (2019–2025)",
      kind: "exam",
      course: "All",
      fileType: "PDF",
      size: "22 MB",
      url: "https://example.com/resources/question-bank-l2-s1",
      published: false,
    },
    {
      title: "Electromagnetic Fields — solved problems",
      kind: "notes",
      course: "EEE 2203",
      fileType: "PDF",
      size: "11 MB",
      url: "https://example.com/resources/electromagnetic-fields-solved",
      published: false,
    },
    {
      title: "MATLAB scripts for Signals & Systems labs",
      kind: "code",
      course: "EEE 2207",
      fileType: "ZIP",
      size: "640 KB",
      url: "https://example.com/resources/matlab-signals-systems",
      published: false,
    },
    {
      title: "Electronics I lab manual with LTspice files",
      kind: "lab",
      course: "EEE 2102",
      fileType: "ZIP",
      size: "5 MB",
      url: "https://example.com/resources/electronics-i-lab-manual",
      published: false,
    },
    {
      title: "KiCad footprint library — club edition",
      kind: "code",
      course: "Workshop",
      fileType: "ZIP",
      size: "36 MB",
      url: "https://example.com/resources/kicad-footprint-library",
      published: false,
    },
    {
      title: "Question bank — Level 3 Semester 2 (2019–2025)",
      kind: "exam",
      course: "All",
      fileType: "PDF",
      size: "19 MB",
      url: "https://example.com/resources/question-bank-l3-s2",
      published: false,
    },
    {
      title: "Control Systems — Bode & root-locus crash course",
      kind: "notes",
      course: "EEE 3201",
      fileType: "PDF",
      size: "6 MB",
      url: "https://example.com/resources/control-systems-crash-course",
      published: false,
    },
  ];

  if (resourcesCheck.empty) {
    for (const res of demoResources) {
      queue("resources", {
        ...res,
        createdAt: now,
        updatedAt: now,
      });
    }
    results.push({
      key: "resources",
      label: "Resources",
      status: "added",
      count: demoResources.length,
    });
  } else {
    results.push({
      key: "resources",
      label: "Resources",
      status: "skipped",
      count: 0,
    });
  }

  // 7. faqs (from ech/contact.html, plain text)
  const demoFaqs = [
    {
      question: "Who is a member of the EEE Club?",
      answer:
        "Every enrolled student of the Department of EEE at HSTU, from Level 1 to Level 4 and postgraduates, is a member automatically. There’s nothing to sign up for. Students from other departments can attend selected events as guests.",
      order: 0,
    },
    {
      question: "Is there a membership fee?",
      answer:
        "No. Membership is free and automatic. A few events, such as Volt Rush, have a small team registration fee.",
      order: 1,
    },
    {
      question: "I’ve graduated. How do I stay involved?",
      answer:
        "Register with the EEE Alumni Association (alumni.html). Once the committee verifies you, we’ll invite you to mentor, speak and meet current students.",
      order: 2,
    },
    {
      question: "Do I need prior experience?",
      answer:
        "None at all. Every wing runs a beginner track in the first month, and most members built their first circuit with us.",
      order: 3,
    },
    {
      question: "How can a company sponsor an event?",
      answer:
        "Choose “Sponsorship” in the contact form above. We’ll send our sponsorship deck with packages for Volt Rush, workshops and Pulse magazine.",
      order: 4,
    },
    {
      question: "How do I verify my certificate?",
      answer:
        "Enter the ID printed on your certificate on the Verify page (verify.html), or scan its QR code.",
      order: 5,
    },
  ];

  if (faqsCheck.empty) {
    for (const faq of demoFaqs) {
      queue("faqs", {
        ...faq,
        published: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    results.push({
      key: "faqs",
      label: "FAQs",
      status: "added",
      count: demoFaqs.length,
    });
  } else {
    results.push({
      key: "faqs",
      label: "FAQs",
      status: "skipped",
      count: 0,
    });
  }

  // Commit each collection on its own. Re-check it is still empty right before writing,
  // so a second admin seeding at the same time can't duplicate it, and one failing
  // collection doesn't block the others.
  for (const [name, docs] of pending) {
    const item = results.find((r) => r.key === name);
    try {
      const recheck = await getDocs(query(collection(db, name), limit(1)));
      if (!recheck.empty) {
        if (item) Object.assign(item, { status: "skipped", count: 0 });
        continue;
      }
      const batch = writeBatch(db);
      docs.forEach((data) => batch.set(doc(collection(db, name)), data));
      await batch.commit();
    } catch (err) {
      if (item) {
        Object.assign(item, {
          status: "error",
          count: 0,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // 8. certificates (transaction per cert ID)
  try {
  if (certsCheck.empty) {
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
    let addedCerts = 0;
    for (const cert of demoCertificates) {
      const res = await createCertificateIfAbsent(cert.certId, {
        type: cert.type,
        name: cert.name,
        details: cert.details,
        issuedOn: cert.issuedOn,
        status: cert.status,
        createdAt: now,
        updatedAt: now,
      });
      if (res.outcome === "created") addedCerts += 1;
    }
    results.push({
      key: "certificates",
      label: "Certificates",
      status: "added",
      count: addedCerts,
    });
  } else {
    results.push({
      key: "certificates",
      label: "Certificates",
      status: "skipped",
      count: 0,
    });
  }
  } catch (err) {
    results.push({
      key: "certificates",
      label: "Certificates",
      status: "error",
      count: 0,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 9. pages_static/constitution
  try {
  if (!constitutionSnap.exists()) {
    await setDoc(doc(db, "pages_static", "constitution"), {
      title: "Constitution — EEE Club of HSTU",
      content: CONSTITUTION_MARKDOWN,
      updatedAt: now,
    });
    results.push({
      key: "pages_static/constitution",
      label: "Constitution Page",
      status: "added",
      count: 1,
    });
  } else {
    results.push({
      key: "pages_static/constitution",
      label: "Constitution Page",
      status: "skipped",
      count: 0,
    });
  }
  } catch (err) {
    results.push({
      key: "pages_static/constitution",
      label: "Constitution Page",
      status: "error",
      count: 0,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}
