import json

from skydash_intel_crew.crew import SkydashIntelCrew
from skydash_intel_crew.artifacts import (
    build_command_inventory,
    build_subteam_model,
    build_ui_control_audit,
    build_verification_gate,
)
from skydash_intel_crew.main import build_inputs
from skydash_intel_crew.tools.custom_tool import (
    CrewAIReferenceTool,
    SkyDashApiHealthTool,
    SkyDashCompanyReadinessTool,
    SkyDashProjectDocsTool,
)


def test_build_inputs_uses_default_focus(monkeypatch):
    monkeypatch.setattr("sys.argv", ["skydash_intel_crew"])
    monkeypatch.delenv("SKYDASH_CREW_FOCUS", raising=False)

    inputs = build_inputs()

    assert "focus_area" in inputs
    assert "platform_scope" in inputs
    assert "SkyDash" in inputs["platform_scope"]


def test_health_tool_handles_unavailable_backend(monkeypatch):
    monkeypatch.setenv("SKYDASH_API_URL", "http://127.0.0.1:9")

    payload = json.loads(SkyDashApiHealthTool()._run())

    assert payload["available"] is False
    assert payload["url"] == "http://127.0.0.1:9/health"


def test_project_docs_tool_reads_local_readme():
    payload = json.loads(SkyDashProjectDocsTool()._run(paths=["README.md"]))

    assert payload["documents"][0]["available"] is True
    assert "SkyDash" in payload["documents"][0]["excerpt"]


def test_crewai_reference_tool_can_skip_external_fetch(monkeypatch):
    monkeypatch.setenv("SKYDASH_CREW_FETCH_EXTERNAL", "0")

    payload = json.loads(CrewAIReferenceTool()._run())

    assert payload["external_fetch_enabled"] is False
    assert payload["sources"] == []


def test_company_readiness_tool_handles_unavailable_stack(monkeypatch):
    monkeypatch.setenv("SKYDASH_API_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("SKYDASH_FRONTEND_URL", "http://127.0.0.1:9")

    payload = json.loads(SkyDashCompanyReadinessTool()._run(include_git_status=False))

    assert payload["checks"]["backend_health"]["available"] is False
    assert payload["artifacts"]["root_readme"] is True


def test_crew_can_be_constructed_without_kickoff():
    crew = SkydashIntelCrew().crew()

    assert len(crew.agents) == 3
    assert len(crew.tasks) == 3


def test_command_inventory_finds_backend_and_frontend_controls():
    payload = build_command_inventory()

    assert payload["summary"]["backend_route_count"] > 0
    assert payload["summary"]["frontend_button_count"] > 0
    assert any(route["path"] == "/api/drone/{drone_id}/command" for route in payload["backend_routes"])


def test_ui_control_audit_tracks_runtime_and_e2e_control_evidence():
    payload = build_ui_control_audit()

    assert payload["summary"]["frontend_button_count"] > 0
    assert payload["summary"]["e2e_control_test_count"] > 0
    assert any("runtime control audit" in item["name"] for item in payload["e2e_control_tests"])


def test_verification_gate_tracks_repaired_flows():
    payload = build_verification_gate()

    names = {check["name"] for check in payload["checks"]}
    assert "drone_command_api_tests" in names
    assert "mission_link_api_tests" in names
    assert "mission_browser_flow" in names
    assert "runtime_control_audit" in names


def test_subteam_model_declares_operating_artifacts():
    payload = build_subteam_model()
    artifacts = {team["artifact"] for team in payload["subteams"]}

    assert "skydash_source_snapshot.json" in artifacts
    assert "skydash_ui_control_audit.json" in artifacts
    assert "skydash_verification_gate.json" in artifacts
