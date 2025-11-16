import React from 'react';
import type { Test, TestResult, Question } from '../types';

interface SubmissionDetailProps {
  test: Test;
  submission: TestResult;
  navigateTo: (view: 'submissions' | 'dashboard') => void;
}

const SubmissionDetailView: React.FC<SubmissionDetailProps> = ({ test, submission, navigateTo }) => {
  const { evaluation, student_name, test_title } = submission;
  const scoreColor = evaluation.overallScore >= 80 ? 'text-green-500 dark:text-green-400' :
                     evaluation.overallScore >= 60 ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-500 dark:text-red-400';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">🔍 Submission Details</h2>
            <p className="text-gray-600 dark:text-gray-400">Viewing results for <span className="font-medium">{student_name}</span> on "{test_title}"</p>
        </div>
        <button onClick={() => navigateTo('submissions')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg dark:bg-slate-600 dark:hover:bg-slate-500">← Back to Submissions</button>
      </div>
      
      <div className="text-center bg-gray-50 rounded-lg p-6 mb-8 dark:bg-slate-700/50">
        <div className="text-lg font-medium text-gray-700 dark:text-gray-300">Overall Score</div>
        <div className={`text-5xl ${scoreColor} font-bold`}>{evaluation.overallScore}%</div>
        <div className="text-lg font-semibold text-gray-600 dark:text-gray-400">
            {evaluation.totalAwardedMarks} / {evaluation.totalPossibleMarks} Marks
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-800 border-b pb-2 dark:text-slate-200 dark:border-slate-700">Question Breakdown</h3>
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

const QuestionBreakdown: React.FC<{ question: Question, answer: any, score: any, index: number }> = ({ question, answer, score, index }) => {
    const percentage = score.maxMarks > 0 ? Math.round((score.score / score.maxMarks) * 100) : 0;
    const scoreColor = percentage >= 80 ? 'text-green-500 dark:text-green-400' :
                       percentage >= 60 ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-500 dark:text-red-400';

  return (
    <div className="bg-gray-50 p-4 rounded-lg border dark:bg-slate-900/50 dark:border-slate-700">
        <div className="flex justify-between items-start mb-4">
            <h4 className="font-semibold text-gray-800 text-lg dark:text-slate-200">
                Question {index + 1}
                {(question.type === 'short-answer' || question.type === 'long-answer') && question.expected_word_limit && (
                    <span className="text-sm font-normal text-gray-500 ml-2 dark:text-gray-400">
                        (Word Limit: {question.expected_word_limit})
                    </span>
                )}
            </h4>
            <div className={`text-right text-lg font-bold ${scoreColor}`}>
                {score.score} / {score.maxMarks}
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
                <p className="text-gray-700 text-sm dark:text-slate-300 whitespace-pre-wrap">{score.feedback}</p>
            </div>
        </div>
    </div>
  );
};

const DisplayAnswer: React.FC<{answer: any, question: Question}> = ({ answer, question }) => {
    if (question.type === 'reading-comprehension') {
        return (
            <div className="space-y-2">
                {(question.comprehension_questions || []).map((compQ, index) => {
                    const studentAnswer = answer[index];
                    let display;

                    if (compQ.type === 'multiple-choice') {
                        const optionIndex = studentAnswer ? studentAnswer.charCodeAt(0) - 65 : -1;
                        const selectedOption = compQ.options?.[optionIndex];
                        display = <p className="text-gray-800 dark:text-slate-200">{studentAnswer}. {selectedOption || <span className="text-gray-400 italic">No answer provided</span>}</p>;
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