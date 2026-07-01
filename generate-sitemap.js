#!/usr/bin/env node
/**
 * generate-sitemap.js
 * Generates sitemap.xml from known static routes + Supabase articles (if configured).
 * Run at build time or as a cron job.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.honestlybiased.com';
const OUTPUT_FILE = path.join(__dirname, 'sitemap.xml');

// Static routes that always exist
const STATIC_ROUTES = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/manifesto', changefreq: 'monthly', priority: 0.8 },
  { url: '/standards', changefreq: 'monthly', priority: 0.8 },
  { url: '/funding', changefreq: 'monthly', priority: 0.8 },
  { url: '/finances', changefreq: 'monthly', priority: 0.8 },
  { url: '/collective', changefreq: 'monthly', priority: 0.8 },
  { url: '/politics', changefreq: 'daily', priority: 0.7 },
  { url: '/tech', changefreq: 'daily', priority: 0.7 },
  { url: '/finance', changefreq: 'daily', priority: 0.7 },
  { url: '/entertainment', changefreq: 'daily', priority: 0.7 },
  { url: '/health', changefreq: 'daily', priority: 0.7 },
];

// Article routes (static for now, dynamic from Supabase in future)
const ARTICLE_ROUTES = [
  { url: '/article/illusion-of-consensus', changefreq: 'monthly', priority: 0.6 },
];

async function fetchArticlesFromSupabase() {
  // Try to fetch from Supabase if configured
  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (e) {
    console.log('@supabase/supabase-js not available, skipping dynamic article URLs');
    return [];
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('Supabase not configured, skipping dynamic article URLs');
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('articles')
      .select('id, updatedat, publishdate')
      .order('publishdate', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Supabase error:', error.message);
      return [];
    }

    return (data || []).map(article => ({
      url: `/article/${article.id}`,
      lastmod: article.updatedat || article.publishdate,
      changefreq: 'weekly',
      priority: 0.6
    }));
  } catch (e) {
    console.error('Failed to fetch articles:', e.message);
    return [];
  }
}

function buildSitemap(articles) {
  const today = new Date().toISOString().split('T')[0];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  // Static routes
  for (const route of STATIC_ROUTES) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${route.url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // Article routes (static)
  for (const route of ARTICLE_ROUTES) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${route.url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // Article routes (dynamic from Supabase)
  for (const article of articles) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${article.url}</loc>\n`;
    if (article.lastmod) {
      xml += `    <lastmod>${article.lastmod.split('T')[0]}</lastmod>\n`;
    }
    xml += `    <changefreq>${article.changefreq}</changefreq>\n`;
    xml += `    <priority>${article.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

async function main() {
  console.log('Generating sitemap.xml...');
  const articles = await fetchArticlesFromSupabase();
  const xml = buildSitemap(articles);
  fs.writeFileSync(OUTPUT_FILE, xml);
  console.log(`✅ sitemap.xml written (${STATIC_ROUTES.length + articles.length} URLs)`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});