import 'dotenv/config';
import { sql } from '../src/lib/db.js';

// ─────────────────────────────────────────────
// SHARED: updated_at trigger function
// ─────────────────────────────────────────────
const phase0 = `
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

// ─────────────────────────────────────────────
// PHASE 1: Projects, Contacts, Project_Contacts
// ─────────────────────────────────────────────
const phase1 = `
-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_org text,
  status text DEFAULT 'active',
  phase text,
  start_date date,
  description text,
  strategic_position text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  organization text,
  role_title text,
  relationship_to_jason text,
  communication_style text,
  personality_notes text,
  leverage_notes text,
  preferred_tone text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Project-Contacts junction
CREATE TABLE IF NOT EXISTS project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role_in_project text,
  UNIQUE(project_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_project ON project_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contacts_contact ON project_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
`;

// ─────────────────────────────────────────────
// PHASE 2: Interactions, Action Items
// ─────────────────────────────────────────────
const phase2 = `
-- Interactions
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  type text NOT NULL,
  direction text,
  date timestamptz DEFAULT now(),
  raw_content text,
  ai_summary text,
  sentiment text,
  subtext_analysis text,
  red_flags text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER interactions_updated_at
  BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_interactions_project ON interactions(project_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_tags ON interactions USING GIN(tags);

-- Action Items
CREATE TABLE IF NOT EXISTS action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  interaction_id uuid REFERENCES interactions(id) ON DELETE SET NULL,
  description text NOT NULL,
  owner text,
  priority text,
  deadline date,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_action_items_project ON action_items(project_id);
CREATE INDEX IF NOT EXISTS idx_action_items_contact ON action_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_action_items_interaction ON action_items(interaction_id);
`;

// ─────────────────────────────────────────────
// PHASE 3: Strategic Notes, Session State
// ─────────────────────────────────────────────
const phase3 = `
-- Strategic Notes
CREATE TABLE IF NOT EXISTS strategic_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  note_type text,
  content text NOT NULL,
  confidence text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategic_notes_project ON strategic_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_strategic_notes_contact ON strategic_notes(contact_id);

-- Session State
CREATE TABLE IF NOT EXISTS session_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  last_updated timestamptz DEFAULT now(),
  current_context text,
  open_threads text,
  upcoming text,
  hot_issues text
);

CREATE INDEX IF NOT EXISTS idx_session_state_project ON session_state(project_id);
`;

// ─────────────────────────────────────────────
// PHASE 4: Knowledge Base, Templates, Drafts, Creative References
// ─────────────────────────────────────────────
const phase4 = `
-- Knowledge Base
CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  raw_input text,
  mode text,
  category_tags text[],
  context_notes text,
  attribution text,
  effectiveness_rating integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category_tags ON knowledge_base USING GIN(category_tags);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  mode text,
  category text,
  tone text,
  usage_notes text,
  times_used integer DEFAULT 0,
  inspired_by uuid REFERENCES knowledge_base(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_templates_inspired_by ON templates(inspired_by);

-- Drafts
CREATE TABLE IF NOT EXISTS drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  content text NOT NULL,
  status text DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_drafts_project ON drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_drafts_contact ON drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_drafts_template ON drafts(template_id);

-- Creative References
CREATE TABLE IF NOT EXISTS creative_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  medium text,
  style_tags text[],
  technique_notes text,
  raw_input text,
  attribution text,
  linked_projects uuid[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creative_references_style_tags ON creative_references USING GIN(style_tags);
CREATE INDEX IF NOT EXISTS idx_creative_references_linked_projects ON creative_references USING GIN(linked_projects);
`;

// ─────────────────────────────────────────────
// EXECUTE ALL PHASES
// ─────────────────────────────────────────────
const phases = [
  { name: 'Phase 0: updated_at trigger function', sql: phase0 },
  { name: 'Phase 1: projects, contacts, project_contacts', sql: phase1 },
  { name: 'Phase 2: interactions, action_items', sql: phase2 },
  { name: 'Phase 3: strategic_notes, session_state', sql: phase3 },
  { name: 'Phase 4: knowledge_base, templates, drafts, creative_references', sql: phase4 },
];

for (const phase of phases) {
  console.log(`Running ${phase.name}...`);
  try {
    await sql.unsafe(phase.sql);
    console.log(`  ✓ ${phase.name} complete`);
  } catch (e) {
    console.error(`  ✗ ${phase.name} failed:`, e.message);
    await sql.end();
    process.exit(1);
  }
}

// Verify all tables exist
const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;
console.log('\nTables created:');
tables.forEach(t => console.log(`  • ${t.table_name}`));

await sql.end();
console.log('\nMigration complete!');
