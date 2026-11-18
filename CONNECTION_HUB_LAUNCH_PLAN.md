# Flexi Rent Connection-Only Launch Specification
Status: DRAFT. Not approved for public launch. Attorney, tax, and insurance review required.

## Business model
Flexi Rent is a listing and connection service, not the owner, lessor, broker, insurer, inspector, guarantor, payment agent, or party to an equipment rental. Owners and renters negotiate and execute rental contracts and exchange rental payments directly. No platform rental checkout, deposit handling, booking confirmations, automatic rental contracts, commission, or platform refunds. Availability is informational, and an inquiry is not a reservation.

## Launch restrictions
Default to no public listings until reviewed by state and equipment category. Exclude cars, drivable trucks, motorhomes, ATVs/UTVs, and other motorized recreational vehicles pending separate review. Review trailers, towable campers, and nonmotorized equipment by jurisdiction. Do not advertise insurance, inspection, verification, or safety guarantees.

## Owner plan
Proposed 7-day trial followed by $9.99/month. Show renewal amount, date, billing frequency, cancellation steps, and refund policy immediately before explicit opt-in. No prechecked consent. Billing integration must be tested before activation; no claim that it works until verified. Cancellation must stop future recurring charges under applicable rules.

## Owner self-certification (separate affirmative unchecked boxes)
- I own this property or am legally authorized to offer it for rent.
- My listing, photographs, location, specifications, price, and availability are accurate.
- I am responsible for lawful registration, title, permits, taxes, maintenance, inspection, recalls, safety, and handoff.
- I will determine and maintain all legally required insurance and confirm whether rental activity is covered. Flexi Rent does not provide or verify insurance.
- I will independently screen prospective renters and verify qualifications, age, licenses, towing capability, and intended use as applicable.
- I will independently negotiate, document, collect payments and deposits, handle disputes and refunds, and provide the rental agreement.
- I understand Flexi Rent is not a party to the rental and does not guarantee any user or equipment.
- I agree to Owner Terms and Marketplace Terms (record policy versions and timestamp).

## Renter acknowledgment (separate affirmative unchecked boxes before sending inquiry)
- I understand this is a connection platform, not a rental checkout or confirmed reservation.
- I must verify owner authority, equipment condition, registration, suitability, towing/operation requirements, and lawful use.
- I must check my insurance and any coverage exclusions; Flexi Rent supplies no insurance or coverage verification.
- I will agree directly with the owner on price, deposits, pickup, return, cancellation, damages, and rental terms.
- I understand rental payments, disputes, and refunds are handled directly with the owner.
- I agree to Renter Terms and Marketplace Terms (record policy versions and timestamp).

## Policy pages required
Marketplace Terms, Owner Terms, Renter Terms, Privacy Policy, Subscription and Cancellation Terms, Prohibited Listings/Safety Standards, and Reporting/Contact. Include effective dates and version history, company legal identity and contact method, applicable jurisdiction, consumer rights carve-outs, legally appropriate limitations and indemnity clauses. Do not purport to waive nonwaivable rights, liability for own unlawful conduct, or statutory duties. Arbitration/class waiver only after attorney review.

## Platform safeguards
- Block contact inquiry and listing publication until required acknowledgments are recorded server-side (user id, policy version, timestamp; do not rely on browser-only checkboxes).
- Require signed-in accounts, email verification, basic anti-spam and abuse rate limiting.
- Give owners a report/remove listing tool; permit immediate suspension for unsafe, fraudulent or unauthorized listings.
- Prohibit stolen property, misleading listings, recalled/unsafe equipment, illegal rentals, and off-platform impersonation.
- Never show sample/demo listings as real inventory.
- Do not expose private user addresses or identity documents publicly.
- Apply least-privilege database rules, audit logs, secure storage, privacy retention/deletion and incident response.
- Ensure contact sharing respects user consent and privacy rules.
- Disable existing booking/payment UI and server endpoints, not merely hide buttons; do not alter owner subscription billing without review.
- Verify all deployed copy, mobile layout, and accessibility before merging.

## Counsel/broker review gates
Confirm business entity and foreign qualification requirements; state-by-state listing/rental categories; insurance exclusions and marketplace policies; taxes on advertising subscriptions and marketplace-provider status; subscription and auto-renewal laws; privacy, consumer protection, Section 230 limits, and appropriate contracts.

## Deployment
Preserve existing main and the backup branch backup-pre-connection-hub-2026-10-15. Implement on feature branch, review/test, then merge only after owner approval. Do not deploy unreviewed legal terms as finalized advice.
