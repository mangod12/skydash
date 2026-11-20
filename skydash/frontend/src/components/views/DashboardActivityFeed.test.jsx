// @vitest-environment jsdom
import {afterEach,expect,it,vi}from'vitest';
import{cleanup,render,screen,fireEvent}from'@testing-library/react';
import DashboardActivityFeed from './DashboardActivityFeed';
import{useActivityStore,logActivity}from'../../stores/activityStore';
vi.mock('../common/GlassCard',()=>({default:({children})=><div>{children}</div>}));
vi.mock('../common/ActivityItem',()=>({default:({activity})=><div>{activity.action}</div>}));
afterEach(()=>{cleanup();useActivityStore.setState({activities:[],filter:'all'});});
it('labels the empty local scope, never fabricated incidents or claims of safety',()=>{render(<DashboardActivityFeed/>);expect(screen.getByRole('region',{name:'Session activity records'})).toBeTruthy();expect(screen.getByText('No session activity records')).toBeTruthy();expect(screen.getByText(/Not a server audit log/)).toBeTruthy();expect(screen.getByText(/Missing entries do not prove/)).toBeTruthy();for(const madeup of ['Geofence breach','Battery critical','User login','RF interference'])expect(screen.queryByText(madeup)).toBeNull();});
it('renders only explicitly added records and distinguishes an empty filter from no incident evidence',()=>{logActivity('system','Explicit local addition','');render(<DashboardActivityFeed/>);expect(screen.getByText('Explicit local addition')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'ALERT',exact:true}));expect(screen.getByText('No matching session records')).toBeTruthy();expect(screen.queryByText('Explicit local addition')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'ALL',exact:true}));expect(screen.getByText('Explicit local addition')).toBeTruthy();expect(useActivityStore.getState().activities).toHaveLength(1);});
