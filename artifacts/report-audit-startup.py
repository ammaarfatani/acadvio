from pathlib import Path
p=Path('src/server/config/db.ts');s=p.read_text(encoding='utf-8');s=s.replace('async (): Promise<typeof mongoose>', 'async (options:{maintenance?:boolean}={}): Promise<typeof mongoose>');s=s.replace('{ serverSelectionTimeoutMS: 5000 }','{ serverSelectionTimeoutMS: 5000,...(options.maintenance===false?{autoIndex:false,autoCreate:false}:{}) }');s=s.replace('  try {\n    const studentIndexes', '  if(options.maintenance!==false)try {\n    const studentIndexes');p.write_text(s,encoding='utf-8')
p=Path('src/server/index.ts');s=p.read_text(encoding='utf-8');s=s.replace('    await connectDB();','''    // Explicit local audit startup: serve the existing authenticated app without
    // seed, migration, index maintenance, recovery or notification jobs.
    const reportsAudit=process.argv.includes("--reports-audit");
    await connectDB({maintenance:!reportsAudit});''');s=s.replace('    await seedDatabase();','    if(!reportsAudit){\n    await seedDatabase();',1);s=s.replace('    // 3. Create Express App','    }\n    // 3. Create Express App',1);p.write_text(s,encoding='utf-8')
