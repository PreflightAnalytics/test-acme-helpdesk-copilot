# Acme Support helpdesk copilot

> **TESTING ONLY.** Acme Support is a fictional company. This repository is a realistic product used to test [Preflight](https://github.com/PreflightAnalytics) end to end with real pull requests and local models. Not a product.

The copilot helps Acme's support agents with four jobs, each answered by the model `config/models.json` names for it, on any OpenAI-compatible endpoint (local Ollama by default):

| Feature | Endpoint | What it does |
| --- | --- | --- |
| Refund triage | `POST /v1/triage` | Labels a ticket (category, priority, sentiment, language, needs a person) as JSON. |
| Reply drafting | `POST /v1/replies` | Drafts the first reply, grounded in the order and Acme's refund policy (`lookup_order`, `check_refund_policy`). |
| Thread summaries | `POST /v1/summaries` | Summarises a thread for the next agent, with the order numbers and the next action. |
| Help-center answers | `POST /v1/answers` | Answers from the help-center articles in `kb/`, with citations, and hands over when they don't cover the question. |

Emails, phone numbers, card numbers and IBANs are masked before anything reaches a model. Every answer reports the model and its token usage. Set `ACME_API_KEY` and every `/v1` route asks for it in `x-acme-key`.

## Run it

```bash
ollama pull llama3.2
npm start              # http://127.0.0.1:4300
npm test               # unit tests, no model needed
```

`MODEL_BASE_URL` points at another OpenAI-compatible endpoint; `ACME_CLOCK` freezes today's date (CI uses it so fixture orders keep their age).

## Preflight

- `.preflight/suites/helpdesk-copilot.json` is the release gate: every pull request is checked against `main`'s baseline on the lab runner.
- `.preflight/probe*` hold Preflight test types that are documented but not built yet (LLM-as-judge, authenticated apps, multipart uploads, values from earlier steps in checks). CI runs them offline and never fails on them; a passing probe means the capability landed.
