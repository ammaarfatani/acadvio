# Parent bank fee payments

Parent Portal > Fees & payments shows each linked child’s issued invoices and actual outstanding balance. An enabled, complete school/branch bank account exposes Pay by bank transfer for outstanding invoices.

Finance > Settings > Bank details: save Bank, Account title and Account number (optional IBAN, branch, instructions), and enable parent bank payment submissions. No account details were hardcoded or changed in the existing school.

Parents can copy account details, submit a partial or full outstanding amount, add a reference and upload a required JPG/JPEG/PNG/WebP screenshot up to 5 MB. The UI supports drag/drop, preview, removal and replacement. Backend validates ownership, invoice balance, image content and pending/idempotent duplicates.

Finance > Parent payments allows secure screenshot viewing, approval and rejection with a required reason. Approval atomically updates the existing fee ledger and creates a receipt; rejection leaves the fee balance unchanged. Parent status shows the invoice, review result/reason and receipt, with automatic record refresh and manual refresh.

Verification: TypeScript and targeted lint passed. Actual school Parent Portal fee page was inspected at desktop and 390px mobile width. Its bank submissions are currently disabled, so no live bank form or payment approval was exercised. The screenshot fees-payment-page.png contains actual demo-parent records. All 229 disposable organization-security integration checks passed, including screenshot validation, child isolation, idempotency, concurrent approval, partial payment, required rejection reason and rejected-payment resubmission.
