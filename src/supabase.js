import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase env vars');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------- Auth ----------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (profileError) throw profileError;
  return { ...data.user, ...profile };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ---------- Create Industrial Supervisor (called by organisation) ----------
export async function createIndustrialSupervisor(organisationId, email, password, name) {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (authError) throw authError;

  // 2. Immediately sign in to get session (so insert works)
  await supabase.auth.signInWithPassword({ email, password });

  // 3. Insert profile with organisation link
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    email,
    name,
    role: 'supervisor',
    sup_type: 'industrial',
    organisation_id: organisationId,
  });
  if (profileError) throw profileError;

  // 4. Sign out (back to organisation account – but we'll handle session carefully)
  // Better: we don't sign out; we just return and organisation stays logged in.
  // The organisation already has a session. The new supervisor can log in separately.
  return authData.user;
}

// ---------- Users ----------
export async function getAllUsers() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return data;
}

export async function getUsersByRole(role) {
  if (role === 'student') {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        industrial_supervisor:industrial_supervisor_id (id, name, email),
        university_supervisor:university_supervisor_id (id, name, email)
      `)
      .eq('role', role);
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', role);
    if (error) throw error;
    return data;
  }
}

export async function getUserById(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updateUser(id, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

// ---------- Organisations ----------
export async function getOrgsByStatus(status) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'organization')
    .eq('org_status', status);
  if (error) throw error;
  return data;
}
export async function getStudentsBySupervisor(supervisorId, type = 'industrial') {
  const column = type === 'industrial' ? 'industrial_supervisor_id' : 'university_supervisor_id';
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq(column, supervisorId);
  if (error) throw error;
  return data || [];
}

export async function approveOrg(orgId) {
  const { error } = await supabase
    .from('profiles')
    .update({ org_status: 'approved', rejection_reason: null })
    .eq('id', orgId);
  if (error) throw error;
}

export async function rejectOrg(orgId, reason) {
  const { error } = await supabase
    .from('profiles')
    .update({ org_status: 'rejected', rejection_reason: reason })
    .eq('id', orgId);
  if (error) throw error;
}

// ---------- Allocation (auto-assign industrial supervisor) ----------
export async function allocateStudent(studentId, orgId) {
  // Get organisation's default industrial supervisor
  const { data: org, error: orgError } = await supabase
    .from('profiles')
    .select('default_industrial_supervisor_id')
    .eq('id', orgId)
    .single();
  if (orgError) throw orgError;

  const updates = { allocated_org: orgId };
  if (org.default_industrial_supervisor_id) {
    updates.industrial_supervisor_id = org.default_industrial_supervisor_id;
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', studentId);
  if (error) throw error;
}

export async function deallocateStudent(studentId) {
  const { error } = await supabase
    .from('profiles')
    .update({ allocated_org: null, industrial_supervisor_id: null })
    .eq('id', studentId);
  if (error) throw error;
}

// ---------- Industrial Supervisor Management ----------
export async function getOrganisationIndustrialSupervisors(orgId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('organisation_id', orgId)
    .eq('role', 'supervisor')
    .eq('sup_type', 'industrial');
  if (error) throw error;
  return data;
}

export async function setDefaultIndustrialSupervisor(orgId, supervisorId) {
  const { error } = await supabase
    .from('profiles')
    .update({ default_industrial_supervisor_id: supervisorId })
    .eq('id', orgId);
  if (error) throw error;
}

// ---------- Global University Supervisor ----------
export async function getGlobalUniversitySupervisor() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'supervisor')
    .eq('sup_type', 'university')
    .limit(1);
  if (error) throw error;
  return data[0]?.id || null;
}

// ---------- Logbooks ----------
export async function getAllLogbooks() {
  const { data, error } = await supabase
    .from('logbooks')
    .select('*, student:profiles!student_id(*)');
  if (error) throw error;
  return data;
}

export async function getStudentLogbooks(studentId) {
  const { data, error } = await supabase
    .from('logbooks')
    .select('*')
    .eq('student_id', studentId);
  if (error) throw error;
  return data;
}

export async function submitLogbook({ studentId, week, title, body, date }) {
  const { error } = await supabase.from('logbooks').insert({
    student_id: studentId,
    week,
    title,
    body,
    date,
    status: 'pending',
  });
  if (error) throw error;
}

export async function reviewLogbook(logbookId, status, comment) {
  const { error } = await supabase
    .from('logbooks')
    .update({ status, comment })
    .eq('id', logbookId);
  if (error) throw error;
}

// ---------- Supervisor Reports & Assessments ----------
export async function submitSupReport({ studentId, supervisorId, content, week }) {
  const { error } = await supabase.from('supervisor_reports').insert({
    student_id: studentId,
    supervisor_id: supervisorId,
    content,
    week,
  });
  if (error) throw error;
}

export async function getSupReports(supervisorId = null) {
  let query = supabase
    .from('supervisor_reports')
    .select('*, student:profiles!student_id(*), supervisor:profiles!supervisor_id(*)');
  if (supervisorId) query = query.eq('supervisor_id', supervisorId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAllAssessments() {
  const { data, error } = await supabase
    .from('assessments')
    .select('*, student:profiles!student_id(*), coordinator:profiles!coordinator_id(*)');
  if (error) throw error;
  return data;
}

export async function submitAssessment({ studentId, coordinatorId, score, feedback, assessType = 'midterm' }) {
  const { error } = await supabase.from('assessments').insert({
    student_id: studentId,
    coordinator_id: coordinatorId,
    score,
    feedback,
    assess_type: assessType,
    date: new Date().toISOString().slice(0, 10),
    status: 'submitted',
  });
  if (error) throw error;
}

// ---------- Registration (for students and orgs) ----------
export async function registerUser(profileData, password) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: profileData.email,
    password,
  });
  if (authError) throw authError;

  // Sign in to get session for profile insert
  await supabase.auth.signInWithPassword({ email: profileData.email, password });

  const uniSupervisorId = await getGlobalUniversitySupervisor();

  const insertData = {
    id: authData.user.id,
    ...profileData,
  };
  if (profileData.role === 'student' && uniSupervisorId) {
    insertData.university_supervisor_id = uniSupervisorId;
  }

  const { error: profileError } = await supabase.from('profiles').insert(insertData);
  if (profileError) throw profileError;

  return authData.user;
}