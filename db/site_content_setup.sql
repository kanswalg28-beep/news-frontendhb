-- site_content_setup.sql — run in Supabase SQL editor (Dashboard → SQL → New query).

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.site_content (
  key          text PRIMARY KEY,
  value        jsonb NOT NULL,
  updated_by   text DEFAULT 'cms',
  updated_at   timestamptz DEFAULT now()
);

-- 2. Row Level Security → public can read; service role can write
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read site_content" ON public.site_content;
CREATE POLICY "public read site_content" ON public.site_content
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service write site_content" ON public.site_content;
CREATE POLICY "service write site_content" ON public.site_content
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Seed with the current static text so home page has content on first load
INSERT INTO public.site_content (key, value) VALUES
  ('hero',           '{"eyebrow":"DEEP PERSPECTIVE","readtime":"9 Min Read","headline":"The Illusion of Consensus: Bending the Corporate News Narrative","body":"Traditional news chambers claim to deliver pure, unvarnished objective truth. We say that is a convenient myth. Let us look closer—and biasedly—at the corporate lobbying, administrative inertia, and policy loopholes rewriting the agrarian economy under the cover of artificial neutrality.","cta":"Expose The Script","byline":"Aniket Verma","byline_role":"Senior Bias Analyst"}'::jsonb),
  ('ledger_intro',   '{"heading":"The Ledger","sub":"Dismantling corporate bias and manufactured consent, systematically"}'::jsonb),
  ('manifesto',      '{"heading":"OUR MANIFESTO","body":"The performance of neutrality is itself a position. We refuse it. We name the pressure, the patron, and the political economy behind every story we touch. If that offends the gatekeepers of polite journalism, good.","author":"Dr. Rupa Murthy","role":"Editor-in-Chief, Honestly Biased"}'::jsonb),
  ('rhetoric',       '{"label":"SENSATIONAL BIAS","value":"84.2%","yoy":"+12.4% YoY","caption":"HYPERBOLE SATURATION","note":"Sensor calibrated against a rolling 90-day window of front-page Indian coverage."}'::jsonb),
  ('podcast',        '{"label":"PODCAST","runtime":"34:10 Min","title":"Honestly Biased Dialogues: Dissecting Editorial Gag Orders","blurb":"Three editors walk through the new media-rules gag, the press conferences that were scrapped, and the ground reporting that still slips through.","play_label":"Play podcast episode"}'::jsonb),
  ('poll',           '{"heading":"NARRATIVE PULSE","prompt":"Should editorial ownership ever be split from advertising sales?","options":[{"id":"no","label":"No, ownership dictates bias","pct":74},{"id":"yes","label":"Yes, under regulatory separation","pct":18},{"id":"myth","label":"Impartiality is a systemic myth anyway","pct":8}]}'::jsonb),
  ('featured',       '{"docs":[{"id":"dpdp","category":"POLITICS","ago":"4 Hours Ago","title":"Consent Under the Microscope: Decoding Startup Panic Over the DPDP Mandates","author":"Devendra Joshi","link":"#"},{"id":"varanasi","kind":"video","ago":"1 Day Ago","title":"The Craftsmen of Varanasi: Weaving Through Algorithmic Disruption","author":"Meenakshi Iyer","meta":"14:20 Documentary","link":"#"},{"id":"agri","category":"TECH","title":"The Agri-Tech Bubble: Edge Sensors Sold to Smallholders Lacking Water Security","link":"#"}]}'::jsonb),
  ('standards',      '{"items":["Our Manifesto","Editorial Standards","Independent Funding Audit","Financial Integrity reports","Join the Collective"]}'::jsonb),
  ('footer',         '{"mission":"Honestly Biased is a reader-supported, digital-first commentary hub. We reject the corporate performance of neutral objectivity. We believe in providing transparent, analytical, and uncompromisingly honest perspectives on politics, satire, and media power structures in India."}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Sanity check
SELECT key, jsonb_pretty(value) FROM public.site_content ORDER BY key;
