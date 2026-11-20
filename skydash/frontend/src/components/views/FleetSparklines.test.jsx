// @vitest-environment jsdom
import { beforeEach,afterEach,expect,it } from 'vitest';
import { cleanup,render,screen,within } from '@testing-library/react';
import FleetSparklines from './FleetSparklines';
import WidgetRenderer from './DashboardWidgets';
import { useTelemetryStore } from '../../stores/telemetryStore';
beforeEach(()=>useTelemetryStore.setState({fleet:[],history:[],isConnected:false,data:null}));
afterEach(cleanup);
it('never generates placeholder aircraft or a fabricated trend when no fleet data arrived',()=>{render(<FleetSparklines/>);expect(screen.getByText(/No received fleet readings/)).toBeTruthy();expect(screen.getByText(/Disconnected/)).toBeTruthy();expect(screen.queryByText('AWAITING')).toBeNull();expect(document.querySelector('svg')).toBeNull();});
it('renders only each drone snapshot altitude and battery percentage, never the selected drone history or voltage',()=>{
 useTelemetryStore.setState({isConnected:true,fleet:[{drone_id:'A',altitude:10,battery_percentage:0,battery_voltage:16,timestamp:100},{drone_id:'B',altitude:-2,battery_percentage:82,battery_voltage:14,timestamp:200}],history:Array.from({length:20},()=>({altitude:999,battery:15}))});render(<FleetSparklines/>);const a=within(screen.getByLabelText('Fleet snapshot A')),b=within(screen.getByLabelText('Fleet snapshot B'));expect(a.getByText('Source altitude: 10.0m')).toBeTruthy();expect(a.getByText('Battery: 0.0%')).toBeTruthy();expect(b.getByText('Source altitude: -2.0m')).toBeTruthy();expect(b.getByText('Battery: 82.0%')).toBeTruthy();expect(document.body.textContent).not.toContain('999');expect(document.body.textContent).not.toContain('15.0%');expect(document.querySelector('svg')).toBeNull();
});
it('preserves unknown/malformed readings instead of filling zero/50percent and flags retained disconnected snapshots',()=>{
 useTelemetryStore.setState({fleet:[{drone_id:'unknown',altitude:null,battery_percentage:undefined,timestamp:null},{drone_id:'malformed',altitude:'12',battery_percentage:101,timestamp:'100'}]});render(<FleetSparklines/>);for(const id of ['unknown','malformed']){const row=within(screen.getByLabelText('Fleet snapshot '+id));expect(row.getByText('Source altitude: unknown')).toBeTruthy();expect(row.getByText('Battery: unknown')).toBeTruthy();expect(row.getByText(/time basis\): unknown/)).toBeTruthy();}expect(screen.getByText(/Retained snapshot is not current telemetry/)).toBeTruthy();
});
it('clears the view when the authoritative fleet becomes empty and does not keep a removed aircraft',()=>{
 useTelemetryStore.getState().updateFleet([{drone_id:'removed',altitude:12,battery_percentage:88}]);const view=render(<FleetSparklines/>);expect(screen.getByLabelText('Fleet snapshot removed')).toBeTruthy();useTelemetryStore.getState().updateFleet([]);view.rerender(<FleetSparklines/>);expect(screen.queryByLabelText('Fleet snapshot removed')).toBeNull();expect(screen.getByText(/No received fleet readings/)).toBeTruthy();
});
it('dashboard sparkline widget shares honest snapshot view and explicitly limits first3entries rather than generating trends',()=>{
 useTelemetryStore.setState({isConnected:true,fleet:Array.from({length:4},(_,i)=>({drone_id:'d'+i,altitude:i,battery_percentage:90-i,timestamp:i}))});render(<WidgetRenderer type="sparkline"/>);expect(screen.getByText('Showing first 3 of 4 snapshot entries.')).toBeTruthy();expect(screen.getByLabelText('Fleet snapshot d2')).toBeTruthy();expect(screen.queryByLabelText('Fleet snapshot d3')).toBeNull();expect(screen.getByText(/not history or a recorded-flight review/)).toBeTruthy();expect(document.querySelector('svg')).toBeNull();
});
