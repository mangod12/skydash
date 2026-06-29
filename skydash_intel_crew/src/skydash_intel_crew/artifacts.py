import json
import os
import re
import subprocess
from datetime import date
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from skydash_intel_crew.tools.custom_tool import (
    SkyDashCompanyReadinessTool,
    SkyDashProjectDocsTool,
    _repo_root,
)

REPORT_DIR = Path("reports")
BACKEND_ROUTE_RE = re.compile(r"@router\.(get|post|put|delete)\(\"([^\"]+)\"")
BUTTON_RE = re.compile(r"<button\b", re.IGNORECASE)
TITLE_RE = re.compile(r"title=\"([^\"]+)\"")
LABEL_RE = re.compile(r"aria-label=\"([^\"]+)\"")


def _write_report(name: str, payload: dict) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / name
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return path


def _generated_date() -> str:
    return os.getenv("SKYDASH_CREW_DATE") or date.today().isoformat()


def _read_json_url(url: str, timeout: int = 5) -> dict:
    try:
        with urlopen(url, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {
                "available": True,
                "status": getattr(response, "status", 200),
                "body": json.loads(body),
            }
    except (OSError, URLError, json.JSONDecodeError) as exc:
        return {"available": False, "error": str(exc)}


def build_command_inventory() -> dict:
    root = _repo_root()
    routes = []
    for path in sorted((root / "backend" / "routes").glob("*.py")):
        text = path.read_text(encoding="utf-8", errors="replace")
        for method, route in BACKEND_ROUTE_RE.findall(text):
            routes.append(
                {
                    "file": str(path.relative_to(root)),
                    "method": method.upper(),
                    "path": route,
                }
            )

    frontend_controls = []
    for path in sorted((root / "skydash" / "frontend" / "src").rglob("*.jsx")):
        text = path.read_text(encoding="utf-8", errors="replace")
        button_count = len(BUTTON_RE.findall(text))
        if button_count == 0:
            continue
        frontend_controls.append(
            {
                "file": str(path.relative_to(root)),
                "button_count": button_count,
                "titles": sorted(set(TITLE_RE.findall(text))),
                "aria_labels": sorted(set(LABEL_RE.findall(text))),
            }
        )

    return {
        "generated_date": _generated_date(),
        "repo_root": str(root),
        "backend_routes": routes,
        "frontend_controls": frontend_controls,
        "summary": {
            "backend_route_count": len(routes),
            "frontend_control_files": len(frontend_controls),
            "frontend_button_count": sum(item["button_count"] for item in frontend_controls),
        },
    }


def build_ui_control_audit() -> dict:
    inventory = build_command_inventory()
    root = _repo_root()
    e2e_dir = root / "e2e"
    e2e_text = "\n".join(
        path.read_text(encoding="utf-8", errors="replace")
        for path in sorted(e2e_dir.glob("*.spec.js"))
    )

    control_files = []
    total_titles = 0
    total_aria_labels = 0
    for item in inventory["frontend_controls"]:
        titles = item["titles"]
        aria_labels = item["aria_labels"]
        total_titles += len(titles)
        total_aria_labels += len(aria_labels)
        tested_titles = [title for title in titles if title and title in e2e_text]
        tested_aria = [label for label in aria_labels if label and label in e2e_text]
        control_files.append(
            {
                **item,
                "tested_titles": tested_titles,
                "tested_aria_labels": tested_aria,
                "coverage_signal_count": len(tested_titles) + len(tested_aria),
            }
        )

    runtime_report_path = REPORT_DIR / "skydash_ui_control_runtime_audit.json"
    runtime_report = {"available": False}
    if runtime_report_path.exists():
        try:
            runtime_report = {
                "available": True,
                "path": str(runtime_report_path),
                "payload": json.loads(runtime_report_path.read_text(encoding="utf-8")),
            }
        except json.JSONDecodeError as exc:
            runtime_report = {
                "available": False,
                "path": str(runtime_report_path),
                "error": str(exc),
            }

    e2e_control_tests = [
        {
            "file": str(path.relative_to(root)),
            "name": name,
        }
        for path in sorted(e2e_dir.glob("*.spec.js"))
        for name in re.findall(r"test\('([^']*(?:button|control|toggle|panel|command|flow|audit)[^']*)'", path.read_text(encoding="utf-8", errors="replace"), re.IGNORECASE)
    ]

    runtime_summary = runtime_report.get("payload", {}).get("summary", {})
    return {
        "generated_date": _generated_date(),
        "summary": {
            "frontend_button_count": inventory["summary"]["frontend_button_count"],
            "frontend_control_files": inventory["summary"]["frontend_control_files"],
            "static_title_count": total_titles,
            "static_aria_label_count": total_aria_labels,
            "e2e_control_test_count": len(e2e_control_tests),
            "runtime_audit_available": runtime_report["available"],
            "runtime_actionable_buttons": runtime_summary.get("actionableButtons"),
            "runtime_unlabeled_buttons": runtime_summary.get("unlabeledButtons"),
        },
        "control_files": control_files,
        "e2e_control_tests": e2e_control_tests,
        "runtime_audit": runtime_report,
    }


def build_runtime_readiness() -> dict:
    api_url = os.getenv("SKYDASH_API_URL", "http://localhost:8001").rstrip("/")
    frontend_url = os.getenv("SKYDASH_FRONTEND_URL", "http://localhost").rstrip("/")
    return {
        "generated_date": _generated_date(),
        "company_readiness": json.loads(
            SkyDashCompanyReadinessTool()._run(include_git_status=False)
        ),
        "live_probes": {
            "health": _read_json_url(f"{api_url}/health"),
            "stable_seed_entity": _read_json_url(f"{api_url}/api/entities/ent-001"),
            "frontend": {"url": frontend_url},
        },
    }


def build_verification_gate() -> dict:
    root = _repo_root()
    checks = []

    def add(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "passed": passed, "detail": detail})

    required_paths = [
        "docker-compose.yml",
        "Dockerfile.backend",
        "Dockerfile.frontend",
        "Dockerfile.crewai",
        "backend/routes/telemetry.py",
        "backend/entities.py",
        "skydash/frontend/src/components/telemetry/DroneCommandPanel.jsx",
        "e2e/api.spec.js",
        "e2e/interactions.spec.js",
        "e2e/control-audit.spec.js",
    ]
    for rel_path in required_paths:
        add(f"path:{rel_path}", (root / rel_path).exists(), "required project artifact")

    try:
        compose = subprocess.run(
            ["docker", "compose", "config", "--quiet"],
            cwd=root,
            text=True,
            capture_output=True,
            timeout=30,
            check=False,
        )
        add("docker_compose_config", compose.returncode == 0, compose.stderr.strip())
    except (OSError, subprocess.TimeoutExpired) as exc:
        add(
            "docker_compose_config",
            (root / "docker-compose.yml").exists(),
            f"Docker CLI unavailable in this runtime; compose file presence checked: {exc}",
        )

    api_spec = (root / "e2e" / "api.spec.js").read_text(encoding="utf-8", errors="replace")
    interactions = (root / "e2e" / "interactions.spec.js").read_text(
        encoding="utf-8", errors="replace"
    )
    add("drone_command_api_tests", "drone command endpoint" in api_spec, "API command tests present")
    add("mission_link_api_tests", "stable seeded entity" in api_spec, "Mission link tests present")
    add("mission_browser_flow", "quick action mission flow" in interactions, "UI mission flow test present")
    control_audit = (root / "e2e" / "control-audit.spec.js").read_text(
        encoding="utf-8", errors="replace"
    )
    add("runtime_control_audit", "runtime control audit" in control_audit, "Visible button audit test present")

    return {
        "generated_date": _generated_date(),
        "passed": all(check["passed"] for check in checks),
        "checks": checks,
    }


def build_subteam_model() -> dict:
    docs = json.loads(
        SkyDashProjectDocsTool()._run(
            paths=[
                "README.md",
                "docs/current-status.md",
                "docs/skydash-operations-runbook.md",
                "docs/safety-and-scope.md",
                "skydash_intel_crew/README.md",
            ]
        )
    )
    return {
        "generated_date": _generated_date(),
        "source_documents": docs,
        "subteams": [
            {
                "name": "Verify Intake",
                "purpose": "Ground CrewAI work in repo docs, current CrewAI references, and live stack probes.",
                "artifact": "skydash_source_snapshot.json",
            },
            {
                "name": "Build",
                "purpose": "Convert verified gaps into scoped engineering tasks for UI, API, OSINT, telemetry, and deployment.",
                "artifact": "skydash_command_inventory.json",
            },
            {
                "name": "UI Control QA",
                "purpose": "Keep visible operator controls labeled, inventoried, and backed by runtime Playwright audit evidence.",
                "artifact": "skydash_ui_control_audit.json",
            },
            {
                "name": "Verify Runtime",
                "purpose": "Probe backend health, seeded entities, connector modes, and frontend reachability.",
                "artifact": "skydash_runtime_readiness.json",
            },
            {
                "name": "QA Gate",
                "purpose": "Block claims until source, Docker, API, and browser checks exist and pass.",
                "artifact": "skydash_verification_gate.json",
            },
            {
                "name": "Market And Brand",
                "purpose": "Start outreach only after QA gates pass; keep claims aligned to safety and prototype scope.",
                "artifact": "skydash_subteam_operating_model.json",
            },
        ],
    }


def write_command_inventory() -> Path:
    return _write_report("skydash_command_inventory.json", build_command_inventory())


def write_ui_control_audit() -> Path:
    return _write_report("skydash_ui_control_audit.json", build_ui_control_audit())


def write_runtime_readiness() -> Path:
    return _write_report("skydash_runtime_readiness.json", build_runtime_readiness())


def write_verification_gate() -> Path:
    return _write_report("skydash_verification_gate.json", build_verification_gate())


def write_subteam_model() -> Path:
    return _write_report("skydash_subteam_operating_model.json", build_subteam_model())
