import React, { useState, useEffect } from 'react';
import type { Test, TestResult, Question, EvaluationResult } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { dataService } from '../services/dataService';

interface SubmissionDetailProps {
  test: Test;
  submission: TestResult;
  navigateTo: (view: 'submissions' | 'dashboard') => void;
}

const SubmissionDetailView: React.FC<SubmissionDetailProps> = ({ test, submission, navigateTo }) => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editableEvaluation, setEditableEvaluation] = useState<EvaluationResult>(submission.evaluation);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditableEvaluation(submission.evaluation);
    setIsEditing(false);
  }, [submission]);

  const { student_name, test_title } = submission;
  const scoreColor = editableEvaluation.overallScore >= 80 ? 'text-green-500 dark:text-green-400' :
                     editableEvaluation.overallScore >= 60 ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-500 dark:text-red-400';
  
  const canEdit = profile?.role === 'teacher' || profile?.role === 'admin';

  const handleSave = async () => {
    if (!submission.id) {
        addToast('Cannot save changes: Submission ID is missing.', 'error');
        return;
    }
    setIsSaving(true);
    try {
        await dataService.updateTestResult(submission.id, editableEvaluation);
        addToast('Feedback updated successfully!', 'success');
        setIsEditing(false);
    } catch (error: any) {
        addToast(`Failed to save changes: ${error.message}`, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditableEvaluation(submission.evaluation); // Revert to original
    setIsEditing(false);
  };
  
  const handleEvaluationChange = (field: keyof EvaluationResult, value: string) => {
    setEditableEvaluation(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">🔍 Submission Details</h2>
            <p className="text-gray-600 dark:text-gray-400">Viewing results for <span className="font-medium">{student_name}</span> on "{test_title}"</p>
        </div>
        <button onClick={() => navigateTo('submissions')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Submissions</button>
      </div>
      
      <div className="text-center bg-gray-50 rounded-lg p-6 mb-8 dark:bg-slate-700/50">
        <div className="text-lg font-medium text-gray-700 dark:text-gray-300">Overall Score</div>
        <div className={`text-5xl ${scoreColor} font-bold`}>{editableEvaluation.overallScore}%</div>
        <div className="text-xl text-gray-500 dark:text-gray-400 font-semibold mt-1">
          ({editableEvaluation.totalAwardedMarks ?? '...'} / {editableEvaluation.totalPossibleMarks ?? '...'} marks)
        </div>
      </div>
      
       <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-2 dark:border-slate-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-200">AI-Generated Feedback</h3>
            {canEdit && (
                <div className="flex space-x-2">
                    {isEditing ? (
                        <>
                            <button onClick={handleCancel} disabled={isSaving} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-1 rounded-lg text-sm dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-slate-100">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-1 rounded-lg text-sm disabled:bg-green-400">
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1 rounded-lg text-sm">
                            Edit Feedback
                        </button>
                    )}
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EditableFeedbackCard title="💪 Strengths" value={editableEvaluation.strengths} isEditing={isEditing} onChange={(val) => handleEvaluationChange('strengths', val)} color="blue"/>
          <EditableFeedbackCard title="📈 Areas for Improvement" value={editableEvaluation.weaknesses} isEditing={isEditing} onChange={(val) => handleEvaluationChange('weaknesses', val)} color="orange"/>
        </div>
      
        <EditableFeedbackCard title="📝 Detailed Feedback" value={editableEvaluation.feedback} isEditing={isEditing} onChange={(val) => handleEvaluationChange('feedback', val)} color="gray"/>
        <EditableFeedbackCard title="💡 Suggestions" value={editableEvaluation.suggestions} isEditing={isEditing} onChange={(val) => handleEvaluationChange('suggestions', val)} color="green"/>

        <h3 className="text-xl font-bold text-gray-800 border-b pt-4 pb-2 dark:text-slate-200 dark:border-slate-700">Question Breakdown</h3>
        {test.questions.map((question, index) => (
          <QuestionBreakdown
            key={question.id || index}
            question={question}
            answer={submission.answers[index]}
            score={submission.evaluation.questionScores[index]}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

const EditableFeedbackCard: React.FC<{title: string, value: string, isEditing: boolean, onChange: (value: string) => void, color: 'blue' | 'orange' | 'green' | 'gray'}> = ({title, value, isEditing, onChange, color}) => {
    const colors = {
        blue: { bg: 'bg-blue-50 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300' },
        orange: { bg: 'bg-orange-50 dark:bg-orange-900/40', text: 'text-orange-800 dark:text-orange-300' },
        green: { bg: 'bg-green-50 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-300' },
        gray: { bg: 'bg-gray-50 dark:bg-slate-700/50', text: 'text-gray-800 dark:text-slate-200' },
    };

    return (
        <div className={`${colors[color].bg} rounded-lg p-4`}>
          <h4 className={`font-semibold ${colors[color].text} mb-2`}>{title}</h4>
          {isEditing ? (
              <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-gray-400 focus:ring-indigo-500 focus:border-transparent text-sm"
                  rows={4}
              />
          ) : (
             <p className="text-gray-700 dark:text-slate-300 text-sm">{value}</p>
          )}
        </div>
    );
};

const QuestionBreakdown: React.FC<{ question: Question, answer: any, score: any, index: number }> = ({ question, answer, score, index }) => {
  const percentage = score && typeof score.maxMarks !== 'undefined' && score.maxMarks > 0 
    ? Math.round((score.score / score.maxMarks) * 100) 
    : 0;
  const scoreColor = percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-gray-50 p-4 rounded-lg border dark:bg-slate-900/50 dark:border-slate-700">
        <div className="flex justify-between items-start mb-4">
            <h4 className="font-semibold text-gray-800 text-lg dark:text-slate-200">Question {index + 1}</h4>
            <div className="text-right">
                <div className={`inline-block px-3 py-1 text-white text-sm font-bold rounded-full ${scoreColor}`}>
                    {percentage}%
                </div>
                {score && typeof score.maxMarks !== 'undefined' && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {score.score} / {score.maxMarks} marks
                    </div>
                )}
            </div>
        </div>
        
        {question.type === 'reading-comprehension' && question.passage && (
            <div className="p-3 bg-gray-100 rounded-md border mb-4 dark:bg-slate-800 dark:border-slate-600">
                <h5 className="font-semibold text-gray-600 mb-1 dark:text-slate-400">Reading Passage</h5>
                <div className="text-gray-700 whitespace-pre-wrap dark:text-slate-300" dangerouslySetInnerHTML={{ __html: question.passage }} />
            </div>
        )}
        
        <div className="text-gray-700 mb-4 whitespace-pre-wrap font-medium dark:text-slate-300" dangerouslySetInnerHTML={{ __html: question.text }} />

        {(question.media?.image || question.media?.video || question.media?.audio) && (
            <div className="my-4 p-2 border rounded-lg dark:border-slate-600">
                {question.media.image && <img src={question.media.image} alt="Question media" className="max-w-full h-auto rounded-md mx-auto" />}
                {question.media.video && <video src={question.media.video} controls className="max-w-full h-auto rounded-md mx-auto" />}
                {question.media.audio && <audio src={question.media.audio} controls className="w-full" />}
            </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border dark:bg-slate-700 dark:border-slate-600">
                <h5 className="font-semibold text-gray-700 mb-2 dark:text-slate-300">Student's Answer</h5>
                <DisplayAnswer answer={answer} question={question} />
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800">
                <h5 className="font-semibold text-blue-800 mb-2 dark:text-blue-300">AI Feedback</h5>
                <p className="text-gray-700 text-sm dark:text-slate-300">{score?.feedback || 'Not available.'}</p>
            </div>
        </div>
    </div>
  );
};

const DisplayAnswer: React.FC<{answer: any, question: Question}> = ({ answer, question }) => {
    if (question.type === 'reading-comprehension') {
        return (
            <div className="space-y-2">
                {(question.comprehensionQuestions || []).map((compQ, index) => (
                    <div key={index} className="text-sm">
                        <p className="font-medium text-gray-600 dark:text-gray-400">{compQ.question}</p>
                        <div 
                            className="text-gray-800 pl-2 border-l-2 border-gray-200 dark:text-slate-200 dark:border-slate-600"
                            dangerouslySetInnerHTML={{ __html: answer?.[index] || `<span class="text-gray-400 italic">No answer provided</span>` }}
                        />
                    </div>
                ))}
            </div>
        );
    }
    
    if (question.type === 'multiple-choice') {
        const optionIndex = answer ? answer.charCodeAt(0) - 65 : -1;
        const selectedOption = question.options?.[optionIndex];
        return <p className="text-gray-800 whitespace-pre-wrap dark:text-slate-200">{answer}. {selectedOption || <span className="text-gray-400 italic">No answer provided</span>}</p>
    }

    return (
        <div 
            className="text-gray-800 whitespace-pre-wrap dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: answer || `<span class="text-gray-400 italic">No answer provided</span>` }}
        />
    );
};

export default SubmissionDetailView;
