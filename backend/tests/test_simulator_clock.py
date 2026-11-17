from unittest.mock import patch

import simulation


def test_wall_clock_corrections_do_not_move_simulated_flight_or_battery():
    with patch.object(simulation.time, 'monotonic', return_value=100.0), \
            patch.object(simulation.time, 'time', return_value=1000.0):
        drone = simulation.DroneSimulator('CLOCK')
    with patch.object(simulation.random, 'gauss', return_value=0), \
            patch.object(simulation.random, 'randint', return_value=10), \
            patch.object(simulation.random, 'uniform', return_value=5), \
            patch.object(simulation.time, 'monotonic', return_value=110.0):
        readings = []
        for wall_time in (1.0, 1010.0, 4000000000.0):
            with patch.object(simulation.time, 'time', return_value=wall_time):
                readings.append(drone.get_telemetry())
        assert readings[0] == readings[1] == readings[2]
        assert readings[0]['timestamp'] == 10.0
        assert 0 <= readings[0]['battery_percentage'] <= 100


def test_rtl_progress_uses_elapsed_clock_and_command_timestamp_stays_wall_time():
    with patch.object(simulation.time, 'monotonic', return_value=0.0), \
            patch.object(simulation.time, 'time', return_value=1000.0):
        drone = simulation.DroneSimulator('RTL-CLOCK')
        state = drone.apply_command('set_mode', {'mode': 'RTL'})
        assert state['last_command_at'] == 1000.0
    position = (drone.base_lat + 0.01, drone.base_lng + 0.01, 90.0)
    with patch.object(drone, '_pattern_position', return_value=position), \
            patch.object(simulation.time, 'monotonic', return_value=10.0):
        for wall_time in (-1000.0, 1010.0, 4000000000.0):
            with patch.object(simulation.time, 'time', return_value=wall_time):
                lat, lng, heading = drone._compute_position(10.0)
                assert abs(lat - (drone.base_lat + 0.005)) < 1e-9
                assert abs(lng - (drone.base_lng + 0.005)) < 1e-9
                assert heading == 90.0


def test_altitude_adjustment_uses_elapsed_clock():
    with patch.object(simulation.time, 'monotonic', return_value=100.0), \
            patch.object(simulation.time, 'time', return_value=1000.0):
        drone = simulation.DroneSimulator('ALT-CLOCK')
    with patch.object(drone, '_compute_altitude', return_value=50.0) as altitude, \
            patch.object(simulation.time, 'monotonic', return_value=125.0), \
            patch.object(simulation.time, 'time', return_value=-1000.0):
        state = drone.apply_command('adjust_altitude', {'delta': 5})
        altitude.assert_called_once_with(25.0)
        assert state['altitude_target'] == 55.0
        assert state['last_command_at'] == -1000.0


def test_parameter_commands_do_not_restart_rtl_progress():
    with patch.object(simulation.time, 'monotonic', return_value=0.0):
        drone = simulation.DroneSimulator('RTL-PARAMETERS')
        drone.apply_command('set_mode', {'mode': 'RTL'})
    position = (drone.base_lat + 0.01, drone.base_lng + 0.01, 90.0)
    with patch.object(drone, '_pattern_position', return_value=position), \
            patch.object(simulation.time, 'monotonic', return_value=20.0):
        assert drone._compute_position(20.0) == (drone.base_lat, drone.base_lng, 90.0)
        for command, params in (('adjust_yaw', {'delta': 10}), ('set_altitude', {'value': 50}),
                                ('set_speed', {'value': 5}), ('set_orbit_radius', {'value': 500})):
            drone.apply_command(command, params)
            assert drone._compute_position(20.0) == (drone.base_lat, drone.base_lng, 90.0)
        # Repeating the current mode must not send a homebound drone back out.
        drone.apply_command('set_mode', {'mode': 'RTL'})
        assert drone._compute_position(20.0) == (drone.base_lat, drone.base_lng, 90.0)
    # A later genuine switch into RTL starts a new return segment.
    with patch.object(drone, '_pattern_position', return_value=position), \
            patch.object(simulation.time, 'monotonic', return_value=30.0):
        drone.apply_command('set_mode', {'mode': 'ORBIT'})
        drone.apply_command('set_mode', {'mode': 'RTL'})
        assert drone._compute_position(30.0) == position


def test_repeated_hold_or_stop_does_not_move_stationary_drone():
    for first, repeat in (('hold', 'hold'), ('stop', 'stop'), ('stop', 'hold')):
        drone = simulation.DroneSimulator('HOLD-IDEMPOTENT')

        def command(kind):
            if kind == 'stop':
                return drone.apply_command('emergency_stop')
            return drone.apply_command('set_mode', {'mode': 'HOLD'})

        command(first)
        initial = drone._compute_position(10.0)
        command(repeat)
        assert drone._compute_position(20.0) == initial
        # A genuine move and later hold must capture a fresh position.
        drone.apply_command('set_mode', {'mode': 'ORBIT'})
        command('hold')
        assert drone._compute_position(30.0) != initial


def test_hold_and_stop_capture_command_time_position_before_mode_changes():
    for action in ('hold', 'stop'):
        for mode in ('ORBIT', 'RTL'):
            with patch.object(simulation.time, 'monotonic', return_value=0.0):
                drone = simulation.DroneSimulator('FREEZE-COMMAND')
                drone.apply_command('set_speed', {'value': 10})
                if mode == 'RTL':
                    drone.apply_command('set_mode', {'mode': mode})
            with patch.object(simulation.time, 'monotonic', return_value=10.0):
                expected = drone._compute_position(10.0)
                if action == 'hold':
                    drone.apply_command('set_mode', {'mode': 'HOLD'})
                else:
                    drone.apply_command('emergency_stop')
            # No telemetry was read between the command and this delayed sample.
            with patch.object(simulation.time, 'monotonic', return_value=20.0):
                assert drone._compute_position(20.0) == expected
