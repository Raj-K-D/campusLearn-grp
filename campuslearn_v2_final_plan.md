# CampusLearn v2 — Complete Final Plan

> All decisions confirmed. Say "start coding" to begin.

---

## Decision Summary

| Topic | Decision |
|---|---|
| `pinnedSemester` storage | Supabase `profiles` table (cross-device) |
| Peek Mode | Available to all authenticated roles |
| Teacher resource permissions | Direct CRUD when coordinator grants access via `teacher_resource_permissions` table |
| TA1/TA2 papers — where shown | Inside the **Question Papers tab** of `SubjectPage.jsx` (NOT Faculty Workshop) |
| TA1/TA2 papers — who sees | Teachers + Coordinators + Admins see them across **all subjects**; Students get lock screen |
| TA1/TA2 papers — who uploads | Both teachers and coordinators; teachers = pending, coordinators = auto-approved |
| Faculty Workshop tab | Stays for coordinator announcements/posts only — separate from TA papers |
| Notifications | In-app badge counters on sidebar tabs, no emails |

---

## Phase 1 — SQL (Run in Supabase SQL Editor first)

### 1a — `profiles` table
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pinned_semester TEXT;
```

### 1b — `faculty_workspace` table (add TA paper fields)
```sql
ALTER TABLE faculty_workspace
  ADD COLUMN IF NOT EXISTS sub_type TEXT
    CHECK (sub_type IN ('TA1', 'TA2', NULL)),
  ADD COLUMN IF NOT EXISTS resource_url TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved'));
```

### 1c — Update RLS on `faculty_workspace` (block students entirely)
```sql
DROP POLICY IF EXISTS "faculty_workspace_restricted_read" ON faculty_workspace;

CREATE POLICY "faculty_workspace_restricted_read" ON faculty_workspace FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE OR is_teacher = TRUE)
    )
  );

DROP POLICY IF EXISTS "faculty_workspace_write" ON faculty_workspace;

CREATE POLICY "faculty_workspace_write" ON faculty_workspace FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE OR is_teacher = TRUE)
    )
  );

CREATE POLICY "faculty_workspace_update_own" ON faculty_workspace FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE)
    )
  );

CREATE POLICY "faculty_workspace_delete" ON faculty_workspace FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE)
    )
    OR (author_id = auth.uid() AND approval_status = 'pending')
  );
```

### 1d — `teacher_resource_permissions` table (elevated access grant)
```sql
CREATE TABLE IF NOT EXISTS teacher_resource_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  granted_by  UUID REFERENCES auth.users(id),
  granted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id)
);

ALTER TABLE teacher_resource_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trp_read" ON teacher_resource_permissions FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE))
  );

CREATE POLICY "trp_coord_write" ON teacher_resource_permissions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE))
  );

CREATE POLICY "trp_coord_delete" ON teacher_resource_permissions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_admin = TRUE OR is_coordinator = TRUE))
  );
```

### 1e — Update `resources` RLS (include elevated teachers)
```sql
DROP POLICY IF EXISTS "coordinator_can_update_subject_resources" ON resources;

CREATE POLICY "coordinator_can_update_subject_resources" ON resources FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    OR EXISTS (SELECT 1 FROM coordinator_subjects
               WHERE coordinator_id = auth.uid() AND subject_id = resources.subject_id)
    OR uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM teacher_resource_permissions
               WHERE teacher_id = auth.uid() AND subject_id = resources.subject_id)
  );

CREATE POLICY "elevated_teacher_can_delete_resources" ON resources FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    OR EXISTS (SELECT 1 FROM coordinator_subjects
               WHERE coordinator_id = auth.uid() AND subject_id = resources.subject_id)
    OR EXISTS (SELECT 1 FROM teacher_resource_permissions
               WHERE teacher_id = auth.uid() AND subject_id = resources.subject_id)
  );
```

### 1f — `modification_requests` table (for non-elevated teachers)
```sql
CREATE TABLE IF NOT EXISTS modification_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requester_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_table      TEXT NOT NULL
    CHECK (target_table IN ('resources', 'subjects', 'subject_timeline')),
  target_id         TEXT NOT NULL,
  proposed_changes  JSONB NOT NULL,
  original_snapshot JSONB,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id       UUID REFERENCES auth.users(id),
  reviewed_at       TIMESTAMPTZ,
  reviewer_notes    TEXT
);

ALTER TABLE modification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mr_insert" ON modification_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "mr_read" ON modification_requests FOR SELECT
  USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_coordinator = TRUE OR is_admin = TRUE))
  );

CREATE POLICY "mr_update_coord" ON modification_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_coordinator = TRUE OR is_admin = TRUE))
  );
```

---

## Phase 2 — `AuthContext.jsx`

### Changes
1. Load `pinned_semester` from profile after fetch → set state
2. `setPinnedSemester(sem)` — updates state + Supabase `profiles` row
3. Load `teacher_resource_permissions` and merge into `userRoles` as `'resource_manager'` role entries
4. Add `isFaculty()` helper
5. Add `hasElevatedResourceAccess(subjectId)` helper
6. Expose all new values in context

### New state & functions
```js
// State
const [pinnedSemester, setPinnedSemesterState] = useState(null);

// Load in fetchUserProfile after setProfile(prof):
setPinnedSemesterState(prof?.pinned_semester || null);

// Also fetch teacher_resource_permissions and merge:
const { data: trp } = await supabase
  .from('teacher_resource_permissions')
  .select('subject_id')
  .eq('teacher_id', userId);
const trpRoles = (trp || []).map(r => ({ role: 'resource_manager', subject_id: r.subject_id }));
setUserRoles([...(roles || []), ...trpRoles]);

// Setter syncs to DB
async function setPinnedSemester(sem) {
  setPinnedSemesterState(sem);
  await supabase.from('profiles').update({ pinned_semester: sem }).eq('id', user.id);
}

// Helpers
function isFaculty() {
  return isAdmin || isCoordinator || isTeacher;
}

function hasElevatedResourceAccess(subjectId) {
  if (isAdmin || isCoordinatorOf(subjectId)) return true;
  return userRoles.some(r =>
    r.role === 'resource_manager' && String(r.subject_id) === String(subjectId)
  );
}
```

### Add to context value object
```js
pinnedSemester, setPinnedSemester, isFaculty, hasElevatedResourceAccess
```

---

## Phase 3 — `StudentDashboard.jsx`

### What changes
| Element | Before | After |
|---|---|---|
| Subject data | Filtered by enrollment | All subjects matching user's `degreeId` |
| Home tab | Current semester subjects | Pinned semester section + quick-explore strip |
| Sidebar | 4 nav items | +1 "Course Explorer" item |
| Subject card actions | Open + Bookmark | Role-aware (see below) |
| New banner | — | Pinned / Peek mode toggle |

### Subject card — role-aware buttons
```jsx
// Students
<Link to={`/subject/${id}`}>Open →</Link>
<BookmarkButton />

// Coordinator
<Link to={`/subject/${id}`}>Open →</Link>
<Link to={`/coordinator?subject=${id}`}><FaCog /> Manage</Link>

// Teacher with elevated access
<Link to={`/subject/${id}`}>Open →</Link>
<span className="badge-green">Resource Access</span>

// Regular teacher (no elevation)
<Link to={`/subject/${id}`}>Open →</Link>
<button onClick={() => openSuggestEdit(subject)}><FaEdit /> Suggest Edit</button>
```

### Peek Mode banner (shown on subjects + explorer tabs)
```jsx
<div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 mb-5">
  <span className="text-sm font-bold text-indigo-800">
    {peekMode ? '👁 Peek Mode — Browsing All Semesters' : `📌 Pinned: Semester ${pinnedSemester}`}
  </span>
  <button onClick={() => setPeekMode(!peekMode)} className="ml-auto text-xs font-bold text-indigo-500 hover:underline">
    {peekMode ? `← Back to Sem ${pinnedSemester}` : 'Browse All'}
  </button>
</div>
```

### Course Explorer tab (new)
- All subjects for the degree, grouped by semester
- Each semester header: **"📌 Pin Semester X"** button → calls `setPinnedSemester(X)`
- If `pinnedSemester === X`, show "✅ Pinned" indicator instead

### Home tab — two sections when pinned
1. **"📖 Semester X — Your Focus"** — grid of subjects for pinned semester
2. **"🌐 Explore Other Semesters"** — 3-card strip from other semesters, "View All →" CTA

### `getEnrolledSubjects` — kept for stats only
Still used to compute: enrolled count, total credits, avg progress.  
Subject grid no longer uses it as a hard filter.

---

## Phase 4 — `SubjectPage.jsx`

### Question Papers tab — two-path rendering

**Path A — Student (`!isFaculty()`):**
```jsx
<div className="flex flex-col items-center justify-center h-64 text-center">
  <FaLock className="text-5xl text-gray-300 mb-4" />
  <h3 className="text-xl font-bold mb-2">Restricted Access</h3>
  <p className="text-gray-400 max-w-xs text-sm">
    TA1 and TA2 question papers are available to faculty only.
    Contact your subject coordinator for academic assistance.
  </p>
</div>
```

**Path B — Faculty (`isFaculty()`):**
```jsx
// Two sections in sequence
<TASection label="TA1 Question Papers" papers={ta1Papers} subType="TA1" />
<TASection label="TA2 Question Papers" papers={ta2Papers} subType="TA2" />
```

Each `TASection` shows:
- Resource cards (title, file type, Open/Download button)
- For teachers: **Upload TA Paper** button (opens inline upload form → inserts to `faculty_workspace` with `approval_status: 'pending'`)
- For coordinators: **Upload + Approve** button (inserts with `approval_status: 'approved'`) + Delete button on each card

### New `useEffect` for TA fetch
```js
const [ta1Papers, setTa1Papers] = useState([]);
const [ta2Papers, setTa2Papers] = useState([]);

useEffect(() => {
  if (activeTab !== 'question_papers' || !isFaculty()) return;

  async function fetchTaPapers() {
    const query = supabase
      .from('faculty_workspace')
      .select('*')
      .eq('subject_id', id)
      .in('sub_type', ['TA1', 'TA2']);

    // Coordinators see pending too; teachers only see approved + their own
    if (!isCoordinator && !isAdmin) {
      query.or(`approval_status.eq.approved,author_id.eq.${user.id}`);
    }

    const { data } = await query;
    setTa1Papers((data || []).filter(p => p.sub_type === 'TA1'));
    setTa2Papers((data || []).filter(p => p.sub_type === 'TA2'));
  }
  fetchTaPapers();
}, [activeTab, id, user]);
```

### Resource cards — Suggest Edit vs Direct Edit

**Regular teacher** (no elevation) — sees "Suggest Edit" button:
```jsx
<button onClick={() => setActiveSuggestEdit(item)}>
  <FaEdit /> Suggest Edit
</button>
// Opens <SuggestEditPanel> inline below card
```

**Elevated teacher / Coordinator** — sees inline edit + delete:
```jsx
<button onClick={() => setEditingItem(item)}><FaEdit /> Edit</button>
<button onClick={() => deleteResource(item.id)}><FaTrash /></button>
// Inline: pre-filled title + url fields, Save → supabase.update()
```

---

## Phase 5 — `TeacherDashboard.jsx`

### UploadModal — TA paper routing

When `form.type === 'question_papers'`, show TA type selector:
```jsx
{form.type === 'question_papers' && (
  <div>
    <label>Question Paper Type *</label>
    <div className="flex gap-3">
      {['TA1', 'TA2'].map(t => (
        <button type="button" key={t}
          onClick={() => setForm({ ...form, taType: t })}
          className={form.taType === t ? 'bg-red-600 text-white ...' : '...'}>
          {t}
        </button>
      ))}
    </div>
    {!form.taType && <p className="text-red-500 text-xs mt-1">Please select TA1 or TA2</p>}
  </div>
)}
```

On submit: if `isQP` (type = question_papers + taType set):
```js
await supabase.from('faculty_workspace').insert({
  subject_id: form.subject_id,
  title: form.title,
  resource_url: fileUrl || form.url,
  sub_type: form.taType,        // 'TA1' or 'TA2'
  type: 'question_paper',
  author_id: user.id,
  approval_status: isCoordinatorView ? 'approved' : 'pending',
});
```
Otherwise: existing `resources` table insert logic unchanged.

### New sidebar tab — "My Suggestions" (with badge)
```jsx
{ id: 'suggestions', label: 'My Suggestions', icon: <FaEdit />, badge: pendingCount }
```
- Fetches `modification_requests WHERE requester_id = me`
- Shows status badge per row: 🟡 Pending · ✅ Approved · ❌ Rejected
- Side-by-side diff: current value vs proposed value
- Cancel button for pending requests (DELETE)
- Badge count = total unreviewed (pending)

### New sidebar tab — "TA Papers" (with badge)
```jsx
{ id: 'ta_papers', label: 'My TA Papers', icon: <FaFileInvoice />, badge: pendingTaCount }
```
- Fetches `faculty_workspace WHERE author_id = me AND sub_type IN ('TA1','TA2')`
- Shows approval status per paper
- Badge count = papers still pending coordinator approval
- Can delete own pending papers

---

## Phase 6 — `CoordinatorDashboard.jsx`

### New sidebar tab — "Edit Requests" (badge = pending count)
```jsx
{ id: 'mod_requests', label: 'Edit Requests', icon: <FaInbox />, badge: pendingModCount }
```

#### Diff card for each pending request
```
┌── Edit Request ────────────────────────────────────────┐
│ Resource: "Unit 2 Notes"  ·  2h ago by Dr. Sharma     │
├──────────────────────┬─────────────────────────────────┤
│ CURRENT              │ PROPOSED                        │
│ title: "Unit 2"      │ title: "Unit 2 – Arrays Intro"  │
│ url: [old link]      │ url: [new drive link]           │
├──────────────────────┴─────────────────────────────────┤
│   [✅ Approve & Push Live]     [❌ Reject]             │
└────────────────────────────────────────────────────────┘
```

#### Approve logic
```js
async function approveModRequest(req) {
  const { error } = await supabase
    .from(req.target_table).update(req.proposed_changes).eq('id', req.target_id);
  if (error) return showToast('Failed: ' + error.message, 'error');

  await supabase.from('modification_requests').update({
    status: 'approved',
    reviewer_id: user.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', req.id);

  fetchData();
  showToast('Change pushed live ✅');
}
```

### New sidebar tab — "TA Paper Approvals" (badge = pending count)
- Lists `faculty_workspace WHERE sub_type IN ('TA1','TA2') AND approval_status = 'pending'`
- Per row: title, sub_type badge, uploaded by, date
- **Approve** → `UPDATE approval_status = 'approved'`
- **Delete** → remove row entirely

### New feature in "Manage Teachers" tab — Permission Grant Toggle
For each teacher row, per subject assigned:
```
Dr. Sharma  ·  Machine Learning
  [🔓 Grant Direct Resource Access]  ← toggle ON/OFF

ON  → INSERT into teacher_resource_permissions
OFF → DELETE from teacher_resource_permissions
```
Visual state: green "✅ Access Granted" pill when active.

---

## Phase 7 — New File: `SuggestEditPanel.jsx`

**Location:** `src/components/SuggestEditPanel.jsx`

```
Props:
  - resource: { id, title, url, type }
  - subjectId: string
  - onClose: () => void
  - onSubmitted: (msg) => void   ← toast callback

UI:
  - Title input (pre-filled)
  - URL input (pre-filled)
  - Note/reason textarea
  - [Submit Suggestion] [Cancel]

On submit:
  INSERT INTO modification_requests {
    requester_id: user.id,
    target_table: 'resources',
    target_id: resource.id,
    proposed_changes: { title, url, note },
    original_snapshot: { title: resource.title, url: resource.url }
  }
  → calls onSubmitted('Suggestion submitted for review ✅')
  → calls onClose()
```

---

## Notification Badge System

| Role | Tab | Badge Source | Count |
|---|---|---|---|
| Teacher | My Suggestions | `modification_requests` WHERE `requester_id = me` AND `status = 'pending'` | Unreviewed |
| Teacher | My TA Papers | `faculty_workspace` WHERE `author_id = me` AND `approval_status = 'pending'` | Awaiting approval |
| Coordinator | Edit Requests | `modification_requests` WHERE `status = 'pending'` | Needs action |
| Coordinator | TA Paper Approvals | `faculty_workspace` WHERE `approval_status = 'pending'` | Needs action |

Badges are red circles with count, shown on sidebar nav items. Refetched on tab change.

---

## Complete File Change Table

| File | Type | Summary |
|---|---|---|
| Supabase SQL | Schema | `pinned_semester` on profiles; TA columns on faculty_workspace; `teacher_resource_permissions`; `modification_requests`; updated RLS on resources + faculty_workspace |
| `AuthContext.jsx` | Modify | `pinnedSemester` state (Supabase-synced); `isFaculty()`; `hasElevatedResourceAccess()`; load TRP into userRoles |
| `StudentDashboard.jsx` | Major refactor | Global subject view; pinned semester sections; peek mode toggle; Course Explorer tab; role-aware card buttons |
| `SubjectPage.jsx` | Tab refactor | `question_papers` tab: student lock screen vs faculty TA1/TA2 sections; Suggest Edit vs Direct Edit on resource cards |
| `TeacherDashboard.jsx` | Upload + tabs | TA type selector in UploadModal routing to `faculty_workspace`; "My Suggestions" tab; "My TA Papers" tab |
| `CoordinatorDashboard.jsx` | New tabs + feature | "Edit Requests" diff inbox; "TA Paper Approvals" queue; Permission Grant toggle in Manage Teachers |
| `SuggestEditPanel.jsx` | New file | Inline suggest-edit form → inserts to `modification_requests` |

---

## Execution Order

```
Step 1  →  SQL Schema (manual in Supabase)
Step 2  →  AuthContext.jsx
Step 3  →  StudentDashboard.jsx
Step 4  →  SubjectPage.jsx
Step 5  →  TeacherDashboard.jsx
Step 6  →  CoordinatorDashboard.jsx
Step 7  →  SuggestEditPanel.jsx  (new component)
```

> [!IMPORTANT]
> SQL must run before Step 2. The `hasElevatedResourceAccess()` function queries `teacher_resource_permissions` which must exist.

> [!NOTE]
> Faculty Workshop tab in TeacherDashboard remains for coordinator announcements/posts only. TA papers are a completely separate flow, rendered inside SubjectPage's question_papers tab.

---

**Reply "start coding" to begin execution.**
