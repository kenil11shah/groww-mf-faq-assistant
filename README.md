# Groww MF Facts: a facts-only mutual fund FAQ assistant

A small FAQ assistant that answers **factual** questions about **Groww Mutual Fund** schemes (expense ratio, exit load, minimum SIP, ELSS lock-in, riskometer, benchmark, fund managers, how to download statements) using **only official public pages** from the AMC, SEBI and AMFI. Every answer is at most 3 sentences, shows **exactly one source link** and the line *"Last updated from sources: 08 Nov 2026"*. It does **not** give investment advice.

- **Live prototype:** https://groww-mf-faq-assistant-livid.vercel.app
- **Built by:** Kenil Shah, NextLeap PM Fellowship, Milestone 4 (AI System Design, LLMs & Prompt Engineering)
- **Product context:** Groww. The AMC covered is Groww's own fund house, Groww Mutual Fund (Groww Asset Management Ltd.).

> **Disclaimer (shown in the UI):** Facts-only. No investment advice. Answers come only from official Groww Mutual Fund, SEBI and AMFI pages, and every answer shows its source.
>
> This is an independent student project and is not affiliated with or endorsed by Groww. Mutual fund investments are subject to market risks; read all scheme-related documents carefully.

---

## 1. Scope

| | |
|---|---|
| **AMC** | Groww Mutual Fund (Groww Asset Management Limited, SEBI Reg. No. MF/068/11/03) |
| **Schemes (4)** | Groww Large Cap Fund (large cap) · Groww ELSS Tax Saver Fund (ELSS) · Groww Multicap Fund (multi cap) · Groww Nifty Total Market Index Fund (index fund) |
| **Facts covered** | Expense ratio, exit load, minimum SIP / lumpsum, SIP instalments, lock-in, riskometer, benchmark, category and objective, launch date, fund managers, plans and options |
| **General topics** | How to download a CAS or a capital-gains statement, ELSS tax statement on Groww, CAS email timelines, what a riskometer / expense ratio / exit load is, SEBI market-cap definitions, AMC contact details |
| **Sources** | 20 official public pages (list below), captured on 08 Nov 2026 |

**What it refuses, politely and with an educational link:**

| Question type | Example | What the assistant does |
|---|---|---|
| Advice / opinion | "Should I buy Groww ELSS?" | Facts-only refusal + link to Groww MF Investor Education |
| Returns / performance | "What returns did it give last year?" | No numbers; links the official factsheet |
| Comparisons | "Which is better, Large Cap or Multicap?" | Asks for one scheme at a time |
| Personal data (PII) | PAN, Aadhaar, phone, email, OTP, folio/account numbers | Blocked in the browser **and** on the server; never stored or sent to the AI |
| Own account | "What is the status of my SIP?" | Points to Groww MF investor support |
| Other AMCs / other Groww schemes | "HDFC Flexi Cap expense ratio?" | Explains the scope |
| Fast-changing numbers | NAV, AUM, holdings | Links the official page instead of guessing |

## 2. How it works

```
Question
  │
  ├─ 1. Understand   PII check → intent (fact / advice / returns / compare / account) → scheme → which fact (topic)
  │                  └─ refuse, or ask "Which scheme?" if the fact needs one and none was named
  ├─ 2. Retrieve     BM25 keyword search over 64 fact chunks, filtered to the scheme, boosted by topic
  ├─ 3. Generate     Gemini (free tier) writes a ≤3-sentence answer from ONE retrieved chunk (JSON output)
  └─ 4. Verify       cited chunk must be one of the retrieved ones · every number must appear in that chunk ·
                     no advice words · max 3 sentences → otherwise show the source sentence itself
Answer + 1 source link + "Last updated from sources"
```

- **Corpus** (`data/corpus.json`): each official page was read and broken into short, self-contained **fact chunks** (one fact each, ≤3 sentences), tagged with scheme, topic, source id and an "as of" date.
- **Retrieval** (`lib/retrieve.js`): with a small corpus, BM25 plus a scheme filter and a topic boost is accurate, fast and explainable, and needs no embedding API.
- **LLM** (`lib/llm.js`): Google Gemini via the free Google AI Studio API. It receives only the retrieved chunks and a strict system prompt (answer only from context, one chunk, ≤3 sentences, copy numbers exactly, no advice).
- **Guardrails** (`lib/assistant.js`): the model's answer is checked before it is shown. If Gemini is unavailable, rate-limited or fails a check, the app shows the verified source sentence instead (*extractive mode*), so the assistant never goes down and never invents a number.
- **Privacy**: no logins, cookies, analytics or database. Questions are not logged.

## 3. Run it locally

Needs Node.js 18 or newer. There are no npm dependencies.

```bash
git clone https://github.com/kenil11shah/groww-mf-faq-assistant.git
cd groww-mf-faq-assistant
cp .env.example .env          # optional: paste a free Gemini key from aistudio.google.com
npm run dev                   # → http://localhost:3000
npm test                      # 1,300+ automated checks
```

Without a key, the app runs in extractive mode: same facts and links, with the source sentence as the answer.

## 4. Deploy on Vercel (free)

1. On vercel.com, choose **Add New → Project**, import this GitHub repo, and keep the default settings (Framework: *Other*, no build command).
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` = your Google AI Studio key.
3. Click **Deploy** (redeploy after adding the key). The static UI is served from `public/` and the API from `api/ask.js`.

## 5. Source list (20 official public pages)

Also available as CSV: [`data/sources.csv`](data/sources.csv). All pages accessed on 08 Nov 2026.

| # | Source | Publisher | Used for |
|---|---|---|---|
| S01 | [Groww Large Cap Fund – Direct Growth](https://www.growwmf.in/mutual-funds/groww-large-cap-fund-direct-growth) | Groww Mutual Fund | Expense ratio, exit load, min SIP, benchmark, riskometer, managers |
| S02 | [Groww ELSS Tax Saver Fund – Direct Growth](https://www.growwmf.in/mutual-funds/groww-elss-tax-saver-fund-direct-growth) | Groww Mutual Fund | Expense ratio, 3-year lock-in, exit load, min SIP, benchmark, riskometer |
| S03 | [Monthly Factsheet – September 2026](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/Fact%20Sheet/2024-%202025/Monthly%20Factsheet%20Sept%202026.pdf) | Groww Mutual Fund | Base expense ratio (as on 30 Sep 2026), exit loads, launch dates |
| S04 | [SID – Groww Multicap Fund (30 Oct 2026)](https://portal.amfiindia.com/spages/14047.pdf) | Groww MF via AMFI portal | Benchmark, riskometer, SIP minimums, lock-in, plans |
| S05 | [SID – Groww Nifty Total Market Index Fund (30 Jul 2026)](https://portal.amfiindia.com/spages/13777.pdf) | Groww MF via AMFI portal | Benchmark, riskometer, SIP minimums, exit load, plans |
| S06 | [Statement of Additional Information (02 Nov 2026)](https://portal.amfiindia.com/spages/sai63.pdf) | Groww MF via AMFI portal | When the CAS is emailed |
| S07 | [Contact Us](https://www.growwmf.in/contact-us) | Groww Mutual Fund | Investor support details |
| S08 | [Investor Education](https://www.growwmf.in/investor/investor-education) | Groww Mutual Fund | Educational link in refusals |
| S09 | [Downloads – Fact Sheet](https://www.growwmf.in/downloads/fact-sheet) | Groww Mutual Fund | Where factsheets are published |
| S10 | [Downloads – Scheme Performance](https://www.growwmf.in/downloads/scheme-performance) | Groww Mutual Fund | Official performance page |
| S11 | [Downloads – KIM](https://www.growwmf.in/downloads/kim) | Groww Mutual Fund | Scheme documents |
| S12 | [SEBI circular: Risk-o-meter (05 Oct 2020)](https://www.sebi.gov.in/sebi_data/attachdocs/oct-2020/1602580413614.pdf) | SEBI | Six risk levels, monthly evaluation, disclosure |
| S13 | [SEBI circular: Categorization of MF schemes (06 Oct 2017)](https://www.amfiindia.com/Themes/Theme1/downloads/1507291273374.pdf) | SEBI (hosted by AMFI) | Large/mid/small cap definitions, ELSS lock-in |
| S14 | [SEBI circular: Categorization of MF schemes (26 Feb 2026)](https://www.sebi.gov.in/legal/circulars/feb-2026/categorization-and-rationalization-of-mutual-fund-schemes_99983.html) | SEBI | Current Large Cap / Multi Cap rules |
| S15 | [Download CAS](https://amfiindia.com/investor-corner/online-center/download-CAS.html) | AMFI | How to get a CAS (MF Central, CAMS, KFintech) |
| S16 | [How to get a capital gain statement](https://www.mutualfundssahihai.com/en/how-get-capital-gain-statement-mutual-funds) | AMFI (Mutual Funds Sahi Hai) | Capital-gains statement steps |
| S17 | [What is a Riskometer?](https://www.mutualfundssahihai.com/en/what-riskometer-and-what-are-different-levels) | AMFI (Mutual Funds Sahi Hai) | Riskometer explainer |
| S18 | [What is Total Expense Ratio?](https://amfiindia.com/investor-corner/knowledge-center/Expense-Ratio.html) | AMFI | Expense ratio explainer |
| S19 | [How to download tax statement (ELSS)](https://groww.in/help/mutual-funds/order/how-to-download-tax-statement--for-elss--77) | Groww help centre | ELSS statement steps in the Groww app |
| S20 | [Groww Mutual Fund home page](https://www.growwmf.in/) | Groww Mutual Fund | AMC name and SEBI registration |

No third-party blogs, aggregators or app screenshots were used. S19 is the help centre of Groww, the product this project is built for; every other source is an AMC, SEBI or AMFI page.

## 6. Sample Q&A

Captured from the live prototype on 08 Nov 2026 (`npm run sample-qa -- <live url>` regenerates it). The full file with links is [`SAMPLE_QA.md`](SAMPLE_QA.md).

| # | Question | Assistant's answer (≤3 sentences) | Source |
|---|---|---|---|
| 1 | What is the expense ratio of Groww Large Cap Fund? | The expense ratio of Groww Large Cap Fund (Direct Plan - Growth) is 1.27%, inclusive of GST, as shown on the scheme page. | [S01](https://www.growwmf.in/mutual-funds/groww-large-cap-fund-direct-growth) |
| 2 | What is the lock-in period of Groww ELSS Tax Saver Fund? | Groww ELSS Tax Saver Fund has a lock-in period of 3 years. Units cannot be redeemed until 3 years from the date of allotment. | [S02](https://www.growwmf.in/mutual-funds/groww-elss-tax-saver-fund-direct-growth) |
| 3 | What is the exit load of Groww Multicap Fund? | 1% if units are redeemed or switched out within 1 year from the date of allotment; nil after 1 year. | [S03](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/Fact%20Sheet/2024-%202025/Monthly%20Factsheet%20Sept%202026.pdf) |
| 4 | Minimum SIP for Groww Nifty Total Market Index Fund? | ₹500 for monthly and quarterly SIPs and ₹100 for daily and weekly SIPs, in multiples of ₹1. | [S05](https://portal.amfiindia.com/spages/13777.pdf) |
| 5 | Riskometer and benchmark of Groww Large Cap Fund? | Very High risk; its benchmark, Nifty 100 TRI, is also Very High on the benchmark riskometer. | [S01](https://www.growwmf.in/mutual-funds/groww-large-cap-fund-direct-growth) |
| 6 | How do I download my capital-gains statement? | Use the Reports section of the platform you invested through, or the RTA websites: CAMS → Statements → Capital Gain/Loss Statement; KFintech → Investor Statement and Report → Capital Gains Statement. | [S16](https://www.mutualfundssahihai.com/en/how-get-capital-gain-statement-mutual-funds) |
| 7 | How do I download my ELSS tax statement on Groww? | Profile → Reports → under Tax, "Mutual Fund - ELSS statement" → Download; the password is your PAN in capital letters. | [S19](https://groww.in/help/mutual-funds/order/how-to-download-tax-statement--for-elss--77) |
| 8 | Should I invest in Groww ELSS or Groww Large Cap? | *Refused:* facts only, no advice; suggests asking for facts and consulting a SEBI-registered investment adviser. | [S08](https://www.growwmf.in/investor/investor-education) |
| 9 | What returns has Groww Multicap Fund given in 1 year? | *Refused:* does not share or compare returns; links the official factsheet. | [S03](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/Fact%20Sheet/2024-%202025/Monthly%20Factsheet%20Sept%202026.pdf) |
| 10 | My PAN is ABCDE1234F. Can you check my SIP? | *Refused:* asks the user not to share personal details (nothing is stored) and points to investor support. | [S07](https://www.growwmf.in/contact-us) |

## 7. Testing

`npm test` runs 76 questions in two modes (no LLM, and a simulated LLM) plus corpus and guardrail checks: 1,300+ assertions in total. It checks:

- the right answer, chunk and source for every factual question;
- that every answer has one https source link, ≤3 sentences and the last-updated date;
- refusals for advice, returns, comparisons, personal data, own-account and out-of-scope questions;
- the guardrails, using a fake model that invents a number, cites a chunk that doesn't exist, slips in advice, writes 5 sentences or goes down. Each case must be caught.

## 8. Known limits

- **Small, frozen corpus.** 4 schemes and 20 pages, captured on 08 Nov 2026. Expense ratios and riskometers change monthly, so the corpus must be refreshed by hand (edit `data/corpus.json` and the date).
- **Two kinds of expense ratio.** The scheme pages show the current expense ratio (Direct Growth, inclusive of GST), while the factsheet shows the *base* expense ratio as on 30 Sep 2026 for both plans. The assistant always says which one it is quoting, and the "as of" basis is part of the answer.
- **Conflicts in official documents.** The Groww Multicap SID lists the exit load as "1% within 1 year" in its highlights but "1% within 3 months" in the load-structure section. The assistant uses 1 year, which matches both the September 2026 factsheet and the AMC scheme page. On 08 Nov 2026 the Multicap scheme page also showed an inconsistent benchmark and category, so that page was not used as a source.
- **Keyword understanding.** Intent and scheme detection use rules, and retrieval is BM25 (keyword, not semantic). Unusual phrasings or spelling mistakes can lead to "Which scheme?" or "not found" instead of an answer. That is the safe failure, never a wrong number.
- **One source per answer.** Multi-part questions get the single best-matching fact.
- **English only.** Hindi and Hinglish questions are not supported yet.
- **No live data by design.** No NAV, AUM, holdings or returns; the assistant links the official page instead.
- **Free-tier AI.** The app uses Google's `-latest` Flash model aliases, because fixed model names get retired (gemini-2.5-flash was closed to new keys while I built this). Gemini's free tier can also be rate-limited. The app then shows the verified source sentence, so answers stay correct but read less naturally.

## 9. Project structure

```
api/ask.js            Vercel serverless function (POST /api/ask, GET /api/ask = metadata + sources)
lib/understand.js     PII, intent, scheme and topic detection
lib/retrieve.js       BM25 retrieval over fact chunks
lib/llm.js            Gemini call: system prompt, JSON schema, model fallback, timeouts
lib/assistant.js      Pipeline, refusal templates, verification, extractive fallback
data/corpus.json      64 fact chunks (scheme, topic, source, as-of date)
data/sources.csv      The 20 sources (also built into data/sources.json)
public/               UI (index.html, app.js): welcome line, 3 examples, disclaimer
tests/                cases.json (76 questions) + run-tests.js
scripts/              build-sources.js, make-sample-qa.js
server.js             Local dev server
```
