import { sendExpiryReminders } from "./services/subscriptionReminder.service";
import { migrateBranchScopes } from "./services/branchMigration.service";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { expireTrials } from "./services/trialLifecycle.service";
import { seedDatabase } from "./utils/seed";

import { BulkImportService } from "./services/bulkImport.service";

const startServer = async () => {
  try {
    console.log(
      `[SMTP] Host configured: ${Boolean(process.env.SMTP_HOST?.trim())}`,
    );
    console.log(
      `[SMTP] Port configured: ${Boolean(process.env.SMTP_PORT?.trim())}`,
    );
    console.log(
      `[SMTP] User configured: ${Boolean(process.env.SMTP_USER?.trim())}`,
    );
    console.log(
      `[SMTP] Password configured: ${Boolean(process.env.SMTP_PASS?.trim())}`,
    );
    console.log(
      `[SMTP] From email configured: ${Boolean(process.env.FROM_EMAIL?.trim())}`,
    );

    // 1. Connect MongoDB
    // Explicit local audit startup: serve the existing authenticated app without
    // seed, migration, index maintenance, recovery or notification jobs.
    const reportsAudit = process.argv.includes("--reports-audit");
    await connectDB({ maintenance: !reportsAudit });

    // 2. Auto-seed permissions and super admin if in development or missing
    if (!reportsAudit) {
      await seedDatabase();

      await migrateBranchScopes();
      console.log(
        "[Branches] Main branches and existing record scopes verified.",
      );
      await expireTrials();
      void sendExpiryReminders().catch(() =>
        console.error("[Subscriptions] Reminder processing unavailable."),
      );
      setInterval(() => {
        void sendExpiryReminders().catch(() =>
          console.error("[Subscriptions] Reminder processing unavailable."),
        );
      }, 3600000).unref();
      await BulkImportService.resume();
      setInterval(() => {
        void BulkImportService.resume().catch(() =>
          console.error("[BulkImport] Recovery check failed."),
        );
      }, 60000).unref();
      setInterval(() => {
        void expireTrials().catch(() =>
          console.error("[Subscription] Trial expiry synchronization failed."),
        );
      }, 60000).unref();
    }
    // 3. Create Express App
    const app = createApp();

    const PORT = parseInt(env.PORT, 10) || 5000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`=======================================================`);
      console.log(`🚀 Acadivo SaaS Backend API Server Running`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`⚡ Environment: ${env.NODE_ENV}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
