import React from 'react';
import type { TestResult } from '../types';

interface ResultsProps {
  result: TestResult;
  navigateTo: (view: 'dashboard') => void;
  onRetakeTest: () => void;
}

const ResultsView: React.FC<ResultsProps> = ({ result, navigateTo, onRetakeTest }) => {
  const { evaluation, test_title } = result;
  const scoreColor = evaluation.overallScore >= 80 ? 'text-green-500 dark:text-green-400' :
                     evaluation.overallScore >= 60 ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-500 dark:text-red-400';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">📊 Results for "{test_title}"</h2>
        <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Dashboard</button>
      </div>
      
      <div className="text-center mb-8 bg-gray-50 dark:bg-slate-700/50 p-6 rounded-lg">
        <p className="text-lg text-gray-600 dark:text-gray-400">Your Score</p>
        <div className={`text-6xl ${scoreColor} font-bold mb-2`}>{evaluation.overallScore}%</div>
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-slate-200">
            {evaluation.totalAwardedMarks} / {evaluation.totalPossibleMarks} Marks
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 rounded-lg p-4 dark:bg-blue-900/40">
          <h4 className="font-semibold text-blue-800 mb-2 dark:text-blue-300">💪 Strengths</h4>
          <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{evaluation.strengths}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 dark:bg-orange-900/40">
          <h4 className="font-semibold text-orange-800 mb-2 dark:text-orange-300">📈 Areas for Improvement</h4>
          <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{evaluation.weaknesses}</p>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-6 mb-6 dark:bg-slate-700/50">
        <h4 className="font-semibold text-gray-800 mb-3 dark:text-slate-200">📝 Detailed Feedback</h4>
        <p className="text-gray-700 mb-4 dark:text-slate-300 whitespace-pre-wrap">{evaluation.feedback}</p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/40 dark:border-green-800">
          <h5 className="font-semibold text-green-800 mb-2 dark:text-green-300">💡 Suggestions</h5>
          <p className="text-green-700 dark:text-green-400 whitespace-pre-wrap">{evaluation.suggestions}</p>
        </div>
      </div>
      
      {evaluation.questionScores && evaluation.questionScores.length > 0 && (
        <div className="bg-white border rounded-lg p-4 dark:bg-slate-900/50 dark:border-slate-700">
          <h4 className="font-semibold text-gray-800 mb-3 dark:text-slate-200">📊 Question-by-Question Breakdown</h4>
          <div className="space-y-3">
            {evaluation.questionScores.map((score, index) => {
                const percentage = score.maxMarks > 0 ? Math.round((score.score / score.maxMarks) * 100) : 0;
                const qScoreColor = percentage >= 80 ? 'text-green-500 dark:text-green-400' :
                                    percentage >= 60 ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-500 dark:text-red-400';
                return (
                    <div key={index} className="p-3 bg-gray-50 rounded dark:bg-slate-800/60 border dark:border-slate-700/50">
                        <div className="flex justify-between items-start">
                            <span className="font-medium dark:text-slate-200">Question {index + 1}</span>
                            <span className={`text-lg font-bold ${qScoreColor}`}>{score.score} / {score.maxMarks}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 dark:text-slate-400 whitespace-pre-wrap">{score.feedback}</p>
                    </div>
                );
            })}
          </div>
        </div>
      )}
      
      <div className="text-center mt-8">
        <button onClick={onRetakeTest} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg mr-4">
          🔄 Retake Test
        </button>
        <button onClick={() => navigateTo('dashboard')} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg">
          🏠 Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ResultsView;