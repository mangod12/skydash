import { useState, useEffect } from 'react';
import { PanelBoundary } from '../common/ErrorBoundary';
import { useMissionStore } from '../../stores/missionStore';
import MissionList from './MissionList';
import MissionDetail from './MissionDetail';

export default function MissionView() {
  const { missions, activeMissionId, loading, fetchMissions, setActiveMission, fetchMissionDetail } = useMissionStore();
  const [tab, setTab] = useState('entities');

  useEffect(() => { fetchMissions(); }, [fetchMissions]);
  useEffect(() => { if (activeMissionId) fetchMissionDetail(activeMissionId); }, [activeMissionId, fetchMissionDetail]);

  const active = missions.find((m) => m.id === activeMissionId) || null;

  return (
    <PanelBoundary name="Missions">
    <div className="h-full flex">
      <MissionList missions={missions} activeId={activeMissionId} onSelect={setActiveMission} loading={loading} />
      <div className="flex-1 min-w-0 flex flex-col">
        {active ? (
          <MissionDetail mission={active} tab={tab} onTab={setTab} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm tracking-wider">
            SELECT OR CREATE A MISSION TO BEGIN INVESTIGATION
          </div>
        )}
      </div>
    </div>
    </PanelBoundary>
  );
}
