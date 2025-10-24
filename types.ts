export type Role = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  role: Role;
  full_name: string;
}

export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'long-answer'
  | 'reading-comprehension';

export interface ComprehensionQuestion {
  question: string;
  sampleAnswer: string;
  type: 'short-answer' | 'multiple-choice' | 'true-false';
  marks: number;
  markingScheme?: string | null;
}

export interface Question {
  id?: string;
  test_id?: string;
  type: QuestionType;
  text: string;
  marks: number;
  media?: {
    image?: string | null;
    video?: string | null;
    audio?: string | null;
  };
  options?: string[];
  correctAnswer?: string;
  passage?: string;
  comprehensionQuestions?: ComprehensionQuestion[];
  expectedWordLimit?: number | null;
  markingScheme?: string | null;
}

export interface Test {
  id?: string;
  title: string;
  class: string;
  timer: number | null;
  total_marks: number;
  questions: Question[];
  created_by?: string;
  created_at?: string;
  total_questions: number;
}

export interface QuestionScore {
    score: number;
    feedback: string;
}

export interface EvaluationResult {
    overallScore: number;
    feedback: string;
    suggestions: string;
    strengths: string;
    weaknesses: string;
    questionScores: QuestionScore[];
}

export interface TestResult {
    id?: string;
    test_id: string;
    test_title: string;
    student_id: string;
    student_name: string;
    answers: (string | Record<number, string>)[];
    evaluation: EvaluationResult;
    submitted_at?: string;
}