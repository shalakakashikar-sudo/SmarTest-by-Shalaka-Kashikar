import React from 'react';
import type { Test, Question } from '../types';

interface PreviewTestProps {
  test: Test;
  onBack: () => void;
}

const PreviewTestView: React.FC<PreviewTestProps> = ({ test, onBack }) => {
    const formatTime = (minutes: number) => {
        const mins = Math.floor(minutes);
        const secs = Math.round((minutes - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 relative dark:bg-slate-800">
            <div className="absolute top-4 right-4 text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Marks: <span className="font-bold">{test.total_marks}</span></p>
                {test.timer && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Time Limit: <span className="font-bold">{test.timer} mins</span></p>
                )}
            </div>

            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">👁️ Test Preview</h2>
                    <p className="text-lg text-gray-600 dark:text-gray-300">{test.title}</p>
                </div>
                <button onClick={onBack} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Editor</button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/40 dark:border-blue-800">
                <p className="text-blue-800 font-medium dark:text-blue-300">This is a preview. All input fields are disabled.</p>
            </div>

            <div className="space-y-6">
                {test.questions.map((q, index) => (
                    <PreviewQuestionDisplay key={index} question={q} index={index} />
                ))}
            </div>

            <div className="mt-8 text-center">
                <button disabled className="bg-blue-400 text-white px-8 py-3 rounded-lg font-medium text-lg cursor-not-allowed">
                    Submit Test (Disabled)
                </button>
            </div>
        </div>
    );
};

const PreviewQuestionDisplay: React.FC<{ question: Question; index: number; }> = ({ question, index }) => {
    let answerInput;
    const commonTextareaClasses = "w-full p-3 border rounded-lg bg-gray-100 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-gray-400 cursor-not-allowed";

    switch (question.type) {
        case 'multiple-choice':
            answerInput = (
                <div className="space-y-2">
                    {question.options?.map((opt, i) => (
                        <label key={i} className="flex items-center space-x-2 p-2 rounded cursor-not-allowed">
                            <input type="radio" name={`preview-question-${index}`} disabled className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400 cursor-not-allowed" />
                            <span className="dark:text-slate-200" dangerouslySetInnerHTML={{ __html: `${String.fromCharCode(65 + i)}. ${opt}` }}></span>
                        </label>
                    ))}
                </div>
            );
            break;
        case 'true-false':
            answerInput = (
                <div className="space-y-2">
                    <label className="flex items-center space-x-2 p-2 rounded cursor-not-allowed">
                        <input type="radio" name={`preview-question-${index}`} disabled className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400 cursor-not-allowed" />
                        <span className="dark:text-slate-200">True</span>
                    </label>
                    <label className="flex items-center space-x-2 p-2 rounded cursor-not-allowed">
                        <input type="radio" name={`preview-question-${index}`} disabled className="text-blue-600 focus:ring-indigo-500 dark:text-indigo-400 cursor-not-allowed" />
                        <span className="dark:text-slate-200">False</span>
                    </label>
                </div>
            );
            break;
        case 'short-answer':
            answerInput = <textarea className={commonTextareaClasses} rows={3} placeholder="Student will type their answer here..." disabled />;
            break;
        case 'long-answer':
            answerInput = <textarea className={commonTextareaClasses} rows={6} placeholder="Student will write their detailed answer here..." disabled />;
            break;
        case 'reading-comprehension':
            answerInput = (
                <div>
                    {question.passage &&
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4 dark:bg-blue-900/30 dark:border-blue-800">
                            <h5 className="font-semibold text-blue-800 mb-2 dark:text-blue-300">📖 Reading Passage</h5>
                            <div className="text-gray-700 whitespace-pre-wrap dark:text-slate-300" dangerouslySetInnerHTML={{ __html: question.passage }} />
                        </div>
                    }
                    <h5 className="font-semibold text-gray-800 mb-2 dark:text-slate-200">Comprehension Questions:</h5>
                    <div className="space-y-4">
                        {(question.comprehensionQuestions || []).map((compQ, compIndex) => (
                            <div key={compIndex} className="bg-white p-3 rounded border dark:bg-slate-900 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: `${compIndex + 1}. ${compQ.question}` }} />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">[{compQ.marks} marks]</span>
                                </div>
                                <textarea className={commonTextareaClasses} rows={2} placeholder="Student will type their answer here..." disabled />
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

export default PreviewTestView;