
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

const WordCounter: React.FC<{ text: string; limit?: number | null }> = ({ text, limit }) => {
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const isOverLimit = limit && wordCount > limit;
    return (
        <div className={`text-right text-xs mt-1 ${isOverLimit ? 'text-red-500 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
            Word Count: {wordCount}{limit ? ` / ${limit}` : ''}
        </div>
    );
};

const TakeTestView: React.FC<TakeTestProps> = ({ test, onSubmitTest, navigateTo }) => {
  const { profile } = useAuth();
  const { addToast } = useToast();
  
  const autoSaveKey = `smartest-autosave-test-${profile?.id}-${test.id}`;

  const [answers, setAnswers] = useState<(string | Record<number, string>)[]>(() => Array(test.questions.length).fill(''));
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(test.timer ? test.timer * 60 : null);
  const [isLoading, setIsLoading] = useState(false);
  // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
  const originalTitle = useRef((window as any).document.title);
  
  const stateRef = useRef({ answers, endTime });
  stateRef.current = { answers, endTime };

  const hasShownToast = useRef(false);

  // Initialize state from localStorage or set up new test session
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(autoSaveKey);
      if (savedData) {
        const { savedAnswers, savedEndTime } = JSON.parse(savedData);
        if (Array.isArray(savedAnswers) && savedAnswers.length === test.questions.length && typeof savedEndTime === 'number') {
          setAnswers(savedAnswers);
          setEndTime(savedEndTime);
          const remaining = Math.max(0, Math.floor((savedEndTime - Date.now()) / 1000));
          setTimeRemaining(remaining);
          
          if (!hasShownToast.current) {
            addToast('Your previous progress has been restored.', 'info');
            hasShownToast.current = true;
          }
          return; // Exit if we restored a draft
        }
      }
    } catch (error) {
      console.error('Failed to load test draft from localStorage:', error);
    }
    
    // If no valid draft, set up a new session
    if (test.timer) {
      const newEndTime = Date.now() + test.timer * 60 * 1000;
      setEndTime(newEndTime);
      setTimeRemaining(test.timer * 60);
    }
  }, [autoSaveKey, test.questions.length, test.timer, addToast]);

  // Auto-save logic
  useEffect(() => {
    if (endTime === null && !test.timer) return; // Don't save for untimed tests without a start time
    
    const intervalId = setInterval(() => {
      try {
        const { answers, endTime } = stateRef.current;
        localStorage.setItem(autoSaveKey, JSON.stringify({ savedAnswers: answers, savedEndTime: endTime }));
        if (!hasShownToast.current) {
          addToast('Your progress is being saved automatically.', 'info');
          hasShownToast.current = true;
        }
      } catch (error) {
        console.error('Failed to auto-save test answers:', error);
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(intervalId);
  }, [autoSaveKey, endTime, test.timer, addToast]);
  
  // Anti-cheat logic
  useEffect(() => {
    const handleContextmenu = (e: MouseEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleVisibilityChange = () => {
        // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
        if ((window as any).document.hidden) addToast('Tab switching detected. Please remain on the test page.', 'warning');
    };

    // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
    (window as any).document.addEventListener('contextmenu', handleContextmenu);
    // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
    (window as any).document.addEventListener('copy', handleCopy);
    // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
    (window as any).document.addEventListener('visibilitychange', handleVisibilityChange);
    // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
    (window as any).document.body.classList.add('select-none');
    addToast('Anti-cheat protection is active.', 'info');
    
    return () => {
      // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
      (window as any).document.removeEventListener('contextmenu', handleContextmenu);
      // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
      (window as any).document.removeEventListener('copy', handleCopy);
      // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
      (window as any).document.removeEventListener('visibilitychange', handleVisibilityChange);
      // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
      (window as any).document.body.classList.remove('select-none');
      // FIX: Cast `window` to `any` to resolve an error where the `document` property was not found on the `Window` type.
      (window as any).document.title = originalTitle.current;
    };
  }, [addToast]);

  const handleSubmit = useCallback(async () => {
    if (!profile) {
      addToast('Error: User not found.', 'error');
      return;
    }
    
    // FIX: Use ref to get the latest answers, making this callback stable
    // and preventing it from causing the timer effect to re-run on every keystroke.
    const currentAnswers = stateRef.current.answers;

    setIsLoading(true);
    addToast('Submitting your test for AI evaluation...', 'info');
    try {
      const evaluation = await aiService.evaluateTest(test.questions, currentAnswers);
      
      const result: TestResult = {
        test_id: test.id!,
        test_title: test.title,
        student_id: profile.id,
        student_name: profile.full_name,
        answers: currentAnswers,
        evaluation: evaluation,
      };

      await dataService.saveTestResult(result);
      
      localStorage.removeItem(autoSaveKey);

      addToast('Evaluation complete!', 'success');
      onSubmitTest(result);
    } catch (error: any) {
      addToast(`Error submitting test: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [test, profile, addToast, onSubmitTest, autoSaveKey]);
  
  // Timer logic
  useEffect(() => {
    if (endTime === null) return; // Do nothing if the test is not timed.

    const timerId = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timerId); // Stop the timer
        addToast('Time is up! Submitting your test automatically.', 'warning');
        handleSubmit(); // Call stable submit function
      }
    }, 1000);

    return () => clearInterval(timerId);
    // FIX: This effect now only depends on stable values, so it won't be
    // reset when the student types, fixing the pausing timer bug.
  }, [endTime, handleSubmit, addToast]);


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
        // FIX: Cast `textarea` to `any` to bypass TS errors for missing DOM properties.
        const start = (textarea as any).selectionStart;
        // FIX: Cast `textarea` to `any` to bypass TS errors for missing DOM properties.
        const end = (textarea as any).selectionEnd;
        if (start === end) return;
        // FIX: Cast `textarea` to `any` to bypass TS errors for missing DOM properties.
        const value = (textarea as any).value;
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
                            {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                            <input type="radio" name={`question-${index}`} value={String.fromCharCode(65+i)} onChange={e => onAnswerChange(index, (e.target as any).value)} checked={answer === String.fromCharCode(65+i)} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
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
                        {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                        <input type="radio" name={`question-${index}`} value="True" onChange={e => onAnswerChange(index, (e.target as any).value)} checked={answer === 'True'} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                        <span className="dark:text-slate-200">True</span>
                    </label>
                     <label className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-slate-600 rounded cursor-pointer">
                        {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                        <input type="radio" name={`question-${index}`} value="False" onChange={e => onAnswerChange(index, (e.target as any).value)} checked={answer === 'False'} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                        <span className="dark:text-slate-200">False</span>
                    </label>
                </div>
            );
            break;
        case 'short-answer':
            answerInput = (
                <>
                    <MiniToolbar onFormat={handleFormat(answerTextareaRef, (newValue) => onAnswerChange(index, newValue))} />
                    {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                    <textarea ref={answerTextareaRef} className={commonTextareaClasses} rows={3} placeholder="Enter your answer" value={typeof answer === 'string' ? answer : ''} onChange={e => onAnswerChange(index, (e.target as any).value)} />
                    <WordCounter text={typeof answer === 'string' ? answer : ''} limit={question.expectedWordLimit} />
                </>
            );
            break;
        case 'long-answer':
            answerInput = (
                <>
                    <MiniToolbar onFormat={handleFormat(answerTextareaRef, (newValue) => onAnswerChange(index, newValue))} />
                    {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                    <textarea ref={answerTextareaRef} className={commonTextareaClasses} rows={6} placeholder="Write your detailed answer here" value={typeof answer === 'string' ? answer : ''} onChange={e => onAnswerChange(index, (e.target as any).value)} />
                    <WordCounter text={typeof answer === 'string' ? answer : ''} limit={question.expectedWordLimit} />
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
                    {(question.comprehensionQuestions || []).map((compQ, compIndex) => {
                        const compAnswer = (typeof answer === 'object' && answer[compIndex]) || '';
                        let compAnswerInput;

                        if (compQ.type === 'multiple-choice') {
                            compAnswerInput = (
                                <div className="space-y-1 mt-2">
                                    {compQ.options?.map((opt, i) => (
                                        <label key={i} className="flex items-center space-x-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                            {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                                            <input type="radio" name={`question-${index}-${compIndex}`} value={String.fromCharCode(65 + i)} onChange={e => handleComprehensionAnswer(compIndex, (e.target as any).value)} checked={compAnswer === String.fromCharCode(65 + i)} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                                            <span className="dark:text-slate-300 text-sm">{String.fromCharCode(65 + i)}. {opt}</span>
                                        </label>
                                    ))}
                                </div>
                            );
                        } else if (compQ.type === 'true-false') {
                            compAnswerInput = (
                                <div className="space-y-1 mt-2">
                                    <label className="flex items-center space-x-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                        {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                                        <input type="radio" name={`question-${index}-${compIndex}`} value="True" onChange={e => handleComprehensionAnswer(compIndex, (e.target as any).value)} checked={compAnswer === 'True'} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                                        <span className="dark:text-slate-300 text-sm">True</span>
                                    </label>
                                    <label className="flex items-center space-x-2 p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                        {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                                        <input type="radio" name={`question-${index}-${compIndex}`} value="False" onChange={e => handleComprehensionAnswer(compIndex, (e.target as any).value)} checked={compAnswer === 'False'} className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400" />
                                        <span className="dark:text-slate-300 text-sm">False</span>
                                    </label>
                                </div>
                            );
                        } else { // short-answer
                            compAnswerInput = (
                                <>
                                    <MiniToolbar onFormat={handleFormat({ current: compAnswerRefs.current[compIndex] }, (newValue) => handleComprehensionAnswer(compIndex, newValue))} />
                                    <textarea
                                        ref={el => { compAnswerRefs.current[compIndex] = el }}
                                        className={`${commonTextareaClasses} text-sm`}
                                        rows={2}
                                        placeholder="Enter your answer"
                                        value={compAnswer}
                                        // FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue.
                                        onChange={e => handleComprehensionAnswer(compIndex, (e.target as any).value)}
                                    />
                                    <WordCounter text={compAnswer} />
                                </>
                            );
                        }
                        
                        return (
                            <div key={compIndex} className="bg-white p-3 rounded border dark:bg-slate-900 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{compIndex + 1}. {compQ.question}</label>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">[{compQ.marks} marks]</span>
                                </div>
                                {compAnswerInput}
                            </div>
                        );
                    })}
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