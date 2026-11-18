/**
 * DRAFT legal pages. They describe what the product actually does today, in plain language. They are NOT legal advice and have not been reviewed by a
 * lawyer: have them reviewed before you take real money. Everything in [square brackets] is a decision or a fact only the operator can supply.
 */
export interface LegalSection { heading: string; body: string[] }
export interface LegalDoc { slug: 'terms' | 'privacy' | 'refunds' | 'ai-policy'; title: string; summary: string; sections: LegalSection[] }

export const LEGAL_DRAFT_NOTICE = 'DRAFT. This page has not been reviewed by a lawyer and must be reviewed and completed before launch. Items in [square brackets] are for the operator to fill in.';
export const OPERATOR = { company: '[Company name and registered address]', email: '[support email address]', jurisdiction: '[governing law and courts]' };

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'terms', title: 'Terms of Service', summary: 'The rules for using SubwayTakes Studio, buying credits and what you may make.',
    sections: [
      { heading: 'Who we are', body: [`SubwayTakes Studio ("the Service") is run by ${OPERATOR.company}. You can reach us at ${OPERATOR.email}.`] },
      { heading: 'Your account', body: ['You need an account and a confirmed email address to generate videos. Guest sessions can look around but cannot generate or buy. You are responsible for what happens under your account. You must be at least [18] years old.'] },
      { heading: 'Credits', body: [
        'Generating a video, a voice or a lip-sync costs credits. 1 credit is worth one US cent of generation. The price of each action is shown before you run it and is set by us at the time you run it.',
        'Credits are reserved when you start an action. If the action fails, the credits are returned automatically. If it succeeds, they are used.',
        'Credits you buy are for use in the Service only and cannot be exchanged for money except as set out in the Refund Policy. [State whether credits expire and after how long, or that they do not expire.]',
      ] },
      { heading: 'Packs and unlocks', body: ['Some features (for example Cuts, Cast voices, extra cities, Recast, the Happiness, Scripture and Motivation shows, brand kit) are unlocked by buying a pack. A pack is a one-time purchase for the feature as it is described on the page where you buy it. We may add to a pack. We will not remove a feature you have bought without a refund. [Confirm.]'] },
      { heading: 'What you may make', body: [
        'You must follow the AI and Likeness Policy. In short: no real, named people or look-alikes without their permission, nothing involving children, no sexual or graphically violent content, no hateful content, and no deceiving people into thinking an AI video is real.',
        'We screen requests automatically and may refuse them. We may suspend accounts that break the rules. We may remove content and report illegal content to the authorities.',
      ] },
      { heading: 'Photos and videos you upload', body: ['You confirm you have the right to upload them, that anyone shown has agreed, and that they are adults. We record your agreement. You keep your rights in what you upload.'] },
      { heading: 'Who owns what you make', body: ['As between you and us, you own the videos you make, to the extent the law allows. AI-generated material may not be protected by copyright in some countries. Underlying models are provided by third parties and their terms also apply. [Confirm against the terms of muapi and each model provider.] Using the videos for client work or commercial projects needs the Commercial licence where it is offered. [Define exactly.]'] },
      { heading: 'Referrals', body: ['Inviting a friend earns credits only after they make a qualifying first purchase, up to a limit per person. We may cancel rewards given for fake, repeated or self-referred accounts, and take the credits back.'] },
      { heading: 'Availability and changes', body: ['We work to keep the Service running but cannot promise it will always be available or that every generation succeeds. Generated results vary and are not guaranteed to match your description. We may change the Service and these terms; we will tell you about important changes.'] },
      { heading: 'Liability', body: ['[Limit of liability, disclaimers and indemnity: to be written with a lawyer for your jurisdiction.]'] },
      { heading: 'Law', body: [`These terms are governed by ${OPERATOR.jurisdiction}.`] },
    ],
  },
  {
    slug: 'privacy', title: 'Privacy Policy', summary: 'What we collect, why, who processes it, and how long we keep it.',
    sections: [
      { heading: 'What we collect', body: [
        'Account: your email address and a password hash (held by our authentication provider).',
        'What you make: your takes and prompts, project edits, characters, uploaded photos and videos, generated clips, and your brand kit.',
        'Payments and credits: orders, amounts and a credit ledger. Card details are handled by Stripe and never reach us.',
        'Usage and safety: which generations you ran and their cost, content-screening results, your acceptance of the upload agreement, and anonymous browser error reports (no prompts, no personal text, URLs without query strings).',
      ] },
      { heading: 'Why we use it', body: ['To run the Service, charge and refund credits, prevent fraud and abuse, keep the Service safe, provide support, and understand which features are used. [Add legal bases if required in your market.]'] },
      { heading: 'Who processes it', body: [
        'Supabase (database, login, file storage). Stripe (payments). muapi and the model providers behind it (to generate video, voice and images, they receive your prompts and any images, audio or video you use in a generation). [List email and hosting providers.]',
        'We do not sell your personal data.',
      ] },
      { heading: 'Your uploads and results', body: ['Uploaded and generated files are stored in a public-link bucket so that the generation tools and the exporter can read them. Anyone with the exact link can open a file; links are not guessable and are not listed. [Decide and state how long files are kept.]'] },
      { heading: 'How long we keep things', body: ['Account and ledger records are kept while your account exists and as the law requires for financial records. Browser error reports are deleted after 14 days. [Confirm other retention periods.]'] },
      { heading: 'Your choices', body: [`You can ask to see, correct or delete your data by emailing ${OPERATOR.email}. [Describe how deletion works with financial records you must keep.]`] },
      { heading: 'Contact', body: [`${OPERATOR.company}, ${OPERATOR.email}.`] },
    ],
  },
  {
    slug: 'refunds', title: 'Refund Policy', summary: 'When credits and purchases are refunded, automatically and on request.',
    sections: [
      { heading: 'Failed generations are refunded automatically', body: ['If a generation fails, the credits reserved for it are returned to your balance automatically. If a job is still unresolved after a long time, it is checked and refunded if it did not complete. You do not need to ask.'] },
      { heading: 'Purchases', body: [
        '[State the refund window, for example "within X days of purchase".]',
        'Credits that you have already used cannot be returned. If you ask for a refund of a purchase, we remove the unlocks it gave and take back the credits from it that you have not used. If you have already spent some of them, the refund may be reduced by the amount you used. [Confirm how partial refunds work.]',
      ] },
      { heading: 'How to ask', body: [`Email ${OPERATOR.email} from the address on your account with your order number. Approved refunds go back to the original payment method through Stripe.`] },
      { heading: 'Disputes', body: ['Please contact us before disputing a charge with your bank; we resolve genuine problems quickly. A chargeback removes the credits and unlocks from that purchase, and we may limit further purchases on the account while it is reviewed.'] },
    ],
  },
  {
    slug: 'ai-policy', title: 'AI Content and Likeness Policy', summary: 'What you may and may not make, and how we label AI videos.',
    sections: [
      { heading: 'These videos are made with AI', body: ['Everything the Service generates is synthetic. Exports carry a small "AI-generated" label by default. Do not remove it where a platform or law requires you to disclose AI content, and never present a generated video as a real event or a real person\'s statement.'] },
      { heading: 'Real people', body: ['Do not create videos of real, named people (public figures, celebrities, colleagues, anyone) or look-alikes of them, and do not use someone\'s photo without their permission. Characters should be original. Recast and Cast uploads are only for you or people who have agreed and are adults.'] },
      { heading: 'Children', body: ['Do not create videos of children or teenagers, or content that sexualises or endangers anyone. We refuse such requests and may report illegal material.'] },
      { heading: 'Other content we refuse', body: ['Sexual or nude content, graphic violence, content about self-harm, hateful content, and medical or health-treatment claims (for example, claims that something cures an illness).'] },
      { heading: 'Faith and scripture content', body: ['The Scripture show uses public-domain Bible texts (King James Version, World English Bible and Berean Standard Bible) from a verified library, or text you type yourself. The choice of verses draws on topic lists from OpenBible.info (CC BY 4.0), used for verse references only. For text you type, you are responsible for having the right to use that translation. The Service does not show, portray or voice God, Jesus, prophets or other holy figures, and does not create content that mocks anyone\'s faith. Do not present a generated video as a real testimony, and do not use it to promise healing, wealth or any particular outcome. Video models can garble spoken words, so the on-screen verse is the exact text and the spoken words may differ.'] },
      { heading: 'How it is enforced', body: ['Requests are screened automatically before generation. The screen is not perfect and we may also review reports. You can report a problem to ' + OPERATOR.email + '. Breaking these rules can lead to refused requests, removed content and suspended accounts.'] },
      { heading: 'Music and other media', body: ['The Service does not include licensed music. Do not add music or footage you do not have the right to use.'] },
    ],
  },
];

export const legalDoc = (slug: string): LegalDoc | undefined => LEGAL_DOCS.find(d => d.slug === slug);
