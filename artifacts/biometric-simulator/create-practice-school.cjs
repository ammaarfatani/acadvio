// Local practice fixtures only. Does not read the project's connection configuration.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), mongoose = require('mongoose');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const load = relative => require(path.join(root, relative));
const { School } = load('src/server/models/school.model.ts');
const { User } = load('src/server/models/user.model.ts');
const { Role } = load('src/server/models/role.model.ts');
const { Branch } = load('src/server/models/branch.model.ts');
const { StaffEmployment } = load('src/server/models/workforce.model.ts');
const { ROLE_PERMISSION_MAP } = load('src/server/constants/permissions.constant.ts');
const { DEFAULT_POLICY } = load('src/lib/workforce-math.ts');
const bcrypt = require('bcryptjs');
const database = 'acadivo_biometric_practice';
(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/' + database + '?replicaSet=acadivoDemo', { serverSelectionTimeoutMS: 10000 });
    if (mongoose.connection.name !== database) throw new Error('Unexpected database; stopped.');
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const school = await School.findOneAndUpdate({ code: 'biometric-practice' }, { $setOnInsert: {
      name: 'DEMO Biometric Practice School', code: 'biometric-practice', slug: 'biometric-practice',
      email: 'school@biometric.example.invalid', phone: '03000000000', address: 'Local testing only',
      teacherCount: 1, studentCountRange: '1-200', plan: 'ENTERPRISE', status: 'ACTIVE',
      attendanceMode: 'MANUAL', attendancePolicy: DEFAULT_POLICY, attendanceSetupCompletedAt: new Date()
    } }, { upsert: true, new: true, runValidators: true });
    await Branch.findOneAndUpdate({ _id: school._id }, { $setOnInsert: {
      organizationId: school._id, name: 'Practice Main Branch', code: 'main', address: 'Local testing only',
      phone: '03000000000', status: 'ACTIVE', isMain: true
    } }, { upsert: true, runValidators: true });
    const passwordHash = await bcrypt.hash('LocalDemo2026!Pass', 12);
    for (const [type, name, email, id] of [
      ['SCHOOL_ADMIN', 'Practice Administrator', 'admin@biometric.example.invalid', null],
      ['TEACHER', 'Demo Teacher', 'teacher@biometric.example.invalid', 'DEMO-101'],
      ['FINANCE', 'Demo Staff', 'staff@biometric.example.invalid', 'DEMO-102']
    ]) {
      const role = await Role.findOneAndUpdate({ schoolId: null, code: 'ROLE_' + type }, { $setOnInsert: {
        name: type, userType: type, permissions: ROLE_PERMISSION_MAP[type], isSystemRole: true
      } }, { upsert: true, new: true, runValidators: true });
      const user = await User.findOneAndUpdate({ email }, { $setOnInsert: {
        schoolId: school._id, organizationId: school._id, branchId: school._id,
        name, passwordHash, userType: type, status: 'ACTIVE', isEmailVerified: true,
        roleId: role._id, isOrganizationOwner: type === 'SCHOOL_ADMIN'
      } }, { upsert: true, new: true, runValidators: true });
      if (id) await StaffEmployment.findOneAndUpdate({ schoolId: school._id, userId: user._id }, { $setOnInsert: {
        organizationId: school._id, branchId: school._id, employeeId: id,
        department: type === 'TEACHER' ? 'Teaching' : 'Finance', designation: name,
        joiningDate: '2026-01-01', status: 'ACTIVE',
        salaryHistory: [{ effectiveDate: '2026-01-01', amount: 30000, basis: 'MONTHLY' }]
      } }, { upsert: true, runValidators: true });
    }
    console.log('SUCCESS: Local practice school is ready.');
    console.log('School: DEMO Biometric Practice School');
    console.log('Employees: Demo Teacher and Demo Staff');
    console.log('Online database and project .env were not changed.');
  } catch (error) { console.error('FAILED: ' + error.message); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
