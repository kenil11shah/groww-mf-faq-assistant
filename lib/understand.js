// Step 1 of the pipeline: understand the question before retrieving anything.
// Works out (a) whether it contains personal data, (b) whether it asks for
// advice, returns or a comparison, (c) which scheme it is about and
// (d) which fact (topic) it is asking for.

// ---------- Personal data (PII) ----------
const PII_PATTERNS = [
  { kind: 'PAN', re: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i },
  { kind: 'Aadhaar number', re: /\b[2-9][0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/ },
  { kind: 'email address', re: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  { kind: 'phone number', re: /(?:\+?91[\s-]?)?\b[6-9][0-9]{9}\b/ },
  { kind: 'OTP', re: /\botp\b[^0-9]{0,15}\d{4,8}|\b\d{4,8}\b[^0-9a-z]{0,5}(?:is my|is the)?\s*otp\b/i },
  { kind: 'folio or account number', re: /\b(?:folio|account|a\/c|acct)\b[^0-9]{0,15}\d{5,}/i },
  { kind: 'account number', re: /\b\d{9,18}\b/ },
];

export function detectPII(text) {
  for (const p of PII_PATTERNS) if (p.re.test(text)) return p.kind;
  return null;
}

// ---------- Schemes ----------
const SCHEME_PATTERNS = {
  large_cap: /\blarge\s*-?\s*cap\b|\bblue\s*-?\s*chip\b|\blargecap\b/i,
  elss: /\belss\b|\btax\s*-?\s*sav(er|ing|ings)\b|\b80\s*c\b/i,
  multicap: /\bmulti\s*-?\s*cap\b|\bmulticap\b/i,
  total_market: /\btotal\s*market\b|\bindex\s*fund\b|\bnifty\s*total\b/i,
};

// Other Groww Mutual Fund schemes that exist but are outside this assistant's corpus.
const OTHER_GROWW_SCHEMES = /\b(value|small\s*-?cap|mid\s*-?cap|banking|financial services|liquid|overnight|arbitrage|aggressive hybrid|hybrid|money market|gilt|dynamic bond|short duration|multi asset|nifty\s*50|next\s*50|smallcap\s*250|midcap\s*150|railways|defence|ev|internet|power|non-cyclical|momentum|low volatility|realty|metal|capital markets|200|etf|fof|gold|silver)\b/i;

const OTHER_AMCS = /\b(hdfc|sbi|icici|axis|nippon|kotak|parag parikh|ppfas|mirae|quant|tata|uti|aditya birla|absl|dsp|motilal|franklin|edelweiss|bandhan|idfc|canara|hsbc|invesco|sundaram|union|baroda|mahindra|pgim|lic|bajaj|zerodha|navi|whiteoak|360 ?one|samco|helios|old bridge|jm financial|iti|trust ?mf|quantum|shriram|unifi|angel one|capitalmind|abakkus)\b/i;

export function detectSchemes(text) {
  const found = [];
  for (const [key, re] of Object.entries(SCHEME_PATTERNS)) if (re.test(text)) found.push(key);
  // "What is a large cap fund / company?" is a definition question, not about the Groww scheme.
  return found;
}

// ---------- Topics (which fact is being asked) ----------
const TOPIC_PATTERNS = [
  ['unsupported', /\bnav\b|\baum\b|\bfund size\b|\bassets under management\b|\bholdings?\b|\bportfolio\b|\btop (stocks|companies)\b|\bsector(s| allocation)?\b|\bstocks? (it )?(holds|held|in)\b|\bsip dates?\b|\bdividend history\b|\bidcw (rate|history|declared)\b|\bstandard deviation\b|\bbeta\b|\bturnover ratio\b|\bcash (holding|level)\b/i],
  ['tax_benefit', /\btax (benefit|benefits|deduction|deductions|saving benefit|exemption)\b|\b80\s*c\b|\bsection 123\b|\bdeduction\b/i],
  ['expense_limit', /\b(maximum|max|limit|upper limit|up to|upto|allowed)\b.{0,30}\b(expense|expenses|ter)\b|\b(expense|expenses|ter)\b.{0,30}\b(limit|maximum|allowed)\b/i],
  ['capital_gains', /\bcapital[\s-]*gains?\b|\bcg statement\b|\bp\s*&\s*l\b|\bprofit (and|&) loss\b/i],
  ['elss_statement', /\b(elss|tax)\s*(statement|proof|certificate|receipt)\b|\b80\s*c\s*(proof|statement|certificate)\b/i],
  ['cas_dispatch', /\b(when|how often)\b.*\b(cas|statement)\b.*\b(sent|send|emailed|dispatched|received?|come)\b|\b(cas|statement)\b.*\b(sent|emailed|dispatched)\b/i],
  ['statement', /\b(cas|consolidated account statement|account statement|statements?|e-?cas|holding statement)\b/i],
  ['stamp_duty', /\bstamp duty\b/i],
  ['exit_load', /\bexit\s*-?\s*load\b|\bredemption (charge|fee|penalty)\b|\bload\b|\b(fee|fees|charge|charges|penalty|cost)\b.{0,40}\b(exit|exiting|redeem|redeeming|redemption|withdraw|withdrawing|sell|selling)\b|\b(exit|redeem|withdraw|sell)\b.{0,30}\bearly\b/i],
  ['expense_ratio', /\bexpense\s*ratio\b|\bter\b|\btotal expense\b|\bexpenses?\b|\bcharges?\b|\bfees?\b/i],
  ['lock_in', /\block\s*-?\s*in\b|\blocked\b|\blockin\b|\b(withdraw|redeem|sell|exit|take out)\b.{0,40}\bbefore\b/i],
  ['sip_instalments', /\binstal+ments?\b|\bhow many (sips|instal)/i],
  ['min_sip', /\bsip\b|\bminimum\b|\bmin\.?\s*(amount|investment|invest)\b|\blump\s*-?\s*sum\b|\bone[\s-]*time\b/i],
  ['riskometer', /\brisk\s*-?\s*o?\s*-?\s*meter\b|\brisk(y| level| grade| category| rating)?\b/i],
  ['benchmark', /\bbenchmark(ed|s)?\b|\b(index|what) does it track\b|\btracks?\b/i],
  ['fund_manager', /\bfund\s*managers?\b|\bmanaged by\b|\bmanagers?\b|\bwho manages\b/i],
  ['inception', /\blaunch(ed)?\b|\binception\b|\bstart(ed)?\b|\ballotment date\b|\bhow old\b/i],
  ['plans', /\bplans?\b|\boptions?\b|\bidcw\b|\bdividend\b|\bgrowth option\b/i],
  ['contact', /\bcontact\b|\bcustomer (care|support)\b|\bhelpline\b|\bsupport\b|\bcomplain/i],
  ['documents', /\bkim\b|\bsid\b|\bsai\b|\bscheme (information )?document|\bkey information memorandum\b|\bdocuments?\b/i],
  ['factsheet', /\bfact\s*-?\s*sheet\b/i],
  ['amc', /\bsebi registration\b|\bregistration (no|number)\b|\bwhich (amc|company)\b|\basset management (company|limited)\b/i],
  ['category', /\bcategory\b|\btype of (fund|scheme)\b|\bobjective\b|\bwhat kind\b|\binvests? in\b|\bwhat is groww\b/i],
];

export function detectTopic(text) {
  for (const [topic, re] of TOPIC_PATTERNS) if (re.test(text)) return topic;
  return null;
}

// Facts that only make sense for a specific scheme.
export const SCHEME_SPECIFIC = new Set(['expense_limit', 'sip_instalments', 'expense_ratio', 'exit_load', 'min_sip', 'riskometer', 'benchmark', 'fund_manager', 'inception', 'plans', 'category']);

const TERMS = '(expense ratio|ter|exit load|riskometer|risk-o-meter|lock[\\s-]*in( period)?|elss|benchmark|large[\\s-]*cap|mid[\\s-]*cap|small[\\s-]*cap|multi[\\s-]*cap|index fund|sip|cas|nav|stamp duty)';
// "What is an exit load?" / "What does TER mean?" are definitions; "What is the exit load?" asks for a scheme's value.
const DEFINITION = [
  new RegExp(`^\\s*(what\\s*(is|are|'s|s)|whats|define|explain)\\s+(an?\\s+|the\\s+(?=risk))?(total\\s+)?${TERMS}\\b(?!\\s+(of|for)\\b)`, 'i'),
  new RegExp(`\\bwhat (does|do)\\s+(an?\\s+|the\\s+)?(total\\s+)?${TERMS}\\s+(mean|stand for|include)`, 'i'),
  new RegExp(`\\b(meaning of|definition of|define)\\b`, 'i'),
  /\b(how many (risk )?levels|levels of (the )?risk|how often .*(riskometer|risk-o-meter)|riskometer .*(updated|evaluated|change))/i,
];

export function isDefinition(text) {
  return DEFINITION.some(re => re.test(text));
}

// ---------- Intent: things we refuse or redirect ----------
const ADVICE = /\b(should i|shall i|should we|do you (recommend|suggest)|recommend|suggest(ion)?|advice|advise|is it (a )?(good|bad|safe|wise|right)|good (time|idea|fund|investment|choice|option)|worth (it|investing|buying)|best (fund|scheme|option|elss|large ?cap|mutual fund|time)|top (fund|scheme)s?|which (fund|scheme|one|plan) (is|should|to|do|would|will)|buy or sell|sell or hold|hold or sell|stop (my )?sip|exit now|invest now|right time|safe to invest|is .{0,40}\bsafe\b|guarantee|will .{0,40}\b(go up|rise|fall|grow|crash|beat)\b|predict|forecast|target price|future (returns?|performance|nav)|how much should|allocat(e|ion)|rebalance|my portfolio|ideal|suitable for me|good for me|for a beginner)\b/i;

const COMPARE = /\b(compare|comparison|vs\.?|versus|better than|better(,)? .{0,40}\bor\b|difference between|which is (better|cheaper|lower|higher))\b/i;

const PERFORMANCE = /\b(returns?|cagr|xirr|performance|perform(ed|ing|s)?|how much (will|would|can|did) (i|it|my money)|(earn|gain|grow|grew|made|make)(ed|s)? .{0,25}\b(last|past|in|over|per)\b|nav (growth|history|change)|track record|beat(en|s)? the (index|benchmark|market)|alpha|sharpe|outperform|underperform)\b/i;
const NOT_PERFORMANCE = /\b(tax returns?|income tax return|itr|capital[\s-]*gains? statement)\b/i;

const PERSONAL_ACCOUNT = /\b(my|mine)\s+(folio|account|sip|sips|investment|investments|units|redemption|order|orders|holdings?|money|kyc|transaction|payment|mandate|nav)\b|\b(where is|status of|track) my\b/i;

export function detectIntent(text) {
  if (PERFORMANCE.test(text) && !NOT_PERFORMANCE.test(text)) return 'performance';
  if (ADVICE.test(text)) return 'advice';
  if (COMPARE.test(text)) return 'compare';
  if (PERSONAL_ACCOUNT.test(text) && !/\b(statement|cas|capital gain|elss statement|tax statement)\b/i.test(text)) return 'account';
  return 'fact';
}

export function detectOutOfScope(text, schemes) {
  if (OTHER_AMCS.test(text)) return 'other_amc';
  // e.g. "Groww Value Fund", "Groww Liquid Fund" - a Groww scheme we do not cover.
  if (schemes.length === 0 && /\bgroww\b/i.test(text) && OTHER_GROWW_SCHEMES.test(text)) return 'other_scheme';
  return null;
}

export function understand(question) {
  const text = String(question || '').trim();
  const schemes = detectSchemes(text);
  return {
    text,
    pii: detectPII(text),
    intent: detectIntent(text),
    schemes,
    topic: detectTopic(text),
    definition: isDefinition(text),
    outOfScope: detectOutOfScope(text, schemes),
  };
}
