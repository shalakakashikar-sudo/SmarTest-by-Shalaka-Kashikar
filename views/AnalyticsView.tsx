
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import type { AnalyticsData } from '../types';

interface AnalyticsProps {
  navigateTo: (view: 'dashboard') => void;
}

const AnalyticsView: React.FC<AnalyticsProps> = ({ navigateTo }) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await dataService.getAnalyticsData();
        setAnalyticsData(data);
      } catch (err: any) {
        addToast(`Failed to load analytics: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [addToast]);
  
  const StatCard: React.FC<{ title: string; value: string | number; icon: string }> = ({ title, value, icon }) => (
    <div className="bg-white dark:bg-slate-700 p-6 rounded-xl shadow-lg flex items-center space-x-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
  
  if (isLoading) {
    return <div className="text-center p-8 dark:text-white">Loading analytics dashboard...</div>;
  }

  if (!analyticsData || analyticsData.overallStats.testCount === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">📊 Analytics Dashboard</h2>
            <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Dashboard</button>
        </div>
        <div className="text-center py-12">
            <p className="text-xl text-gray-600 dark:text-gray-400">No submission data available yet.</p>
            <p className="text-gray-500 dark:text-gray-500 mt-2">Create and share a test to start gathering insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100">📊 Analytics Dashboard</h2>
        <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Dashboard</button>
      </div>
      
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Overall Average Score" value={`${analyticsData.overallStats.averageScore.toFixed(1)}%`} icon="🎯" />
        <StatCard title="Total Submissions" value={analyticsData.overallStats.totalSubmissions} icon="📝" />
        <StatCard title="Total Tests" value={analyticsData.overallStats.testCount} icon="📚" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance by Test */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Performance by Test</h3>
            <div className="space-y-4">
                {analyticsData.performanceByTest.map(test => (
                    <div key={test.testTitle}>
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="font-medium text-gray-700 dark:text-slate-300">{test.testTitle}</span>
                            <span className="font-semibold text-gray-800 dark:text-slate-200">{test.averageScore.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-slate-700">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${test.averageScore}%` }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Most Difficult Questions */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Most Difficult Questions</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="border-b dark:border-slate-700">
                        <tr>
                            <th className="py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Question</th>
                            <th className="py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Success Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {analyticsData.mostDifficultQuestions.slice(0, 5).map((q, i) => (
                            <tr key={i} className="border-b dark:border-slate-700">
                                <td className="py-3 pr-2">
                                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate" title={q.questionText}>{q.questionText}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{q.testTitle}</p>
                                </td>
                                <td className="py-3 text-right text-sm font-bold text-red-500 dark:text-red-400">{q.averageSuccessRate.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
      
       {/* Performance Trend */}
      {analyticsData.performanceTrend.length > 1 && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Performance Trend</h3>
          <div className="h-64 w-full flex items-end border-l border-b border-gray-200 dark:border-slate-700 p-4">
              {analyticsData.performanceTrend.map((point, index) => (
                  <div key={index} className="flex-1 group relative flex justify-center items-end" style={{ height: `${point.averageScore}%` }}>
                      <div className="w-2/3 bg-blue-500 rounded-t-md group-hover:bg-blue-400"></div>
                      <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          {point.testTitle}: {point.averageScore.toFixed(1)}%
                      </div>
                  </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsView;
