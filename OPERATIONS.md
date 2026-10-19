# CampusLearn launch and operations handover

## Current status

This repository contains a React/Vite client and Supabase integration. A hosting provider, production domain, verified staging environment, monitoring service, support email, and backup/restore process have **not** been configured or verified as part of this work. A successful local build does not certify production readiness.

The client currently uses the Supabase `materials` Storage bucket for both public learning resources and student submission uploads. Do not use real student submissions in a production launch until submissions have been moved to a private bucket with reviewed Storage policies and coordinator access rules. Public resources and private submissions must not share a public bucket.

## Before staging or production

1. Select a hosting provider and create separate staging and production environments. Configure HTTPS, SPA route fallback to `index.html`, and environment-specific build variables.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider's environment settings. These values are client-visible; never put a Supabase service-role key in a `VITE_` variable or browser bundle.
3. Keep any service-role/database credentials in a trusted server-side secret store only. Remove them from local files and rotate them if they have ever been committed or shared.
4. In Supabase Auth, set the site URL and allow-list the exact staging and production redirect URLs, including `/reset-password`. Verify email delivery, expiry, rate limits, and recovery links end-to-end.
5. Review every table and Storage RLS policy against the role matrix below. Test with real student, coordinator, and admin accounts; a hidden button or React route guard is not backend authorization.
6. Create a **private** submissions bucket and policies that authorize students to write/read only their own objects and assigned coordinators to read the submissions they are entitled to review. Migrate the current submission upload path away from the public `materials` bucket before collecting real work.
7. Identify a named operational owner and publish a monitored support contact. The homepage's issue link is a project feedback channel, not an incident-response or support SLA.
8. Configure provider-side error monitoring, uptime checks, and alert ownership. Confirm logs exclude passwords, tokens, and uploaded private content.

## Release procedure

1. Review the change and confirm required Supabase schema/policies are applied to staging first.
2. Install from the lockfile (`npm ci`), run `npm test`, `npm run lint`, and `npm run build`; investigate and document any existing lint baseline failures rather than ignoring them.
3. Deploy the exact tested commit to staging, then perform the test matrix below with separate accounts for each role.
4. Check browser console/network errors, storage/database policies, mobile layout, password recovery email delivery, and the production bundle for secrets.
5. Require an authorized release owner to approve production promotion. Keep the previous deployment available for rollback.
6. After release, smoke-test sign-in, course browsing, resource download, coordinator upload, admin access, and the support contact. Monitor errors and alert delivery.

## Acceptance test matrix

| Journey | Staging verification |
| --- | --- |
| Student sign-in/sign-up | Valid credentials, email verification, invalid credentials, slow/offline Supabase, sign-out, and session refresh |
| Account recovery | Request link for an existing and unknown email; confirm generic UI response, allowed redirect, expired/used link handling, password mismatch/length checks, and successful sign-in with the new password |
| Coordinator access | Unassigned user is denied by both UI and database policies; invited coordinator can activate, see only assigned subjects, upload an allowed PDF/Office/text/ZIP file, and receive explicit errors on upload/record failures |
| Admin access | Non-admin cannot read or mutate protected data through direct API calls; authorized admin can manage resources; denied mutations are visible and logged |
| Student submission | Test 0-byte, >10 MB, supported, and unsupported files; confirm failed Storage/DB requests are not shown as successful submissions; verify private object access using an unauthenticated session |
| Resource download | Confirm valid Supabase URLs with spaces/non-ASCII names work, missing objects show a useful error, and restricted files cannot be fetched by another role |
| Responsive/accessibility | Verify 360 px mobile, tablet, and desktop layouts; keyboard-only navigation; visible focus; labels and error announcements; reduced-motion setting |
| Failure/recovery | Simulate API timeout, rejected upload, lost session, browser refresh, and a React render error; confirm retry/recovery paths and no false success state |
| Backup/restore | Restore a recent database backup and representative Storage objects into an isolated project; verify row/object integrity and document recovery time |

## Backup and restore

- Confirm the Supabase plan's database backup/PITR capabilities, retention window, restore procedure, and costs before launch; these vary by plan and are not enabled or verified by this repository.
- Define and record database and Storage recovery-point and recovery-time objectives with the client. Database backups do not automatically prove that Storage objects can be restored.
- Keep schema/migration changes in version control and export production data only through approved, access-controlled backup mechanisms.
- Restrict backup access, encrypt backup exports at rest and in transit, and define retention/deletion rules.
- Schedule restore drills in a separate project. Record who performed the restore, the tested restore point, integrity checks, and elapsed time.

## Routine maintenance and incidents

- Review dependency/security advisories and Supabase Auth/RLS/Storage policy changes regularly; patch and verify in staging.
- Monitor uptime, frontend exceptions, Supabase database/storage usage, failed authentication, email delivery, and backup jobs.
- Provide an incident contact and escalation owner. For a suspected credential leak, revoke sessions, rotate affected keys, inspect access logs, and notify affected parties according to applicable policy.
- Keep a release log, rollback instructions, role/account ownership list, and data-retention/deletion process.
- Never request or share a user's password. Account recovery must use the configured Supabase email flow.

## Environment checklist

- [ ] Hosting provider and staging/production domains selected
- [ ] Separate staging and production Supabase projects/credentials configured
- [ ] Auth redirect allow-list includes the deployed `/reset-password` route
- [ ] Email delivery and recovery templates tested
- [ ] Database and Storage RLS reviewed and tested with least-privilege accounts
- [ ] Private submission bucket and coordinator policies deployed and verified
- [ ] Backup retention, Storage backup, and restore drill recorded
- [ ] Error monitoring, uptime checks, and alert recipients configured
- [ ] Named human support contact and incident owner published
- [ ] Release approver and rollback owner assigned
