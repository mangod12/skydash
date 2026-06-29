import json
import os
import re
import subprocess
from html import unescape
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import urlopen

from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field

DEFAULT_TIMEOUT = 5
MAX_EXCERPT_CHARS = 1200
DEFAULT_REFERENCE_URLS = (
    "https://docs.crewai.com/en/changelog",
    "https://docs.crewai.com/en/concepts/tools",
    "https://docs.crewai.com/en/concepts/knowledge",
    "https://docs.crewai.com/en/concepts/flows",
    "https://api.github.com/repos/crewAIInc/crewAI",
    "https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md",
    "https://pypi.org/pypi/crewai/json",
)
DEFAULT_DOC_PATHS = (
    "README.md",
    "docs/current-status.md",
    "docs/skydash-operations-runbook.md",
    "docs/skydash-brand-system.md",
    "docs/safety-and-scope.md",
    "docs/architecture-walkthrough.md",
    "skydash_intel_crew/README.md",
    "skydash_intel_crew/AGENTS.md",
)


def _repo_root() -> Path:
    configured = os.getenv("SKYDASH_REPO_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[4]


def _excerpt(text: str, limit: int = MAX_EXCERPT_CHARS) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}..."


def _html_to_text(content: str) -> str:
    without_scripts = re.sub(
        r"<(script|style).*?</\1>",
        " ",
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    without_tags = re.sub(r"<[^>]+>", " ", without_scripts)
    return unescape(without_tags)


def _read_json_url(url: str, timeout: int = DEFAULT_TIMEOUT) -> dict:
    try:
        with urlopen(url, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            content_type = response.headers.get("content-type", "")
            status = getattr(response, "status", 200)
    except (OSError, URLError) as exc:
        return {
            "available": False,
            "url": url,
            "error": str(exc),
        }

    parsed_url = urlparse(url)
    result = {
        "available": True,
        "url": url,
        "host": parsed_url.netloc,
        "status": status,
        "content_type": content_type,
    }
    if "json" in content_type:
        try:
            parsed = json.loads(body)
            if parsed_url.netloc == "pypi.org":
                result["summary"] = {
                    "package": parsed.get("info", {}).get("name"),
                    "version": parsed.get("info", {}).get("version"),
                    "requires_python": parsed.get("info", {}).get("requires_python"),
                }
            elif parsed_url.netloc == "api.github.com":
                result["summary"] = {
                    "name": parsed.get("full_name"),
                    "description": parsed.get("description"),
                    "stars": parsed.get("stargazers_count"),
                    "open_issues": parsed.get("open_issues_count"),
                    "default_branch": parsed.get("default_branch"),
                }
            else:
                result["summary"] = parsed
        except json.JSONDecodeError:
            result["excerpt"] = _excerpt(body)
    else:
        text = _html_to_text(body) if "<html" in body[:500].lower() else body
        result["excerpt"] = _excerpt(text)
    return result


class SkyDashApiHealthInput(BaseModel):
    """Input schema for SkyDashApiHealthTool."""

    path: str = Field(
        default="/health",
        description="SkyDash API path to request, normally /health.",
    )


class SkyDashApiHealthTool(BaseTool):
    name: str = "skydash_api_health"
    description: str = (
        "Checks the local SkyDash FastAPI service and returns a compact JSON "
        "status payload when the backend is running."
    )
    args_schema: Type[BaseModel] = SkyDashApiHealthInput

    def _run(self, path: str = "/health") -> str:
        base_url = os.getenv("SKYDASH_API_URL", "http://localhost:8001").rstrip("/")
        normalized_path = path if path.startswith("/") else f"/{path}"
        url = f"{base_url}{normalized_path}"

        try:
            with urlopen(url, timeout=5) as response:
                body = response.read().decode("utf-8")
        except (OSError, URLError) as exc:
            return json.dumps(
                {
                    "available": False,
                    "url": url,
                    "error": str(exc),
                },
                sort_keys=True,
            )

        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"raw": body[:500]}

        return json.dumps(
            {
                "available": True,
                "url": url,
                "response": parsed,
            },
            sort_keys=True,
        )


class SkyDashCompanyReadinessInput(BaseModel):
    """Input schema for SkyDashCompanyReadinessTool."""

    include_git_status: bool = Field(
        default=True,
        description="Include a compact git status signal for company readiness reports.",
    )


class SkyDashCompanyReadinessTool(BaseTool):
    name: str = "skydash_company_readiness"
    description: str = (
        "Checks local SkyDash operating signals: backend health, frontend "
        "reachability, API docs, Docker Compose config, and optional git state."
    )
    args_schema: Type[BaseModel] = SkyDashCompanyReadinessInput

    def _run(self, include_git_status: bool = True) -> str:
        backend_url = os.getenv("SKYDASH_API_URL", "http://localhost:8001").rstrip("/")
        frontend_url = os.getenv("SKYDASH_FRONTEND_URL", "http://localhost").rstrip("/")
        checks = {
            "backend_health": _read_json_url(f"{backend_url}/health"),
            "backend_openapi_docs": _read_json_url(f"{backend_url}/docs"),
            "frontend_home": _read_json_url(frontend_url),
        }

        root = _repo_root()
        compose_file = root / "docker-compose.yml"
        result = {
            "repo_root": str(root),
            "checks": checks,
            "artifacts": {
                "docker_compose": compose_file.exists(),
                "root_readme": (root / "README.md").exists(),
                "current_status": (root / "docs" / "current-status.md").exists(),
                "brand_system": (root / "docs" / "skydash-brand-system.md").exists(),
                "operations_runbook": (root / "docs" / "skydash-operations-runbook.md").exists(),
            },
        }

        if include_git_status:
            try:
                status = subprocess.run(
                    ["git", "status", "--short"],
                    cwd=root,
                    text=True,
                    capture_output=True,
                    timeout=DEFAULT_TIMEOUT,
                    check=False,
                )
                result["git_status"] = {
                    "available": status.returncode == 0,
                    "changed_paths": [
                        line.strip() for line in status.stdout.splitlines()[:50]
                    ],
                    "error": status.stderr.strip(),
                }
            except (OSError, subprocess.TimeoutExpired) as exc:
                result["git_status"] = {
                    "available": False,
                    "error": str(exc),
                }

        return json.dumps(result, sort_keys=True)


class SkyDashProjectDocsInput(BaseModel):
    """Input schema for SkyDashProjectDocsTool."""

    paths: list[str] = Field(
        default_factory=lambda: list(DEFAULT_DOC_PATHS),
        description="Repo-relative markdown/docs paths to read.",
    )


class SkyDashProjectDocsTool(BaseTool):
    name: str = "skydash_project_docs"
    description: str = (
        "Reads SkyDash README, runbook, safety, architecture, brand, and CrewAI "
        "project docs so company plans are grounded in local source material."
    )
    args_schema: Type[BaseModel] = SkyDashProjectDocsInput

    def _run(self, paths: list[str] | None = None) -> str:
        root = _repo_root()
        requested_paths = paths or list(DEFAULT_DOC_PATHS)
        documents = []

        for rel_path in requested_paths:
            target = (root / rel_path).resolve()
            if not str(target).startswith(str(root)):
                documents.append(
                    {
                        "path": rel_path,
                        "available": False,
                        "error": "Path is outside the repository root.",
                    }
                )
                continue

            if not target.exists():
                documents.append({"path": rel_path, "available": False})
                continue

            content = target.read_text(encoding="utf-8", errors="replace")
            headings = re.findall(r"^#{1,3}\s+(.+)$", content, flags=re.MULTILINE)
            documents.append(
                {
                    "path": rel_path,
                    "available": True,
                    "bytes": len(content.encode("utf-8")),
                    "headings": headings[:20],
                    "excerpt": _excerpt(content),
                }
            )

        return json.dumps(
            {
                "repo_root": str(root),
                "documents": documents,
            },
            sort_keys=True,
        )


class CrewAIReferenceInput(BaseModel):
    """Input schema for CrewAIReferenceTool."""

    urls: list[str] = Field(
        default_factory=lambda: list(DEFAULT_REFERENCE_URLS),
        description="CrewAI docs, GitHub, README, and package registry URLs to fetch.",
    )


class CrewAIReferenceTool(BaseTool):
    name: str = "crewai_reference_sources"
    description: str = (
        "Fetches CrewAI docs, changelog, GitHub repository metadata, README, "
        "and PyPI package metadata for current implementation guidance."
    )
    args_schema: Type[BaseModel] = CrewAIReferenceInput

    def _run(self, urls: list[str] | None = None) -> str:
        if os.getenv("SKYDASH_CREW_FETCH_EXTERNAL", "1").lower() in {"0", "false", "no"}:
            return json.dumps(
                {
                    "external_fetch_enabled": False,
                    "sources": [],
                },
                sort_keys=True,
            )

        sources = [_read_json_url(url) for url in (urls or list(DEFAULT_REFERENCE_URLS))]
        return json.dumps(
            {
                "external_fetch_enabled": True,
                "sources": sources,
            },
            sort_keys=True,
        )
