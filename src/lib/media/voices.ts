// ─────────────────────────────────────────────────────────────────────────────
// THE PLATES ON THE FRONT DOOR.
//
// Kenya, on the half of the sign-in screen that is not the form. These are the
// people who actually borrow here: a mama mboga, a fundi, a duka owner, a boda
// rider. Nothing on this screen is a stock photograph of a laptop.
//
// ── WHY THESE ARE PROMISES AND NOT TESTIMONIALS ──────────────────────────────
// The visual treatment is borrowed from a testimonial panel — stacked cards that
// shuffle, copy that arrives out of focus — and the obvious thing to put in it
// would have been quotes: a name, a trade, and a sentence about how the loan
// changed everything.
//
// That would be a fabricated review. The people in these frames are generated
// composites, not customers; attaching a name and an endorsement to one would
// manufacture social proof for a lending product, in front of somebody being
// asked to hand over a photograph of their national ID. It is the one thing on
// this screen that would be worth nothing and cost everything.
//
// So each plate carries a PROMISE the product can actually be held to — apply in
// minutes, see the reasons, repay from the phone — and the caption says what the
// picture is rather than who. Same effect, nothing invented. When real
// customers consent to be quoted, the shape below already has room for them and
// the change is data, not code.
//
// ── THE COMPOSITION RULE ─────────────────────────────────────────────────────
// The photograph is a CARD here, not a background: it has its own frame, its own
// corner radius and its own shadow, and the copy sits beside it rather than on
// it. So unlike the staff doors — where the sign-in card floats on the artwork
// and the plates must keep a dark, empty left third — these want the subject
// roughly centred and can use the whole frame.
//
// Every file is optional. With none of them present the panel renders its brand
// gradient and reads as deliberate, so the screen is never broken while
// photography is being commissioned.
// ─────────────────────────────────────────────────────────────────────────────

export type Voice = {
  id: string;
  /** Served from /public. Optional — see the note above. */
  file: string;
  /** The promise. One line, and one the product can be held to. */
  title: string;
  /** How it is kept. */
  body: string;
  /** What the picture is. Not who — see the note above. */
  caption: string;
  /** Alt text. Describes the photograph for somebody who cannot see it. */
  alt: string;
};

export const VOICES: Voice[] = [
  {
    id: "mama-mboga",
    file: "/images/login/ke-mama-mboga.webp",
    title: "Your business does not wait. Neither should your loan.",
    body: "Apply in minutes from your phone, and get a decision you can see the reasons for.",
    caption: "A grocer's stall, Nairobi",
    alt: "A Kenyan grocer arranging produce at her stall in the early morning.",
  },
  {
    id: "fundi",
    file: "/images/login/ke-fundi.webp",
    title: "Tools, stock, rent — funded the same day.",
    body: "Working capital that arrives when the job does, repaid from the phone in your pocket.",
    caption: "A carpenter's workshop",
    alt: "A Kenyan craftsman measuring timber in his workshop.",
  },
  {
    id: "duka",
    file: "/images/login/ke-duka.webp",
    title: "Every decision explained. Never a silent no.",
    body: "See exactly what your limit is built from — and what would move it.",
    caption: "A neighbourhood duka",
    alt: "A Kenyan shopkeeper checking stock on her phone behind the counter.",
  },
  {
    id: "boda",
    file: "/images/login/ke-boda.webp",
    title: "Repay from your phone, wherever the day takes you.",
    body: "M-Pesa STK, standing orders, and a statement you can actually read.",
    caption: "A boda stage at dusk",
    alt: "A Kenyan boda boda rider pausing beside his motorcycle at dusk.",
  },

  // ── THE SECOND FOUR ─────────────────────────────────────────────────────
  // The deck was built for four and shuffles through however many are here, so
  // this is data rather than a change to the component.
  //
  // WHY MORE AT ALL: four plates on a five-second rotation is a twenty-second
  // loop, and the front door is a screen people sit in front of for longer than
  // that — twice, if the first password attempt fails. A visible loop turns a
  // photograph into a slideshow, which is the register this panel exists to
  // avoid. Eight is forty seconds and reads as a stack rather than a cycle.
  //
  // And the trades are chosen, not collected: a tailor, a farmer, a salon and a
  // butcher are four more of the book, and between them the eight cover the
  // actual spread of what Micromart lends against. Every promise below is one
  // the product can be held to — see the note at the top of this file about why
  // none of these is a testimonial.
  {
    id: "tailor",
    file: "/images/login/ke-tailor.webp",
    title: "Buy the fabric before the order, not after.",
    body: "A limit that is there when the work is, so a deposit is never the thing that stops you.",
    caption: "A tailor's workroom",
    alt: "A Kenyan tailor guiding cloth through a sewing machine.",
  },
  {
    id: "farmer",
    file: "/images/login/ke-farmer.webp",
    title: "Seed, fertiliser, labour — timed to the season.",
    body: "Borrow when the ground is ready and repay when the crop sells.",
    caption: "A smallholding at first light",
    alt: "A Kenyan farmer working a smallholding in the early morning.",
  },
  {
    id: "salon",
    file: "/images/login/ke-salon.webp",
    title: "Stock the chair, not just fill it.",
    body: "Working capital for product and equipment, repaid in small pieces from takings.",
    caption: "A salon, mid-appointment",
    alt: "A Kenyan hairdresser working with a client in her salon.",
  },
  {
    id: "butcher",
    file: "/images/login/ke-butcher.webp",
    title: "Buy the whole carcass at the better price.",
    body: "Short-term credit sized to a day's trade, so buying in bulk is finally worth it.",
    caption: "A butchery counter",
    alt: "A Kenyan butcher preparing cuts behind the counter.",
  },
];
