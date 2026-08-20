## Summary

## Safety review

- [ ] I reviewed all AI-generated code and tests for correctness
- [ ] Validation, audit, idempotency, timezones, and failure/retry behavior are covered or not applicable
- [ ] No secrets, personal data, biometric data, internal errors, or production payloads are exposed
- [ ] A qualifying architecture decision is recorded and indexed, or this change is not architectural

## Verification

- [ ] Focused tests added/updated and passing
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm docs:check`
- [ ] `pnpm test:unit`
- [ ] `pnpm build`
- [ ] `pnpm format:check`
- [ ] `pnpm test:e2e` (if a critical user workflow changed)
- [ ] `pnpm firmware:build` (if firmware changed)

Record commands actually run, results, and any skipped/blocked check with its reason:

## Data, documentation, and rollout

- [ ] Migration reviewed and existing-data/clean paths verified, or no migration needed
- [ ] Seeds and cleanup scripts updated, or not affected
- [ ] Architecture, feature, setup, security, and operations docs updated, or not affected
- [ ] Environment variables and secrets handling documented, or not affected
- [ ] Rollout flag, entitlement, backfill, compatibility, and forward-fix plan documented, or not needed

## Risks and evidence

- Risks / known limitations:
- Screenshots, logs, reports, or other review evidence:
