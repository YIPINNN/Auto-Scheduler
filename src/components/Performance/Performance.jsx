import React, { useState, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend
} from 'recharts';

import {
  Activity,
  Clock,
  Target,
  History,
  Timer,
  Users,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

import supabase from '../../config/supabaseClient';
import './Performance.css';

const Performance = () => {
  const [runHistory, setRunHistory] = useState([]);
  const [workloadHeatmap, setWorkloadHeatmap] = useState([]);
  const [ticketStats, setTicketStats] = useState({
    totalActive: 0,
    assigned: 0,
    unassigned: 0,
    assignedRate: 0
  });

  const [loading, setLoading] = useState(true);

  const shortenName = (name, maxLength = 18) => {
    if (!name) return 'Unknown';
    return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
  };

  const normalizeStatus = (status) => {
    const value = String(status || '').toLowerCase();

    if (value === 'pending') return 'Pending';
    if (value === 'attending') return 'Attending';
    if (value === 'completed' || value === 'complete') return 'Completed';

    return null;
  };
  const fetchPerformanceData = async () => {
    setLoading(true);

    try {
      // 1. Fetch optimization result history
      const { data: runs, error: runsError } = await supabase
        .from('Optimization_Results')
        .select(`
          scenarioName,
          computationTime,
          algorithmElapsedTime,
          workloadVariance,
          makespan,
          created_at
        `)
        .order('created_at', { ascending: true })
        .limit(10);

      if (runsError) {
        console.error('Error fetching Optimization_Results:', runsError);
      }

      // 2. Fetch current active tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from('Ticket')
        .select(`
          ticketID,
          status,
          attendById,
          attendByName,
          estimatedDuration
        `)
        .in('status', [
          'pending',
          'attending',
          'completed',
          'complete',
          'Pending',
          'Attending',
          'Completed',
          'Complete'
        ]);
      if (ticketsError) {
        console.error('Error fetching Ticket:', ticketsError);
      }

      // 3. Format optimization run history
      const formattedRuns = (runs || []).map((run, index) => ({
        runLabel: run.scenarioName || `Run ${index + 1}`,
        scenarioName: run.scenarioName || `Run ${index + 1}`,
        computationTime: Number(run.computationTime || 0),
        algorithmElapsedTime: Number(run.algorithmElapsedTime || 0),
        workloadVariance: Number(run.workloadVariance || 0),
        makespan: Number(run.makespan || 0),
        created_at: run.created_at
      }));

      setRunHistory(formattedRuns);

      // 4. Build real heatmap: Technician × Status
      const heatmapMap = {};

      let totalActive = 0;
      let assigned = 0;
      let unassigned = 0;

      (tickets || []).forEach((ticket) => {
        totalActive += 1;

        const hasTechnician = ticket.attendById && ticket.attendByName;
        if (!hasTechnician) return;
        const techName = ticket.attendByName;
        const status = hasTechnician ? normalizeStatus(ticket.status) : 'Unassigned';
        const duration = Number(ticket.estimatedDuration || 0);

        if (hasTechnician) {
          assigned += 1;
        } else {
          unassigned += 1;
        }

        if (!heatmapMap[techName]) {
          heatmapMap[techName] = {
            name: techName,
            displayName: shortenName(techName, 18),
            Pending: 0,
            Attending: 0,
            Completed: 0,
            totalMinutes: 0,
            ticketCount: 0
          };
        }

        heatmapMap[techName][status] += duration;
        heatmapMap[techName].totalMinutes += duration;
        heatmapMap[techName].ticketCount += 1;
      });

      const heatmapArray = Object.values(heatmapMap).sort(
        (a, b) => b.totalMinutes - a.totalMinutes
      );

      setWorkloadHeatmap(heatmapArray);

      const assignedRate =
        totalActive > 0 ? ((assigned / totalActive) * 100).toFixed(1) : 0;

      setTicketStats({
        totalActive,
        assigned,
        unassigned,
        assignedRate
      });
    } catch (error) {
      console.error('Performance data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const average = (data, key) => {
    if (!data || data.length === 0) return '0.000';

    const validValues = data
      .map((item) => Number(item[key] || 0))
      .filter((value) => value > 0);

    if (validValues.length === 0) return '0.000';

    const avg =
      validValues.reduce((acc, curr) => acc + curr, 0) / validValues.length;

    return avg.toFixed(3);
  };

  const latestRun =
    runHistory.length > 0 ? runHistory[runHistory.length - 1] : null;

  const avgBackendTime = average(runHistory, 'computationTime');
  const avgAlgorithmTime = average(runHistory, 'algorithmElapsedTime');

  const latestMakespan = latestRun ? latestRun.makespan : 0;
  const latestWorkloadVariance = latestRun ? latestRun.workloadVariance : 0;

  const getHeatmapCellColor = (value) => {
    if (value >= 120) return '#ef4444';
    if (value >= 60) return '#facc15';
    if (value > 0) return '#4ecca3';
    return 'rgba(148, 163, 184, 0.08)';
  };

  const kpis = [
    {
      label: 'Avg Backend Time',
      val: `${avgBackendTime}s`,
      icon: <History />,
      color: '#4ecca3'
    },
    {
      label: 'Avg Algorithm Time',
      val: `${avgAlgorithmTime}s`,
      icon: <Timer />,
      color: '#3b82f6'
    },
    {
      label: 'Latest Makespan',
      val: `${latestMakespan || 0}`,
      icon: <Clock />,
      color: '#a855f7'
    },
    {
      label: 'Active Tickets',
      val: `${ticketStats.totalActive}`,
      icon: <Activity />,
      color: '#38bdf8'
    },
    {
      label: 'Latest Workload Variance',
      val: `${latestWorkloadVariance || 0}`,
      icon: <Target />,
      color: '#fb7185'
    }
  ];

  if (loading) {
    return (
      <main className="dashboard-content">
        <header className="glass-header">
          <div className="header-text">
            <h1>System Intelligence & Performance</h1>
            <p>Loading real-time performance analytics...</p>
          </div>
        </header>

        <div className="glass-card loading-card">
          <p>Loading performance data...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>System Intelligence & Performance</h1>
          <p>
            Real-time MO-SAHH analytics based on optimization history and active ticket workload
          </p>
        </div>

        <button className="refresh-btn" onClick={fetchPerformanceData}>
          Refresh
        </button>
      </header>

      {/* KPI Cards */}
      <div className="performance-kpi-grid">
        {kpis.map((kpi, index) => (
          <div key={index} className="glass-card performance-card">
            <div
              className="perf-icon"
              style={{
                color: kpi.color,
                backgroundColor: `${kpi.color}22`
              }}
            >
              {kpi.icon}
            </div>

            <div className="perf-details">
              <span className="perf-label">{kpi.label}</span>
              <h2 className="perf-val">{kpi.val}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        {/* Backend Execution Time */}
        <div className="glass-card chart-wrapper full-width">
          <div className="chart-header">
            <h3>Backend Execution Time per Scenario</h3>
            <span>
              Includes FastAPI processing, MATLAB startup, script execution, file handling and result parsing
            </span>
          </div>

          <div className="recharts-box">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={runHistory}>
                <defs>
                  <linearGradient
                    id="colorBackendTime"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#4ecca3" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4ecca3" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />

                <XAxis
                  dataKey="scenarioName"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                />

                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  unit="s"
                  tickLine={false}
                />

                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '10px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />

                <Area
                  type="monotone"
                  dataKey="computationTime"
                  name="Backend Execution Time"
                  stroke="#4ecca3"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorBackendTime)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Algorithm Elapsed Time */}
        <div className="glass-card chart-wrapper half-chart">
          <div className="chart-header">
            <h3>Algorithm Elapsed Time</h3>
            <span>
              MATLAB tic-toc execution time for the optimization algorithm
            </span>
          </div>

          <div className="recharts-box">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={runHistory}>
                <defs>
                  <linearGradient
                    id="colorAlgorithmTime"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />

                <XAxis
                  dataKey="scenarioName"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                />

                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  unit="s"
                  tickLine={false}
                />

                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '10px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />

                <Area
                  type="monotone"
                  dataKey="algorithmElapsedTime"
                  name="Algorithm Elapsed Time"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAlgorithmTime)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real Heatmap */}
        <div className="glass-card chart-wrapper half-chart heatmap-wrapper">
          <div className="chart-header">
            <h3>Technician Workload Heatmap by Status</h3>
            <span>
              Workload intensity by technician and ticket status, calculated from estimated duration
            </span>
          </div>

          <div className="real-heatmap-scroll">
            <div className="real-heatmap-table">
              <div className="heatmap-header-row">
                <div className="heatmap-name-cell">Technician</div>
                <div className="heatmap-status-cell">Pending</div>
                <div className="heatmap-status-cell">Attending</div>
                <div className="heatmap-status-cell">Completed</div>
              </div>

              {workloadHeatmap.length === 0 ? (
                <div className="heatmap-empty">
                  No active ticket workload found.
                </div>
              ) : (
                workloadHeatmap.map((row, index) => (
                  <div className="heatmap-row" key={index}>
                    <div className="heatmap-name-cell" title={row.name}>
                      {row.displayName}
                    </div>

                    {['Pending', 'Attending', 'Completed'].map((status) => (
                      <div
                        key={status}
                        className="heatmap-value-cell"
                        style={{
                          backgroundColor: getHeatmapCellColor(row[status])
                        }}
                        title={`${row.name} | ${status}: ${row[status]} minutes`}
                      >
                        {row[status] > 0 ? row[status] : '-'}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="heatmap-legend">
            <span>
              <i className="legend-box low"></i> Low
            </span>
            <span>
              <i className="legend-box medium"></i> Medium
            </span>
            <span>
              <i className="legend-box high"></i> High
            </span>
          </div>
        </div>

        {/* Workload Variance vs Makespan */}
        <div className="glass-card chart-wrapper full-width">
          <div className="chart-header">
            <h3>Workload Variance and Makespan per Run</h3>
            <span>
              Multi-objective result trend: lower workload variance and lower makespan are preferred
            </span>
          </div>

          <div className="recharts-box">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={runHistory}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />

                <XAxis
                  dataKey="scenarioName"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                />

                <YAxis
                  yAxisId="left"
                  stroke="#4ecca3"
                  fontSize={10}
                  tickLine={false}
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#a855f7"
                  fontSize={10}
                  tickLine={false}
                />

                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '10px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />

                <Legend verticalAlign="top" height={36} />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="workloadVariance"
                  name="Workload Variance"
                  stroke="#4ecca3"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="makespan"
                  name="Makespan"
                  stroke="#a855f7"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ticket Assignment Summary */}
        <div className="glass-card chart-wrapper full-width">
          <div className="chart-header">
            <h3>Current Ticket Assignment Summary</h3>
            <span>Real-time overview of active ticket assignment status</span>
          </div>

          <div className="ticket-summary-grid">
            <div className="ticket-summary-item">
              <Users size={24} />
              <span>Total Active Tickets</span>
              <strong>{ticketStats.totalActive}</strong>
            </div>

            <div className="ticket-summary-item">
              <CheckCircle size={24} />
              <span>Assigned Tickets</span>
              <strong>{ticketStats.assigned}</strong>
            </div>

            <div className="ticket-summary-item warning">
              <AlertTriangle size={24} />
              <span>Unassigned Tickets</span>
              <strong>{ticketStats.unassigned}</strong>
            </div>

            <div className="ticket-summary-item">
              <Target size={24} />
              <span>Assigned Rate</span>
              <strong>{ticketStats.assignedRate}%</strong>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Performance;