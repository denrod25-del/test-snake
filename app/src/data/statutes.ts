import type { StatuteSection } from '../lib/types';

export const STATUTE_SECTIONS: StatuteSection[] = [
  {
    id: '197.122', title: 'Lien of Taxes; Applicability',
    summary: 'All taxes imposed pursuant to the State Constitution and laws of Florida shall be a first lien on the property against which assessed. The lien is superior to all other liens, even those recorded earlier.',
    why: "This is the foundation. It's why a tax deed wipes out most prior liens — the tax lien is statutorily senior to mortgages and most encumbrances.",
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.122',
  },
  {
    id: '197.402', title: 'Advertisement of Real or Personal Property With Delinquent Taxes',
    summary: 'Requires the Tax Collector to advertise delinquent property in a newspaper of general circulation in the county for at least three weeks before the tax certificate sale.',
    why: 'The advertisement window is your earliest signal that a tax-certificate (and eventually deed) opportunity is forming on a parcel.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.402',
  },
  {
    id: '197.432', title: 'Sale of Tax Certificates for Unpaid Taxes',
    summary: 'On or before June 1, the Tax Collector sells tax certificates on properties with delinquent taxes via competitive bid. The bid is the interest rate the certificate will accrue, starting at 18% and bid downward in 0.25% increments.',
    why: 'Tax certificates are the precursor to tax deeds. Hold a certificate two years and you can apply to force a deed sale on the property.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.432',
  },
  {
    id: '197.472', title: 'Redemption of Tax Certificates',
    summary: 'The property owner (or any party with interest) may redeem a certificate at any time before a tax deed is issued by paying delinquent taxes plus accrued interest at the certificate rate or 5%, whichever is greater.',
    why: 'Most certificates redeem. The 5% minimum interest is the floor return for certificate holders even on a same-year redemption.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.472',
  },
  {
    id: '197.502', title: 'Application for Tax Deed by Holder of Tax Sale Certificate',
    summary: 'The certificate holder may apply for a tax deed two years after April 1 of the year of issuance. The application requires payment of all outstanding taxes and a fee. The Clerk then schedules the sale.',
    why: 'This is the trigger event. Once filed, the property is on a 6-month clock to sale absent redemption.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.502',
    critical: true,
  },
  {
    id: '197.512', title: 'Notice, By Publication or Posting',
    summary: 'The Clerk must publish notice of the application for tax deed once a week for four consecutive weeks in a newspaper of general circulation, and post a copy on the property.',
    why: 'The publication record is part of your due-diligence checklist — defective notice can be grounds for setting aside a tax deed.',
  },
  {
    id: '197.522', title: 'Notice to Owner When Application for Tax Deed is Made',
    summary: 'The Clerk shall mail certified-mail notice to the owner of record, all lienholders of record, and other interested parties. Failure of notice is one of the few constitutionally-recognized grounds to challenge a tax deed.',
    why: 'Most tax-deed challenges hinge on §197.522 notice defects. Pull the file and confirm certified mail receipts before bidding.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.522',
    critical: true,
  },
  {
    id: '197.542', title: 'Sale at Public Auction',
    summary: 'The Clerk shall sell the property at public auction to the highest bidder. The opening bid includes all delinquent taxes, interest, certificate face value, and costs. Sales must be conducted in person at the courthouse OR via electronic sale on a county-approved platform. The winning bidder must pay the bid in full within 24 hours (or 48 hours for online sales) or forfeit the deposit.',
    why: 'This is THE statute that governs the sale itself. Memorize the deposit and final-payment timelines for the counties you bid in.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.542',
    critical: true,
  },
  {
    id: '197.552', title: 'Tax Deeds',
    summary: 'All tax deeds shall be issued in the name of the County and signed by the Clerk. The deed conveys the property free of all liens of record except those held by a municipality or county, and except certain governmental liens that survive.',
    why: 'Note the carve-outs: code-enforcement liens, municipal utility liens, and other governmental liens may survive the tax deed. Verify with the city before bidding.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.552',
    critical: true,
  },
  {
    id: '197.572', title: 'Easements, Liens, and Reservations Existing in Land Conveyed',
    summary: 'Easements for telegraph, telephone, pipeline, drainage, conservation, and similar public-purpose uses survive a tax deed sale. Restrictive covenants generally survive.',
    why: 'A tax deed does NOT wipe out recorded easements or restrictive covenants. Pull the title commitment to identify what survives.',
  },
  {
    id: '197.582', title: 'Disbursement of Proceeds of Sale (Surplus Funds)',
    summary: "After payment of taxes, costs, and the certificate holder's interest, any surplus is held by the Clerk for the benefit of the prior owner and lienholders. Claims must generally be made within 120 days of the sale; unclaimed surplus escheats to the county after a statutory period.",
    why: 'This is the entire surplus-funds business. The 120-day window starts the day of sale and statutory notice runs from there.',
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.582',
    critical: true,
  },
  {
    id: '197.592', title: 'Lands Available for Taxes',
    summary: "If no bidder offers the opening bid at the tax deed sale, the property is added to the County's 'Lands Available for Taxes' list. After 90 days, any party may purchase from the list by paying the opening bid plus accrued taxes.",
    why: "The Lands Available list is an underrated source of inventory. Many counties publish it; check the Clerk's site under 'lands available' or 'list of lands.'",
    href: 'https://www.flsenate.gov/Laws/Statutes/2024/197.592',
  },
  {
    id: '197.602', title: 'Reimbursement Required in Challenges to Validity of a Tax Deed',
    summary: 'A party seeking to set aside a tax deed must reimburse the holder for all amounts paid (delinquent taxes, the deed price, subsequent taxes, and improvements made in good faith).',
    why: 'Provides a measure of protection for tax deed purchasers — even a successful challenge requires the challenger to make you whole.',
  },
];
