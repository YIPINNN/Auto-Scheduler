import React, { useState } from 'react';
import { Lock, User, ShieldCheck, Loader2 } from 'lucide-react';
import './Login.css';

const Login = ({ onLoginWithID, isSystemLoading }) => {
  const [employeeID, setEmployeeID] = useState("");
  const [password, setPassword] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalLoading(true);
    setErrorMsg("");

    try {
      // Execute custom table-lookup auth routing defined inside App.jsx
      const response = await onLoginWithID(employeeID, password);
      
      if (response && !response.success) {
        setErrorMsg(response.error || "Authentication rejected. Verify credential values.");
      }
    } catch (err) {
      setErrorMsg("An unexpected operational error occurred during lookup.");
    } finally {
      setLocalLoading(false);
    }
  };

  // Combine parent sync hooks and local state locks to handle form button disables safely
  const isLoading = isSystemLoading || localLoading;

  return (
    <div className="login-container">
      <div className="glass-card login-box">
        <div className="login-header">
          <ShieldCheck size={48} color="#4ecca3" />
          <h2>Auto-Scheduler</h2>
          <p>Secure Engine Access Registry</p>
        </div>

        {errorMsg && <div className="auth-error-badge">{errorMsg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-input">
            <User size={18} />
            <input 
              type="text" 
              placeholder="Employee ID (e.g. admin, tech1)" 
              required 
              value={employeeID} 
              onChange={(e) => setEmployeeID(e.target.value)} 
              disabled={isLoading}
            />
          </div>
          <div className="login-input">
            <Lock size={18} />
            <input 
              type="password" 
              placeholder="System Password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              disabled={isLoading}
            />
          </div>
          <button type="submit" className="neon-btn login-btn" disabled={isLoading}>
            {isLoading ? <Loader2 className="spin" size={18} /> : "INITIALIZE SESSION"}
          </button>
        </form>
        
        <div className="login-footer">
          <span>Protected by AES-256 Encryption Node Matrix</span>
        </div>
      </div>
    </div>
  );
};

export default Login;