import React, { createContext, useState, useEffect } from 'react';
import api, { scheduleSessionWarning, clearSessionTimers, markIntentionalLogout, prewarmBackend } from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    prewarmBackend();
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/me');
          setUser(res.data);
          if (res.data?.id && res.data?.onboarding_completed) {
            localStorage.setItem(`florix_welcomed_${res.data.id}`, 'true');
          }
          scheduleSessionWarning(token);
        } catch (error) {
          console.error('Failed to fetch user', error);
          localStorage.removeItem('token');
          clearSessionTimers();
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const detectAndSaveCountry = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      const country = data.country_name || 'Unknown';
      localStorage.setItem('user_country', country);
      await api.post('/me/detect-country', { country });
    } catch (err) {
      // Instant offline timezone fallback (0ms)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const isIndia = tz.includes('Kolkata') || tz.includes('Calcutta') || tz.includes('Asia/Kolkata');
        const fallbackCountry = isIndia ? 'India' : 'United States';
        localStorage.setItem('user_country', fallbackCountry);
        await api.post('/me/detect-country', { country: fallbackCountry });
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (user) {
      detectAndSaveCountry();
    }
  }, [user]);

  const login = async (email, password) => {
    const res = await api.post('/login', { email, password });
    const token = res.data.access_token;
    localStorage.setItem('token', token);
    scheduleSessionWarning(token);
    const userData = res.data.user;
    if (userData?.id && userData?.onboarding_completed) {
      localStorage.setItem(`florix_welcomed_${userData.id}`, 'true');
    } else if (userData?.id) {
      localStorage.removeItem(`florix_welcomed_${userData.id}`);
    }
    setUser(userData);
    return res.data;
  };

  const signup = async (name, email, password) => {
    const res = await api.post('/signup', { name, email, password });
    const token = res.data.access_token;
    localStorage.setItem('token', token);
    scheduleSessionWarning(token);
    const userData = res.data.user;
    // New signup: clear welcomed flag so user answers questions and sees welcome screen
    if (userData?.id) {
      localStorage.removeItem(`florix_welcomed_${userData.id}`);
    }
    setUser(userData);
    return res.data;
  };

  const oauthLogin = async (provider, email, name) => {
    const res = await api.post('/auth/oauth', { provider, email, name });
    const token = res.data.access_token;
    localStorage.setItem('token', token);
    scheduleSessionWarning(token);
    const userData = res.data.user;
    if (userData?.id && userData?.onboarding_completed) {
      localStorage.setItem(`florix_welcomed_${userData.id}`, 'true');
    } else if (userData?.id) {
      localStorage.removeItem(`florix_welcomed_${userData.id}`);
    }
    setUser(userData);
    return res.data;
  };

  const logout = () => {
    markIntentionalLogout();       // ✅ suppress false "session expired" toast
    localStorage.removeItem('token');
    clearSessionTimers();
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await api.get('/me');
        setUser(res.data);
        return res.data;
      } catch (error) {
        console.error('Failed to refresh user', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, signup, logout, loading, refreshUser, oauthLogin }}>
      {children}
    </AuthContext.Provider>
  );
};
