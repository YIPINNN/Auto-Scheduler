import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  Users, 
  Ticket as TicketIcon, 
  PlusSquare, // Added for Create Ticket
  BarChart3, 
  Send,
  UserCircle 
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ onNavigate, activePage }) => {
  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Schedule', icon: <CalendarRange size={20} /> },
    { name: 'Technicians', icon: <Users size={20} /> },
    { name: 'Tickets', icon: <TicketIcon size={20} /> },
    { name: 'Create Ticket', icon: <PlusSquare size={20} /> }, // New Navigation Item
    { name: 'Notification', icon: <Send size={20} /> },
    { name: 'Performance', icon: <BarChart3 size={20} /> },
    { name: 'Account', icon: <UserCircle size={20} /> }, 
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">AS</div>
        <h2>AUTO-SCHEDULER</h2>
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
            
            {/* Visual indicator for active state */}
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