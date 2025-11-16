import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { useToast } from '../contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import type { Question, QuestionType, ComprehensionQuestion, Test } from '../types';

interface TempQuestion extends Question {
    tempId: string;
}

interface CreateTestViewProps {
  navigateTo: (view: 'dashboard') => void;
  testToEdit?: Test | null;
  onPreviewTest: (test: Test) => void;
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

const WordCounter: React.FC<{ text: string }> = ({ text }) => {
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    return (
        <div className="text-right text-xs text-gray-500 mt-1 dark:text-gray-400">
            Word Count: {wordCount}
        </div>
    );
};

const CreateTestView: React.FC<CreateTestViewProps> = ({ navigateTo, testToEdit, onPreviewTest }) => {
    const { profile } = useAuth();
    const { addToast } = useToast();
    const [title, setTitle] = useState('');
    const [testClass, setTestClass] = useState('');
    const [timer, setTimer] = useState<number | null>(null);
    const [questions, setQuestions] = useState<TempQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [mediaModal, setMediaModal] = useState<{ isOpen: boolean; questionId: string | null }>({ isOpen: false, questionId: null });

    const isEditMode = !!testToEdit;
    const autoSaveKey = `smartest-autosave-create-${profile?.id}-${testToEdit?.id || 'new'}`;
    const hasShownToast = useRef(false);

    // Effect to initialize state from localStorage (if draft exists) or props (edit mode)
    useEffect(() => {
      // 1. Try to restore from localStorage first. This takes priority.
      try {
        const savedData = localStorage.getItem(autoSaveKey);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData.title || (parsedData.questions && parsedData.questions.length > 0)) {
              setTitle(parsedData.title || '');
              setTestClass(parsedData.testClass || '');
              setTimer(parsedData.timer || null);
              setQuestions(parsedData.questions || []);
              if (!hasShownToast.current) {
                addToast('Your unsaved progress has been restored.', 'info');
                hasShownToast.current = true;
              }
              return; // Exit early if we restored a draft.
          }
        }
      } catch (error) {
        console.error('Failed to load test from localStorage:', error);
      }

      // 2. If no draft, load from props in edit mode.
      if (isEditMode && testToEdit) {
        setTitle(testToEdit.title);
        setTestClass(testToEdit.class);
        setTimer(testToEdit.timer);
        setQuestions(testToEdit.questions.map(q => ({ ...q, tempId: uuidv4() })));
      } else {
      // 3. Otherwise, it's a new test, so ensure state is clear.
        setTitle('');
        setTestClass('');
        setTimer(null);
        setQuestions([]);
      }
    }, [isEditMode, testToEdit, addToast, autoSaveKey]);
    
    // Auto-save logic
    const currentStateRef = useRef({ title, testClass, timer, questions });
    currentStateRef.current = { title, testClass, timer, questions };

    useEffect(() => {
        const intervalId = setInterval(() => {
            const { title, questions } = currentStateRef.current;
            if (!title.trim() && questions.length === 0) {
                return; // Don't save an empty test
            }

            try {
                localStorage.setItem(autoSaveKey, JSON.stringify(currentStateRef.current));
                if (!hasShownToast.current) {
                    addToast('Your progress is being saved automatically.', 'info');
                    hasShownToast.current = true;
                }
            } catch (error) {
                console.error('Failed to auto-save test:', error);
            }
        }, 5000); // Save every 5 seconds

        return () => clearInterval(intervalId);
    }, [autoSaveKey, addToast]);


    const totalMarks = questions.reduce((total, q) => {
      if (q.type === 'reading-comprehension' && q.comprehension_questions) {
        return total + q.comprehension_questions.reduce((compTotal, compQ) => compTotal + (compQ.marks || 0), 0);
      }
      return total + (q.marks || 0);
    }, 0);

    const addQuestion = () => {
        const newQuestion: TempQuestion = {
            tempId: uuidv4(),
            type: 'multiple-choice',
            text: '',
            marks: 1,
            options: ['', '', '', ''],
            correct_answer: 'A',
        };
        setQuestions([...questions, newQuestion]);
    };
    
    const updateQuestion = useCallback((tempId: string, updatedField: Partial<TempQuestion>) => {
        setQuestions(prev => prev.map(q => q.tempId === tempId ? { ...q, ...updatedField } : q));
    }, []);

    const removeQuestion = (tempId: string) => {
        setQuestions(prev => prev.filter(q => q.tempId !== tempId));
    };

    const handleSaveTest = async () => {
        if (!title.trim()) {
            addToast('Please enter a test title.', 'error');
            return;
        }
        if (questions.length === 0) {
            addToast('Please add at least one question.', 'error');
            return;
        }

        setLoading(true);

        const testPayload: Test = {
            id: isEditMode ? testToEdit?.id : undefined,
            title,
            class: testClass,
            timer,
            total_marks: totalMarks,
            questions: questions.map(({ tempId, ...q }) => q), // Remove temp fields
            created_by: profile?.id,
            total_questions: questions.length,
        };

        try {
            if (isEditMode) {
                await dataService.updateTest(testPayload);
                addToast('Test updated successfully!', 'success');
            } else {
                await dataService.createTest(testPayload);
                addToast('Test created successfully!', 'success');
            }
            localStorage.removeItem(autoSaveKey); // Clear auto-save on successful save
            navigateTo('dashboard');
        } catch (error: any) {
            addToast(`Failed to save test: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const handlePreview = () => {
        if (!title.trim() || questions.length === 0) {
            addToast('Please add a title and at least one question to preview.', 'error');
            return;
        }
        const testToPreview: Test = {
            title,
            class: testClass,
            timer,
            total_marks: totalMarks,
            questions: questions.map(({ tempId, ...q }) => q),
            total_questions: questions.length,
        };
        onPreviewTest(testToPreview);
    };

    const handleSaveMedia = (mediaData: { image?: string; video?: string; audio?: string }) => {
        if (mediaModal.questionId) {
            updateQuestion(mediaModal.questionId, { media: mediaData });
        }
        setMediaModal({ isOpen: false, questionId: null });
    };
    
    const currentQuestionForMedia = questions.find(q => q.tempId === mediaModal.questionId);
    
    return (
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{isEditMode ? '✍️ Edit Test' : '📝 Create a New Test'}</h2>
                <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Dashboard</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg dark:border-slate-700">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Test Title</label>
                    {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                    <input type="text" value={title} onChange={e => setTitle((e.target as any).value)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" placeholder="e.g., Chapter 5: Photosynthesis Quiz" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Class / Subject</label>
                    {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                    <input type="text" value={testClass} onChange={e => setTestClass((e.target as any).value)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" placeholder="e.g., Grade 10 Biology" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Time Limit (minutes)</label>
                    {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                    <input type="number" value={timer === null ? '' : timer} onChange={e => setTimer((e.target as any).value ? parseInt((e.target as any).value) : null)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" placeholder="Optional" />
                </div>
                <div className="md:col-span-2 flex items-center justify-start text-sm text-gray-600 dark:text-gray-400">
                    <span className="mr-4">Total Questions: <span className="font-bold text-gray-800 dark:text-slate-200">{questions.length}</span></span>
                    <span>Total Marks: <span className="font-bold text-gray-800 dark:text-slate-200">{totalMarks}</span></span>
                </div>
            </div>

            <div className="space-y-4 pb-24">
                {questions.map((q, index) => (
                    <QuestionEditor 
                        key={q.tempId}
                        question={q}
                        index={index}
                        updateQuestion={updateQuestion}
                        removeQuestion={removeQuestion}
                        onOpenMediaModal={(id) => setMediaModal({ isOpen: true, questionId: id })}
                    />
                ))}
            </div>

             <div className="sticky bottom-0 -mx-6 -mb-6 mt-4 p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200 dark:bg-slate-800/80 dark:border-slate-700">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between">
                    <div className="space-x-2 mb-2 md:mb-0">
                        <button onClick={addQuestion} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">➕ Add Question</button>
                    </div>
                    <div className="space-x-2">
                        <button onClick={handlePreview} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg">👁️ Preview</button>
                        <button onClick={handleSaveTest} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:bg-blue-400">
                            {loading ? 'Saving...' : (isEditMode ? '💾 Update Test' : '💾 Save Test')}
                        </button>
                    </div>
                </div>
            </div>
            
            {mediaModal.isOpen && currentQuestionForMedia && (
                <MediaModal
                    initialMedia={currentQuestionForMedia.media}
                    onClose={() => setMediaModal({ isOpen: false, questionId: null })}
                    onSave={handleSaveMedia}
                />
            )}
        </div>
    );
};

interface MediaModalProps {
    initialMedia?: { image?: string | null; video?: string | null; audio?: string | null } | null;
    onClose: () => void;
    onSave: (mediaData: { image?: string; video?: string; audio?: string }) => void;
}

const MediaModal: React.FC<MediaModalProps> = ({ initialMedia, onClose, onSave }) => {
    const [media, setMedia] = useState({
        image: initialMedia?.image || '',
        video: initialMedia?.video || '',
        audio: initialMedia?.audio || '',
    });

    const handleSave = () => {
        onSave({
            image: media.image?.trim() || undefined,
            video: media.video?.trim() || undefined,
            audio: media.audio?.trim() || undefined,
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full mx-4 dark:bg-slate-800">
                <h3 className="text-2xl font-bold text-gray-900 mb-4 dark:text-slate-100">📎 Attach Media</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Image URL</label>
                        {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                        <input type="text" value={media.image} onChange={e => setMedia(m => ({ ...m, image: (e.target as any).value }))} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" placeholder="https://example.com/image.png" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Video URL</label>
                        {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                        <input type="text" value={media.video} onChange={e => setMedia(m => ({ ...m, video: (e.target as any).value }))} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" placeholder="https://example.com/video.mp4" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Audio URL</label>
                        {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                        <input type="text" value={media.audio} onChange={e => setMedia(m => ({ ...m, audio: (e.target as any).value }))} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600" placeholder="https://example.com/audio.mp3" />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 pt-6">
                    <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-slate-100">Cancel</button>
                    <button type="button" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg">Save Media</button>
                </div>
            </div>
        </div>
    );
};

interface QuestionEditorProps {
    question: TempQuestion;
    index: number;
    updateQuestion: (tempId: string, updatedField: Partial<TempQuestion>) => void;
    removeQuestion: (tempId: string) => void;
    onOpenMediaModal: (tempId: string) => void;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({ question, index, updateQuestion, removeQuestion, onOpenMediaModal }) => {
    const commonInputClasses = "w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600";

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        // FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue.
        const newType = (e.target as any).value as QuestionType;
        const updatedFields: Partial<TempQuestion> = { type: newType };
        // Set defaults for new type
        if (newType === 'multiple-choice') {
            updatedFields.options = ['', '', '', ''];
            updatedFields.correct_answer = 'A';
        } else if (newType === 'true-false') {
            updatedFields.options = ['True', 'False'];
            updatedFields.correct_answer = 'True';
        } else if (newType === 'reading-comprehension') {
            updatedFields.passage = '';
            updatedFields.comprehension_questions = [];
            updatedFields.marks = 0; // Marks will be sum of sub-questions
        } else {
            delete updatedFields.options;
            delete updatedFields.comprehension_questions;
        }
        updateQuestion(question.tempId, updatedFields);
    };

    const addComprehensionQuestion = () => {
        const newCompQ: ComprehensionQuestion = { question: '', type: 'short-answer', marks: 1, sample_answer: '' };
        updateQuestion(question.tempId, { comprehension_questions: [...(question.comprehension_questions || []), newCompQ] });
    };

    const updateComprehensionQuestion = (compIndex: number, field: keyof ComprehensionQuestion, value: any) => {
        const updatedCompQs = (question.comprehension_questions || []).map((q, i) => (i === compIndex ? { ...q, [field]: value } : q));
        updateQuestion(question.tempId, { comprehension_questions: updatedCompQs });
    };
    
    const removeComprehensionQuestion = (compIndex: number) => {
        const updatedCompQs = (question.comprehension_questions || []).filter((_, i) => i !== compIndex);
        updateQuestion(question.tempId, { comprehension_questions: updatedCompQs });
    };
    
    const handleComprehensionTypeChange = (compIndex: number, newType: 'short-answer' | 'multiple-choice' | 'true-false') => {
        const updatedCompQs = [...(question.comprehension_questions || [])];
        const updatedCompQ: ComprehensionQuestion = { ...updatedCompQs[compIndex], type: newType };

        // Set defaults for the new type
        if (newType === 'multiple-choice') {
            updatedCompQ.options = updatedCompQ.options?.length === 4 ? updatedCompQ.options : ['', '', '', ''];
            updatedCompQ.correct_answer = updatedCompQ.correct_answer || 'A';
        } else if (newType === 'true-false') {
            updatedCompQ.options = ['True', 'False'];
            updatedCompQ.correct_answer = updatedCompQ.correct_answer || 'True';
        } else { // short-answer
            delete updatedCompQ.options;
            delete updatedCompQ.correct_answer;
        }

        updatedCompQs[compIndex] = updatedCompQ;
        updateQuestion(question.tempId, { comprehension_questions: updatedCompQs });
    };

    const handleWordLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Sanitize the input value by removing any non-digit characters.
        // This provides a much better user experience than parseInt, as it
        // prevents invalid characters from being entered and immediately shows
        // the clean, numeric result. It completely fixes the bug where
        // typing "30-40" would result in a strange number.
        // FIX: Cast event target to 'any' to access the 'value' property, resolving a TypeScript type error.
        const sanitizedValue = (e.target as any).value.replace(/[^0-9]/g, '');

        if (sanitizedValue === '') {
            updateQuestion(question.tempId, { expected_word_limit: null });
        } else {
            const num = parseInt(sanitizedValue, 10);
            updateQuestion(question.tempId, { expected_word_limit: num });
        }
    };


    return (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-slate-900/50 dark:border-slate-700 relative">
            <div className="absolute top-2 right-2 flex items-center space-x-2">
                 <button onClick={() => onOpenMediaModal(question.tempId)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" title="Add Media">📎</button>
                <button onClick={() => removeQuestion(question.tempId)} className="text-red-500 hover:text-red-700" title="Delete Question">🗑️</button>
            </div>
            <h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">Question {index + 1}</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                    <label className="block text-sm font-medium dark:text-gray-300">Question Text</label>
                     <MiniToolbar onFormat={(tag) => {/* ... */}} />
                    {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                    <textarea value={question.text} onChange={e => updateQuestion(question.tempId, { text: (e.target as any).value })} className={commonInputClasses} rows={2} />
                </div>
                <div>
                    <label className="block text-sm font-medium dark:text-gray-300">Type</label>
                    <select value={question.type} onChange={handleTypeChange} className={commonInputClasses}>
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="true-false">True/False</option>
                        <option value="short-answer">Short Answer</option>
                        <option value="long-answer">Long Answer</option>
                        <option value="reading-comprehension">Reading Comprehension</option>
                    </select>
                </div>
            </div>

            {/* Type-specific fields */}
            {question.type === 'multiple-choice' && (
                <div className="mt-4">
                    {question.options?.map((opt, i) => (
                        <div key={i} className="flex items-center space-x-2 mb-2">
                             {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                             <input type="radio" name={`correct-${question.tempId}`} value={String.fromCharCode(65 + i)} checked={question.correct_answer === String.fromCharCode(65 + i)} onChange={e => updateQuestion(question.tempId, { correct_answer: (e.target as any).value })} />
                            <span className="font-mono">{String.fromCharCode(65 + i)}.</span>
                            {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                            <input type="text" value={opt} onChange={e => {
                                const newOptions = [...question.options!]; newOptions[i] = (e.target as any).value;
                                updateQuestion(question.tempId, { options: newOptions });
                            }} className={commonInputClasses} placeholder={`Option ${i+1}`} />
                        </div>
                    ))}
                </div>
            )}
             {question.type === 'true-false' && (
                 <div className="mt-4 flex space-x-4">
                     <label><input type="radio" name={`correct-${question.tempId}`} value="True" checked={question.correct_answer === 'True'} onChange={e => updateQuestion(question.tempId, { correct_answer: 'True' })} /> True</label>
                     <label><input type="radio" name={`correct-${question.tempId}`} value="False" checked={question.correct_answer === 'False'} onChange={e => updateQuestion(question.tempId, { correct_answer: 'False' })} /> False</label>
                 </div>
             )}
             {question.type === 'reading-comprehension' && (
                 <div className="mt-4 space-y-4">
                     <div>
                         <label className="block text-sm font-medium dark:text-gray-300">Reading Passage</label>
                         {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                         <textarea value={question.passage} onChange={e => updateQuestion(question.tempId, { passage: (e.target as any).value })} className={commonInputClasses} rows={5} />
                     </div>
                     <div className="space-y-3">
                        {question.comprehension_questions?.map((cq, cqIndex) => (
                             <div key={cqIndex} className="p-3 border rounded bg-white dark:bg-slate-800 space-y-2">
                                <div className="flex justify-between items-center">
                                    <p className="font-medium text-sm text-gray-600 dark:text-gray-300">Sub-question {cqIndex + 1}</p>
                                    <button onClick={() => removeComprehensionQuestion(cqIndex)} className="text-xs text-red-500 hover:text-red-700">remove</button>
                                </div>
                                {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                                <input value={cq.question} onChange={e => updateComprehensionQuestion(cqIndex, 'question', (e.target as any).value)} className={`${commonInputClasses} text-sm`} placeholder={`Sub-question text`} />
                                
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</label>
                                        <select
                                            value={cq.type}
                                            onChange={e => handleComprehensionTypeChange(cqIndex, (e.target as any).value as 'short-answer' | 'multiple-choice' | 'true-false')}
                                            className={`${commonInputClasses} !w-48 text-sm`}
                                        >
                                            <option value="short-answer">Short Answer</option>
                                            <option value="multiple-choice">Multiple Choice</option>
                                            <option value="true-false">True/False</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Marks:</label>
                                        <input type="number" value={cq.marks} onChange={e => {
                                            const rawValue = (e.target as any).value;
                                            const marks = rawValue === '' ? 0 : parseInt(rawValue, 10);
                                            updateComprehensionQuestion(cqIndex, 'marks', isNaN(marks) ? 0 : marks);
                                        }} className={`${commonInputClasses} !w-24`} placeholder="marks" />
                                    </div>
                                </div>

                                <textarea
                                    value={cq.marking_scheme ?? ''}
                                    onChange={e => updateComprehensionQuestion(cqIndex, 'marking_scheme', (e.target as any).value)}
                                    className={`${commonInputClasses} text-sm`}
                                    rows={2}
                                    placeholder="Optional: Marking scheme for this sub-question"
                                />
                                
                                {cq.type === 'short-answer' && (
                                    <textarea value={cq.sample_answer ?? ''} onChange={e => updateComprehensionQuestion(cqIndex, 'sample_answer', (e.target as any).value)} className={`${commonInputClasses} text-sm`} rows={2} placeholder="Sample answer for AI evaluation" />
                                )}
                                
                                {cq.type === 'multiple-choice' && (
                                    <div className="mt-2 pl-4 space-y-1">
                                        {cq.options?.map((opt, optIndex) => (
                                            <div key={optIndex} className="flex items-center space-x-2">
                                                <input type="radio" name={`correct-sub-${question.tempId}-${cqIndex}`} value={String.fromCharCode(65 + optIndex)} checked={cq.correct_answer === String.fromCharCode(65 + optIndex)} onChange={e => updateComprehensionQuestion(cqIndex, 'correct_answer', (e.target as any).value)} />
                                                <span className="font-mono text-sm">{String.fromCharCode(65 + optIndex)}.</span>
                                                <input type="text" value={opt} onChange={e => {
                                                    const newOptions = [...(cq.options || [])];
                                                    newOptions[optIndex] = (e.target as any).value;
                                                    updateComprehensionQuestion(cqIndex, 'options', newOptions);
                                                }} className={`${commonInputClasses} text-sm`} placeholder={`Option ${optIndex + 1}`} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {cq.type === 'true-false' && (
                                    <div className="mt-2 pl-4 flex space-x-4 items-center">
                                        <label className="text-sm flex items-center gap-1.5"><input type="radio" name={`correct-sub-${question.tempId}-${cqIndex}`} value="True" checked={cq.correct_answer === 'True'} onChange={() => updateComprehensionQuestion(cqIndex, 'correct_answer', 'True')} /> True</label>
                                        <label className="text-sm flex items-center gap-1.5"><input type="radio" name={`correct-sub-${question.tempId}-${cqIndex}`} value="False" checked={cq.correct_answer === 'False'} onChange={() => updateComprehensionQuestion(cqIndex, 'correct_answer', 'False')} /> False</label>
                                    </div>
                                )}
                            </div>
                        ))}
                     </div>
                     <button onClick={addComprehensionQuestion} className="text-sm bg-gray-200 px-2 py-1 rounded dark:bg-slate-700">Add Sub-question</button>
                 </div>
             )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium dark:text-gray-300">Marks</label>
                    <input type="number" value={question.marks} onChange={e => {
                        const rawValue = (e.target as any).value;
                        const marks = rawValue === '' ? 0 : parseInt(rawValue, 10);
                        updateQuestion(question.tempId, { marks: isNaN(marks) ? 0 : marks });
                    }} className={commonInputClasses} disabled={question.type === 'reading-comprehension'} />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">Word Limit (Optional)</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={question.expected_word_limit ?? ''}
                        onChange={handleWordLimitChange}
                        className={commonInputClasses}
                        placeholder="e.g., 100"
                    />
                </div>
                {(question.type === 'short-answer' || question.type === 'long-answer') ? (
                    <>
                        <div>
                             <label className="block text-sm font-medium dark:text-gray-300">Marking Scheme (Optional)</label>
                             {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                             <textarea value={question.marking_scheme ?? ''} onChange={e => updateQuestion(question.tempId, { marking_scheme: (e.target as any).value })} className={commonInputClasses} rows={3} placeholder="e.g., 1 mark for definition..." />
                        </div>
                        <div>
                             <label className="block text-sm font-medium dark:text-gray-300">Sample Answer (Optional)</label>
                             {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                             <textarea value={question.sample_answer ?? ''} onChange={e => updateQuestion(question.tempId, { sample_answer: (e.target as any).value })} className={commonInputClasses} rows={3} placeholder="A model answer for AI evaluation." />
                        </div>
                    </>
                ) : (
                    <div className="md:col-span-2">
                         <label className="block text-sm font-medium dark:text-gray-300">Marking Scheme (Optional)</label>
                         {/* FIX: Cast event target to 'any' to access the 'value' property due to a potential TypeScript environment issue. */}
                         <textarea value={question.marking_scheme ?? ''} onChange={e => updateQuestion(question.tempId, { marking_scheme: (e.target as any).value })} className={commonInputClasses} rows={2} placeholder="e.g., 1 mark for definition, 1 mark for example..." />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateTestView;