import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { authService } from '../services/authService';
import { dataService } from '../services/dataService';
import { aiService } from '../services/aiService';
import { useToast } from '../contexts/ToastContext';
import type { Test, TestResult } from '../types';

interface DashboardProps {
  navigateTo: (view: 'create-test' | 'edit-test' | 'take-test' | 'submissions' | 'user-management') => void;
  onStartTest: (test: Test) => void;
  onEditTest: (test: Test) => void;
  onViewSubmissions: (test: Test) => void;
  onViewResultDetails: (result: TestResult) => void;
}

const DashboardView: React.FC<DashboardProps> = ({ navigateTo, onStartTest, onEditTest, onViewSubmissions, onViewResultDetails }) => {
  const { profile, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [mySubmissions, setMySubmissions] = useState<TestResult[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [testToDelete, setTestToDelete] = useState<Test | null>(null);
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState('all');

  useEffect(() => {
    const fetchDashboardData = async () => {
        setIsLoadingTests(true);
        try {
            const testsData = await dataService.getTests();
            setTests(testsData);

            if (profile?.role === 'student' && profile.id) {
                const submissionsData = await dataService.getMyTestResults(profile.id);
                setMySubmissions(submissionsData);
            }
        } catch (err: any) {
            addToast('Failed to load dashboard data: ' + err.message, 'error');
        } finally {
            setIsLoadingTests(false);
        }
    };
    
    if (profile) {
        fetchDashboardData();
    }
  }, [profile, addToast]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      addToast('Logged out successfully', 'info');
    } catch (error: any) {
      addToast(error.message, 'error');
    }
  };
  
  const handleDeleteTest = async () => {
    if (!testToDelete || !testToDelete.id) return;
    try {
        await dataService.deleteTest(testToDelete.id);
        setTests(prevTests => prevTests.filter(t => t.id !== testToDelete.id));
        addToast('Test deleted successfully!', 'success');
    } catch (error: any) {
        addToast(`Failed to delete test: ${error.message}`, 'error');
    } finally {
        setTestToDelete(null);
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };


  if (loading) {
    return <div className="dark:text-white">Loading dashboard...</div>;
  }

  const roleBadgeClass = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    teacher: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    student: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  };

  const myTests = tests.filter(test => profile?.role === 'admin' || test.created_by === profile?.id);

  const availableClasses = useMemo(() => (
    ['all', ...Array.from(new Set(tests.map(t => t.class).filter(c => c)))]
  ), [tests]);

  const filteredTestsForStudent = useMemo(() => (
    selectedClass === 'all' ? tests : tests.filter(test => test.class === selectedClass)
  ), [tests, selectedClass]);

  const DashboardCard: React.FC<{ title: string; description: string; buttonText: string; onClick: () => void; color: string; icon: string }> = ({ title, description, buttonText, onClick, color, icon }) => (
    <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow dark:bg-slate-800 dark:hover:shadow-indigo-900/20">
      <div className="text-center">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2 dark:text-slate-100">{title}</h3>
        <p className="text-gray-600 mb-4 dark:text-gray-400">{description}</p>
        <button onClick={onClick} className={`${color} text-white px-6 py-2 rounded-lg font-medium`}>
          {buttonText}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100">🎓 SmarTest Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Welcome back, <span className="font-medium text-gray-800 dark:text-slate-200">{profile?.full_name}</span>!</p>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
            {theme === 'light' ? 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> :
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            }
          </button>
          {profile && <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleBadgeClass[profile.role]}`}>{profile.role.toUpperCase()}</span>}
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">🚪 Logout</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {profile?.role === 'student' && (
          <DashboardCard title="Take a Test" description="View and start available tests." buttonText="View Tests" onClick={() => document.getElementById('student-tests')?.scrollIntoView({ behavior: 'smooth' })} color="bg-green-600 hover:bg-green-700" icon="✏️" />
        )}
        {(profile?.role === 'teacher' || profile?.role === 'admin') && (
          <DashboardCard title="Create Test" description="Design custom tests with multiple question types." buttonText="Create New Test" onClick={() => navigateTo('create-test')} color="bg-blue-600 hover:bg-blue-700" icon="📝" />
        )}
        {(profile?.role === 'teacher' || profile?.role === 'admin') && (
          <DashboardCard title="User Management" description="View and manage student and teacher accounts." buttonText="Manage Users" onClick={() => navigateTo('user-management')} color="bg-purple-600 hover:bg-purple-700" icon="👥" />
        )}
        {profile?.role === 'admin' && (
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow dark:bg-slate-800 dark:hover:shadow-indigo-900/20">
                <div className="text-center">
                    <div className="text-4xl mb-4">🔐</div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2 dark:text-slate-100">Security Note</h3>
                    <p className="text-gray-600 mb-4 dark:text-gray-400">AI API keys are securely managed on the server via Supabase Edge Functions to prevent misuse.</p>
                </div>
            </div>
        )}
      </div>

      {profile?.role === 'student' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div id="student-tests" className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Available Tests</h2>
                {availableClasses.length > 1 && (
                    <div>
                        <label htmlFor="class-filter" className="text-sm font-medium text-gray-700 mr-2 dark:text-gray-300">Filter by Class:</label>
                        <select
                            id="class-filter"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            {availableClasses.map(c => (
                                <option key={c} value={c}>{c === 'all' ? 'All Classes' : c}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            {isLoadingTests ? <p className="dark:text-gray-300">Loading tests...</p> : (
              <div className="space-y-4">
                {filteredTestsForStudent.length > 0 ? filteredTestsForStudent.map(test => (
                  <div key={test.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border dark:bg-slate-700 dark:border-slate-600">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100">{test.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Class: {test.class || 'All'} | Questions: {test.total_questions} | Marks: {test.total_marks} | Time: {test.timer ? `${test.timer} min` : 'N/A'}
                      </p>
                    </div>
                    <button onClick={() => onStartTest(test)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">Start Test</button>
                  </div>
                )) : <p className="dark:text-gray-400">No tests available for the selected class.</p>}
              </div>
            )}
          </div>
          <div id="student-submissions" className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 dark:text-slate-100">My Past Submissions</h2>
            {isLoadingTests ? <p className="dark:text-gray-300">Loading submission history...</p> : (
              <div className="space-y-4">
                {mySubmissions.length > 0 ? mySubmissions.map(result => (
                  <div key={result.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border dark:bg-slate-700 dark:border-slate-600">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100">{result.test_title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Score: <span className="font-bold">{result.evaluation.overallScore}%</span> | Submitted: {formatDate(result.submitted_at)}
                      </p>
                    </div>
                    <button onClick={() => onViewResultDetails(result)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">View Details</button>
                  </div>
                )) : <p className="dark:text-gray-400">You have not submitted any tests yet.</p>}
              </div>
            )}
          </div>
        </div>
      )}
      
       {(profile?.role === 'teacher' || profile?.role === 'admin') && (
        <div id="teacher-tests" className="bg-white rounded-lg shadow-lg p-6 mt-8 dark:bg-slate-800">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 dark:text-slate-100">My Created Tests</h2>
          {isLoadingTests ? <p className="dark:text-gray-300">Loading tests...</p> : (
            <div className="space-y-4">
              {myTests.length > 0 ? myTests.map(test => (
                <div key={test.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border dark:bg-slate-700 dark:border-slate-600">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100">{test.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Class: {test.class || 'All'} | Questions: {test.total_questions} | Marks: {test.total_marks}
                    </p>
                  </div>
                  <div className="space-x-2">
                    <button onClick={() => onEditTest(test)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg">Edit</button>
                    <button onClick={() => onViewSubmissions(test)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">View Submissions</button>
                    <button onClick={() => setTestToDelete(test)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Delete</button>
                  </div>
                </div>
              )) : <p className="dark:text-gray-400">You have not created any tests yet.</p>}
            </div>
          )}
        </div>
      )}

      {testToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full mx-4 dark:bg-slate-800">
                <h3 className="text-2xl font-bold text-gray-900 mb-2 dark:text-slate-100">Confirm Deletion</h3>
                <p className="my-4 text-gray-600 dark:text-gray-300">Are you sure you want to delete the test <span className="font-bold">"{testToDelete.title}"</span>? This will permanently remove the test, all its questions, and all student submissions. This action cannot be undone.</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={() => setTestToDelete(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-slate-100">Cancel</button>
                    <button onClick={handleDeleteTest} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg">Delete Test</button>
                </div>
            </div>
        </div>
      )}

      {profile?.role === 'student' && (
        <>
            <button
                onClick={() => setIsTutorOpen(true)}
                className="fixed bottom-8 right-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 z-40"
                aria-label="Open AI Tutor"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </button>
            {isTutorOpen && (
                <AITutorModal onClose={() => setIsTutorOpen(false)} />
            )}
        </>
      )}

    </div>
  );
};


interface TutorMessage {
    role: 'user' | 'model';
    text: string;
}

const AITutorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [messages, setMessages] = useState<TutorMessage[]>([
        { role: 'model', text: "Hello! I am your SmarTest AI Tutor, powered by Gemini. How can I help you study today? You can ask me to explain concepts, define terms, or give you practice problems." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatHistoryRef.current?.scrollTo(0, chatHistoryRef.current.scrollHeight);
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: TutorMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        const historyForApi = messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        try {
            const response = await aiService.getTutorResponse(currentInput, historyForApi);
            const aiMessage: TutorMessage = { role: 'model', text: response.text };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error: any) {
            addToast(error.message, 'error');
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col mx-4 dark:bg-slate-800">
                <header className="flex items-center justify-between p-4 border-b dark:border-slate-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">🤖 AI Tutor (Powered by Gemini)</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                <div ref={chatHistoryRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50 dark:bg-slate-900">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                           {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">AI</div>}
                           <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                             {msg.text}
                           </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">AI</div>
                            <div className="max-w-md p-3 rounded-lg bg-gray-200 text-gray-800 dark:bg-slate-700">
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center gap-3 dark:border-slate-700">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ask a question..."
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="bg-blue-600 text-white p-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};


export default DashboardView;