import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import type { Test, TestResult } from '../types';

interface SubmissionsProps {
  test: Test;
  navigateTo: (view: 'dashboard') => void;
  onViewDetail: (submission: TestResult) => void;
}

const SubmissionsView: React.FC<SubmissionsProps> = ({ test, navigateTo, onViewDetail }) => {
  const [submissions, setSubmissions] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();
  const [submissionToDelete, setSubmissionToDelete] = useState<TestResult | null>(null);

  useEffect(() => {
    if (test.id) {
      dataService.getTestResults(test.id)
        .then(data => setSubmissions(data))
        .catch(err => addToast(`Failed to load submissions: ${err.message}`, 'error'))
        .finally(() => setIsLoading(false));
    }
  }, [test.id, addToast]);

  const handleDeleteSubmission = async () => {
    if (!submissionToDelete || !submissionToDelete.id) return;
    try {
      await dataService.deleteTestResult(submissionToDelete.id);
      setSubmissions(prev => prev.filter(s => s.id !== submissionToDelete.id));
      addToast('Submission deleted successfully!', 'success');
    } catch (error: any) {
      addToast(`Failed to delete submission: ${error.message}`, 'error');
    } finally {
      setSubmissionToDelete(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">📋 Submissions for "{test.title}"</h2>
          <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Dashboard</button>
        </div>
        
        {isLoading ? (
          <p className="dark:text-gray-300">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 text-lg dark:text-gray-400">No students have submitted this test yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Student Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Score</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Submitted At</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-slate-700">
                {submissions.map(submission => (
                  <tr key={submission.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">{submission.student_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-slate-300">{submission.evaluation.overallScore}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{formatDate(submission.submitted_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-4">
                      <button onClick={() => onViewDetail(submission)} className="text-indigo-600 hover:text-indigo-900 font-medium dark:text-indigo-400 dark:hover:text-indigo-300">View</button>
                      <button onClick={() => setSubmissionToDelete(submission)} className="text-red-600 hover:text-red-900 font-medium dark:text-red-400 dark:hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {submissionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full mx-4 dark:bg-slate-800">
                <h3 className="text-2xl font-bold text-gray-900 mb-2 dark:text-slate-100">Confirm Deletion</h3>
                <p className="my-4 text-gray-600 dark:text-gray-300">
                  Are you sure you want to delete the submission for <span className="font-bold">"{submissionToDelete.student_name}"</span>? 
                  This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={() => setSubmissionToDelete(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-slate-100">Cancel</button>
                    <button onClick={handleDeleteSubmission} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg">Delete Submission</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default SubmissionsView;