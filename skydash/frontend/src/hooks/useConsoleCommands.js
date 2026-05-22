import { useCallback, useMemo } from 'react';
import {
  COMMAND_NAMES,
  handleHelp, handleStatus, handleEntity, handleFly,
  handleAlert, handleExport, handleTheme, handleDrone,
  handleEntities, handleMissions, handleGoto,
} from './consoleHandlers';

export function useConsoleCommands() {
  const handlers = useMemo(() => ({
    help: handleHelp,
    status: handleStatus,
    entity: handleEntity,
    fly: handleFly,
    alert: handleAlert,
    export: handleExport,
    theme: handleTheme,
    clear: () => '__CLEAR__',
    drone: handleDrone,
    entities: handleEntities,
    missions: handleMissions,
    goto: handleGoto,
  }), []);

  const execute = useCallback((input) => {
    const trimmed = input.trim();
    if (!trimmed) return [];

    const spaceIdx = trimmed.indexOf(' ');
    const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);

    const handler = handlers[cmd];
    if (!handler) {
      return [`  Unknown command: "${cmd}". Type "help" for available commands.`];
    }

    return handler(args);
  }, [handlers]);

  const getSuggestions = useCallback((partial) => {
    const p = partial.toLowerCase().trim();
    if (!p) return COMMAND_NAMES;
    return COMMAND_NAMES.filter((name) => name.startsWith(p));
  }, []);

  return { execute, getSuggestions };
}
