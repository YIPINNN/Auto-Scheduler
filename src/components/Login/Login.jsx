import React, { useState } from 'react';
import { Lock, User, ShieldCheck, Loader2 } from 'lucide-react';
import supabase from '../../config/supabaseClient'; // Ensure this path is correct
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // REAL AUTH CALL to Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        // Construct a session object to pass to App.jsx
        onLogin({
          id: data.user.id,
          email: data.user.email,
          name: "System Administrator", // You can pull this from a Profile table later
          role: "Management",
          lastLogin: data.user.last_sign_in_at
        });
      }
    } catch (err) {
      setErrorMsg(err.message || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card login-box">
        <div className="login-header">
          <ShieldCheck size={48} color="#4ecca3" />
          <h2>Auto-Scheduler</h2>
          <p>Secure Engine Access</p>
        </div>

        {errorMsg && <div className="auth-error-badge">{errorMsg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-input">
            <User size={18} />
            <input 
              type="email" 
              placeholder="Admin Email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div className="login-input">
            <Lock size={18} />
            <input 
              type="password" 
              placeholder="Master Password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          <button type="submit" className="neon-btn login-btn" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : "INITIALIZE SESSION"}
          </button>
        </form>
        
        <div className="login-footer">
          <span>Protected by AES-256 Encryption</span>
        </div>
      </div>
    </div>
  );
};

export default Login;