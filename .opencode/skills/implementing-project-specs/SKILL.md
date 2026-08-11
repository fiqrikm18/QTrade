---
name: implementing-project-specs
description: Use when building, modifying, or adding any feature to this project (ihsg-quant / quant-trade) — frontend, backend, engines, pipelines. Requires reading docs/PRD.md, docs/DESIGN.md, and docs/architecture.md before writing code, following roadmap phase order, and verifying before claiming completion.
---

# Implementing Project Specs

## Overview

This repo is specified by `docs/PRD.md` (product requirements) and
`docs/DESIGN.md` (UI spec). Before writing code, read the spec — the docs
decide the design, not the agent. Never make silent architectural decisions
(PRD §67).

## When to use

- Starting any feature, engine, page, or component in this repo
- Fixing or extending existing modules
- Choosing stack, schema, or data flow for new functionality

## Required before writing code

1. Read `docs/PRD.md` (source of truth for requirements).
2. Read `docs/DESIGN.md` when the change touches frontend.
3. Read `docs/architecture.md` (module boundaries, tech choices, roadmap).
4. Read the relevant domain doc:
   `technical-analysis.md`, `fundamental-analysis.md`, `scoring.md`,
   `ml.md`, `backtesting.md`, `macro.md`, `llm.md`, `data-pipeline.md`,
   `data-model.md`, `deployment.md`.
5. Determine which roadmap phase (P1-P4 in `docs/architecture.md`) the work
   belongs to. Build in phase order; never jump ahead.

## Rules

1. **Backend engines before UI.** The quantitative engine is the foundation
   (PRD §59). Never start by building the UI.
2. **Modular monolith.** Respect clean boundaries
   (`app/{domain, application, infrastructure, interfaces}`). No
   microservices, no K8s/Kafka/Spark unless scale demands it (PRD §68).
3. **Deterministic first.** ML and LLM are optional support layers. Code must
   work with both disabled (`LLM_ENABLED=false`, `ML_ENABLED=false`).
4. **No look-ahead.** Point-in-time data everywhere; `available_at` gates
   fundamentals; walk-forward for ML; never use future data in backtests
   (`docs/quant-finance-rules`).
5. **Explainable + versioned.** Every score stores `score_components`;
   features/scores/models carry `*_version`.
6. **Test-Driven Development.** Write the test first, watch it fail, then
   implement. No code without a failing test.
7. **Per-component flow (PRD §67):** explain purpose → explain design →
   explain trade-offs → implement → add tests → validate → update docs.
8. **Verify before claiming done:** run lint, typecheck, and tests. Evidence
   before assertions.

## Red flags — STOP

- Writing code before reading the specs
- Silently changing architecture or schema
- Building the UI before the engine
- LLM/ML in a critical path
- Hardcoding weights or thresholds that should be configurable
- Claiming done without running tests
- "It's just a small change, docs don't matter"

**All of these mean: stop, read the spec, restart.**
