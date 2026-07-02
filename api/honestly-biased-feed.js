const { supabase } = require('../db/client');

const DEFAULT_HIGHLIGHTS = [
  "Parliament confirms new tax framework remains perfectly logical to precisely three statisticians.",
  "Global summit achieves historic consensus on scheduling a date to discuss scheduling a deadline.",
  "Central Bank introduces digital currency feature designed to automatically feel superior to physical currency.",
  "Supreme Court requests national media houses to explain what they meant by '100% objective facts.'"
];

async function getCustomArticles() {
  const { data } = await supabase
    .from('articles')
    .select('*');
  return data || [];
}

module.exports = async (req, res) => {
  try {
    const customArticles = await getCustomArticles();

    return res.json({
      rhetoricMeter: {
        hyperbolePercentage: "84.2%",
        yoyGrowth: "+12.4%",
        aiAnalysis: "Prime-time coverage monitored today reveals a severe spike in hyperbolic sensationalism as legacy newsrooms attempt to mask policy concessions behind corporate volume."
      },
      articles: customArticles,
      highlights: DEFAULT_HIGHLIGHTS
    });
  } catch (err) {
    console.error('Endpoint error:', err);
    res.status(500).json({ error: 'Internal server error assembling content feed' });
  }
};