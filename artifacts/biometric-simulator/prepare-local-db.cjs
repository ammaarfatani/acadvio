// Dedicated local testing instance only. Never reads .env.
const mongoose = require('mongoose');
(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/admin?directConnection=true', { serverSelectionTimeoutMS: 5000 });
    const admin = mongoose.connection.db.admin();
    const hello = await admin.command({ hello: 1 });
    if (hello.setName && hello.setName !== 'acadivoDemo') throw new Error('Unexpected database instance; setup stopped.');
    if (!hello.setName && hello.isreplicaset !== true) throw new Error('This database was not started for Acadivo testing.');
    try {
      await admin.command({ replSetInitiate: { _id: 'acadivoDemo', members: [{ _id: 0, host: '127.0.0.1:27018' }] } });
    } catch (error) {
      if (error.code !== 23) throw error;
    }
    for (let attempt = 0; attempt < 30; attempt++) {
      const status = await admin.command({ hello: 1 });
      if (status.setName === 'acadivoDemo' && status.isWritablePrimary) {
        console.log('SUCCESS: Local testing database is ready on port 27018.');
        console.log('Online database and project .env were not changed.');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Local database is still preparing. Run this command again.');
  } catch (error) {
    console.error('FAILED: ' + error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
