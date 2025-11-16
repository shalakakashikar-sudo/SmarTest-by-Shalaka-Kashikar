

import React, { useState, useMemo } from 'react';
import { authService } from '../services/authService';
import { useToast } from '../contexts/ToastContext';
import type { Role } from '../types';

type AuthMode = 'login' | 'register';

const AuthView: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  
  // State for login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState<Role | ''>('');

  // State for register form
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<Role | ''>('');

  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const loginIdentifierProps = useMemo(() => {
    if (loginRole === 'admin') {
      return { label: 'Email', placeholder: 'Enter your email address', type: 'email' };
    }
    if (loginRole === 'student' || loginRole === 'teacher') {
      return { label: 'Username', placeholder: 'Enter your unique username', type: 'text' };
    }
    return { label: 'Username / Email', placeholder: 'Please select a role to begin', type: 'text' };
  }, [loginRole]);

  const registerIdentifierProps = useMemo(() => {
    if (registerRole === 'admin') {
      return { label: 'Email', placeholder: 'Enter your administrator email', type: 'email' };
    }
    if (registerRole === 'student' || registerRole === 'teacher') {
      return { label: 'Username', placeholder: 'Create a unique username', type: 'text' };
    }
    return { label: 'Username / Email', placeholder: 'Please select a role to begin', type: 'text' };
  }, [registerRole]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword || !loginRole) {
      addToast('Please fill in all fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const loginData = await authService.login(loginUsername, loginPassword, loginRole as Role);
      if (loginData?.user && loginData?.session) {
        addToast('Login successful!', 'success');
      } else {
        throw new Error('Login failed. Please check your credentials.');
      }
    } catch (error: any) {
      if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
          addToast('Login failed: Email not confirmed. Please check your inbox for a confirmation link.', 'error');
      } else {
          addToast(error.message || 'Invalid login credentials', 'error');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerFullName || !registerUsername || !registerPassword || !registerRole) {
      addToast('Please fill in all fields', 'error');
      return;
    }
    setLoading(true);
    try {
      await authService.register(registerUsername, registerPassword, registerRole as Role, registerFullName);
      addToast('Registration successful! Please login.', 'success');
      setMode('login');
      setRegisterFullName('');
      setRegisterUsername('');
      setRegisterPassword('');
      setRegisterRole('');
    } catch (error: any) {
      addToast(error.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const TabButton: React.FC<{ currentMode: AuthMode; targetMode: AuthMode; children: React.ReactNode }> = ({ currentMode, targetMode, children }) => (
    <button
      onClick={() => setMode(targetMode)}
      className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors duration-200 ${
        currentMode === targetMode
          ? 'bg-white shadow-sm text-indigo-600 dark:bg-slate-700'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8 mt-10 dark:bg-slate-800 dark:shadow-indigo-900/20">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
            <svg className="w-12 h-12 text-indigo-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 3V7.6C14 7.86522 14.1054 8.11957 14.2929 8.30711C14.4804 8.49464 14.7348 8.6 15 8.6H19.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10.5 21H6.6C6.03995 21 5.49987 20.7893 5.09281 20.3822C4.68575 19.9752 4.47502 19.4351 4.475 18.875V5.125C4.47502 4.56495 4.68575 4.02487 5.09281 3.61781C5.49987 3.21075 6.03995 3 6.6 3H14L19.5 8.5V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 19.5L18.5 21L21.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19.5 14.5L18.7 17.3L16 18L18.7 18.7L19.5 21.5L20.3 18.7L23 18L20.3 17.3L19.5 14.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight dark:text-slate-100">SmarTest</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Intelligent Assessment Platform by Shalaka Kashikar</p>
      </div>

      <div className="flex mb-6 bg-slate-100 rounded-lg p-1 dark:bg-slate-900">
        <TabButton currentMode={mode} targetMode="login">Login</TabButton>
        <TabButton currentMode={mode} targetMode="register">Register</TabButton>
      </div>
      
      {mode === 'login' ? (
        <div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Role</label>
              <select value={loginRole} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLoginRole(e.target.value as Role | '')} className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-indigo-400">
                <option value="" disabled>Select your role</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">{loginIdentifierProps.label}</label>
              <input type={loginIdentifierProps.type} value={loginUsername} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginUsername(e.target.value)} disabled={!loginRole} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-indigo-400 dark:disabled:bg-slate-600" placeholder={loginIdentifierProps.placeholder}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Password</label>
              <input type="password" value={loginPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-indigo-400" placeholder="Enter your password"/>
            </div>
            <button type="submit" disabled={loading || !loginRole || !loginUsername || !loginPassword} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-3 rounded-lg font-medium hover:from-indigo-700 hover:to-violet-700 disabled:from-indigo-400 disabled:to-violet-400 disabled:cursor-not-allowed transition-all duration-300 ease-in-out transform hover:scale-105">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      ) : (
        <div>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Role</label>
              <select value={registerRole} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRegisterRole(e.target.value as Role | '')} className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-indigo-400">
                <option value="" disabled>Select your role</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Full Name</label>
              <input type="text" value={registerFullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegisterFullName(e.target.value)} disabled={!registerRole} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-indigo-400 dark:disabled:bg-slate-600" placeholder="Enter your full name"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">{registerIdentifierProps.label}</label>
              <input type={registerIdentifierProps.type} value={registerUsername} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegisterUsername(e.target.value)} disabled={!registerRole} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-indigo-400 dark:disabled:bg-slate-600" placeholder={registerIdentifierProps.placeholder}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Password</label>
              <input type="password" value={registerPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegisterPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:focus:ring-indigo-400" placeholder="Create a password"/>
            </div>
            <button type="submit" disabled={loading || !registerRole || !registerFullName || !registerUsername || !registerPassword} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-3 rounded-lg font-medium hover:from-indigo-700 hover:to-violet-700 disabled:from-indigo-400 disabled:to-violet-400 disabled:cursor-not-allowed transition-all duration-300 ease-in-out transform hover:scale-105">
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AuthView;