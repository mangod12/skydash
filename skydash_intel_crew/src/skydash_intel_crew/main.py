#!/usr/bin/env python
import os
import sys
import warnings
from datetime import date
from pathlib import Path
import json

from skydash_intel_crew.crew import SkydashIntelCrew
from skydash_intel_crew.artifacts import (
    write_command_inventory,
    write_runtime_readiness,
    write_subteam_model,
    write_ui_control_audit,
    write_verification_gate,
)
from skydash_intel_crew.tools.custom_tool import (
    CrewAIReferenceTool,
    SkyDashCompanyReadinessTool,
    SkyDashProjectDocsTool,
)

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

DEFAULT_FOCUS_AREA = (
    "SkyDash company operating readiness: CrewAI docs and GitHub source intake, "
    "product engineering, QA, drone safety, compliance, brand, and outreach"
)
PLATFORM_SCOPE = (
    "SkyDash is a local-first spatial intelligence OS built with FastAPI and "
    "React. It combines simulated drone telemetry, entity and relationship "
    "records, missions, exports, ADS-B/OpenSky integration, optional Shodan "
    "connector support, and a brand position of: Command the signal. Map the risk. "
    "The current stack is an engineering prototype with simulated telemetry and "
    "explicit safety boundaries; production, surveillance, and real-drone claims "
    "must be gated by evidence."
)


def build_inputs() -> dict[str, str]:
    focus_area = " ".join(sys.argv[1:]).strip()
    if not focus_area:
        focus_area = os.getenv("SKYDASH_CREW_FOCUS", DEFAULT_FOCUS_AREA)
    return {
        "focus_area": focus_area,
        "platform_scope": os.getenv("SKYDASH_CREW_PLATFORM_SCOPE", PLATFORM_SCOPE),
        "generated_date": os.getenv("SKYDASH_CREW_DATE") or date.today().isoformat(),
    }


def run():
    """
    Run the crew.
    """
    inputs = build_inputs()

    try:
        SkydashIntelCrew().crew().kickoff(inputs=inputs)
    except Exception as e:
        raise Exception(f"An error occurred while running the crew: {e}")


def source_snapshot():
    """
    Collect the tool-grounded source intake without requiring an LLM kickoff.
    """
    output_dir = Path("reports")
    output_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_date": os.getenv("SKYDASH_CREW_DATE") or date.today().isoformat(),
        "inputs": build_inputs(),
        "crewai_reference_sources": json.loads(CrewAIReferenceTool()._run()),
        "skydash_project_docs": json.loads(SkyDashProjectDocsTool()._run()),
        "skydash_company_readiness": json.loads(
            SkyDashCompanyReadinessTool()._run(include_git_status=True)
        ),
    }
    output_path = output_dir / "skydash_source_snapshot.json"
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Wrote {output_path}")


def command_inventory():
    """Create a deterministic API/UI command inventory for CrewAI QA agents."""
    print(f"Wrote {write_command_inventory()}")


def ui_control_audit():
    """Create static/runtime UI control audit evidence for CrewAI QA agents."""
    print(f"Wrote {write_ui_control_audit()}")


def runtime_readiness():
    """Create a deterministic runtime readiness artifact without LLM calls."""
    print(f"Wrote {write_runtime_readiness()}")


def verification_gate():
    """Create a deterministic verification gate artifact without LLM calls."""
    print(f"Wrote {write_verification_gate()}")


def subteam_model():
    """Create a deterministic CrewAI subteam operating model without LLM calls."""
    print(f"Wrote {write_subteam_model()}")


def crew_subprocesses():
    """Run all non-LLM CrewAI subprocess artifacts."""
    source_snapshot()
    for writer in (
        write_command_inventory,
        write_ui_control_audit,
        write_runtime_readiness,
        write_verification_gate,
        write_subteam_model,
    ):
        print(f"Wrote {writer()}")


def train():
    """
    Train the crew for a given number of iterations.
    """
    inputs = build_inputs()
    try:
        SkydashIntelCrew().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")

def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        SkydashIntelCrew().crew().replay(task_id=sys.argv[1])

    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")

def test():
    """
    Test the crew execution and returns the results.
    """
    inputs = build_inputs()

    try:
        SkydashIntelCrew().crew().test(n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs)

    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")

def run_with_trigger():
    """
    Run the crew with trigger payload.
    """
    import json

    if len(sys.argv) < 2:
        raise Exception("No trigger payload provided. Please provide JSON payload as argument.")

    try:
        trigger_payload = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        raise Exception("Invalid JSON payload provided as argument")

    inputs = {
        "crewai_trigger_payload": trigger_payload,
        **build_inputs(),
    }

    try:
        result = SkydashIntelCrew().crew().kickoff(inputs=inputs)
        return result
    except Exception as e:
        raise Exception(f"An error occurred while running the crew with trigger: {e}")
