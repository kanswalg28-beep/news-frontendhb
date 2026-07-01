-- Migration: Create site_content table for CMS content blocks
CREATE TABLE IF NOT EXISTS public.site_content (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access
CREATE POLICY "Public read access" ON public.site_content
    FOR SELECT USING (true);

-- Policy: Allow authenticated admin write access
CREATE POLICY "Admin write access" ON public.site_content
    FOR ALL USING (
        auth.role() = 'service_role' OR
        (auth.jwt() ->> 'role') = 'service_role'
    );

-- Insert default content blocks
INSERT INTO public.site_content (key, value) VALUES
('hero', '{"eyebrow": "DEEP PERSPECTIVE", "readtime": "9 Min Read", "headline": "The Illusion of Consensus: Bending the Corporate News Narrative", "body": "Traditional news chambers claim to deliver pure, unvarnished objective truth. We say that is a convenient myth. Let us look closer—and biasedly—at the corporate lobbying, administrative inertia, and policy loopholes rewriting the agrarian economy under the cover of artificial neutrality.", "byline": "Aniket Verma", "byline_role": "Senior Bias Analyst", "cta": "Expose The Script", "imageurl": "./assets/hero-bg.png"}'),
('rhetoric', '{"value": "84.2%", "label": "Sensational Bias", "yoy": "+12.4% YoY", "caption": "Hyperbole saturation", "aiAnalysis": "Prime-time panel debates monitored today recorded an all-time high of sensationalist adjectives vs objective factual references."}'),
('manifesto', '{"heading": "Our Manifesto", "body": "\"Objective journalism is a corporate shield. The moment you select which stories to cover or which quotes to crop, bias exists. We just choose to be honest about ours.\"", "author": "Dr. Rupa Murthy", "role": "Editor-in-Chief, Honestly Biased"}'),
('poll', '{"heading": "Narrative Pulse", "prompt": "Do you believe corporate media news outlets can ever deliver genuinely objective reporting?", "options": [{"id": "no", "label": "No, ownership dictates bias", "pct": 74}, {"id": "yes", "label": "Yes, under regulatory separation", "pct": 18}, {"id": "myth", "label": "Impartiality is a systemic myth anyway", "pct": 8}]}'),
('podcast', '{"label": "Podcast", "runtime": "34:10 Min", "title": "Honestly Biased Dialogues: Dissecting Editorial Gag Orders", "blurb": "We sit down with former editors to chart how corporate balance sheets silently dictate the limits of prime-time debates."}'),
('express_bias', '{"label": "Express Bias", "items": [{"time": "17:42", "content": "FinMin launches rigorous desk-to-desk search for lost file containing standard economic logic."}, {"time": "16:15", "content": "Space agency confirms successful deployment of sensor engineered to detect political hot air."}, {"time": "15:08", "content": "Telecom operators reach historic agreement to collectively drop calls more efficiently."}]}'),
('featured', '{"docs": [{"id": "varanasi", "title": "The Craftsmen of Varanasi: Weaving Through Algorithmic Disruption", "category": "Tech", "author": "Meenakshi Iyer", "ago": "1 Day Ago", "meta": "14:20 Documentary", "body": "Our special report tracking how traditional handloom weavers are resisting automated replica algorithms and mass-produced synthetic chains.", "doc_meta": "14:20 Documentary"}]}'),
('standards', '{"items": ["Our Manifesto", "Editorial Standards", "Independent Funding Audit", "Financial Integrity reports", "Join the Collective"]}'),
('ledger_intro', '{"heading": "The Ledger", "sub": "Dismantling corporate bias and manufactured consent, systematically"}'),
('footer', '{"mission": "Honestly Biased is a reader-supported, digital-first commentary hub. We reject the corporate performance of neutral objectivity. We believe in providing transparent, analytical, and uncompromisingly honest perspectives on politics, satire, and media power structures in India."}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Also ensure articles table has archived column
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_articles_archived ON public.articles(archived);
CREATE INDEX IF NOT EXISTS idx_articles_publishdate ON public.articles(publishdate);
