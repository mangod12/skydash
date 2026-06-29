from typing import List

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent

from skydash_intel_crew.tools.custom_tool import (
    CrewAIReferenceTool,
    SkyDashApiHealthTool,
    SkyDashCompanyReadinessTool,
    SkyDashProjectDocsTool,
)


@CrewBase
class SkydashIntelCrew():
    """SkydashIntelCrew crew"""

    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def source_researcher(self) -> Agent:
        return Agent(
            config=self.agents_config['source_researcher'],  # type: ignore[index]
            tools=[
                CrewAIReferenceTool(),
                SkyDashProjectDocsTool(),
            ],
            verbose=True,
        )

    @agent
    def mission_context_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config['mission_context_analyst'],  # type: ignore[index]
            tools=[
                SkyDashApiHealthTool(),
                SkyDashCompanyReadinessTool(),
                SkyDashProjectDocsTool(),
            ],
            verbose=True,
        )

    @agent
    def briefing_writer(self) -> Agent:
        return Agent(
            config=self.agents_config['briefing_writer'],  # type: ignore[index]
            verbose=True,
        )

    @task
    def source_intake_task(self) -> Task:
        return Task(
            config=self.tasks_config['source_intake_task'],  # type: ignore[index]
        )

    @task
    def mission_context_task(self) -> Task:
        return Task(
            config=self.tasks_config['mission_context_task'],  # type: ignore[index]
            context=[self.source_intake_task()],
        )

    @task
    def briefing_task(self) -> Task:
        return Task(
            config=self.tasks_config['briefing_task'],  # type: ignore[index]
            context=[self.source_intake_task(), self.mission_context_task()],
            output_file='reports/skydash_company_ops_plan.md',
        )

    @crew
    def crew(self) -> Crew:
        """Creates the SkydashIntelCrew crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
