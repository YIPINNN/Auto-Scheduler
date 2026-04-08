import React from 'react';
import { User, Mail, Shield, LogOut, Award } from 'lucide-react';
import './Account.css';

const Account = ({ user, onLogout }) => {
  return (
    <main className="dashboard-content">
      <header className="glass-header">
        <h1>Account Settings</h1>
        <p>Manage your administrative profile</p>
      </header>

      <div className="account-grid">
        <div className="glass-card profile-card">
          <div className="avatar-huge">{user.name[0]}</div>
          <h2>{user.name}</h2>
          <span className="role-tag">{user.role}</span>
          
          <div className="info-list">
            <div className="info-item">
              <Mail size={18} /> <span>{user.email}</span>
            </div>
            <div className="info-item">
              <Shield size={18} /> <span>Security Level: Tier 1</span>
            </div>
            <div className="info-item">
              <Award size={18} /> <span>FYP Project 2026</span>
            </div>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={18} /> TERMINATE SESSION
          </button>
        </div>
      </div>
    </main>
  );
};

export default Account;