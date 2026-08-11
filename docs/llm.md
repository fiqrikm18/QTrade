# LLM Integration (Optional Layer)

The LLM is an **optional interpretation and research layer**. It must NEVER
generate indicators, override quantitative calculations, or hallucinate
financial data (PRD §31-§34, §63). The entire platform runs unchanged with
`LLM_ENABLED=false`.

## 1. Non-negotiable rules

1. LLM explains numbers; it does not create them.
2. LLM is never in the critical path — scanner, indicators, fundamentals,
   regime, ranking, screening, risk, backtest, ML all work without it
   (PRD §34).
3. All AI enrichment is marked `AI_ENRICHED`, not raw fact (PRD §17).
4. LLM output is untrusted text rendered for humans, never fed back into
   quantitative logic without re-validation.
5. On any LLM failure: graceful fallback to deterministic analytics. Never a
   blank page.

## 2. Feature flags (PRD §33)

Every AI feature independently configurable (env + `feature_flags` table):

```
AI_ENABLED=true
LLM_ENABLED=true
LLM_ANALYSIS_ENABLED=true
LLM_NEWS_SUMMARY_ENABLED=true
LLM_STOCK_EXPLANATION_ENABLED=true
LLM_MACRO_SUMMARY_ENABLED=true
LLM_NL_SCREENER_ENABLED=true
LLM_RESEARCH_ENABLED=true
ML_ENABLED=true
ML_STOCK_RANKING_ENABLED=true
ML_RETURN_PREDICTION_ENABLED=true
```

Supported modes: **Pure Quant** · **Quant+ML** · **Quant+LLM** ·
**Quant+ML+LLM**.

## 3. Provider abstraction (PRD §32)

```python
class LLMProvider(Protocol):
    def complete(self, prompt: str, *, system: str | None = None,
                 temperature: float | None = None) -> str: ...
    def complete_json(self, prompt: str, *, schema: type[BaseModel]) -> BaseModel: ...
```

Implementation per vendor: OpenAI, Anthropic, Google, OpenRouter, local
Ollama. Selected by `LLM_PROVIDER`; model by `LLM_MODEL`; `LLM_TEMPERATURE`
(0-1, default low). Config keys: `LLM_ENABLED, LLM_PROVIDER, LLM_MODEL,
LLM_TEMPERATURE`. Retry/timeout in the adapter; on failure raise a typed
`LLMUnavailable` handled by the application layer's fallback path.

## 4. Allowed features

- Explaining quantitative results ("why is BBCA ranked #3?") from structured
  `score_components`
- Summarizing a single-stock analysis page
- Summarizing news items and macro conditions
- Generating research reports (from stored facts)
- Natural-language query translation (screener + market questions)
- Answering questions **about calculated analytics** only

## 5. Structured data → prompt

Never paste free-form DB state. Build a compact, schema-bound context:

```json
{
  "ticker": "BBCA",
  "asof_date": "...",
  "opportunity_score": 86,
  "classification": "OPPORTUNITY",
  "components": {
    "technical": {"score": 88, "drivers": ["..."], "metric": {"rsi_14": 62, "price_vs_sma50": 1.04}}
  },
  "risk": {"score": 76, "drawdown_250d": 0.12},
  "feature_version": "v3",
  "scoring_version": "v1"
}
```

Constraints:
- Pass only fields the UI would show; keep payloads small.
- Include version strings so the LLM can say "based on feature_version v3".
- Prompt includes: system instruction (analyst explaining data, cite numbers,
  no invented figures, no advice), the JSON context, and the user question.
- `complete_json` + a Pydantic schema for any structured output (e.g.
  NL-screener filter tree) so results are validated before use.

## 6. Natural-language screener & market query (PRD §45, §46)

Flow:
```
user: "Which banking stocks are strongest right now?"
  → LLM (complete_json, schema = FilterTree): {"sector": "BANKING", "opportunity_score": {">": 70}}
  → deterministic screener engine executes FilterTree
  → results from DB, never from LLM
```

- The LLM produces only the **filter spec**; execution is 100% deterministic
  (`docs/scoring.md` §9).
- Validate FilterTree against an allowlist of fields/operators before running.
- On validation failure or LLM error: fall back to asking the user to use the
  form-based screener.
- Market questions ("what is happening in IHSG today?") translate to the
  market overview API; again deterministic execution.

## 7. Async & cost discipline (PRD §38, §34)

- No LLM call in any scan/ingest/batch path.
- LLM only on-demand: user-selected stocks, top candidates, reports, NL
  queries.
- Long-running features (research reports) run as RQ jobs; short explanations
  inline with timeout + graceful degradation.
- Cache LLM responses keyed by `(feature, context_hash, model)` to avoid
  repeat spend.

## 8. Prompt safety (PRD §56)

- Data injected via JSON only, never raw user text concatenated into
  instructions.
- System prompt fixed; user content separated.
- Treat LLM output as untrusted: render as text; no `dangerouslySetInnerHTML`
  without sanitization; never execute tool results derived from LLM text.
- No provider API keys ever in frontend; server-side only.

## 9. Modes of operation

| Mode | Deterministic | ML | LLM |
|---|---|---|---|
| Pure Quant | ✅ | — | — |
| Quant+ML | ✅ | ✅ | — |
| Quant+LLM | ✅ | — | ✅ |
| Quant+ML+LLM | ✅ | ✅ | ✅ |

Degradation ladder on LLM failure: **LLM content hidden → deterministic
numbers shown → system fully functional**. The UI must never block on an LLM
call.

## 10. UI transparency (DESIGN §33, §63-65, §67)

The frontend spec (`docs/DESIGN.md`) adds binding UI rules for AI features:

- AI assistant renders as a **secondary panel** (DESIGN §33) beside — never
  over — the quantitative evidence. It must cite the structured analytics it
  references (scores, drivers, risks).
- All AI-generated content is labeled `AI ENRICHED`, with provider, model,
  and generation time visible (DESIGN §64). Never present AI output as raw
  market data.
- Model/version metadata (model, version, training period, feature version,
  validation method, ROC-AUC, Rank IC) is exposed for ML outputs
  (DESIGN §64).
- When LLM is disabled/unavailable, the assistant panel shows an explicit
  "Unavailable — ML/LLM disabled in configuration; quantitative scoring
  remains fully operational" state (DESIGN §65).
- Click-through explainability (DESIGN §63): score → contributors → evidence
  (e.g. `EMA20 > EMA50`, `RSI = 64`). If a factor cannot be calculated,
  the UI says so instead of showing a blank.
- Command palette and research workspace (`docs/scoring.md` §9,
  `saved_research_queries`) persist NL-query → filter-tree results so they
  stay reproducible and shareable (DESIGN §32, §51).
