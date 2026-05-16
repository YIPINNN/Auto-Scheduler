import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  Users, 
  Ticket as TicketIcon, 
  PlusSquare, 
  CheckSquare, 
  BarChart3, 
  Send,
  UserCircle 
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ onNavigate, activePage, userRole }) => {
  
  // Master manifest containing configuration keys for all items
  const masterMenu = {
    Dashboard: { name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    Schedule: { name: 'Schedule', icon: <CalendarRange size={20} /> },
    Technicians: { name: 'Technicians', icon: <Users size={20} /> },
    Tickets: { name: 'Tickets', icon: <TicketIcon size={20} /> },
    CreateTicket: { name: 'Create Ticket', icon: <PlusSquare size={20} /> }, 
    TaskToDo: { name: 'Task To Do', icon: <CheckSquare size={20} /> }, 
    Notification: { name: 'Notification', icon: <Send size={20} /> },
    Performance: { name: 'Performance', icon: <BarChart3 size={20} /> },
    Account: { name: 'Account', icon: <UserCircle size={20} /> }
  };

  // Generate individual routing matrices matching your specifications exactly
  let menuItems = [];

  if (userRole === 'Administrator') {
    menuItems = [
      masterMenu.Dashboard,
      masterMenu.Schedule,
      masterMenu.Technicians,
      masterMenu.Tickets,
      masterMenu.CreateTicket,
      masterMenu.Notification,
      masterMenu.Performance,
      masterMenu.Account
    ];
  } else if (userRole === 'Manager') {
    menuItems = [
      masterMenu.Dashboard,
      masterMenu.Schedule,
      masterMenu.Technicians,
      masterMenu.Tickets,
      masterMenu.CreateTicket,
      masterMenu.TaskToDo,
      masterMenu.Notification,
      masterMenu.Performance,
      masterMenu.Account
    ];
  } else {
    // Default Role Fallback: Employee Perspective Route Array
    menuItems = [
      masterMenu.Dashboard,
      masterMenu.Tickets,
      masterMenu.CreateTicket,
      masterMenu.TaskToDo,
      masterMenu.Account
    ];
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">AS</div>
        <div className="logo-meta" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>AUTO-SCHEDULER</h2>
          <small style={{ color: '#4ecca3', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' }}>{userRole} Node</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.name}
            type="button" 
            className={`nav-item ${activePage === item.name ? 'active' : ''}`}
            onClick={() => onNavigate(item.name)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">
              {item.name === 'Account' ? 'Account Detail' : item.name}
            </span>
            {activePage === item.name && <div className="active-glow" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="version-tag">v2.0.4-Neural</span>
      </div>
    </aside>
  );
};

export default Sidebar;