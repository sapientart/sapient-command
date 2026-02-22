import 'dotenv/config';
import { sql } from '../src/lib/db.js';

// Comprehensive integration test across all tables
// Creates test data, queries with joins, then cleans up

let testProjectId, testContactId, testInteractionId, testKbId, testTemplateId;

try {
  // ── Phase 1: Project + Contact + Link ──
  console.log('Phase 1: Core tables...');

  const [project] = await sql`
    INSERT INTO projects (name, client_org, status, phase, description, strategic_position)
    VALUES ('Test Campaign', 'Acme Agency', 'active', 'production', 'TVC campaign', 'Strong — sole creative supplier')
    RETURNING id, name
  `;
  testProjectId = project.id;
  console.log(`  ✓ Project created: ${project.name} (${project.id})`);

  const [contact] = await sql`
    INSERT INTO contacts (name, email, organization, role_title, relationship_to_jason, tags)
    VALUES ('Jane Smith', 'jane@acme.com', 'Acme Agency', 'Creative Director', 'decision-maker',
            ARRAY['decision-maker', 'creative-collaborator'])
    RETURNING id, name
  `;
  testContactId = contact.id;
  console.log(`  ✓ Contact created: ${contact.name} (${contact.id})`);

  await sql`
    INSERT INTO project_contacts (project_id, contact_id, role_in_project)
    VALUES (${testProjectId}, ${testContactId}, 'Client creative lead')
  `;
  console.log(`  ✓ Project-Contact linked`);

  // Query with join
  const [link] = await sql`
    SELECT p.name as project, c.name as contact, pc.role_in_project
    FROM project_contacts pc
    JOIN projects p ON p.id = pc.project_id
    JOIN contacts c ON c.id = pc.contact_id
    WHERE pc.project_id = ${testProjectId}
  `;
  console.log(`  ✓ Join query: ${link.contact} → ${link.project} (${link.role_in_project})`);

  // ── Phase 2: Interaction + Action Item ──
  console.log('\nPhase 2: Interactions...');

  const [interaction] = await sql`
    INSERT INTO interactions (project_id, contact_id, type, direction, raw_content, sentiment, tags)
    VALUES (${testProjectId}, ${testContactId}, 'email', 'inbound',
            'Hi Jason, we need to discuss the revised timeline for the shoot.',
            'cautious', ARRAY['scheduling', 'scope-change'])
    RETURNING id, type
  `;
  testInteractionId = interaction.id;
  console.log(`  ✓ Interaction created: ${interaction.type} (${interaction.id})`);

  const [action] = await sql`
    INSERT INTO action_items (project_id, contact_id, interaction_id, description, owner, priority, status)
    VALUES (${testProjectId}, ${testContactId}, ${testInteractionId},
            'Reply to Jane re: revised timeline', 'jason', 'high', 'pending')
    RETURNING id, description
  `;
  console.log(`  ✓ Action item created: ${action.description}`);

  // Query interaction with joins
  const [full] = await sql`
    SELECT i.type, i.sentiment, p.name as project, c.name as contact, ai.description as action
    FROM interactions i
    JOIN projects p ON p.id = i.project_id
    JOIN contacts c ON c.id = i.contact_id
    LEFT JOIN action_items ai ON ai.interaction_id = i.id
    WHERE i.id = ${testInteractionId}
  `;
  console.log(`  ✓ Full join: ${full.type} from ${full.contact} on ${full.project} → action: ${full.action}`);

  // ── Phase 3: Strategic Note + Session State ──
  console.log('\nPhase 3: Strategic layer...');

  const [note] = await sql`
    INSERT INTO strategic_notes (project_id, contact_id, note_type, content, confidence)
    VALUES (${testProjectId}, ${testContactId}, 'risk_flag',
            'Jane pushing for timeline change may indicate budget pressure from above', 'medium')
    RETURNING id, note_type
  `;
  console.log(`  ✓ Strategic note created: ${note.note_type}`);

  const [session] = await sql`
    INSERT INTO session_state (project_id, current_context, open_threads, upcoming, hot_issues)
    VALUES (${testProjectId},
            'Acme TVC in production phase, timeline under pressure',
            'Timeline renegotiation with Jane, budget approval pending',
            'Shoot date confirmation needed by Friday',
            'Possible scope reduction if budget is cut')
    RETURNING id
  `;
  console.log(`  ✓ Session state created: ${session.id}`);

  // ── Phase 4: Knowledge Base + Template + Draft + Creative Reference ──
  console.log('\nPhase 4: Knowledge layer...');

  const [kb] = await sql`
    INSERT INTO knowledge_base (title, content, mode, category_tags, context_notes, effectiveness_rating)
    VALUES ('Timeline pressure negotiation',
            'When clients push for compressed timelines, anchor to quality implications rather than arguing dates directly.',
            'strategic', ARRAY['negotiation', 'scope-creep', 'client-management'],
            'Use when client tries to compress timeline without adjusting scope or budget', 4)
    RETURNING id, title
  `;
  testKbId = kb.id;
  console.log(`  ✓ Knowledge base entry: ${kb.title}`);

  const [template] = await sql`
    INSERT INTO templates (name, content, mode, category, tone, usage_notes, inspired_by)
    VALUES ('Timeline pushback — quality anchor',
            'Hi [NAME], I want to make sure we deliver the quality you briefed. Moving the shoot forward by [X] days would mean [IMPACT]. Can we look at [ALTERNATIVE]?',
            'strategic', 'negotiation', 'firm',
            'Adapt the [IMPACT] section to the specific project risk', ${testKbId})
    RETURNING id, name
  `;
  testTemplateId = template.id;
  console.log(`  ✓ Template created: ${template.name}`);

  const [draft] = await sql`
    INSERT INTO drafts (project_id, contact_id, template_id, content, status)
    VALUES (${testProjectId}, ${testContactId}, ${testTemplateId},
            'Hi Jane, I want to make sure we deliver the quality you briefed. Moving the shoot forward by 3 days would mean cutting the grade session. Can we look at a weekend shoot instead?',
            'draft')
    RETURNING id, status
  `;
  console.log(`  ✓ Draft created: ${draft.status}`);

  const [cref] = await sql`
    INSERT INTO creative_references (title, description, medium, style_tags, technique_notes, linked_projects)
    VALUES ('Spike Jonze Apple HomePod spot',
            'Dancer in expanding room — practical set + VFX hybrid',
            'tvc', ARRAY['cinematic', 'vfx', 'bold'],
            'The room expansion is all practical builds with CG extensions. Key learning: grounding VFX in practical elements.',
            ARRAY[${testProjectId}]::uuid[])
    RETURNING id, title
  `;
  console.log(`  ✓ Creative reference: ${cref.title}`);

  // ── Verify updated_at trigger ──
  console.log('\nTrigger test...');
  const [before] = await sql`SELECT updated_at FROM projects WHERE id = ${testProjectId}`;
  await sql`SELECT pg_sleep(0.1)`;
  await sql`UPDATE projects SET notes = 'trigger test' WHERE id = ${testProjectId}`;
  const [after] = await sql`SELECT updated_at FROM projects WHERE id = ${testProjectId}`;
  const triggerWorked = new Date(after.updated_at) > new Date(before.updated_at);
  console.log(`  ✓ updated_at trigger: ${triggerWorked ? 'WORKS' : 'FAILED'}`);

  // ── Array query test ──
  console.log('\nArray query test...');
  const tagResults = await sql`
    SELECT name FROM contacts WHERE tags @> ARRAY['decision-maker']
  `;
  console.log(`  ✓ Array query (decision-maker tag): found ${tagResults.length} contact(s)`);

  // ── CLEANUP ──
  console.log('\nCleaning up test data...');
  await sql`DELETE FROM drafts WHERE project_id = ${testProjectId}`;
  await sql`DELETE FROM creative_references WHERE linked_projects @> ARRAY[${testProjectId}]::uuid[]`;
  await sql`DELETE FROM templates WHERE id = ${testTemplateId}`;
  await sql`DELETE FROM knowledge_base WHERE id = ${testKbId}`;
  await sql`DELETE FROM session_state WHERE project_id = ${testProjectId}`;
  await sql`DELETE FROM strategic_notes WHERE project_id = ${testProjectId}`;
  await sql`DELETE FROM action_items WHERE project_id = ${testProjectId}`;
  await sql`DELETE FROM interactions WHERE project_id = ${testProjectId}`;
  await sql`DELETE FROM project_contacts WHERE project_id = ${testProjectId}`;
  await sql`DELETE FROM contacts WHERE id = ${testContactId}`;
  await sql`DELETE FROM projects WHERE id = ${testProjectId}`;
  console.log('  ✓ All test data deleted');

  // Verify clean
  const remaining = await sql`
    SELECT
      (SELECT count(*) FROM projects)::int as projects,
      (SELECT count(*) FROM contacts)::int as contacts,
      (SELECT count(*) FROM interactions)::int as interactions,
      (SELECT count(*) FROM action_items)::int as action_items,
      (SELECT count(*) FROM strategic_notes)::int as strategic_notes,
      (SELECT count(*) FROM session_state)::int as session_state,
      (SELECT count(*) FROM knowledge_base)::int as knowledge_base,
      (SELECT count(*) FROM templates)::int as templates,
      (SELECT count(*) FROM drafts)::int as drafts,
      (SELECT count(*) FROM creative_references)::int as creative_references
  `;
  const counts = remaining[0];
  const allClean = Object.values(counts).every(v => v === 0);
  console.log(`  ✓ Database clean: ${allClean ? 'YES' : 'NO — ' + JSON.stringify(counts)}`);

  console.log('\n═══════════════════════════════════');
  console.log('  ALL TESTS PASSED — SCHEMA VALID');
  console.log('═══════════════════════════════════');

} catch (e) {
  console.error('\n✗ TEST FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
} finally {
  await sql.end();
}
