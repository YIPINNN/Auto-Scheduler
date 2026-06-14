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
  Legend,
  BarChart,
  Bar,
  ScatterChart,
  Scatter
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
  const [mogaHistory, setMogaHistory] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [workloadHeatmap, setWorkloadHeatmap] = useState([]);
  const [ticketStats, setTicketStats] = useState({
    totalActive: 0,
    assigned: 0,
    unassigned: 0,
    assignedRate: 0
  });

  const [loading, setLoading] = useState(true);

  // Heatmap historical filter
  const [heatmapMode, setHeatmapMode] = useState('realtime');
  const [heatmapDate, setHeatmapDate] = useState('');
  const [heatmapMonth, setHeatmapMonth] = useState('');
  const [heatmapRangeStart, setHeatmapRangeStart] = useState('');
  const [heatmapRangeEnd, setHeatmapRangeEnd] = useState('');
  const [heatmapHistory, setHeatmapHistory] = useState([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const isFetchingRef = React.useRef(false);

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

  const getMalaysiaTodayUtcRange = () => {
    const now = new Date();

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now);

    const year = Number(parts.find(p => p.type === 'year').value);
    const month = Number(parts.find(p => p.type === 'month').value);
    const day = Number(parts.find(p => p.type === 'day').value);

    const startUtc = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
    const endUtc = new Date(Date.UTC(year, month - 1, day, 15, 59, 59, 999));

    return {
      todayStartMYUtc: startUtc.toISOString(),
      todayEndMYUtc: endUtc.toISOString()
    };
  };
    
  const buildHeatmapRows = (tickets) => {
    const map = {};
    (tickets || []).forEach((ticket) => {
      const hasTech = ticket.attendById && ticket.attendByName;
      if (!hasTech) return;
      const techName = ticket.attendByName;
      const status = normalizeStatus(ticket.status);
      if (!status) return;
      const duration = Number(ticket.estimatedDuration || 0);
      if (!map[techName]) {
        map[techName] = {
          name: techName,
          displayName: shortenName(techName, 18),
          Pending: 0, Attending: 0, Completed: 0,
          CompletedCount: 0,
          totalMinutes: 0, ticketCount: 0
        };
      }
      map[techName][status] += duration;
      map[techName].totalMinutes += duration;
      map[techName].ticketCount += 1;
      if (status === 'Completed') map[techName].CompletedCount += 1;
    });
    return Object.values(map).sort((a, b) => b.totalMinutes - a.totalMinutes);
  };

  const fetchHeatmapHistory = async () => {
    setHeatmapLoading(true);
    try {
      let query = supabase
        .from('Ticket')
        .select('ticketID, status, attendById, attendByName, estimatedDuration, ticketEnd')
        .in('status', ['pending','attending','completed','complete','Pending','Attending','Completed','Complete']);

      if (heatmapMode === 'day' && heatmapDate) {
        query = query
          .gte('ticketStart', `${heatmapDate}T00:00:00.000Z`)
          .lte('ticketStart', `${heatmapDate}T23:59:59.999Z`);
      } else if (heatmapMode === 'month' && heatmapMonth) {
        const [yr, mo] = heatmapMonth.split('-').map(Number);
        const lastDay = new Date(yr, mo, 0).getDate();
        query = query
          .gte('ticketStart', `${heatmapMonth}-01T00:00:00.000Z`)
          .lte('ticketStart', `${heatmapMonth}-${String(lastDay).padStart(2,'0')}T23:59:59.999Z`);
      } else if (heatmapMode === 'range' && heatmapRangeStart && heatmapRangeEnd) {
        query = query
          .gte('ticketStart', `${heatmapRangeStart}T00:00:00.000Z`)
          .lte('ticketStart', `${heatmapRangeEnd}T23:59:59.999Z`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHeatmapHistory(buildHeatmapRows(data || []));
    } catch (err) {
      console.error('Heatmap history fetch error:', err);
      setHeatmapHistory([]);
    } finally {
      setHeatmapLoading(false);
    }
  };

  const fetchPerformanceData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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

      // 2. Fetch MOGA history from backend
            // 2. Fetch MOGA history from backend
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const mogaRes = await fetch('http://localhost:8000/moga-history', {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!mogaRes.ok) {
          throw new Error(`MOGA history HTTP error: ${mogaRes.status}`);
        }

        const mogaJson = await mogaRes.json();
        const rawMoga = Array.isArray(mogaJson.data) ? mogaJson.data : [];

        const formattedMoga = rawMoga.map((r, i) => ({
          runLabel: `Run ${i + 1}`,
          workloadVariance: Number(r.workloadVariance || 0),
          makespan: Number(r.makespan || 0),
          algorithmElapsedTime: Number(r.algorithmElapsedTime || 0),
        }));

        // Only update when backend returns valid data.
        // If current MOGA run is interrupted, keep the previous chart data.
        if (formattedMoga.length > 0) {
          setMogaHistory(formattedMoga);
        } else {
          console.warn('MOGA history returned empty. Keeping previous MOGA chart data.');
        }

      } catch (mogaErr) {
        console.error('MOGA history fetch error:', mogaErr);

        // Important:
        // Do NOT clear mogaHistory here.
        // Keep previous MOGA data visible if current MOGA fetch fails/interrupted.
      }

      const today = new Date().toISOString().split('T')[0];

      const liveStart = `${today}T00:00:00.000Z`;
      const liveEnd = `${today}T23:59:59.999Z`;

      console.log('Live today:', today);
      console.log('Live start:', liveStart);
      console.log('Live end:', liveEnd);
            // 2. Fetch current active tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from('Ticket')
        .select(`
          ticketID,
          status,
          attendById,
          attendByName,
          estimatedDuration,
          ticketStart
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
        ])
          .gte('ticketStart', liveStart)
          .lte('ticketStart', liveEnd);
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

    
      // 4. Build real heatmap
      let totalActive = 0;
      let assigned = 0;
      let unassigned = 0;

      (tickets || []).forEach((ticket) => {
        totalActive += 1;
        const hasTechnician = ticket.attendById && ticket.attendByName;
        if (hasTechnician) { assigned += 1; } else { unassigned += 1; }
      });

      setWorkloadHeatmap(buildHeatmapRows(tickets || []));

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
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  useEffect(() => {
    const maxLen = Math.max(runHistory.length, mogaHistory.length);
    const comp = Array.from({ length: maxLen }, (_, i) => ({
      label:        `Run ${i + 1}`,
      sahh_elapsed: runHistory[i]?.algorithmElapsedTime ?? null,
      moga_elapsed: mogaHistory[i]?.algorithmElapsedTime ?? null,
      sahh_variance: runHistory[i]?.workloadVariance ?? null,
      moga_variance: mogaHistory[i]?.workloadVariance ?? null,
      sahh_makespan: runHistory[i]?.makespan ?? null,
      moga_makespan: mogaHistory[i]?.makespan ?? null,
    }));
    setComparisonData(comp);
  }, [runHistory, mogaHistory]);

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

        {/* Workload Heatmap — with historical filter */}
        <div className="glass-card chart-wrapper half-chart heatmap-wrapper">
          <div className="chart-header heatmap-chart-header">
            <div>
              <h3>Technician Workload Heatmap</h3>
              <span>
                {heatmapMode === 'realtime'
                  ? 'Live view — active ticket workload by status and estimated duration'
                  : 'Historical view — filtered by selected time window'}
              </span>
            </div>
            <div className="heatmap-mode-pills">
              {[
                { key: 'realtime', label: 'Live' },
                { key: 'day',      label: 'Day' },
                { key: 'month',    label: 'Month' },
                { key: 'range',    label: 'Range' },
              ].map(m => (
                <button
                  key={m.key}
                  className={`heatmap-pill ${heatmapMode === m.key ? 'active' : ''}`}
                  onClick={() => setHeatmapMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {heatmapMode !== 'realtime' && (
            <div className="heatmap-filter-row">
              {heatmapMode === 'day' && (
                <input
                  type="date"
                  className="heatmap-date-input"
                  value={heatmapDate}
                  onChange={e => setHeatmapDate(e.target.value)}
                />
              )}
              {heatmapMode === 'month' && (
                <input
                  type="month"
                  className="heatmap-date-input"
                  value={heatmapMonth}
                  onChange={e => setHeatmapMonth(e.target.value)}
                />
              )}
              {heatmapMode === 'range' && (
                <>
                  <input
                    type="date"
                    className="heatmap-date-input"
                    value={heatmapRangeStart}
                    onChange={e => setHeatmapRangeStart(e.target.value)}
                  />
                  <span className="heatmap-range-sep">→</span>
                  <input
                    type="date"
                    className="heatmap-date-input"
                    value={heatmapRangeEnd}
                    onChange={e => setHeatmapRangeEnd(e.target.value)}
                  />
                </>
              )}
              <button
                className="heatmap-apply-btn"
                onClick={fetchHeatmapHistory}
                disabled={heatmapLoading}
              >
                {heatmapLoading ? 'Loading...' : 'Apply'}
              </button>
            </div>
          )}

          {heatmapMode === 'realtime' ? (
            <div className="real-heatmap-scroll">
              <div className="real-heatmap-table">
                <div className="heatmap-header-row">
                  <div className="heatmap-name-cell">Technician</div>
                  <div className="heatmap-status-cell">Pending</div>
                  <div className="heatmap-status-cell">Attending</div>
                  <div className="heatmap-status-cell">Completed</div>
                </div>
                {workloadHeatmap.length === 0 ? (
                  <div className="heatmap-empty">No ticket activity today.</div>
                ) : (
                  workloadHeatmap.map((row, index) => (
                    <div className="heatmap-row" key={index}>
                      <div className="heatmap-name-cell" title={row.name}>{row.displayName}</div>
                      {['Pending', 'Attending', 'Completed'].map((status) => (
                        <div
                          key={status}
                          className="heatmap-value-cell"
                          style={{ backgroundColor: getHeatmapCellColor(row[status]) }}
                          title={`${row.name} | ${status}: ${row[status]} min`}
                        >
                          {row[status] > 0 ? row[status] : '-'}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="real-heatmap-scroll">
              <div className="real-heatmap-table">
                <div className="heatmap-header-row history-header-row">
                  <div className="heatmap-name-cell">Technician</div>
                  <div className="heatmap-status-cell">Completed</div>
                  <div className="heatmap-status-cell">Total Duration</div>
                </div>
                {heatmapLoading ? (
                  <div className="heatmap-empty heatmap-fetching">Fetching historical data...</div>
                ) : heatmapHistory.length === 0 ? (
                  <div className="heatmap-empty">No data found for the selected period.</div>
                ) : (
                  heatmapHistory.map((row, index) => (
                    <div className="heatmap-row history-row" key={index}>
                      <div className="heatmap-name-cell" title={row.name}>{row.displayName}</div>
                      <div className="heatmap-value-cell history-count-cell">
                        {row.CompletedCount > 0 ? row.CompletedCount : '-'}
                      </div>
                      <div
                        className="heatmap-value-cell"
                        style={{ backgroundColor: getHeatmapCellColor(row.totalMinutes) }}
                        title={`${row.name} | Total: ${row.totalMinutes} min`}
                      >
                        {row.totalMinutes > 0 ? `${row.totalMinutes} min` : '-'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="heatmap-legend">
            {heatmapMode === 'realtime' ? (
              <>
                <span><i className="legend-box low"></i> Low (&lt;60 min)</span>
                <span><i className="legend-box medium"></i> Medium (60–119 min)</span>
                <span><i className="legend-box high"></i> High (≥120 min)</span>
              </>
            ) : (
              <>
                <span><i className="legend-box low"></i> Low (&lt;60 min total)</span>
                <span><i className="legend-box medium"></i> Medium (60–119 min total)</span>
                <span><i className="legend-box high"></i> High (≥120 min total)</span>
                <span className="heatmap-legend-note">Colour based on total duration</span>
              </>
            )}
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

        {/* Algorithm Elapsed Time Comparison — MO-SAHH vs MOGA */}
        <div className="glass-card chart-wrapper full-width">
          <div className="chart-header">
            <h3>Algorithm Elapsed Time — MO-SAHH vs MOGA</h3>
            <span>
              Direct comparison of MATLAB tic-toc execution time per run. Lower is faster.
            </span>
          </div>
          <div className="recharts-box">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} unit="s" tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', color: '#fff' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="sahh_elapsed" name="MO-SAHH" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="moga_elapsed" name="MOGA (NSGA-II)" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workload Variance vs Makespan — MO-SAHH vs MOGA */}
        <div className="glass-card chart-wrapper full-width">
          <div className="chart-header">
            <h3>Workload Variance vs Makespan — MO-SAHH vs MOGA</h3>
            <span>
              X-axis: workload variance — Y-axis: makespan. Bottom-left corner is best. Each point is one run. Same run number connects MO-SAHH and MOGA.
            </span>
          </div>
          <div className="recharts-box">
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  type="number"
                  dataKey="workloadVariance"
                  name="Workload Variance"
                  domain={['auto', 'auto']}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  label={{ value: 'Workload Variance', position: 'insideBottom', offset: -15, fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="makespan"
                  name="Makespan"
                  domain={['auto', 'auto']}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  label={{ value: 'Makespan', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', color: '#fff' }}
                  formatter={(value, name, props) => {
                    const run = props?.payload?.runLabel || '';
                    return [`${Number(value).toFixed(4)}  (${run})`, name];
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Scatter
                  name="MO-SAHH"
                  data={runHistory.map((r, i) => ({
                    workloadVariance: r.workloadVariance,
                    makespan: r.makespan,
                    runLabel: `Run ${i + 1}`
                  }))}
                  fill="#3b82f6"
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r={7} fill="#3b82f6" />
                        <text x={cx} y={cy - 12} textAnchor="middle" fill="#3b82f6" fontSize={10}>
                          {payload.runLabel}
                        </text>
                      </g>
                    );
                  }}
                />
                <Scatter
                  name="MOGA (NSGA-II)"
                  data={mogaHistory.map((r, i) => ({
                    workloadVariance: r.workloadVariance,
                    makespan: r.makespan,
                    runLabel: `Run ${i + 1}`
                  }))}
                  fill="#f97316"
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <g>
                        <rect x={cx - 6} y={cy - 6} width={12} height={12} fill="#f97316" />
                        <text x={cx} y={cy - 12} textAnchor="middle" fill="#f97316" fontSize={10}>
                          {payload.runLabel}
                        </text>
                      </g>
                    );
                  }}
                />
              </ScatterChart>
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