import React, { useState } from 'react';
import type { Test, TestResult, Question } from '../types';

interface ResultsProps {
  result: TestResult;
  test: Test;
  navigateTo: (view: 'dashboard') => void;
  onRetakeTest: () => void;
}

const DisplayAnswer: React.FC<{answer: any, question: Question}> = ({ answer, question }) => {
    if (question.type === 'reading-comprehension') {
        return (
            <div className="space-y-2">
                {(question.comprehension_questions || []).map((compQ, index) => {
                    const studentAnswer = answer ? answer[index] : undefined;
                    let display;

                    if (compQ.type === 'multiple-choice') {
                        const optionIndex = studentAnswer ? studentAnswer.charCodeAt(0) - 65 : -1;
                        const selectedOption = compQ.options?.[optionIndex];
                        display = <p className="text-gray-800 dark:text-slate-200">{studentAnswer ? `${studentAnswer}. ${selectedOption}` : <span className="text-gray-400 italic">No answer provided</span>}</p>;
                    } else if (compQ.type === 'true-false') {
                        display = <p className="text-gray-800 dark:text-slate-200">{studentAnswer || <span className="text-gray-400 italic">No answer provided</span>}</p>;
                    } else { // short-answer
                        display = <div className="text-gray-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: studentAnswer || `<span class="text-gray-400 italic">No answer provided</span>` }} />;
                    }

                    return (
                        <div key={index} className="text-sm">
                            <p className="font-medium text-gray-600 dark:text-gray-400">{compQ.question}</p>
                            <div className="pl-2 border-l-2 border-gray-200 dark:border-slate-600">
                                {display}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
    
    if (question.type === 'multiple-choice') {
        const optionIndex = answer ? answer.charCodeAt(0) - 65 : -1;
        const selectedOption = question.options?.[optionIndex];
        return <p className="text-gray-800 whitespace-pre-wrap dark:text-slate-200">{answer ? `${answer}. ${selectedOption}` : <span className="text-gray-400 italic">No answer provided</span>}</p>
    }

    return (
        <div 
            className="text-gray-800 whitespace-pre-wrap dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: answer || `<span class="text-gray-400 italic">No answer provided</span>` }}
        />
    );
};


const ResultsView: React.FC<ResultsProps> = ({ result, test, navigateTo, onRetakeTest }) => {
  const { evaluation, test_title } = result;
  const [activeTab, setActiveTab] = useState('summary');
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);

  const getScoreInfo = (score: number) => {
    if (score >= 80) {
      return {
        color: 'text-green-500 dark:text-green-400',
        message: 'Excellent Work! 🚀',
        bgColor: 'bg-green-500'
      };
    }
    if (score >= 60) {
      return {
        color: 'text-yellow-500 dark:text-yellow-400',
        message: 'Good Effort! 👍',
        bgColor: 'bg-yellow-500'
      };
    }
    return {
      color: 'text-red-500 dark:text-red-400',
      message: 'Keep Practicing! 🌱',
      bgColor: 'bg-red-500'
    };
  };
  
  const scoreInfo = getScoreInfo(evaluation.overallScore);

  const handleQuestionToggle = (index: number) => {
    setOpenQuestionIndex(openQuestionIndex === index ? null : index);
  };

  const TabButton: React.FC<{tabName: string; label: string; icon: string;}> = ({ tabName, label, icon }) => (
      <button
        onClick={() => setActiveTab(tabName)}
        className={`flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === tabName
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700'
        }`}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </button>
  );

  const FeedbackCard: React.FC<{ title: string; content: string; icon: string; borderColor: string }> = ({ title, content, icon, borderColor }) => (
    <div className={`bg-gray-50 dark:bg-slate-700/50 rounded-lg p-5 border-l-4 ${borderColor}`}>
        <h3 className="text-xl font-bold text-gray-800 dark:text-slate-200 mb-3 flex items-center">
            <span className="mr-2">{icon}</span>
            {title}
        </h3>
        <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{content}</p>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 dark:bg-slate-800 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 border-b border-gray-200 dark:border-slate-700 pb-4">
        <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100">Results for "{test_title}"</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Here's your AI-powered performance breakdown.</p>
        </div>
        <button onClick={() => navigateTo('dashboard')} className="mt-4 sm:mt-0 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500 transition-colors">← Back to Dashboard</button>
      </div>

      {/* Score Card */}
      <div className="text-center mb-10 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-700/50 dark:to-slate-800/50 p-6 rounded-xl shadow-inner">
        <p className="text-lg text-gray-600 dark:text-gray-400">{scoreInfo.message}</p>
        <div className={`text-7xl ${scoreInfo.color} font-bold my-2`}>{evaluation.overallScore}%</div>
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-slate-200">
            {evaluation.totalAwardedMarks} / {evaluation.totalPossibleMarks} Marks
        </h3>
      </div>
      
      {/* Always Visible Strengths and Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <FeedbackCard 
            title="Strengths"
            content={evaluation.strengths}
            icon="🏆"
            borderColor="border-green-500"
        />
        <FeedbackCard 
            title="Areas for Improvement"
            content={evaluation.weaknesses}
            icon="🎯"
            borderColor="border-yellow-500"
        />
      </div>

      {/* Tabbed section for other details */}
      <div className="mb-10">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-4">📖 More Details</h3>
        <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-100 dark:bg-slate-900/50 rounded-lg mb-4">
            <TabButton tabName="summary" label="Overall Summary" icon="📝" />
            <TabButton tabName="next_steps" label="Next Steps" icon="💡" />
        </div>
        <div className="p-5 bg-gray-50 dark:bg-slate-700/50 rounded-lg min-h-[120px]">
            {activeTab === 'summary' && <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{evaluation.feedback}</p>}
            {activeTab === 'next_steps' && <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{evaluation.suggestions}</p>}
        </div>
      </div>
      
      {/* Question Breakdown Accordion */}
      <div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-4">📊 Question-by-Question Breakdown</h3>
        <div className="space-y-3 border border-gray-200 dark:border-slate-700 rounded-lg p-2 sm:p-4">
          {evaluation.questionScores.map((score, index) => {
              const question = test.questions[index];
              if (!question) return null; // Safety check
              const qScoreInfo = getScoreInfo(score.maxMarks > 0 ? Math.round((score.score / score.maxMarks) * 100) : 0);
              const isOpen = openQuestionIndex === index;
              return (
                  <div key={index} className="bg-white dark:bg-slate-900/70 rounded-lg shadow-sm overflow-hidden">
                      <button onClick={() => handleQuestionToggle(index)} className="w-full flex justify-between items-center p-4 text-left">
                          <span className="font-medium dark:text-slate-200">Question {index + 1}</span>
                          <div className="flex items-center space-x-3">
                              <span className={`text-lg font-bold ${qScoreInfo.color}`}>{score.score} / {score.maxMarks}</span>
                               <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                               </span>
                          </div>
                      </button>
                      {isOpen && (
                          <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                               <div className="mb-4">
                                  <h5 className="font-semibold text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-2">👤 Your Answer</h5>
                                  <div className="p-3 rounded-md bg-white dark:bg-slate-700 border dark:border-slate-600 text-sm">
                                      <DisplayAnswer answer={result.answers[index]} question={question} />
                                  </div>
                               </div>
                               <div>
                                  <h5 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">🤖 AI Feedback</h5>
                                  <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                                      {score.feedback}
                                  </div>
                               </div>
                          </div>
                      )}
                  </div>
              );
          })}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 text-center mt-10 pt-6 border-t dark:border-slate-700">
        <button onClick={onRetakeTest} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-transform transform hover:scale-105">
          🔄 Retake Test
        </button>
        <button onClick={() => navigateTo('dashboard')} className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-transform transform hover:scale-105">
          🏠 Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ResultsView;