# Consent implementation gate

The owner form currently has individually required boxes, but server persistence is not implemented. The existing `proposals/marketplace-consents-review.sql` is a **proposal**, not deployed. The final implementation needs immutable audit records, policy versioning, verified email, and database-enforced publishing and inquiry restrictions. No production database changes should occur until a restorable backup is verified.

Do not treat UI checkboxes or browser-side filters as access control. Current production listing RLS allows owner updates without certification. Avoid applying an additive RLS policy without first revising the existing permissive policies, because permissive policies combine with OR.
