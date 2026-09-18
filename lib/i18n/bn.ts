/**
 * Every patient-facing string. Nothing here addresses a patient by name.
 * Functions take already-formatted Bangla fragments (dates, times, numbers)
 * from lib/i18n/format.ts.
 */
export const bn = {
  doctorName: "ডাঃ খালেদ নূর জিহাদ",
  header: "ডাঃ খালেদ নূর জিহাদ — অনলাইন কনসালটেশন",
  greeting: "প্রিয় রোগী,",

  // Step 1: dates
  pickDate: "তারিখ নির্বাচন করুন",
  pickDateHelp: "যে দিন কথা বলতে চান সেই তারিখে চাপ দিন।",
  noDates: "এখন কোনো তারিখ খালি নেই",
  noDatesHelp: "কিছুদিন পরে আবার দেখুন।",
  bookingClosed: "অনলাইন বুকিং এখন বন্ধ আছে।",
  callWindow: (start: string, end: string) => `কল করা হবে ${start} - ${end} এর মধ্যে`,
  chipWindow: (start: string, end: string) => `${start} - ${end}`,
  remaining: (n: string) => `${n}টি খালি`,

  // Step 2: details
  yourDetails: "আপনার তথ্য",
  selectedDate: "নির্বাচিত তারিখ",
  changeDate: "তারিখ বদলান",
  name: "নাম",
  whatsapp: "হোয়াটসঅ্যাপ নম্বর (এই নম্বরে কল করা হবে)",
  phonePlaceholder: "01XXXXXXXXX",
  next: "পরবর্তী",
  back: "পিছনে",

  // Step 3: payment
  payHeading: "পেমেন্ট করুন",
  payInstructionBefore: "নিচের নম্বরে",
  payInstructionMiddle: "টাকা বিকাশে",
  payInstructionAfter: "করুন",
  sendMoney: "Send Money",
  bkashNumber: "বিকাশ নম্বর",
  amount: "টাকার পরিমাণ",
  taka: (n: string) => `${n} টাকা`,
  copy: "কপি করুন",
  copied: "কপি হয়েছে",
  countdown: "বাকি সময়:",
  countdownHelp: "এই সময়ের মধ্যে পেমেন্ট করে নিচের বাটনে চাপ দিন।",
  paid: "আমি পেমেন্ট করেছি",
  holdExpired: "সময় শেষ হয়ে গেছে। অনুগ্রহ করে আবার বুক করুন।",
  bookAgain: "আবার বুক করুন",

  // Step 4: proof
  proofHeading: "পেমেন্টের তথ্য দিন",
  proofHelp: "যেকোনো একটি দিলেই হবে।",
  trxId: "ট্রানজেকশন আইডি (TrxID)",
  trxHelp: "বিকাশ মেসেজে ১০ অক্ষরের আইডি",
  or: "অথবা",
  senderNumber: "যে নম্বর থেকে টাকা পাঠিয়েছেন",
  submit: "জমা দিন",

  // Step 5: done
  doneHeading: "আপনার বুকিং গৃহীত হয়েছে।",
  serial: "সিরিয়াল নং",
  doneCall: (date: string, start: string, end: string) =>
    `${date} তারিখ ${start} - ${end} এর মধ্যে কল করা হবে।`,
  doneSms: "পেমেন্ট যাচাইয়ের পর এসএমএস পাঠানো হবে।",
  doneKeep: "এই পাতাটির ছবি তুলে রাখুন।",

  // Shared states
  dayFull: "দুঃখিত, এই দিনের সব সিরিয়াল পূর্ণ হয়ে গেছে",
  expiredLink: "এই লিংকের মেয়াদ শেষ হয়েছে।",
  alreadyBooked: "এই তারিখে আপনার একটি বুকিং আগে থেকেই আছে।",
  dayCancelled: "দুঃখিত, এই তারিখে ডাক্তার বসবেন না।",
  contactClinic: "প্রয়োজনে চেম্বারে যোগাযোগ করুন।",

  errors: {
    name: "আপনার নাম লিখুন।",
    phone: "সঠিক মোবাইল নম্বর লিখুন (১১ সংখ্যা)।",
    date: "তারিখ নির্বাচন করুন।",
    full: "দুঃখিত, এই দিনের সব সিরিয়াল পূর্ণ হয়ে গেছে।",
    closed: "এই তারিখে বুকিং নেওয়া হচ্ছে না।",
    trx: "সঠিক ট্রানজেকশন আইডি লিখুন (১০ অক্ষর)।",
    trxUsed: "এই ট্রানজেকশন আইডি আগে ব্যবহার হয়েছে।",
    sender: "সঠিক মোবাইল নম্বর লিখুন।",
    proofRequired: "ট্রানজেকশন আইডি অথবা মোবাইল নম্বর দিন।",
    generic: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।",
  },

  // Flow B: follow-up
  followup: {
    heading: "আপনার ফলোআপ",
    line: (date: string) => `${date} তারিখে আপনার ফলোআপ।`,
    invite: "অনলাইনে (ভিডিও) কনসালটেশন করতে চাইলে নিচের বাটনে চাপ দিন।",
    chamberNote: "চেম্বারে সরাসরি আসতে চাইলে কিছু করার দরকার নেই।",
    button: "অনলাইনে কনসালটেশন করব",
    otherDay: "অন্য দিন বেছে নিন",
    keepDate: "আগের তারিখেই থাকুক",
    pickHeading: "নতুন দিন বেছে নিন",
    overdue: (date: string) =>
      `${date} তারিখের ফলোআপ পার হয়ে গেছে। চেম্বারে সরাসরি আসতে পারেন; অনলাইনে (ভিডিও) করতে চাইলে নিচে থেকে একটি দিন বেছে নিন।`,
    changeHelp: "যে দিন কথা বলতে চান সেই তারিখে চাপ দিন।",
    lostHeading: "ফলোআপ লিংক",
    lostIntro: "আপনার মোবাইল নম্বর দিন। ফলোআপ থাকলে এসএমএসে লিংক পাঠানো হবে।",
    phone: "মোবাইল নম্বর",
    send: "লিংক পাঠান",
    sentMessage: "যদি এই নম্বরটি নিবন্ধিত থাকে, আমরা একটি লিংক পাঠিয়েছি।",
  },

  // Shell: header, steps, footer
  clinicSubtitle: "ডায়াবেটিস ও হরমোন রোগ বিশেষজ্ঞ",
  steps: ["তারিখ", "তথ্য", "পেমেন্ট", "নিশ্চিত"],
  stepOf: (n: string, total: string) => `ধাপ ${n} / ${total}`,
  footerContact: "যোগাযোগ",
  footerWhatsApp: "হোয়াটসঅ্যাপ",
  footerHelp: "সমস্যা হলে এই নম্বরে মেসেজ দিন।",
  tapToBook: "বুক করতে চাপ দিন",

  // Payment help
  payStepsHeading: "কীভাবে পাঠাবেন",
  paySteps: [
    "বিকাশ অ্যাপ খুলুন, অথবা *247# ডায়াল করুন",
    "Send Money বেছে নিন",
    "উপরের নম্বর ও টাকার পরিমাণ দিন",
    "পাঠানো হলে মেসেজের TrxID টি রেখে দিন",
  ],

  // Cancellation SMS the doctor sends from the schedule
  smsDayCancelled: (date: string) =>
    `প্রিয় রোগী, দুঃখিত, ${date} তারিখে ডাক্তার বসবেন না। নতুন তারিখ জানানো হবে।`,

  loading: "লোড হচ্ছে…",
  errorHeading: "দুঃখিত, কিছু একটা ভুল হয়েছে।",
  errorBody: "একটু পরে আবার চেষ্টা করুন।",
  tryAgain: "আবার চেষ্টা করুন",
  notFoundHeading: "এই পাতাটি পাওয়া যায়নি।",
  goToBooking: "বুকিং পাতায় যান",

  weekdays: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
  monthsShort: ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"],
} as const;
