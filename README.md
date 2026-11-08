# Groww MF Facts: a facts-only mutual fund FAQ assistant

A small FAQ assistant that answers **factual** questions about **Groww Mutual Fund** schemes (expense ratio, exit load, minimum SIP, ELSS lock-in, riskometer, benchmark, fund managers, how to download statements) using **only official public documents and pages** from the AMC, SEBI and AMFI. Every answer is at most 3 sentences, shows **exactly one source link** and the line *"Last updated from sources: 08 Nov 2026"*. It does **not** give investment advice.

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
| **Facts covered** | Expense ratio (and expense limit), exit load, minimum SIP / lumpsum, SIP instalments, lock-in, riskometer (scheme and benchmark), benchmark, category and objective, ELSS tax section, launch date, fund managers, plans and options |
| **General topics** | How to download a CAS or a capital-gains statement, ELSS tax statement on Groww, when the CAS is emailed, what a riskometer / expense ratio / exit load is, SEBI market-cap definitions, stamp duty, AMC contact details |
| **Sources** | 16 official public documents and pages (list below), checked on 08 Nov 2026 |

**What it refuses, politely and with an educational link:**

| Question type | Example | What the assistant does |
|---|---|---|
| Advice / opinion | "Should I buy Groww ELSS?" | Facts-only refusal + link to Groww MF Investor Education |
| Returns / performance | "What returns did it give last year?" | No numbers; links the official factsheet |
| Comparisons | "Which is better, Large Cap or Multicap?" | Asks for one scheme at a time |
| Personal data (PII) | PAN, Aadhaar, phone, email, OTP, folio/account numbers | Blocked in the browser **and** on the server; never stored or sent to the AI |
| Own account | "What is the status of my SIP?" | Points to Groww MF investor support |
| Other AMCs / other Groww schemes | "HDFC Flexi Cap expense ratio?" | Explains the scope |
| Fast-changing numbers | NAV, AUM, holdings | Links the official factsheet instead of guessing |

## 2. How it works

```
Question
  │
  ├─ 1. Understand   PII check → intent (fact / advice / returns / compare / account) → scheme → which fact (topic)
  │                  └─ refuse, or ask "Which scheme?" if the fact needs one and none was named
  ├─ 2. Retrieve     BM25 keyword search over 65 fact chunks, filtered to the scheme, boosted by topic
  ├─ 3. Generate     Gemini (free tier) writes a ≤3-sentence answer from ONE retrieved chunk (JSON output)
  └─ 4. Verify       cited chunk must be one of the retrieved ones · every number must appear in that chunk ·
                     no advice words · max 3 sentences → otherwise show the source sentence itself
Answer + 1 source link + "Last updated from sources"
```

- **Corpus** (`data/corpus.json`): each official document was read and broken into short, self-contained **fact chunks** (one fact each, ≤3 sentences), tagged with scheme, topic, source id and an "as of" date.
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
npm test                      # 1,385 automated checks
```

Without a key, the app runs in extractive mode: same facts and links, with the source sentence as the answer.

## 4. Deploy on Vercel (free)

1. On vercel.com, choose **Add New → Project**, import this GitHub repo, and keep the default settings (Framework: *Other*, no build command).
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` = your Google AI Studio key.
3. Click **Deploy** (redeploy after adding the key). The static UI is served from `public/` and the API from `api/ask.js`.

## 5. Source list (16 official public documents and pages)

Also available as CSV: [`data/sources.csv`](data/sources.csv). Every link was opened and checked on 08 Nov 2026.

| # | Source | Publisher | Used for |
|---|---|---|---|
| S01 | [SID – Groww Large Cap Fund (dated 30 Oct 2026)](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/SID/Equity%20Funds/Groww%20Large%20Cap%20Fund.pdf) | Groww Mutual Fund | Benchmark, riskometer, SIP/lumpsum minimums, exit load, lock-in, plans, managers, expenses, stamp duty |
| S02 | [SID – Groww ELSS Tax Saver Fund (dated 30 Oct 2026)](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/SID/Equity%20Funds/Groww%20ELSS%20Tax%20Saver%20Fundx.pdf) | Groww Mutual Fund | Benchmark, riskometer, SIP/lumpsum minimums, exit load, plans, managers, tax section |
| S03 | [Monthly Factsheet – September 2026](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/Fact%20Sheet/2024-%202025/Monthly%20Factsheet%20Sept%202026.pdf) | Groww Mutual Fund | Base expense ratios (as on 30 Sep 2026), ELSS 3-year lock-in, launch dates, Large Cap objective |
| S04 | [SID – Groww Multicap Fund (dated 30 Oct 2026)](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/SID/Equity%20Funds/Groww%20Multicap%20Fund.pdf) | Groww Mutual Fund | Benchmark, riskometer, SIP/lumpsum minimums, exit load, lock-in, plans, managers |
| S05 | [SID – Groww Nifty Total Market Index Fund (dated 23 Oct 2026)](https://assets-netstorage.growwmf.in/compliance_docs/Downloads/SID/Index%20Funds/SID_Groww%20Nifty%20Total%20Market%20Index%20Fund.pdf) | Groww Mutual Fund | Benchmark, riskometer, SIP/lumpsum minimums, exit load, lock-in, plans, managers, expense limit |
| S06 | [Statement of Additional Information (dated 02 Nov 2026)](https://portal.amfiindia.com/spages/sai63.pdf) | Groww MF via AMFI portal | When account statements and the CAS are sent |
| S07 | [Contact Us](https://www.growwmf.in/contact-us) | Groww Mutual Fund | Investor support details |
| S08 | [Investor Education](https://www.growwmf.in/investor/investor-education) | Groww Mutual Fund | Educational link in refusals |
| S09 | [SEBI circular: Risk-o-meter (05 Oct 2020)](https://www.sebi.gov.in/sebi_data/attachdocs/oct-2020/1602580413614.pdf) | SEBI | Six risk levels, monthly evaluation, disclosure and change rules |
| S10 | [SEBI circular: Categorization of MF schemes (06 Oct 2017)](https://www.amfiindia.com/Themes/Theme1/downloads/1507291273374.pdf) | SEBI (hosted by AMFI) | Large/mid/small cap definitions, ELSS statutory 3-year lock-in |
| S11 | [SEBI circular: Categorization of MF schemes (26 Feb 2026)](https://www.sebi.gov.in/legal/circulars/feb-2026/categorization-and-rationalization-of-mutual-fund-schemes_99983.html) | SEBI | Current Large Cap and Multi Cap rules |
| S12 | [Download CAS](https://www.amfiindia.com/online-center/download-cas) | AMFI | How to get a CAS (MF Central, CAMS, KFintech) |
| S13 | [How to get a capital gain statement](https://www.mutualfundssahihai.com/en/how-get-capital-gain-statement-mutual-funds) | AMFI (Mutual Funds Sahi Hai) | Capital-gains statement steps |
| S14 | [What is a Riskometer?](https://www.mutualfundssahihai.com/en/what-riskometer-and-what-are-different-levels) | AMFI (Mutual Funds Sahi Hai) | Riskometer explainer |
| S15 | [ELSS tax statement download](https://groww.in/help/mutual-funds/order/how-to-download-tax-statement--for-elss--77) | Groww help centre | ELSS statement steps in the Groww app |
| S16 | [Groww Mutual Fund home page](https://www.growwmf.in/) | Groww Mutual Fund | AMC name, SEBI registration, Downloads menu |

No third-party blogs, aggregators or app screenshots were used. S15 is the help centre of Groww, the product this project is built for; every other source is an AMC, SEBI or AMFI document or page.

**Why scheme documents rather than scheme web pages:** the growwmf.in scheme pages load their data from a back-end that often fails ("Oops! something went wrong"), so a link could break while a mentor clicks it. The SIDs and the factsheet are static PDFs on the AMC's own file server, they are the legally binding scheme documents, and every link above opened reliably in repeated checks.

## 6. Sample Q&A

SAMPLE_QA_TABLE

## 7. Testing

`npm test` runs 80 questions in two modes (no LLM, and a simulated LLM) plus corpus and guardrail checks: 1,385 assertions in total. It checks:

- the right answer, chunk and source for every factual question;
- that every answer has one https source link, ≤3 sentences and the last-updated date;
- refusals for advice, returns, comparisons, personal data, own-account and out-of-scope questions;
- the guardrails, using a fake model that invents a number, cites a chunk that doesn't exist, slips in advice, writes 5 sentences or goes down. Each case must be caught.

## 8. Known limits

- **Small, frozen corpus.** 4 schemes and 16 sources, checked on 08 Nov 2026. Expense ratios and riskometers can change every month, so the corpus must be refreshed by hand when a new factsheet or SID comes out (edit `data/corpus.json` and the date).
- **Expense ratios are the factsheet's base expense ratios as on 30 Sep 2026.** Other places show different figures for the same fund (the growwmf.in scheme page and the Groww app use different dates and include GST), so every expense-ratio answer states its date and source.
- **ELSS tax wording follows the latest SID.** From the SID dated 30 Oct 2026, the ELSS tax benefit is described under Section 123 read with Schedule XV of the Income Tax Act, 2025 (earlier documents said Section 80C).
- **Keyword understanding.** Intent and scheme detection use rules, and retrieval is BM25 (keyword, not semantic). Unusual phrasings or spelling mistakes can lead to "Which scheme?" or "not found" instead of an answer. That is the safe failure, never a wrong number.
- **One source per answer.** Multi-part questions get the single best-matching fact.
- **English only.** Hindi and Hinglish questions are not supported yet.
- **No live data by design.** No NAV, AUM, holdings or returns; the assistant links the official factsheet instead.
- **Free-tier AI.** The app uses Google's `-latest` Flash model aliases, because fixed model names get retired (gemini-2.5-flash was closed to new keys while I built this). If Gemini is busy, the app shows the verified source sentence, so answers stay correct but read less naturally.

## 9. Project structure

```
api/ask.js            Vercel serverless function (POST /api/ask, GET /api/ask = metadata + sources)
lib/understand.js     PII, intent, scheme and topic detection
lib/retrieve.js       BM25 retrieval over fact chunks
lib/llm.js            Gemini call: system prompt, JSON schema, model fallback, timeouts
lib/assistant.js      Pipeline, refusal templates, verification, extractive fallback
data/corpus.json      65 fact chunks (scheme, topic, source, as-of date)
data/sources.csv      The 16 sources (also built into data/sources.json)
public/               UI (index.html, app.js): welcome line, 3 examples, disclaimer
tests/                cases.json (80 questions) + run-tests.js
scripts/              build-sources.js, make-sample-qa.js
server.js             Local dev server
```
