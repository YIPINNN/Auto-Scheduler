import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, Cell, AreaChart, Area 
} from 'recharts';
import { Activity, Clock, CheckCircle, Zap, Target, TrendingUp } from 'lucide-react';
import './Performance.css';

const Performance = () => {
  // Mock Data: MO-SAHH Algorithm Efficiency (Makespan reduction over time)
  const algorithmEfficiency = [
    { iteration: 'Iter 1', makespan: 120, baseline: 150 },
    { iteration: 'Iter 10', makespan: 110, baseline: 150 },
    { iteration: 'Iter 50', makespan: 85, baseline: 150 },
    { iteration: 'Iter 100', makespan: 45, baseline: 150 },
    { iteration: 'Iter 200', makespan: 42, baseline: 150 },
  ];

  // Mock Data: Workload Heatmap (Technician Utilization %)
  const workloadData = [
    { name: 'Aiman', load: 85 },
    { name: 'Haliza', load: 62 },
    { name: 'Logaraj', load: 92 },
    { name: 'Natasya', load: 45 },
    { name: 'Sujatha', load: 78 },
    { name: 'Azri', load: 55 },
  ];

  const kpis = [
    { label: "Makespan Reduction", val: "72%", icon: <Zap />, color: "#4ecca3" },
    { label: "Avg. Resolution", val: "14.2m", icon: <Clock />, color: "#3b82f6" },
    { label: "OEE Performance", val: "91.5%", icon: <Activity />, color: "#a855f7" },
    { label: "Success Rate", val: "98.2%", icon: <Target />, color: "#facc15" },
  ];

  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <h1>Technicians Performance</h1>
          <p>Multi-Objective Simulated Annealing Hyper-Heuristic (MO-SAHH) Analytics</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="performance-kpi-grid">
        {kpis.map((kpi, index) => (
          <div key={index} className="glass-card performance-card">
            <div className="perf-icon" style={{ color: kpi.color, backgroundColor: `${kpi.color}22` }}>
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
        {/* Workload Heatmap (Bar Chart) */}
        <div className="glass-card chart-wrapper">
          <div className="chart-header">
            <h3>Technician Workload Heatmap</h3>
            <span>Utilization % per Shift</span>
          </div>
          <div className="recharts-box">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workloadData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px' }}
                />
                <Bar dataKey="load" radius={[0, 10, 10, 0]} barSize={20}>
                  {workloadData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.load > 90 ? '#ff4d4d' : '#4ecca3'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Algorithm Performance (Area Chart) */}
        <div className="glass-card chart-wrapper">
          <div className="chart-header">
            <h3>Algorithm Convergence</h3>
            <span>Baseline vs. MO-SAHH Optimized Makespan</span>
          </div>
          <div className="recharts-box">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={algorithmEfficiency}>
                <defs>
                  <linearGradient id="colorMakespan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="iteration" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px' }} />
                <Legend verticalAlign="top" height={36}/>
                <Area type="monotone" dataKey="makespan" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorMakespan)" />
                <Line type="monotone" dataKey="baseline" stroke="#ff4d4d" strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Performance;