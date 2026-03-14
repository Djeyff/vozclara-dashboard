-- VozClara + Retena — Seed Data
-- Migration: 002_seed.sql
-- Based on mock data from Batches 3 & 4

-- ═══════════════════════════════════════
-- SEED USER (Lord Kaan / Jeffrey)
-- ═══════════════════════════════════════

INSERT INTO users (id, email, phone, name, vc_tier, rt_tier, daily_notes_used, audio_minutes_used, daily_notes_limit)
VALUES (
  'e964b1e5-c32d-4809-9fdd-30f4242667b0',
  'djeyff06@gmail.com',
  '18092044903',
  'Jeffrey',
  'business',
  'pro',
  7,
  23.4,
  100
) ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════
-- VOZCLARA FOLDERS
-- ═══════════════════════════════════════

INSERT INTO vc_folders (id, user_id, name, color) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'e964b1e5-c32d-4809-9fdd-30f4242667b0', 'Construction', '#f59e0b'),
  ('f2000000-0000-0000-0000-000000000002', 'e964b1e5-c32d-4809-9fdd-30f4242667b0', 'Client Calls', '#6366f1'),
  ('f3000000-0000-0000-0000-000000000003', 'e964b1e5-c32d-4809-9fdd-30f4242667b0', 'Ideas', '#22c55e')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════
-- VOZCLARA TRANSCRIPTS (15 mock entries)
-- ═══════════════════════════════════════

INSERT INTO vc_transcripts (id, user_id, folder_id, text, language, source, duration_seconds, starred, summary, translation, created_at)
VALUES
  ('t1000000-0000-0000-0000-000000000001',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f1000000-0000-0000-0000-000000000001',
   'Hay que revisar los precios antes del lunes. El proveedor confirmó que el cemento subió un 15%. Roberto dice que hay que ajustar el presupuesto del segundo piso antes de firmar.',
   'es', 'whatsapp', 47, TRUE,
   '{"keyPoints":["Cement prices up 15%","Budget needs adjustment for second floor","Must review before Monday"],"actionItems":["Adjust budget before signing","Confirm new prices with supplier"]}',
   'We need to review the prices before Monday. The supplier confirmed cement went up 15%. Roberto says we need to adjust the second floor budget before signing.',
   '2026-03-14 10:23:00+00'),

  ('t2000000-0000-0000-0000-000000000002',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   NULL,
   'Just finished the client meeting. They want to move the deadline up by two weeks. I told them we''d need to bring in two more contractors. They said budget isn''t an issue but quality can''t drop. Let me know your thoughts.',
   'en', 'telegram', 123, FALSE,
   '{"keyPoints":["Client wants deadline 2 weeks earlier","Need 2 more contractors","Budget flexible, quality non-negotiable"],"actionItems":["Discuss contractor options with team","Send revised timeline to client"]}',
   NULL,
   '2026-03-14 09:15:00+00'),

  ('t3000000-0000-0000-0000-000000000003',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f2000000-0000-0000-0000-000000000002',
   'Bonjour, je voulais te parler du dossier médical de maman. Le médecin a dit qu''elle doit prendre deux médicaments différents chaque matin. Il faut aussi faire une prise de sang la semaine prochaine.',
   'fr', 'whatsapp', 89, TRUE,
   '{"keyPoints":["Two medications every morning","Blood test next week","Doctor follow-up required"],"actionItems":["Schedule blood test","Buy medications from pharmacy"]}',
   'Hello, I wanted to talk to you about mom''s medical file. The doctor said she needs to take two different medications every morning. We also need to do a blood test next week.',
   '2026-03-13 18:45:00+00'),

  ('t_fr_medical-0000-0000-0000-000000000000',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f2000000-0000-0000-0000-000000000002',
   'Bonjour, je voulais te parler du dossier médical de maman. Le médecin a dit qu''elle doit prendre deux médicaments différents et revenir le mois prochain pour un contrôle. Il faut aussi faire une prise de sang avant le prochain rendez-vous.',
   'fr', 'whatsapp', 89, TRUE,
   '{"keyPoints":["Mom needs two different medications","Follow-up appointment next month","Blood test required before next visit"],"actionItems":["Schedule blood test","Pick up prescriptions","Book follow-up for next month"]}',
   'Hello, I wanted to talk to you about mom''s medical file. The doctor said she needs to take two different medications and come back next month for a check-up. She also needs a blood test before the next appointment.',
   '2026-03-13 18:45:00+00'),

  ('t4000000-0000-0000-0000-000000000004',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f1000000-0000-0000-0000-000000000001',
   'Reunión con el banco confirmada para el miércoles a las 10. Llevar los documentos del proyecto y el balance del último trimestre.',
   'es', 'upload', 34, FALSE,
   '{"keyPoints":["Bank meeting Wednesday 10am","Bring project documents","Last quarter balance needed"],"actionItems":["Prepare project documents","Print last quarter balance"]}',
   'Bank meeting confirmed for Wednesday at 10. Bring project documents and last quarter balance.',
   '2026-03-13 15:30:00+00'),

  ('t5000000-0000-0000-0000-000000000005',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f3000000-0000-0000-0000-000000000003',
   'Então, a ideia é criar um aplicativo de delivery para pequenos restaurantes. O mercado está crescendo muito e os grandes players cobram taxas altíssimas. Poderíamos oferecer algo mais acessível.',
   'pt', 'telegram', 215, FALSE,
   '{"keyPoints":["Delivery app for small restaurants","Market growing, big players charge high fees","Need monetization strategy"],"actionItems":["Research delivery market data","Draft monetization strategy"]}',
   'The idea is to create a delivery app for small restaurants. The market is growing and big players charge very high fees. We could offer something more affordable.',
   '2026-03-13 12:10:00+00'),

  ('t6000000-0000-0000-0000-000000000006',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f2000000-0000-0000-0000-000000000002',
   'Quick update on the Johnson account. They approved the proposal but want a few tweaks on the timeline. Specifically they need delivery by April 15 not May. Also they added a new requirement around reporting.',
   'en', 'whatsapp', 67, TRUE,
   '{"keyPoints":["Johnson account approved proposal","New deadline: April 15","New reporting requirement added"],"actionItems":["Adjust timeline to April 15","Check email for reporting requirements"]}',
   NULL,
   '2026-03-13 08:55:00+00'),

  ('t7000000-0000-0000-0000-000000000007',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   NULL,
   'J''ai rencontré l''équipe de développement aujourd''hui. Ils ont bien avancé sur le module de paiement. Il reste encore le système de notifications et l''intégration avec l''API externe. On prévoit de terminer d''ici deux semaines.',
   'fr', 'telegram', 158, FALSE,
   '{"keyPoints":["Payment module nearly complete","Notifications system pending","External API integration pending","2-week estimated completion"],"actionItems":["Monitor notification system","Follow up on API integration"]}',
   'I met with the dev team today. They''ve made good progress on the payment module. Notifications and external API are still pending. We plan to finish within two weeks.',
   '2026-03-12 20:30:00+00'),

  ('t8000000-0000-0000-0000-000000000008',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f2000000-0000-0000-0000-000000000002',
   'Oye, te llamo para lo del contrato de arrendamiento. El propietario quiere aumentar el alquiler un 12%. Finalmente acordamos un 6% y renovamos por dos años más. Quedamos en firmar el próximo viernes.',
   'es', 'whatsapp', 287, FALSE,
   '{"keyPoints":["Landlord wanted 12% rent increase","Negotiated down to 6%","2-year renewal agreed","Signing next Friday"],"actionItems":["Prepare for signing next Friday","Review new contract terms"]}',
   'Calling about the lease. The owner wants to raise rent 12% next year. We agreed on 6% and renewed for two more years. We''ll sign next Friday.',
   '2026-03-12 14:20:00+00'),

  ('t9000000-0000-0000-0000-000000000009',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f3000000-0000-0000-0000-000000000003',
   'Idea for the new product launch. We should do a limited beta with influencers first, get organic content, then push paid ads after we have social proof. Budget around 5K for the beta phase.',
   'en', 'upload', 42, TRUE,
   '{"keyPoints":["Influencer beta launch first","Organic content before paid ads","5K budget for beta phase"],"actionItems":["Identify relevant influencers","Define beta selection criteria"]}',
   NULL,
   '2026-03-12 09:45:00+00'),

  ('t10000000-0000-0000-0000-00000000000a',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f1000000-0000-0000-0000-000000000001',
   'Doctor confirmó que los análisis salieron bien. La presión arterial está normal y el colesterol bajó desde la última visita. Hay que continuar con la dieta y hacer ejercicio tres veces por semana.',
   'es', 'telegram', 95, FALSE,
   '{"keyPoints":["Blood pressure normal","Cholesterol improved","Continue diet and exercise 3x/week","Next appointment in 3 months"],"actionItems":["Schedule appointment in 3 months","Maintain exercise routine"]}',
   'Doctor confirmed tests came back well. Blood pressure is normal and cholesterol has dropped. Need to continue diet and exercise three times a week.',
   '2026-03-11 17:00:00+00'),

  ('t11000000-0000-0000-0000-00000000000b',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f2000000-0000-0000-0000-000000000002',
   'Alors voilà ce que je pense pour la stratégie marketing du trimestre prochain. On devrait concentrer nos efforts sur LinkedIn et YouTube plutôt que sur Instagram. Notre cible est professionnelle.',
   'fr', 'whatsapp', 178, FALSE,
   '{"keyPoints":["Focus on LinkedIn and YouTube next quarter","Better conversion on professional platforms","Data supports this decision"],"actionItems":["Review LinkedIn campaign options","Plan YouTube content strategy"]}',
   'Here''s what I think for next quarter''s marketing strategy. We should focus on LinkedIn and YouTube rather than Instagram. Our target is professional.',
   '2026-03-11 11:30:00+00'),

  ('t12000000-0000-0000-0000-00000000000c',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f3000000-0000-0000-0000-000000000003',
   'Just had a breakthrough idea for the app redesign. What if we made the onboarding a 3-step flow instead of the current 7 screens? Users are dropping off at step 4.',
   'en', 'whatsapp', 56, TRUE,
   '{"keyPoints":["Current 7-screen onboarding drops at step 4","Proposed: 3-step flow","Want to prototype and test with 5 users"],"actionItems":["Prototype 3-step onboarding tomorrow","Schedule 5-user test session"]}',
   NULL,
   '2026-03-10 19:15:00+00'),

  ('t13000000-0000-0000-0000-00000000000d',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   NULL,
   'Reunião com os investidores foi bem melhor do que esperado. Eles gostaram muito do traction que temos. Fizeram algumas perguntas sobre o modelo de receita e a estratégia de expansão para o mercado latino-americano.',
   'pt', 'telegram', 201, FALSE,
   '{"keyPoints":["Investor meeting went better than expected","Strong interest in traction","Questions about revenue model and LatAm expansion"],"actionItems":["Prepare detailed financial presentation","Outline LatAm expansion strategy"]}',
   'The investor meeting went much better than expected. They liked our traction and asked about the revenue model and LatAm expansion.',
   '2026-03-10 14:00:00+00'),

  ('t14000000-0000-0000-0000-00000000000e',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   'f1000000-0000-0000-0000-000000000001',
   'Nota de voz del terapeuta. Seguir trabajando en técnicas de respiración antes de situaciones estresantes. Practicar mindfulness 10 minutos cada mañana. La próxima sesión es el jueves a las 6 pm.',
   'es', 'upload', 73, FALSE,
   '{"keyPoints":["Continue breathing techniques before stress","10 minutes mindfulness every morning","Next session Thursday 6pm"],"actionItems":["Practice morning mindfulness daily","Confirm Thursday 6pm appointment"]}',
   'Therapist voice note. Continue breathing techniques before stressful situations. Mindfulness 10 minutes every morning. Next session Thursday at 6pm.',
   '2026-03-09 16:45:00+00'),

  ('t15000000-0000-0000-0000-00000000000f',
   'e964b1e5-c32d-4809-9fdd-30f4242667b0',
   NULL,
   'Call mom back tonight. Don''t forget.',
   'en', 'whatsapp', 15, FALSE,
   '{"keyPoints":["Call mom tonight"],"actionItems":["Call mom"]}',
   NULL,
   '2026-03-09 10:20:00+00')

ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════
-- VOZCLARA USAGE — current month
-- ═══════════════════════════════════════

INSERT INTO vc_usage (user_id, date, notes_count, audio_minutes, ai_searches)
VALUES (
  'e964b1e5-c32d-4809-9fdd-30f4242667b0',
  CURRENT_DATE,
  7, 23.4, 3
) ON CONFLICT (user_id, date) DO UPDATE
  SET notes_count = EXCLUDED.notes_count,
      audio_minutes = EXCLUDED.audio_minutes,
      ai_searches = EXCLUDED.ai_searches;

-- ═══════════════════════════════════════
-- RETENA WORKSPACE SEED (demo)
-- ═══════════════════════════════════════

INSERT INTO rt_workspaces (id, owner_user_id, name, rt_tier)
VALUES (
  'ws000000-0000-0000-0000-000000000001',
  'e964b1e5-c32d-4809-9fdd-30f4242667b0',
  'CaseDamare Team',
  'pro'
) ON CONFLICT DO NOTHING;

INSERT INTO rt_workspace_members (workspace_id, user_id, role)
VALUES (
  'ws000000-0000-0000-0000-000000000001',
  'e964b1e5-c32d-4809-9fdd-30f4242667b0',
  'owner'
) ON CONFLICT DO NOTHING;

INSERT INTO rt_groups (id, workspace_id, name, member_count, status, last_activity)
VALUES
  ('gr000000-0000-0000-0000-000000000001', 'ws000000-0000-0000-0000-000000000001', 'Equipo Obra Norte', 8, 'active', NOW() - INTERVAL '2 hours'),
  ('gr000000-0000-0000-0000-000000000002', 'ws000000-0000-0000-0000-000000000001', 'Proveedores CaseDamare', 5, 'active', NOW() - INTERVAL '1 day'),
  ('gr000000-0000-0000-0000-000000000003', 'ws000000-0000-0000-0000-000000000001', 'SportingClub LT Staff', 12, 'paused', NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;
