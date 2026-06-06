import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import Schedule from './components/Schedule/Schedule';
import Ticket from './components/Ticket/Ticket';
import CreateTicket from './components/CreateTicket/CreateTicket';
import Technician from './components/Technician/Technician';
import TaskToDo from './components/TaskToDo/TaskToDo';
import Notification from './components/Notification/Notification';
import Performance from './components/Performance/Performance';
import Login from './components/Login/Login'; 
import Account from './components/Account/Account'; 
import supabase from './config/supabaseClient';
import './App.css';

function App() {
  // Initialize user session from local client cache storage to support persistent login states
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('mosahh_active_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [technicians, setTechnicians] = useState([]);
  const [allTickets, setAllTickets] = useState([]); 
  const [optimizationScore, setOptimizationScore] = useState(0);

  // --- CUSTOM EMPLOYEE ID AUTHENTICATION DISPATCHER ---
  const handleLoginByEmployeeID = async (employeeID, password) => {
    try {
      // Query Remote Table directly for ANY employee ID (Admin, Manager, or Employee)
      const { data, error } = await supabase
        .from('Technician')
        .select('*')
        .eq('employeeID', employeeID)
        .single();

      if (error || !data) {
        throw new Error("Invalid Credentials. Employee ID cannot be verified inside system registry.");
      }

      // Evaluate User Privilege Role mapping constraints via JobTitleID dynamically
      let assignedRole = 'Employee';
      
      if (data.jobTitleID === 5013 || data.jobTitle?.toLowerCase() === 'admin') {
        assignedRole = 'Administrator';
      } else if (data.jobTitleID === 5002 || data.jobTitle?.toLowerCase() === 'manager') {
        assignedRole = 'Manager';
      }

      const verifiedUser = {
        id: data.technicianStatusID,
        employeeID: data.employeeID,
        email: data.email,
        name: data.fullName,
        role: assignedRole
      };

      setUser(verifiedUser);
      localStorage.setItem('mosahh_active_user', JSON.stringify(verifiedUser));
      setCurrentPage('Dashboard');
      return { success: true };

    } catch (err) {
      console.error("Authentication Exception:", err.message);
      alert(err.message);
      return { success: false, error: err.message };
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('mosahh_active_user');
    setCurrentPage('Dashboard');
  };
  
  // --- REAL-TIME TELEMETRY POLLING REFRESH ---
  const fetchData = async () => {
    if (!user) return; 
    try {
      const { data: techData } = await supabase.from('Technician').select('*');
      
      // Limit data surface layer for base fields based on role privileges
      let query = supabase.from('Ticket').select('*');
      if (user.role === 'Employee') {
        query = query.in('status', ['pending', 'attending']);
      }
      const { data: ticketData } = await query;

      if (techData) setTechnicians(techData);
      if (ticketData) {
        setAllTickets(ticketData);
        const attendingCount = ticketData.filter(t => t.status === 'attending').length;
        const totalCount = ticketData.length;
        const score = totalCount > 0 ? ((attendingCount / totalCount) * 100).toFixed(1) : 100;
        setOptimizationScore(score);
      }
    } catch (error) {
      console.error("Telemetry Sync Interrupted Error:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [user]); 

  // --- FORCE ENTRY ACCESSIBILITY GUARD BLOCK ---
  if (!user) {
    return <Login onLoginWithID={handleLoginByEmployeeID} />;
  }

  const getTechLoad = (techId) => {
    const techTasks = allTickets.filter(t => 
        String(t.attendById) === String(techId) &&
        ['pending', 'attending'].includes(t.status)
    );
    return Math.min(techTasks.length * 20, 100);
  };

  const DashboardView = () => {
    const pendingList = allTickets.filter(t => t.status === 'pending');
    const availableTechs = technicians.filter(t => t.isAvailable ?? true);
    
    return (
      <main className="dashboard-content">
        <header className="glass-header">
          <div className="header-text">
            <span className="system-badge">{user.role} Privilege Matrix Node</span>
            <h1>{user.role === 'Employee' ? 'Field Operational Analytics' : 'Task Allocation Dashboard'}</h1>
          </div>
          {user.role !== 'Employee' && (
            <button className="neon-btn reschedule" onClick={() => setCurrentPage('Schedule')}>
              OPEN OPTIMIZER
            </button>
          )}
        </header>

        <section className="stats-row">
          <div className="stat-glass-card" style={{ '--accent': '#ff4d4d' }}>
            <span className="stat-icon">📥</span>
            <div>
              <p className="stat-val">{pendingList.length}</p>
              <p className="stat-label">Pending Queue</p>
            </div>
          </div>
          <div className="stat-glass-card" style={{ '--accent': '#4ecca3' }}>
            <span className="stat-icon">⚡</span>
            <div>
              <p className="stat-val">{optimizationScore}%</p>
              <p className="stat-label">System Flow</p>
            </div>
          </div>
          {user.role !== 'Employee' && (
            <div className="stat-glass-card" style={{ '--accent': '#3b82f6' }}>
              <span className="stat-icon">👥</span>
              <div>
                <p className="stat-val">{availableTechs.length}</p>
                <p className="stat-label">Available Resources (of {technicians.length})</p>
              </div>
            </div>
          )}
        </section>

        <div className="grid-container">
          <section className="glass-card main-viz" style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
            <h3>Live Resource Load Core Matrix</h3>
            <div className="visual-timeline" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', marginTop: '15px' }}>
              {[...technicians]
                .sort((a, b) => getTechLoad(b.employeeID) - getTechLoad(a.employeeID))
                .map(tech => {
                  const load = getTechLoad(tech.employeeID);
                  const isOffDuty = tech.isAvailable === false;

                  return (
                    <div key={tech.employeeID} className={`timeline-row ${isOffDuty ? 'off-duty-row' : ''}`}>
                      <div className="tech-profile">
                        <div className="avatar-mini" style={{ width: '40px', height: '40px', minWidth: '40px', flexShrink: 0, opacity: isOffDuty ? 0.4 : 1 }}>
                          {tech.fullName ? tech.fullName[0] : 'T'}
                        </div>
                        <div className="tech-meta">
                          <p className="tech-name" style={{ color: isOffDuty ? '#64748b' : '#f8fafc' }}>
                            {tech.fullName} {isOffDuty && "(Off-Duty)"}
                          </p>
                          <small>ID: {tech.employeeID} | Module Group: {tech.targetGroup || "General"}</small>
                        </div>
                      </div>
                      <div className="track">
                        <div 
                          className="glow-bar" 
                          style={{ 
                            width: `${load}%`, 
                            backgroundColor: isOffDuty ? '#334155' : (load >= 80 ? '#ff4d4d' : '#4ecca3'),
                            transition: 'width 0.5s ease-in-out',
                            opacity: isOffDuty ? 0.5 : 1
                          }}
                        >
                          {load > 0 ? `${load}%` : '0%'}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          <section className="glass-card attendance-panel" style={{ height: '500px' }}>
            <div className="panel-header">
                <h3>Live Incident Stack</h3>
                <span className="count-tag">{pendingList.length}</span>
            </div>
            <div className="ticket-stack" style={{ overflowY: 'auto', maxHeight: '400px', paddingRight: '5px' }}>
              {pendingList.length > 0 ? pendingList.map(ticket => (
                <div key={ticket.ticketID} className="ticket-item critical">
                  <div className="ticket-body">
                    <p><strong>{ticket.machineName || `Machine ${ticket.ticketID}`}</strong></p>
                    <span>ID: #{ticket.ticketID} | {ticket.targetGroup}</span>
                  </div>
                  <div className="priority-indicator"></div>
                </div>
              )) : (
                <div className="empty-state"><p>Queue Clear</p></div>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  };

  return (
    <div className="dashboard-layout">
      {/* Dynamic menu array controller parameter hooks */}
      <Sidebar onNavigate={setCurrentPage} activePage={currentPage} userRole={user.role} />
      <div className="main-content-wrapper">
        {currentPage === 'Dashboard' && <DashboardView />}
        {currentPage === 'Schedule' && user.role !== 'Employee' && <Schedule technicians={technicians} />}
        {currentPage === 'Tickets' && <Ticket user={user} />}
        {currentPage === 'Create Ticket' && <CreateTicket user={user} />}
        {currentPage === 'Task To Do' && user.role !== 'Administrator' && (<TaskToDo user={user} />)}
        {currentPage === 'Technicians' && user.role !== 'Employee' && <Technician />}
        {currentPage === 'Notification' && user.role !== 'Employee' && <Notification />}
        {currentPage === 'Performance' && user.role !== 'Employee' && <Performance />}
        {currentPage === 'Account' && <Account user={user} onLogout={handleLogout} />}
      </div>
    </div>
  );
}

export default App;