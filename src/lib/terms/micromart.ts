// ─────────────────────────────────────────────────────────────────────────────
// MICROMART AFRICA — THE LOAN TERMS, VERBATIM.
//
// Supplied by Micromart and reproduced word for word. Nothing here is
// paraphrased, reordered or "tidied": a customer accepts THIS text, the
// application records THIS version, and a dispute is argued over THESE words.
// Change the text and you must change the version, or somebody will have agreed
// to a document that no longer exists.
//
// The version is sent with every application and must match TERMS_VERSION in
// connected-suite/src/lib/portal/terms-grants.ts, which turns acceptance of
// THIS version into the customer's recorded consents.
//
// ── WHAT THE VERSION COVERS ─────────────────────────────────────────────────
// The document as presented: Micromart's sections 1–11 below, then section 12
// (the consents a loan rests on — ours, not Micromart's, see consents.ts), then
// Micromart's closing CRB paragraph. "micromart-terms-2026-09" was the same
// text without section 12, when the closing paragraph carried its own tick.
// ─────────────────────────────────────────────────────────────────────────────

export const MICROMART_TERMS_VERSION = "micromart-terms-2026-09-22";

export const MICROMART_TERMS_TITLE = "MICROMART AFRICA TERMS AND CONDITIONS";

export type TermsBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] };

export interface TermsSection {
  heading: string;
  blocks: TermsBlock[];
}

export const MICROMART_TERMS: TermsSection[] = [
  {
    heading: "1. Repayment Terms",
    blocks: [
      { kind: "p", text: "Loans shall be repaid as per the agreed loan terms or scheduled installments without any delayed payment." },
    ],
  },
  {
    heading: "2. Prepayment",
    blocks: [
      {
        kind: "p",
        text: "The Borrower has the right to prepay the full outstanding amount at any time. If the Borrower does so, or if the loan is restructured (i.e., replaced by a new facility), the new loan installment will be recalculated accordingly.",
      },
    ],
  },
  {
    heading: "3. Late Payment Charges",
    blocks: [
      {
        kind: "p",
        text: "Any installment not paid within the specified time of its due date shall attract a late fee of 20% on the overdue amount, not to exceed the outstanding principal due for such installment.",
      },
    ],
  },
  {
    heading: "4. Default",
    blocks: [
      {
        kind: "p",
        text: "If the Borrower fails to make any payment on time, the Borrower will be in default. The Lender may then demand immediate repayment of the entire remaining unpaid balance without further notice. If the loan is not settled in full upon the final due date, the Lender reserves the right to impound and auction the pledged security through a private process.",
      },
    ],
  },
  {
    heading: "5. Right of Offset",
    blocks: [
      {
        kind: "p",
        text: "In the event of loan delinquency, the Lender may recover the amount from any security or account held by the Borrower without prior notice. Extension of repayment time does not affect the Borrower's obligation to repay the full loan.",
      },
    ],
  },
  {
    heading: "6. Collection Fees",
    blocks: [
      {
        kind: "p",
        text: "If this agreement is referred to an attorney or collection agents assigned for collection, the Borrower agrees to pay legal fees as provided under the Advocates Remuneration Act or as advised by the attorney or collection agent. These fees will be added to the outstanding loan balance.",
      },
    ],
  },
  {
    heading: "7. Notice to Borrow",
    blocks: [
      {
        kind: "p",
        text: "This agreement shall serve as the Borrower's formal request to borrow and an agreement to any future loan continuations.",
      },
    ],
  },
  {
    heading: "8. Borrower Instructions and Authorizations",
    blocks: [
      {
        kind: "list",
        items: [
          "The Borrower irrevocably authorizes the Lender to act on all requests submitted through the system.",
          "The Lender may decline any request at its sole discretion.",
          "The Lender may request additional verification before proceeding.",
          "The Borrower shall not hold the Lender liable for unauthorized access or use of their credentials, unless due to gross negligence by the Lender.",
          "The Lender is authorized to act in accordance with any lawful order or directive.",
        ],
      },
    ],
  },
  {
    heading: "9. Loan Disbursement",
    blocks: [
      {
        kind: "list",
        items: [
          "The approved loan amount shall be credited to the Borrower's designated account.",
          "Disbursed amounts may be net of any applicable fees or interest.",
          "Funds shall be considered disbursed once transferred to the Borrower's account.",
        ],
      },
    ],
  },
  {
    heading: "10. Termination",
    blocks: [
      {
        kind: "list",
        items: [
          "All accrued fees must be settled on the termination date.",
          "The Borrower shall repay any outstanding principal as of the termination date.",
          "The Lender may terminate this facility at any time without notice, which shall constitute the effective termination date.",
        ],
      },
    ],
  },
  {
    heading: "11. Right to Share Information",
    blocks: [
      {
        kind: "p",
        text: "The Borrower consents and authorizes the Lender to share their credit information, repayment history, and any other relevant data with:",
      },
      {
        kind: "list",
        items: [
          "Licensed Credit Reference Bureaus (CRBs);",
          "Collection agents and attorneys for recovery purposes;",
          "Regulatory authorities as required by law; and",
          "Any other financial institution or partner for credit assessment, reporting, or fraud prevention.",
        ],
      },
      {
        kind: "p",
        text: "This consent remains valid throughout the loan term and for a period thereafter as may be necessary for record keeping or collections.",
      },
    ],
  },
];

/**
 * The CRB authorisation paragraph that closes the document. Accepted with the
 * rest of the terms by the one tick; since 22 Sep 2026 it has no tick of its own.
 */
export const MICROMART_CRB_CONSENT =
  "By entering into this agreement, I authorize Micromart Africa Ltd to access and query my credit information from any of the licensed CRBs and to receive credit reports/scores from any of the licensed CRBs on my behalf in order to assess my creditworthiness, both at the time of application and during the duration of the facility. I further consent to my credit information being shared with the licensed CRBs. This consent shall not be withdrawn during the period in which my application is pending or while I have an outstanding balance.";

export const MICROMART_ADDRESS = "Casamia, Ngong Road, Nairobi | P.O. Box 1864-00100 Nairobi | Phone: +254 20 2 736 622";
export const MICROMART_CONTACT = "Email: info@micromartafrica.com | Web: http://micromartafrica.com";
