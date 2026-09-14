// ─────────────────────────────────────────────────────────────────────────────
// HELP — the three explainers on Home, in full, and the questions people ring
// the office to ask.
//
// Home carries the short version of each topic on its first pane with a "Read
// more" that opens the help pane at that topic. The long version lives here so
// the two cannot drift: the card's one-liner and the pane's explanation are two
// fields of the same record.
//
// ── WHAT THIS COPY MAY NOT DO ───────────────────────────────────────────────
// Quote a live price. Fees and rates come from the lender's own sheet at the
// moment of applying and are shown, priced, on the loan overview. Copy that says
// "the processing fee is KSh 400" is true until the day Micromart changes it,
// and then it is a promise the app broke. The two figures stated here — the
// KSh 100 bureau fee and the 20% late fee — are stated because the lender's own
// terms state them.
// ─────────────────────────────────────────────────────────────────────────────

export type HelpTopicId = "credit-score" | "limit" | "charges";

export interface HelpTopic {
  id: HelpTopicId;
  /** The Artwork slot the card on Home uses. */
  slot: string;
  motif: 0 | 1 | 2;
  title: string;
  /** One line, for the card on pane one. */
  teaser: string;
  /** The full explanation, one paragraph per entry. */
  body: string[];
  /** Short labelled points under the explanation. */
  points?: { label: string; detail: string }[];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "credit-score",
    slot: "tip-credit-score",
    motif: 0,
    title: "What is a credit score?",
    teaser: "What it measures, and why yours moves every time you repay.",
    body: [
      "Your credit score is a number between 300 and 900 that sums up how likely you are to repay a loan on time. The higher it is, the more a lender can safely offer you.",
      "Before your first loan, the score is built from evidence rather than guesswork: six months of your M-PESA statement, and your record at a licensed credit bureau. After your first loan, the way you repay becomes the strongest part of it.",
      "It is not a judgement of you as a person, and it is not fixed. Every instalment you pay on time pushes it up. A late or missed payment pulls it down. You can always see yours, and the reasons behind it, under Your score.",
    ],
    points: [
      { label: "Raises it", detail: "Instalments paid on or before the due date, loans cleared in full, steady income on your statement." },
      { label: "Lowers it", detail: "Late or missed instalments, heavy borrowing elsewhere, arrears or listings at a credit bureau." },
      { label: "Doesn't touch it", detail: "Checking your own score in this app. Looking is free and never counts against you." },
    ],
  },
  {
    id: "limit",
    slot: "tip-what-moves-limit",
    motif: 1,
    title: "What moves your limit",
    teaser: "The four things we look at, in plain language.",
    body: [
      "Your limit is the most you can borrow at one time. A new customer's starting limit is set from their statement and their credit bureau record, inside the maximum the lender allows.",
      "It is reviewed every time you repay. Nobody sets it by hand, and the reasons for it are shown to you on the same screen as the number.",
    ],
    points: [
      { label: "1. How you repay", detail: "On time, every time, is the single biggest thing that raises a limit. Clearing a loan early helps too." },
      { label: "2. Your cashflow", detail: "Money coming in most months, and money left over after spending, as your M-PESA statement shows it." },
      { label: "3. Your bureau record", detail: "What licensed credit reference bureaus hold about your other loans — open balances, arrears, and listings." },
      { label: "4. Other borrowing and betting", detail: "A statement that leans heavily on other loans or on betting lowers what can be lent safely." },
    ],
  },
  {
    id: "charges",
    slot: "tip-charges",
    motif: 2,
    title: "Understanding the charges",
    teaser: "What you pay, when, and what happens if you are late.",
    body: [
      "Every loan has two kinds of cost: interest, and fees. Both are shown to you, priced at the amount and period you chose, on the loan overview before you apply. Nothing is added after you agree.",
      "Interest is charged per repayment period. A product priced at 8.25% a week costs 8.25% for each week you choose to take: KSh 10,000 over 5 weeks is 41.25% interest, KSh 4,125, so KSh 14,125 in total before fees. Choosing fewer weeks costs less.",
      "Fees are charged in one of three ways, and the overview says which applies to each: paid before the money is sent, deducted from the amount sent, or spread across your instalments.",
    ],
    points: [
      { label: "Credit bureau fee — KSh 100", detail: "Covers the two reports we request from Metropol for your application: the identity report and the standard credit report." },
      { label: "Late payment — 20%", detail: "An instalment not paid on time attracts a late fee of 20% of the overdue amount, never more than the principal due on that instalment." },
      { label: "Paying early", detail: "You may repay the full balance at any time. On a flat-rate loan the interest was fixed when the loan was written." },
    ],
  },
];

export const helpTopic = (id: HelpTopicId) => HELP_TOPICS.find((t) => t.id === id) ?? HELP_TOPICS[0];

export interface Faq {
  q: string;
  a: string;
}

export interface FaqGroup {
  title: string;
  items: Faq[];
}

export const FAQS: FaqGroup[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What do I need to open an account?",
        a: "Your National ID, the phone number registered in your name, and a six-month M-PESA statement. Depending on your lender you may also be asked for a selfie, your location, and a referee.",
      },
      {
        q: "Why do you verify my identity?",
        a: "A licensed lender must know who it lends to. We read your ID, confirm it with the national registry, and match your face to the photo on the card. Every customer goes through the same checks — there is no shorter version.",
      },
      {
        q: "My ID check says a person is reviewing it. What now?",
        a: "Your lender signs off every new customer's identity before money moves. You can carry on reading your statement meanwhile. We message you the moment it clears.",
      },
    ],
  },
  {
    title: "Your statement",
    items: [
      {
        q: "How do I get my M-PESA statement?",
        a: "Dial *334#, choose My Account, then M-PESA Statement, Request Statement, Full Statement, and Last 6 months. Safaricom emails a locked PDF and texts you the password.",
      },
      {
        q: "Is my statement safe?",
        a: "It is read on our servers to work out what you can comfortably afford, and the reading is kept as a score and a summary. It is never shared.",
      },
      {
        q: "It says the statement is in someone else's name.",
        a: "A statement can only score the person named on it. Upload your own, or — if it is yours under a different registered name — raise it with our team from that screen and a person will look at it.",
      },
    ],
  },
  {
    title: "Borrowing",
    items: [
      {
        q: "Which products can I choose?",
        a: "Products open up with your limit. A smaller starting limit opens the entry product; once your limit reaches a product's minimum, it unlocks. Locked products are shown with the reason, so you know what to aim for.",
      },
      {
        q: "Can I choose how long to repay?",
        a: "Yes. On weekly products you choose the number of weeks, up to the product's maximum, and the interest is priced for exactly that many weeks. You can also move amounts between instalments, as long as the total stays the same.",
      },
      {
        q: "What happens after I apply?",
        a: "Your application goes to the lender's Risk team first, then Finance, and then the money is sent to your M-PESA. You can follow every stage under Application, and message the team at any point.",
      },
      {
        q: "Why is there a KSh 100 CRB fee?",
        a: "It pays for the two credit reports requested from Metropol for your application — the identity report and the standard report.",
      },
    ],
  },
  {
    title: "Repaying",
    items: [
      {
        q: "How do I repay?",
        a: "Use Pay now in the app to get an M-PESA prompt, or pay through your lender's paybill. Money goes to your loan first; anything left over goes to your savings.",
      },
      {
        q: "What if I will be late?",
        a: "Message us before the due date. A late instalment attracts a 20% late fee on the overdue amount and lowers your score, and talking to us early is always better than missing a payment.",
      },
    ],
  },
];
