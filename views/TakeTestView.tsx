import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { aiService } from '../services/aiService';
import { dataService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import type { Test, TestResult, Question, ComprehensionQuestion } from '../types';

interface TakeTestProps {
  test: Test;
  onSubmitTest: (result: TestResult) => void;
  navigateTo: (view: 'dashboard') => void;
}

const TakeTestView: React.FC<TakeTestProps> = ({ test, onSubmitTest, navigateTo }) => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [answers, setAnswers] = useState<(string | Record<number, string>)[]>(() => Array(test.questions.length).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(test.timer ? test.timer * 60 : null);
  const originalTitle = useRef(document.title);
  
  // Anti-cheat logic
  useEffect(() => {
    const handleContextmenu = (e: MouseEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleVisibilityChange = () => {
        if (document.hidden) addToast('Tab switching detected. Please remain on the test page.', 'warning');
    };

    document.addEventListener('contextmenu', handleContextmenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.body.classList.add('select-none');
    addToast('Anti-cheat protection is active.', 'info');
    
    return () => {
      document.removeEventListener('contextmenu', handleContextmenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.body.classList.remove('select-none');
      document.title = originalTitle.current;
    };
  }, [addToast]);

  const handleSubmit = useCallback(async () => {
    if (!profile) {
      addToast('Error: User not found.', 'error');
      return;
    }

    setIsLoading(true);
    addToast('Submitting your test for AI evaluation...', 'info');
    try {
      const evaluation = await aiService.evaluateTest(test.questions, answers);
      
      const result: TestResult = {
        test_id: test.id!,
        test_title: test.title,
        student_id: profile.id,
        student_name: profile.full_name,
        answers: answers,
        evaluation: evaluation,
      };

      await dataService.saveTestResult(result);
      addToast('Evaluation complete!', 'success');
      onSubmitTest(result);
    } catch (error: any) {
      addToast(`Error submitting test: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [test, answers, profile, addToast, onSubmitTest]);
  
  // Timer logic
  useEffect(() => {
    if (timeRemaining === null) return;
    
    if (timeRemaining <= 0) {
      addToast('Time is up! Submitting your test automatically.', 'warning');
      handleSubmit();
      return;
    }

    const timerId = setInterval(() => setTimeRemaining(t => t! - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeRemaining, handleSubmit, addToast]);


  const updateAnswer = (questionIndex: number, answer: string | Record<number, string>) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = answer;
      return newAnswers;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 relative dark:bg-slate-800">
      {timeRemaining !== null && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg font-bold z-50 text-white ${timeRemaining <= 300 ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}`}>
          ⏰ {formatTime(timeRemaining)}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">✏️ {test.title}</h2>
        <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Dashboard</button>
      </div>

      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/40 dark:border-yellow-800">
        <div className="flex items-center">
          <span className="text-yellow-600 mr-2 dark:text-yellow-400">🛡️</span>
          <span className="text-yellow-800 font-medium dark:text-yellow-300">Anti-Cheat Protection Active</span>
        </div>
        <p className="text-yellow-700 text-sm mt-1 dark:text-yellow-400">Right-click, copy/paste, and tab switching are monitored.</p>
      </div>

      <div className="space-y-6">
        {test.questions.map((q, index) => (
          <QuestionDisplay key={index} question={q} index={index} answer={answers[index]} onAnswerChange={updateAnswer} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium text-lg disabled:bg-blue-400">
          {isLoading ? 'Evaluating...' : '🎯 Submit Test for AI Evaluation'}
        </button>
      </div>
    </div>
  );
};

const QuestionDisplay: React.FC<{ question: Question; index: number; answer: string | Record<number, string>; onAnswerChange: (index: number, answer: string | Record<number, string>) => void; }> = ({ question, index, answer, onAnswerChange }) => {
    let answerInput;

    const handleComprehensionAnswer = (compIndex: number, compAnswer: string) => {
        const currentCompAnswers = typeof answer === 'object' ? answer : {};
        onAnswerChange(index, { ...currentCompAnswers, [compIndex]: compAnswer });
    };

    const commonTextareaClasses = "w-full p-3 border rounded-lg dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-gray-400 focus:ring-indigo-500 focus:border-transparent";

    switch(question.type) {
        case 'multiple-choice':
            answerInput = (
                <div className="space-y-2">
                    {question.options?.map((opt, i) => (
                        <label key={i} className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded cursor-pointer">
                            <input type="radio" name={`question-${index}`} value={String.fromCharCode(65+i)} onChange={e => onAnswerChange(index, e.target.value)} checked={answer === String.fromCharCode(65+i)} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                            <span className="dark:text-slate-200">{String.fromCharCode(65 + i)}. {opt}</span>
                        </label>
                    ))}
                </div>
            );
            break;
        case 'true-false':
            answerInput = (
                <div className="space-y-2">
                     <label className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded cursor-pointer">
                        <input type="radio" name={`question-${index}`} value="True" onChange={e => onAnswerChange(index, e.target.value)} checked={answer === 'True'} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                        <span className="dark:text-slate-200">True</span>
                    </label>
                     <label className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded cursor-pointer">
                        <input type="radio" name={`question-${index}`} value="False" onChange={e => onAnswerChange(index, e.target.value)} checked={answer === 'False'} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                        <span className="dark:text-slate-200">False</span>
                    </label>
                </div>
            );
            break;
        case 'short-answer':
            answerInput = <textarea className={commonTextareaClasses} rows={3} placeholder="Enter your answer" value={typeof answer === 'string' ? answer : ''} onChange={e => onAnswerChange(index, e.target.value)} />;
            break;
        case 'long-answer':
            answerInput = <textarea className={commonTextareaClasses} rows={6} placeholder="Write your detailed answer here" value={typeof answer === 'string' ? answer : ''} onChange={e => onAnswerChange(index, e.target.value)} />;
            break;
        case 'reading-comprehension':
            answerInput = (
                <div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4 dark:bg-blue-900/30 dark:border-blue-800">
                        <h5 className="font-semibold text-blue-800 mb-2 dark:text-blue-300">📖 Reading Passage</h5>
                        <p className="text-gray-700 whitespace-pre-wrap dark:text-slate-300">{question.passage}</p>
                    </div>
                    <h5 className="font-semibold text-gray-800 mb-2 dark:text-slate-200">Comprehension Questions:</h5>
                    <div className="space-y-4">
                    {(question.comprehensionQuestions || []).map((compQ, compIndex) => (
                        <div key={compIndex} className="bg-white p-3 rounded border dark:bg-slate-900 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{compIndex + 1}. {compQ.question}</label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">[{compQ.marks} marks]</span>
                            </div>
                            <textarea className={commonTextareaClasses} rows={2} placeholder="Enter your answer" value={(typeof answer === 'object' && answer[compIndex]) || ''} onChange={e => handleComprehensionAnswer(compIndex, e.target.value)} />
                        </div>
                    ))}
                    </div>
                </div>
            );
            break;
        default:
             answerInput = <p className="dark:text-red-400">Unsupported question type.</p>;
    }
    
    return (
        <div className="bg-gray-50 p-4 rounded-lg border dark:bg-slate-700/50 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-800 dark:text-slate-200">Question {index + 1}</h4>
                <span className="text-sm text-gray-600 dark:text-gray-400">[{question.marks > 0 ? `${question.marks} marks` : 'See sub-questions'}]</span>
            </div>
            <p className="text-gray-700 mb-3 whitespace-pre-wrap dark:text-slate-300">{question.text}</p>
            {answerInput}
        </div>
    );
};

export default TakeTestView;