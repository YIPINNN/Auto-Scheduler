import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import Schedule from './components/Schedule/Schedule';
import Ticket from './components/Ticket/Ticket';
import Technician from './components/Technician/Technician';
import Notification from './components/Notification/Notification';
import Performance from './components/Performance/Performance';
import supabase from './config/supabaseClient';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [technicians, setTechnicians] = useState([]);
  const [pendingTickets, setPendingTickets] = useState([]);
  
  // FIX 1: Add the missing state variable
  const [optimizationScore, setOptimizationScore] = useState(0);

  // FIX 2: Move calculation logic outside useEffect so it's a helper function
  const calculateFlow = (tickets) => {
    if (!tickets || tickets.length === 0) return 100;
    const pendingCount = tickets.filter(t => !t.attendStart).length;
    const totalCount = tickets.length;
    const flowScore = ((totalCount - pendingCount) / totalCount) * 100;
    return flowScore.toFixed(1);
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: techData } = await supabase.from('Technician').select('*').limit(5);
      
      // Fetching all tickets to calculate the flow score accurately
      const { data: ticketData } = await supabase.from('Ticket').select('*');

      if (techData) setTechnicians(techData);
      
      if (ticketData) {
        // Show only pending tickets in the sidebar list
        setPendingTickets(ticketData.filter(t => !t.attendStart).slice(0, 5));
        
        // FIX 3: Actually update the state with the calculated flow
        const score = calculateFlow(ticketData);
        setOptimizationScore(score);
      }
    };
    fetchData();
  }, []);

  const DashboardView = () => (
    <main className="dashboard-content">
      <header className="glass-header">
        <div className="header-text">
          <span className="system-badge">MO-SAHH Engine: Active</span>
          <h1>Optimized Task Allocation Dashboard</h1>
        </div>
        <button className="neon-btn reschedule">TRIGGER RESCHEDULING</button>
      </header>

      <section className="stats-row">
        <div className="stat-glass-card" style={{ '--accent': '#ff4d4d' }}>
          <span className="stat-icon">📥</span>
          <div>
            <p className="stat-val">{pendingTickets.length}</p>
            <p className="stat-label">Pending Tickets</p>
          </div>
        </div>
        <div className="stat-glass-card" style={{ '--accent': '#4ecca3' }}>
          <span className="stat-icon">⚡</span>
          <div>
            <p className="stat-val">{optimizationScore}%</p>
            <p className="stat-label">Optimization Flow</p>
          </div>
        </div>
      </section>

      <div className="grid-container">
        <section className="glass-card main-viz">
          <h3>Live Resource Load</h3>
          <div className="visual-timeline">
            {technicians.map(tech => (
              <div key={tech.employeeID} className="timeline-row">
                <div className="tech-profile">
                  <div className="avatar-mini">{tech.fullName ? tech.fullName[0] : 'T'}</div>
                  <p className="tech-name">{tech.fullName}</p>
                </div>
                <div className="track">
                  <div className="glow-bar" style={{ width: '60%', backgroundColor: '#4ecca3' }}></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card attendance-panel">
          <h3>Pending Status Tickets</h3>
          <div className="ticket-stack">
            {pendingTickets.map(ticket => (
              <div key={ticket.TicketID} className="ticket-item critical">
                <p><strong>{ticket.machineName}</strong></p>
                <span>ID: {ticket.TicketID}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );

  return (
    <div className="dashboard-layout">
      <Sidebar onNavigate={setCurrentPage} activePage={currentPage} />
      <div className="main-content-wrapper">
        {currentPage === 'Dashboard' && <DashboardView />}
        {currentPage === 'Schedule' && <Schedule />}
        {currentPage === 'Tickets' && <Ticket />}
        {currentPage === 'Technicians' && <Technician />}
        {currentPage === 'Notification' && <Notification />}
        {currentPage === 'Performance' && <Performance />}
      </div>
    </div>
  );
}

export default App;