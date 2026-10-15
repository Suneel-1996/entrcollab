# ADR-004 — Initial idea/project aggregate and lifecycle

Status: Owner-approved model and policy, 15 October 2026. Implementation review pending.

The owner explicitly requested TASK-006 after merging TASK-005 and approved the recommended single IdeaProject model, fields and narrow visibility/lifecycle policy. The product starts with one aggregate representing an idea/project; no conversion, duplicate Project table or separate team lifecycle is invented.

## Decision

Persist owner application UUID, title, summary, description, neededSkills, tags, status, visibility and creation/update/publication/archive timestamps. Default DRAFT/PRIVATE. Explicit allowed edges are DRAFT→PUBLISHED, DRAFT→ARCHIVED and PUBLISHED→ARCHIVED. ARCHIVED is terminal; no restore, unpublish, hard delete or owner-transfer behavior is approved.

Only active, non-held authenticated owners may transition their records. An active, non-held owner can read their own draft, publication or archive. Another active signed-in user can read only PUBLISHED/MEMBERS records whose owner remains active/non-held. Anonymous/public/unlisted access is absent. Publication does not change visibility automatically. Archive always masks member visibility, even when the stored visibility was MEMBERS.

Alternative offered: owner-only draft persistence with publication deferred. The owner approved the narrow member-sharing/publication model instead. One aggregate avoids premature split/coordination between Idea and Project before team requirements are defined. No per-owner idea quota is inferred from the PRD's ability to lead one idea and join another.

## Consequences and limits

Use additive enum/table/PK/FK/index migration and explicit record-shape CHECK constraints. Owner deletion uses RESTRICT to prevent accidental data loss; this is integrity protection, not an erasure/retention policy. SQL enforces valid state/date shapes but not actor authorization or transition history. Reusable policy definitions provide those rules for future services; TASK-007 must enforce them with fresh server identities/account data and atomic writes.

TASK-006 exposes no CRUD, publish/archive, list/discovery or mobile endpoints. Team roles/join requests (PLAN-005), retention/deletion/consent/region/AI (PLAN-007), public access and live provider/device verification remain separate gates. Existing restricted-development controls/no deployment/no signing/no paid services remain in force.

See [domain contract](../ideas/TASK-006-domain.md), [PLAN-003](../planning/PLAN-003-define-profile-and-idea-visibility-model.md), and [report](../TASK-006-report.md).
