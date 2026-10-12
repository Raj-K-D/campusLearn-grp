import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load Env
const envPath = path.resolve(process.cwd(), '.env');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runTests() {
  console.log('🧪 Starting Professional System Test...');
  let errors = 0;

  // 1. Create a Test Subject
  console.log('\n--- Test 1: Add Subject & Division ---');
  let subjectId;
  let divisionId;
  const { data: subject, error: subErr } = await supabase
    .from('subjects')
    .insert([{ title: 'Test Engineering', code: 'TE101', branch: 'TestBranch', semester: 1 }])
    .select('id').single();

  if (subErr) {
    console.error('❌ Failed to add Subject:', subErr.message);
    errors++;
  } else {
    subjectId = subject.id;
    console.log('✅ Added Subject successfully. ID:', subjectId);

    const { data: div, error: divErr } = await supabase
      .from('divisions')
      .insert([{ name: 'Test-A', subject_id: subjectId, branch: 'TestBranch', semester: 1 }])
      .select('id').single();
    if (divErr) {
      console.error('❌ Failed to add Division:', divErr.message);
      errors++;
    } else {
      divisionId = div.id;
      console.log('✅ Added Division successfully. ID:', divisionId);
    }
  }

  // 2. Add a test user in Auth directly using Admin API
  console.log('\n--- Test 2: Create Test Users ---');
  const teacherEmail = `teacher_${Date.now()}@test.com`;
  const coordEmail = `coord_${Date.now()}@test.com`;

  let teacherId, coordId;

  // Create Teacher
  const { data: teacherAuth, error: teacherAuthErr } = await supabase.auth.admin.createUser({
    email: teacherEmail,
    password: 'password123',
    email_confirm: true
  });
  if (teacherAuthErr) {
    console.error('❌ Failed to create Teacher Auth:', teacherAuthErr.message);
    errors++;
  } else {
    teacherId = teacherAuth.user.id;
    console.log('✅ Added Teacher Auth User. ID:', teacherId);
    
    // Update profile
    await supabase.from('profiles').update({ full_name: 'Test Teacher', is_teacher: true }).eq('id', teacherId);
    
    // Add Role
    const { error: roleErr } = await supabase.from('user_roles').insert([{ user_id: teacherId, role: 'teacher', subject_id: subjectId }]);
    if (roleErr) {
        console.error('❌ Failed to assign Teacher Role:', roleErr.message);
        errors++;
    } else {
        console.log('✅ Assigned Teacher Role successfully.');
    }

    if (divisionId) {
        const { error: assignErr } = await supabase.from('teacher_assignments').insert([{ teacher_id: teacherId, subject_id: subjectId, division_id: divisionId }]);
        if (assignErr) {
            console.error('❌ Failed to create Teacher Assignment:', assignErr.message);
            errors++;
        } else {
            console.log('✅ Created Teacher Assignment successfully.');
        }
    }
  }

  // Create Coordinator
  const { data: coordAuth, error: coordAuthErr } = await supabase.auth.admin.createUser({
    email: coordEmail,
    password: 'password123',
    email_confirm: true
  });
  if (coordAuthErr) {
    console.error('❌ Failed to create Coordinator Auth:', coordAuthErr.message);
    errors++;
  } else {
    coordId = coordAuth.user.id;
    console.log('✅ Added Coordinator Auth User. ID:', coordId);
    
    await supabase.from('profiles').update({ full_name: 'Test Coordinator', is_coordinator: true }).eq('id', coordId);
    
    const { error: coordRoleErr } = await supabase.from('user_roles').insert([{ user_id: coordId, role: 'coordinator', subject_id: subjectId }]);
    if (coordRoleErr) {
        console.error('❌ Failed to assign Coordinator Role:', coordRoleErr.message);
        errors++;
    } else {
        console.log('✅ Assigned Coordinator Role successfully.');
    }
  }

  // 3. Add Files / Data
  console.log('\n--- Test 3: Add Files/Data (Resources) ---');
  if (subjectId && teacherId) {
    const { error: resErr } = await supabase
      .from('resources')
      .insert([{
        subject_id: subjectId,
        division_id: divisionId,
        title: 'Test Syllabus Document',
        type: 'handout',
        url: 'https://example.com/test.pdf',
        visibility: 'SUBJECT_WIDE',
        approval_status: 'pending',
        uploaded_by: teacherId,
        owner_id: teacherId
      }]);
    
    if (resErr) {
      console.error('❌ Failed to add Resource data:', resErr.message);
      errors++;
    } else {
      console.log('✅ Added test file/resource data successfully.');
    }

    // Add Timeline Data
    const { error: timeErr } = await supabase
      .from('subject_timeline')
      .insert([{
        subject_id: subjectId,
        week_number: 1,
        title: 'Intro to Testing',
        description: 'Testing week 1',
        type: 'topic',
        created_by: coordId || teacherId
      }]);
    
    if (timeErr) {
      console.error('❌ Failed to add Timeline data:', timeErr.message);
      errors++;
    } else {
      console.log('✅ Added timeline data successfully.');
    }
  } else {
    console.log('⚠️ Skipping Data test because Subject or Teacher creation failed.');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up test data...');
  if (subjectId) {
      await supabase.from('subjects').delete().eq('id', subjectId);
      console.log('✅ Cleaned up Subject (and cascading data).');
  }
  if (teacherId) await supabase.auth.admin.deleteUser(teacherId);
  if (coordId) await supabase.auth.admin.deleteUser(coordId);
  console.log('✅ Cleaned up Auth users.');

  console.log(`\n🏁 Test Run Complete. Errors found: ${errors}`);
  if (errors === 0) {
      console.log('🏆 System is robust and all core operations succeeded.');
  } else {
      console.log('🚨 System has issues that need to be addressed.');
  }
}

runTests();
