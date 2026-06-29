# SkyDash Intel Crew

CrewAI setup for SkyDash operational and company-readiness analysis. It creates
a three-agent crew that gathers current CrewAI/GitHub/package references, reads
local SkyDash source docs, checks live app readiness signals, and produces a
founder-ready operating plan.

## Installation

Ensure Python >=3.10 <3.14 is installed. This project uses
[UV](https://docs.astral.sh/uv/) for dependency management.

From this directory, install dependencies:

```bash
crewai install
```

Create a local `.env` file from `.env.example` and add an LLM API key. The
default example uses OpenAI. OpenRouter and Mimo are also supported.

```powershell
Copy-Item .env.example .env
```

## Running

Recommended Docker run from the repository root:

```powershell
docker compose up --build -d
docker compose --profile crew run --rm crewai
```

This uses `http://backend:8001` inside the Compose network and writes the report
to `skydash_intel_crew/reports/skydash_company_ops_plan.md`.

For local CLI development, start the SkyDash backend if you want live health
context available to the crew:

```powershell
cd ..\backend
python main.py
```

Run the crew from this directory:

```bash
crewai run
```

Collect the source intake without invoking an LLM:

```bash
uv run source_snapshot
```

Optionally pass a focus area:

```bash
uv run skydash_intel_crew "Run SkyDash like a production AI drone and surveillance company"
```

The report is written to `reports/skydash_company_ops_plan.md`.
The source snapshot is written to `reports/skydash_source_snapshot.json`.

## What The Crew Reads

The source researcher is tool-grounded. By default it checks:

- CrewAI changelog, tools docs, knowledge docs, flows docs, GitHub repository metadata, GitHub README, and PyPI package metadata.
- Local SkyDash root README, operations runbook, brand system, safety/scope doc, architecture walkthrough, CrewAI README, and CrewAI AGENTS reference.
- Local app readiness signals from `SKYDASH_API_URL`, `SKYDASH_FRONTEND_URL`, Docker Compose artifacts, and optional git status.

Set `SKYDASH_CREW_FETCH_EXTERNAL=0` to skip external CrewAI/GitHub/PyPI fetches
for offline tests.

## Configuration

Relevant environment variables:

- `OPENAI_API_KEY`: required for the default OpenAI model provider.
- `OPENROUTER_API_KEY`: required when using an OpenRouter model.
- `OPENAI_API_BASE` / `OPENAI_BASE_URL`: required when routing OpenAI-compatible calls to Mimo.
- `MODEL`: optional model override, for example `gpt-4o-mini`, `openrouter/openai/gpt-4o-mini`, or `openai/mimo-v2.5-pro`.
- `SKYDASH_API_URL`: optional SkyDash backend URL, defaults to `http://localhost:8001`.
- `SKYDASH_FRONTEND_URL`: optional SkyDash frontend URL, defaults to `http://localhost`.
- `SKYDASH_CREW_FOCUS`: optional default focus area when no CLI argument is passed.
- `SKYDASH_CREW_DATE`: optional ISO date override for generated reports.
- `SKYDASH_CREW_PLATFORM_SCOPE`: optional replacement for the built-in SkyDash scope summary.
- `SKYDASH_CREW_FETCH_EXTERNAL`: set to `0` to skip CrewAI docs, GitHub, and PyPI fetches.

OpenRouter example:

```env
OPENROUTER_API_KEY=your_openrouter_key
MODEL=openrouter/openai/gpt-4o-mini
```

Mimo example:

```env
OPENAI_API_KEY=your_mimo_key
OPENAI_API_BASE=https://token-plan-sgp.xiaomimimo.com/v1
OPENAI_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MODEL=openai/mimo-v2.5-pro
```

## Development

```bash
uv run pytest
uv run python -m compileall src
```

This project was generated with CrewAI `1.15.1` and customized for SkyDash.
