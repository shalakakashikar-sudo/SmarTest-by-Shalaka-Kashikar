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

const MiniToolbar: React.FC<{ onFormat: (tag: 'b' | 'i' | 'u') => void }> = ({ onFormat }) => {
    return (
        <div className="flex space-x-1 mb-1">
            <button type="button" onClick={() => onFormat('b')} className="px-2 py-0.5 text-sm bg-gray-200 dark:bg-slate-600 rounded font-bold" aria-label="Bold">B</button>
            <button type="button" onClick={() => onFormat('i')} className="px-2 py-0.5 text-sm bg-gray-200 dark:bg-slate-600 rounded italic" aria-label="Italic">I</button>
            <button type="button" onClick={() => onFormat('u')} className="px-2 py-0.5 text-sm bg-gray-200 dark:bg-slate-600 rounded underline" aria-label="Underline">U</button>
        </div>
    );
};

const TakeTestView: React.FC<TakeTestProps> = ({ test, onSubmitTest, navigateTo }) => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  
  // Define a unique key for localStorage based on user and test ID.
  const autoSaveKey = `smartest-autosave-${profile?.id}-${test.id}`;

  const [answers, setAnswers] = useState<(string | Record<number, string>)[]>(() => {
    // Attempt to load saved answers from localStorage on initial render.
    try {
      const savedAnswers = localStorage.getItem(autoSaveKey);
      if (savedAnswers) {
        const parsedAnswers = JSON.parse(savedAnswers);
        if (Array.isArray(parsedAnswers) && parsedAnswers.length === test.questions.length) {
          return parsedAnswers;
        }
      }
    } catch (error) {
      console.error('Failed to load answers from localStorage:', error);
    }
    // If no saved answers, initialize with an empty array.
    return Array(test.questions.length).fill('');
  });

  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(test.timer ? test.timer * 60 : null);
  const originalTitle = useRef(document.title);
  
  // Create a ref to hold the latest answers for the auto-save interval.
  const answersRef = useRef(answers);
  answersRef.current = answers; // Keep the ref updated on every render.
  
  const hasShownToast = useRef(false);

  // Auto-save logic using useEffect and setInterval.
  useEffect(() => {
    const autoSaveInterval = 5000; // Save every 5 seconds.

    // Check on mount if we restored data, and show a toast if we haven't already.
    if (!hasShownToast.current) {
        try {
            const savedAnswers = localStorage.getItem(autoSaveKey);
            if (savedAnswers) {
                addToast('Your previous progress has been restored.', 'info');
                hasShownToast.current = true;
            }
        } catch {}
    }

    const timerId = setInterval(() => {
      try {
        localStorage.setItem(autoSaveKey, JSON.stringify(answersRef.current));
        if (!hasShownToast.current) {
          addToast('Your progress is being saved automatically.', 'info');
          hasShownToast.current = true;
        }
      } catch (error) {
        console.error('Failed to auto-save answers:', error);
        // Avoid spamming toasts on interval failures.
      }
    }, autoSaveInterval);

    // Cleanup interval on component unmount.
    return () => clearInterval(timerId);
  }, [autoSaveKey, addToast]);
  
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
      
      // Clear the auto-saved data from localStorage after successful submission.
      localStorage.removeItem(autoSaveKey);

      addToast('Evaluation complete!', 'success');
      onSubmitTest(result);
    } catch (error: any) {
      addToast(`Error submitting test: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [test, answers, profile, addToast, onSubmitTest, autoSaveKey]);
  
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
    const answerTextareaRef = useRef<HTMLTextAreaElement>(null);
    const compAnswerRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

    const handleFormat = (
        ref: React.RefObject<HTMLTextAreaElement>,
        callback: (newValue: string) => void
    ) => (tag: 'b' | 'i' | 'u') => {
        const textarea = ref.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) return;
        const value = textarea.value;
        const selectedText = value.substring(start, end);
        const newValue = `${value.substring(0, start)}<${tag}>${selectedText}</${tag}>${value.substring(end)}`;
        callback(newValue);
    };

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
            answerInput = (
                <>
                    <MiniToolbar onFormat={handleFormat(answerTextareaRef, (newValue) => onAnswerChange(index, newValue))} />
                    <textarea ref={answerTextareaRef} className={commonTextareaClasses} rows={3} placeholder="Enter your answer" value={typeof answer === 'string' ? answer : ''} onChange={e => onAnswerChange(index, e.target.value)} />
                </>
            );
            break;
        case 'long-answer':
            answerInput = (
                <>
                    <MiniToolbar onFormat={handleFormat(answerTextareaRef, (newValue) => onAnswerChange(index, newValue))} />
                    <textarea ref={answerTextareaRef} className={commonTextareaClasses} rows={6} placeholder="Write your detailed answer here" value={typeof answer === 'string' ? answer : ''} onChange={e => onAnswerChange(index, e.target.value)} />
                </>
            );
            break;
        case 'reading-comprehension':
            answerInput = (
                <div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4 dark:bg-blue-900/30 dark:border-blue-800">
                        <h5 className="font-semibold text-blue-800 mb-2 dark:text-blue-300">📖 Reading Passage</h5>
                        <div className="text-gray-700 whitespace-pre-wrap dark:text-slate-300" dangerouslySetInnerHTML={{ __html: question.passage || '' }} />
                    </div>
                    <h5 className="font-semibold text-gray-800 mb-2 dark:text-slate-200">Comprehension Questions:</h5>
                    <div className="space-y-4">
                    {(question.comprehensionQuestions || []).map((compQ, compIndex) => (
                        <div key={compIndex} className="bg-white p-3 rounded border dark:bg-slate-900 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{compIndex + 1}. {compQ.question}</label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">[{compQ.marks} marks]</span>
                            </div>
                            <MiniToolbar onFormat={handleFormat({ current: compAnswerRefs.current[compIndex] }, (newValue) => handleComprehensionAnswer(compIndex, newValue))} />
                            <textarea 
                                ref={el => { compAnswerRefs.current[compIndex] = el }} 
                                className={commonTextareaClasses} 
                                rows={2} 
                                placeholder="Enter your answer" 
                                value={(typeof answer === 'object' && answer[compIndex]) || ''} 
                                onChange={e => handleComprehensionAnswer(compIndex, e.target.value)} 
                            />
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
            <div className="text-gray-700 mb-3 whitespace-pre-wrap dark:text-slate-300" dangerouslySetInnerHTML={{ __html: question.text }} />
            
            {(question.media?.image || question.media?.video || question.media?.audio) && (
                <div className="my-4 p-2 border rounded-lg dark:border-slate-600">
                    {question.media.image && <img src={question.media.image} alt="Question media" className="max-w-full h-auto rounded-md mx-auto" />}
                    {question.media.video && <video src={question.media.video} controls className="max-w-full h-auto rounded-md mx-auto" />}
                    {question.media.audio && <audio src={question.media.audio} controls className="w-full" />}
                </div>
            )}

            {answerInput}
        </div>
    );
};

export default TakeTestView;