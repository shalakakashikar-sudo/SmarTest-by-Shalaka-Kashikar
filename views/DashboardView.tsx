
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { authService } from '../services/authService';
import { dataService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import type { Test, TestResult } from '../types';
import { SkeletonCard } from '../components/SkeletonLoader';

interface DashboardProps {
  navigateTo: (view: 'create-test' | 'edit-test' | 'take-test' | 'submissions' | 'user-management' | 'analytics') => void;
  onStartTest: (test: Test) => void;
  onEditTest: (test: Test) => void;
  onViewSubmissions: (test: Test) => void;
  onViewResultDetails: (result: TestResult, test: Test) => void;
}

interface ProgressData {
  subject: string;
  averageScore: number;
  testCount: number;
}

const DashboardView: React.FC<DashboardProps> = ({ navigateTo, onStartTest, onEditTest, onViewSubmissions, onViewResultDetails }) => {
  const { profile, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [mySubmissions, setMySubmissions] = useState<TestResult[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [testToDelete, setTestToDelete] = useState<Test | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedClass, setSelectedClass] = useState('all');

  useEffect(() => {
    const fetchDashboardData = async () => {
        setIsLoadingTests(true);
        try {
            const testsData = await dataService.getTests();
            setTests(testsData);

            if (profile?.role === 'student' && profile.id) {
                const submissionsData = await dataService.getMyTestResults();
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

  const progressData = useMemo<ProgressData[]>(() => {
    if (profile?.role !== 'student' || mySubmissions.length === 0 || tests.length === 0) {
      return [];
    }

    const testIdToClassMap = new Map<string, string>();
    tests.forEach(test => {
      if (test.id && test.class) {
        testIdToClassMap.set(test.id, test.class);
      }
    });

    const progressBySubject = new Map<string, { sum: number; count: number }>();

    mySubmissions.forEach(submission => {
      const subject = testIdToClassMap.get(submission.test_id);
      if (subject) {
        if (!progressBySubject.has(subject)) {
          progressBySubject.set(subject, { sum: 0, count: 0 });
        }
        const current = progressBySubject.get(subject)!;
        current.sum += submission.evaluation.overallScore;
        current.count += 1;
      }
    });

    const calculatedProgress: ProgressData[] = [];
    progressBySubject.forEach((value, key) => {
      calculatedProgress.push({
        subject: key,
        averageScore: value.sum / value.count,
        testCount: value.count,
      });
    });

    return calculatedProgress.sort((a, b) => a.subject.localeCompare(b.subject));
  }, [mySubmissions, tests, profile]);


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
    setIsDeleting(true);
    try {
        await dataService.deleteTest(testToDelete.id);
        setTests(prevTests => prevTests.filter(t => t.id !== testToDelete.id));
        addToast('Test deleted successfully!', 'success');
    } catch (error: any) {
        addToast(`Failed to delete test: ${error.message}`, 'error');
    } finally {
        setTestToDelete(null);
        setIsDeleting(false);
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleViewDetailsClick = (result: TestResult) => {
    const associatedTest = tests.find(t => t.id === result.test_id);
    if (associatedTest) {
      onViewResultDetails(result, associatedTest);
    } else {
      addToast('Could not find the original test for this submission.', 'error');
    }
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

  const StudentProgressChart: React.FC<{ data: ProgressData[] }> = ({ data }) => {
    const getScoreColor = (score: number) => {
      if (score >= 80) return 'bg-green-500';
      if (score >= 60) return 'bg-yellow-500';
      return 'bg-red-500';
    };

    if (data.length === 0) {
        return null; // Don't render if there's no data
    }

    return (
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 dark:text-slate-100">📈 My Subject Progress</h2>
        <div className="space-y-4">
          {data.map(({ subject, averageScore, testCount }) => (
            <div key={subject}>
              <div className="flex justify-between items-center mb-1 text-sm">
                <span className="font-semibold text-gray-800 dark:text-slate-200">{subject}</span>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Average: <span className="font-bold">{Math.round(averageScore)}%</span> ({testCount} {testCount > 1 ? 'tests' : 'test'})
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden dark:bg-slate-700" title={`Average score: ${Math.round(averageScore)}%`}>
                <div
                  className={`h-4 rounded-full transition-all duration-500 ease-out ${getScoreColor(averageScore)}`}
                  style={{ width: `${averageScore}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(averageScore)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${subject} progress`}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };


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

      <div className="mb-8">
        {profile?.role === 'student' ? (
          <div className="flex justify-center">
            <div className="w-full max-w-sm">
              <DashboardCard 
                title="Take a Test" 
                description="View and start available tests." 
                buttonText="View Tests" 
                onClick={() => document.getElementById('student-tests')?.scrollIntoView({ behavior: 'smooth' })} 
                color="bg-green-600 hover:bg-green-700" 
                icon="✏️" 
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DashboardCard 
              title="Create Test" 
              description="Design custom tests with multiple question types." 
              buttonText="Create New Test" 
              onClick={() => navigateTo('create-test')} 
              color="bg-blue-600 hover:bg-blue-700" 
              icon="📝" 
            />
            <DashboardCard 
              title="Analytics"
              description="View performance data and class insights."
              buttonText="View Analytics"
              onClick={() => navigateTo('analytics')}
              color="bg-teal-600 hover:bg-teal-700"
              icon="📊"
            />
            <DashboardCard 
              title="User Management" 
              description="View and manage student and teacher accounts." 
              buttonText="Manage Users" 
              onClick={() => navigateTo('user-management')} 
              color="bg-purple-600 hover:bg-purple-700" 
              icon="👥" 
            />
          </div>
        )}
      </div>
      
      {profile?.role === 'student' && <StudentProgressChart data={progressData} />}

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
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedClass(e.target.value)}
                            className="p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            {availableClasses.map(c => (
                                <option key={c} value={c}>{c === 'all' ? 'All Classes' : c}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            {isLoadingTests ? (
                <div className="space-y-4">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            ) : (
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
            {isLoadingTests ? (
                <div className="space-y-4">
                    <SkeletonCard />
                </div>
            ) : (
              <div className="space-y-4">
                {mySubmissions.length > 0 ? mySubmissions.map(result => (
                  <div key={result.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border dark:bg-slate-700 dark:border-slate-600">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100">{result.test_title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Score: <span className="font-bold">{result.evaluation.overallScore}%</span> | Submitted: {formatDate(result.submitted_at)}
                      </p>
                    </div>
                    <button onClick={() => handleViewDetailsClick(result)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">View Details</button>
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
          {isLoadingTests ? (
            <div className="space-y-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
          ) : (
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
                    <button onClick={handleDeleteTest} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg disabled:bg-red-400">
                        {isDeleting ? 'Deleting...' : 'Delete Test'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default DashboardView;
