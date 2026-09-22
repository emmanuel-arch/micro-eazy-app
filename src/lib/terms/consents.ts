// ─────────────────────────────────────────────────────────────────────────────
// THE CONSENTS A LOAN RESTS ON — carried inside the terms, not beside them.
//
// Until 22 Sep 2026 the Overview step asked for two ticks: accept the terms, and
// separately authorise the CRB. But Micromart's own terms already close with
// that CRB authorisation, so the second tick asked the customer to agree to the
// same paragraph twice. Now there is ONE tick — "I have read and accept the
// terms, and I request this loan" — and every consent that is global to lending
// lives in the document that tick accepts.
//
// ── THIS IS PLATFORM WORDING, NOT MICROMART'S ───────────────────────────────
// micromart.ts is Micromart's text verbatim. This section is ours: it names
// what the Lending Console and the Interchange do with a borrower's data, so
// the consent both of them record is a consent the customer actually read. It
// is presented as section 12 of Micromart's document, between their section 11
// and their closing CRB paragraph. Micromart's counsel should approve it.
//
// ── WHAT EACH CLAUSE ANSWERS FOR ────────────────────────────────────────────
// Accepting the terms writes these grants on the customer's Consent row
// (connected-suite/src/lib/portal/terms-grants.ts), and the Interchange is
// told the customer holds its seven mandatory scopes:
//
//   M-PESA statement analysis    mpesaAnalysis        mpesa.crunch
//   Identity verification        iprs                 kyc.verify
//   Automated assessment         automatedScoring     —
//   Credit reference bureaus     crbCheck, crbShare   bureau.pull
//   The lending network          ecosystemExposure    ecosystem.exposure
//   Loan outcomes                —                    outcome.label
//   Improving assessment         modelImprovement     model.train
//   Contact about repayment      —                    collections.contact
//   Processing outside Kenya     crossBorder          —
//
// What is deliberately NOT here: marketing, offers from other lenders, naming
// the lender to other lenders, and location. Those are optional everywhere,
// and a loan must not be conditioned on them. Keeping them out is what makes
// the bundle defensible as being about lending.
//
// Change a word here and bump MICROMART_TERMS_VERSION (micromart.ts) and the
// server's TERMS_VERSION together, or a customer will have agreed to a
// document that no longer exists.
// ─────────────────────────────────────────────────────────────────────────────
import type { TermsSection } from "./micromart";

/** The consents section, in the lender's name. `n` numbers it inside a longer document. */
export function consentSection(lender: string, n?: number): TermsSection {
  return {
    heading: `${n ? `${n}. ` : ""}Consents for Assessment, Credit Reference and the Lending Network`,
    blocks: [
      {
        kind: "p",
        text: `By accepting these terms the Borrower gives ${lender} the following consents. Each is needed to assess, provide and administer this loan, and each is recorded against the Borrower's account with the version of these terms and the time they were accepted.`,
      },
      {
        kind: "list",
        items: [
          `M-PESA statement analysis: ${lender} may read any M-PESA statement the Borrower provides and work out income, spending and existing repayments from it.`,
          `Identity verification: ${lender} may confirm the Borrower's identity using their national ID document, a photograph of their face, and the national population register (IPRS).`,
          `Automated assessment: an automated scoring system may help assess the application. Any decision to decline the Borrower is reviewed by a person.`,
          `Credit reference bureaus: ${lender} may obtain the Borrower's credit reports and scores from licensed Credit Reference Bureaus, directly or through the lending network below, when the Borrower applies and while the loan is outstanding, and may share the Borrower's credit information and repayment history with them, as set out in the final paragraph of these terms.`,
          `The lending network: ${lender} may ask other licensed lenders in the Interchange network whether the Borrower currently owes them money, and will answer the same question about the Borrower when they ask. They are told amounts, as ranges, and repayment status — never the Borrower's name, ID number or phone number.`,
          `Loan outcomes: how this loan ends — repaid, late or defaulted — is recorded and used to improve how lending decisions are made.`,
          `Improving assessment: the Borrower's information, with name and ID removed so that it cannot be traced back to them, may be used to build and test the systems that assess future applications. It is never sold.`,
          `Contact about repayment: if the Borrower falls behind, ${lender} may contact them, and may share how best to reach them with a collection agent acting for ${lender}.`,
          `Processing outside Kenya: ${lender}'s lending systems are hosted in the European Union (Ireland), and some assessment steps use service providers outside Kenya. Only what each step needs is sent, and it is protected as the Data Protection Act, 2019 requires for a transfer outside Kenya.`,
        ],
      },
      {
        kind: "p",
        text: `These consents do not permit marketing to the Borrower, offers from other lenders, telling other lenders which lender the Borrower owes, or recording the Borrower's location. Those are asked for separately and may be refused without affecting this application.`,
      },
      {
        kind: "p",
        text: `The Borrower may withdraw any of these consents by writing to ${lender} through Messages in the app. A withdrawal takes effect from then on: it does not undo a decision already made, and an application that depends on a withdrawn consent cannot be assessed until it is given again. The credit reference consent in the final paragraph cannot be withdrawn while an application is pending or while a balance is outstanding.`,
      },
    ],
  };
}

/**
 * The closing CRB authorisation for a lender whose own terms are not held here.
 * Micromart's is their verbatim paragraph (MICROMART_CRB_CONSENT); every other
 * lender gets this, in the same shape, so the one tick covers the same ground.
 */
export function crbAuthorisation(lender: string): string {
  return `By entering into this agreement, I authorize ${lender} to access and query my credit information from any of the licensed CRBs and to receive credit reports/scores from any of the licensed CRBs on my behalf in order to assess my creditworthiness, both at the time of application and during the duration of the facility. I further consent to my credit information being shared with the licensed CRBs. This consent shall not be withdrawn during the period in which my application is pending or while I have an outstanding balance.`;
}
