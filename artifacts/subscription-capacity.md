# Subscription capacity update

- Enterprise includes the main/owner branch plus five additional branches (six total). Additional branch slots include inactive branches. Existing records are never removed when over limit.
- Branch creation is enforced in a MongoDB transaction, serializing concurrent creation attempts through the owning school. Editing existing branches remains available at the cap.
- Subscription & plans now returns and displays organization-wide active student, active teacher and department-staff usage, limits and remaining seats. Teachers are separate from Finance/Examination/Reception staff. Parents and school administrators are not counted as department staff.
- Existing student/teacher quotas are preserved: Starter 300/15, Professional and trial 1500/75, Enterprise 999999/999999. Department staff has no existing numeric seat quota where the feature is included; no new quota was invented. Additional branches are an Enterprise feature.
- Subscription billing remains restricted to the authorized school administrator/organization owner. Usage counts do not narrow to the selected branch.
- Website pricing, branch management and the subscription page explain the five additional branches and link to Contact Acadivo for more capacity.

Validation: TypeScript passed; production build passed (151 pages); 15 real local MongoDB capacity/concurrency checks passed; 239 organization/role/tenant regression checks passed. Tests used disposable databases on local port 27018. Existing school records were not used as write fixtures.

Follow-up browser verification completed against the running built application: public pricing and the actual authorized Enterprise subscription page reviewed at desktop 1600 CSS px and mobile 400 CSS px, with no document horizontal overflow at mobile width. Owner branch page reviewed on desktop. Actual subscription counts: 53 active students, 11 active teachers, 3 department staff, 0 of 5 additional branches used. No student or branch was created during browser verification. Screenshots saved in `artifacts/subscription-capacity-visual/`. Other plans retain automated coverage; their authenticated screens were not visually tested by changing the real account plan.
