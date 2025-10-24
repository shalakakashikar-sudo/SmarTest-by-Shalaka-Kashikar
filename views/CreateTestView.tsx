import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { aiService } from '../services/aiService';
import { useToast } from '../contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import type { Question, QuestionType, ComprehensionQuestion, Test } from '../types';

interface TempQuestion extends Question {
    tempId: string;
    isRegenerating?: boolean;
}

interface CreateTestViewProps {
  navigateTo: (view: 'dashboard') => void;
  testToEdit?: Test | null;
}

const CreateTestView: React.FC<CreateTestViewProps> = ({ navigateTo, testToEdit }) => {
    const { profile } = useAuth();
    const { addToast } = useToast();
    const [title, setTitle] = useState('');
    const [testClass, setTestClass] = useState('');
    const [timer, setTimer] = useState<number | null>(null);
    const [questions, setQuestions] = useState<TempQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const isEditMode = !!testToEdit;

    useEffect(() => {
      if (isEditMode && testToEdit) {
        setTitle(testToEdit.title);
        setTestClass(testToEdit.class);
        setTimer(testToEdit.timer);
        setQuestions(testToEdit.questions.map(q => ({ ...q, tempId: uuidv4() })));
      }
    }, [isEditMode, testToEdit]);

    const totalMarks = questions.reduce((total, q) => {
      if (q.type === 'reading-comprehension' && q.comprehensionQuestions) {
        return total + q.comprehensionQuestions.reduce((compTotal, compQ) => compTotal + (compQ.marks || 0), 0);
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
            correctAnswer: 'A',
        };
        setQuestions([...questions, newQuestion]);
    };
    
    // FIX: Update the function signature to accept Partial<TempQuestion> to allow setting 'isRegenerating' state.
    const updateQuestion = useCallback((tempId: string, updatedField: Partial<TempQuestion>) => {
        setQuestions(prev => prev.map(q => q.tempId === tempId ? { ...q, ...updatedField } : q));
    }, []);

    const removeQuestion = (tempId: string) => {
        setQuestions(prev => prev.filter(q => q.tempId !== tempId));
    };

    const handleAiGenerate = async (params: {
        topic: string;
        numQuestions: number;
        questionTypes: QuestionType[];
        difficulty: string;
        isThinkingMode: boolean;
    }) => {
        setIsGenerating(true);
        addToast(params.isThinkingMode ? '🤖 Engaging Gemini Pro with Thinking Mode. This may take a moment...' : '⚡ Generating test with Gemini Flash...', 'info');
        try {
            const { title: generatedTitle, questions: generatedQuestions } = await aiService.generateTestWithAI(params);
            
            setTitle(prev => prev || generatedTitle);
            const newQuestions = generatedQuestions.map(q => ({...q, tempId: uuidv4()}));
            setQuestions(prev => [...prev, ...newQuestions]);

            addToast('AI has successfully generated the questions!', 'success');
            setIsAiModalOpen(false);
        } catch (error: any) {
            addToast(`AI generation failed: ${error.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRegenerateQuestion = async (tempId: string) => {
      const questionToRegen = questions.find(q => q.tempId === tempId);
      if (!questionToRegen) return;

      setQuestions(prev => prev.map(q => q.tempId === tempId ? { ...q, isRegenerating: true } : q));
      addToast('✨ Regenerating question with AI...', 'info');

      try {
          const { tempId: id, isRegenerating, ...questionData } = questionToRegen;
          const newQuestion = await aiService.regenerateQuestionWithAI(questionData);
          
          updateQuestion(tempId, { ...newQuestion, isRegenerating: false });
          addToast('Question regenerated successfully!', 'success');
      } catch (error: any) {
          addToast(`AI regeneration failed: ${error.message}`, 'error');
          setQuestions(prev => prev.map(q => q.tempId === tempId ? { ...q, isRegenerating: false } : q));
      }
    };
    
    const saveTest = async () => {
        if (!title.trim()) {
            addToast('Test title is required.', 'error');
            return;
        }
        if (questions.length === 0) {
            addToast('Please add at least one question.', 'error');
            return;
        }
        if (!profile) {
            addToast('You must be logged in to create a test.', 'error');
            return;
        }

        setLoading(true);
        const testToSave: Test = {
            id: isEditMode ? testToEdit.id : undefined,
            title,
            class: testClass,
            timer: timer,
            total_marks: totalMarks,
            questions: questions.map(({ tempId, isRegenerating, ...q }) => q), // remove temp properties
            created_by: profile.id,
            total_questions: questions.length
        };
        
        try {
            if (isEditMode) {
                await dataService.updateTest(testToSave);
                addToast('Test updated successfully!', 'success');
            } else {
                await dataService.createTest(testToSave);
                addToast('Test created successfully!', 'success');
            }
            navigateTo('dashboard');
        } catch (error: any) {
            addToast(`Failed to save test: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{isEditMode ? '✍️ Edit Test' : '📝 Create Test'}</h2>
                <button onClick={() => navigateTo('dashboard')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">← Back to Dashboard</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div><label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Test Title</label> <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter test title" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Class</label> <input type="text" value={testClass} onChange={e => setTestClass(e.target.value)} placeholder="Enter class/grade" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Timer (minutes)</label> <input type="number" value={timer ?? ''} onChange={e => setTimer(e.target.value ? parseInt(e.target.value) : null)} placeholder="Enter time limit" min="1" max="300" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Total Marks</label> <input type="number" value={totalMarks} readOnly className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400" placeholder="Auto-calculated" /></div>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Questions</h3>
                 <div className="flex space-x-2">
                    <button onClick={() => setIsAiModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        <span>Generate with AI</span>
                    </button>
                    <button onClick={addQuestion} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">+ Add Question</button>
                </div>
              </div>
              <div id="questions-container" className="space-y-4">
                {questions.map((q, index) => (
                    <QuestionEditor key={q.tempId} question={q} index={index} updateQuestion={updateQuestion} removeQuestion={removeQuestion} onRegenerate={handleRegenerateQuestion} />
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
                <button onClick={saveTest} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg disabled:bg-green-400">
                  {loading ? 'Saving...' : (isEditMode ? 'Update Test' : 'Save Test')}
                </button>
            </div>
            {isAiModalOpen && (
                <AIGenerationModal
                    onClose={() => setIsAiModalOpen(false)}
                    onGenerate={handleAiGenerate}
                    isLoading={isGenerating}
                />
            )}
        </div>
    );
};

// --- AI Generation Modal Component ---
const AIGenerationModal: React.FC<{
    onClose: () => void;
    onGenerate: (params: { topic: string; numQuestions: number; questionTypes: QuestionType[], difficulty: string, isThinkingMode: boolean }) => void;
    isLoading: boolean;
}> = ({ onClose, onGenerate, isLoading }) => {
    const [topic, setTopic] = useState('');
    const [numQuestions, setNumQuestions] = useState(5);
    const [difficulty, setDifficulty] = useState('Medium');
    const [isThinkingMode, setIsThinkingMode] = useState(false);
    const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(['multiple-choice']);
    const { addToast } = useToast();
    
    const allQuestionTypes: { id: QuestionType, label: string }[] = [
        { id: 'multiple-choice', label: 'Multiple Choice' },
        { id: 'true-false', label: 'True/False' },
        { id: 'short-answer', label: 'Short Answer' },
        { id: 'long-answer', label: 'Long Answer' },
        { id: 'reading-comprehension', label: 'Reading Comprehension' },
    ];

    const handleTypeToggle = (type: QuestionType) => {
        setQuestionTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleSubmit = () => {
        if (!topic.trim()) {
            addToast('Please enter a topic.', 'error');
            return;
        }
        if (questionTypes.length === 0) {
            addToast('Please select at least one question type.', 'error');
            return;
        }
        onGenerate({ topic, numQuestions, questionTypes, difficulty, isThinkingMode });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-2xl max-w-2xl w-full mx-4 dark:bg-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100">✨ AI Test Generation</h3>
                   <button onClick={onClose} disabled={isLoading} className="text-gray-500 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
                </div>
                <p className="text-gray-600 mb-6 dark:text-gray-400">Describe the test you want to create. Gemini will generate the questions for you.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Topic / Syllabus</label>
                        <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3} placeholder="e.g., 'The basics of photosynthesis for 8th grade biology', 'Chapter 5: Linear Equations', 'World War II: The European Theater'" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Number of Questions</label><input type="number" value={numQuestions} onChange={e => setNumQuestions(Math.max(1, parseInt(e.target.value)))} min="1" max="20" className="w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"/></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Difficulty</label><select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Question Types</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {allQuestionTypes.map(({ id, label }) => (
                                <button key={id} onClick={() => handleTypeToggle(id)} className={`p-2 rounded-lg text-sm border ${questionTypes.includes(id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 dark:border-slate-600'}`}>{label}</button>
                            ))}
                        </div>
                    </div>
                     <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800">
                        <div>
                            <h4 className="font-semibold text-blue-800 dark:text-blue-300">Enable Thinking Mode</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-400">Uses Gemini 2.5 Pro for higher quality, more complex questions. (Slower)</p>
                        </div>
                        <label htmlFor="thinking-mode-toggle" className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input type="checkbox" id="thinking-mode-toggle" className="sr-only" checked={isThinkingMode} onChange={() => setIsThinkingMode(!isThinkingMode)} />
                                <div className="block bg-gray-300 w-10 h-6 rounded-full dark:bg-slate-600"></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isThinkingMode ? 'transform translate-x-full bg-purple-400' : ''}`}></div>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} disabled={isLoading} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-slate-100">Cancel</button>
                    <button onClick={handleSubmit} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg disabled:bg-purple-400">
                      {isLoading ? 'Generating...' : '✨ Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Question Editor Component ---
const QuestionEditor: React.FC<{ question: TempQuestion; index: number; updateQuestion: (tempId: string, updatedField: Partial<TempQuestion>) => void; removeQuestion: (tempId: string) => void; onRegenerate: (tempId: string) => void; }> = React.memo(({ question, index, updateQuestion, removeQuestion, onRegenerate }) => {
    
    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value as QuestionType;
        const newFields: Partial<Question> = { type: newType };
        
        // Set defaults for new type
        if (newType === 'multiple-choice') {
            newFields.options = ['', '', '', ''];
            newFields.correctAnswer = 'A';
        } else if (newType === 'true-false') {
            newFields.options = ['True', 'False'];
            newFields.correctAnswer = 'True';
        } else if (newType === 'reading-comprehension') {
            newFields.passage = '';
            // FIX: Explicitly type the new comprehension question to match the ComprehensionQuestion interface.
            const newCompQuestion: ComprehensionQuestion = { question: '', sampleAnswer: '', type: 'short-answer', marks: 1 };
            newFields.comprehensionQuestions = [newCompQuestion];
            newFields.marks = 0; // Marks are derived from sub-questions
        } else {
            delete newFields.options;
            newFields.correctAnswer = '';
        }
        
        updateQuestion(question.tempId, newFields);
    };

    const handleOptionChange = (optionIndex: number, value: string) => {
        const newOptions = [...(question.options || [])];
        newOptions[optionIndex] = value;
        updateQuestion(question.tempId, { options: newOptions });
    };

    const handleComprehensionQuestionChange = (compIndex: number, field: keyof ComprehensionQuestion, value: any) => {
        const newCompQuestions = [...(question.comprehensionQuestions || [])];
        newCompQuestions[compIndex] = { ...newCompQuestions[compIndex], [field]: value };
        updateQuestion(question.tempId, { comprehensionQuestions: newCompQuestions });
    };

    const addComprehensionQuestion = () => {
        // FIX: Explicitly type the new comprehension question object to ensure its 'type' property is correctly inferred as a literal type ('short-answer') instead of a generic string.
        const newCompQuestion: ComprehensionQuestion = { question: '', sampleAnswer: '', type: 'short-answer', marks: 1 };
        const newCompQuestions = [...(question.comprehensionQuestions || []), newCompQuestion];
        updateQuestion(question.tempId, { comprehensionQuestions: newCompQuestions });
    };
    
    const removeComprehensionQuestion = (compIndex: number) => {
        const newCompQuestions = (question.comprehensionQuestions || []).filter((_, i) => i !== compIndex);
        updateQuestion(question.tempId, { comprehensionQuestions: newCompQuestions });
    };
    
    return (
        <div className={`p-4 border rounded-lg bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 ${question.isRegenerating ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-800 dark:text-slate-200">Question {index + 1}</h4>
                <div className="flex items-center space-x-2">
                    <button onClick={() => onRegenerate(question.tempId)} className="text-purple-600 hover:text-purple-800 p-1 rounded-full dark:text-purple-400 dark:hover:text-purple-300" title="Regenerate with AI">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={() => removeQuestion(question.tempId)} className="text-red-500 hover:text-red-700" title="Remove Question">&times;</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Type</label><select value={question.type} onChange={handleTypeChange} className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"><option value="multiple-choice">Multiple Choice</option><option value="true-false">True/False</option><option value="short-answer">Short Answer</option><option value="long-answer">Long Answer</option><option value="reading-comprehension">Reading Comprehension</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Marks</label><input type="number" value={question.marks} onChange={e => updateQuestion(question.tempId, { marks: parseInt(e.target.value) })} min="0" className="w-full p-2 border rounded-lg disabled:bg-gray-200 dark:bg-slate-700 dark:border-slate-600 dark:text-white" disabled={question.type === 'reading-comprehension'} /></div>
            </div>
            
            <div><label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Question Text</label><textarea rows={3} value={question.text} onChange={e => updateQuestion(question.tempId, { text: e.target.value })} className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>

            {question.type === 'multiple-choice' && (
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Options & Correct Answer</label>
                    <div className="space-y-2">
                        {question.options?.map((opt, i) => (
                            <div key={i} className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-600 dark:text-gray-400">{String.fromCharCode(65 + i)}.</span>
                                <input type="text" value={opt} onChange={e => handleOptionChange(i, e.target.value)} className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                            </div>
                        ))}
                    </div>
                    <div className="mt-2"><label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Correct Answer</label><select value={question.correctAnswer} onChange={e => updateQuestion(question.tempId, { correctAnswer: e.target.value })} className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                        {question.options?.map((_, i) => <option key={i} value={String.fromCharCode(65 + i)}>{String.fromCharCode(65 + i)}</option>)}
                    </select></div>
                </div>
            )}
            
            {question.type === 'true-false' && (
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Correct Answer</label>
                    <select value={question.correctAnswer} onChange={e => updateQuestion(question.tempId, { correctAnswer: e.target.value })} className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                        <option value="True">True</option>
                        <option value="False">False</option>
                    </select>
                </div>
            )}
            
            {(question.type === 'short-answer' || question.type === 'long-answer') && (
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Sample Answer / Marking Scheme</label>
                    <textarea rows={2} value={question.correctAnswer} onChange={e => updateQuestion(question.tempId, { correctAnswer: e.target.value })} className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                </div>
            )}
            
            {question.type === 'reading-comprehension' && (
                 <div className="mt-4 space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Reading Passage</label><textarea rows={5} value={question.passage} onChange={e => updateQuestion(question.tempId, { passage: e.target.value })} className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div className="p-3 bg-blue-50 rounded-lg border dark:bg-blue-900/20 dark:border-blue-800">
                        <h5 className="font-semibold text-gray-700 mb-2 dark:text-slate-300">Comprehension Questions</h5>
                        <div className="space-y-3">
                        {(question.comprehensionQuestions || []).map((compQ, compIndex) => (
                            <div key={compIndex} className="p-2 bg-white rounded border relative dark:bg-slate-700 dark:border-slate-600">
                               <button onClick={() => removeComprehensionQuestion(compIndex)} className="absolute top-1 right-1 text-red-500 hover:text-red-700 text-xs">&times;</button>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div><label className="text-xs font-medium dark:text-gray-400">Question {compIndex + 1}</label><input type="text" value={compQ.question} onChange={e => handleComprehensionQuestionChange(compIndex, 'question', e.target.value)} className="w-full p-1 border rounded text-sm dark:bg-slate-600 dark:border-slate-500 dark:text-white"/></div>
                                  <div><label className="text-xs font-medium dark:text-gray-400">Marks</label><input type="number" min="0" value={compQ.marks} onChange={e => handleComprehensionQuestionChange(compIndex, 'marks', parseInt(e.target.value))} className="w-full p-1 border rounded text-sm dark:bg-slate-600 dark:border-slate-500 dark:text-white"/></div>
                               </div>
                               <div><label className="text-xs font-medium dark:text-gray-400">Sample Answer</label><textarea rows={2} value={compQ.sampleAnswer} onChange={e => handleComprehensionQuestionChange(compIndex, 'sampleAnswer', e.target.value)} className="w-full p-1 border rounded text-sm dark:bg-slate-600 dark:border-slate-500 dark:text-white"/></div>
                            </div>
                        ))}
                        </div>
                        <button onClick={addComprehensionQuestion} className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">+ Add Sub-question</button>
                    </div>
                 </div>
            )}

        </div>
    );
});


export default CreateTestView;