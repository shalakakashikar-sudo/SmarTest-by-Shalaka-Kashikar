import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import CreateTestView from './views/CreateTestView';
import TakeTestView from './views/TakeTestView';
import PreviewTestView from './views/PreviewTestView';
import ResultsView from './views/ResultsView';
import SubmissionsView from './views/SubmissionsView';
import SubmissionDetailView from './views/SubmissionDetailView';
import UserManagementView from './views/StudentManagementView';
import { Test, TestResult } from './types';
import { supabase } from './services/supabase';
import type { Session } from '@supabase/supabase-js';

type View = 'auth' | 'dashboard' | 'create-test' | 'edit-test' | 'take-test' | 'preview-test' | 'results' | 'submissions' | 'submission-detail' | 'user-management';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [currentTestToTake, setCurrentTestToTake] = useState<Test | null>(null);
  const [currentTestToEdit, setCurrentTestToEdit] = useState<Test | null>(null);
  const [currentTestToPreview, setCurrentTestToPreview] = useState<Test | null>(null);
  const [currentTestToView, setCurrentTestToView] = useState<Test | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [currentSubmissionToView, setCurrentSubmissionToView] = useState<TestResult | null>(null);


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setView('auth');
      }
    });

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setView('auth');
      } else if (view === 'auth') {
        setView('dashboard');
      }
    });

    return () => authListener?.subscription.unsubscribe();
  }, []);

  const navigateTo = (newView: View) => {
    setView(newView);
  };

  const handleStartTest = (test: Test) => {
    setCurrentTestToTake(test);
    navigateTo('take-test');
  };

  const handleEditTest = (test: Test) => {
    setCurrentTestToEdit(test);
    navigateTo('edit-test');
  };

  const handlePreviewTest = (test: Test) => {
    setCurrentTestToPreview(test);
    navigateTo('preview-test');
  };

  const handleSubmitTest = (result: TestResult) => {
    setTestResult(result);
    navigateTo('results');
  };
  
  const handleRetakeTest = () => {
      if (currentTestToTake) {
          navigateTo('take-test');
      } else {
          // If retaking from a past result, the test to take might not be set.
          // In a real app, we'd fetch the test details again. For now, go to dashboard.
          navigateTo('dashboard');
      }
  };

  const handleViewSubmissions = (test: Test) => {
    setCurrentTestToView(test);
    navigateTo('submissions');
  };

  const handleViewSubmissionDetail = (submission: TestResult) => {
    setCurrentSubmissionToView(submission);
    navigateTo('submission-detail');
  };
  
  const handleViewResultDetails = (result: TestResult) => {
    // This function enables viewing past results from the student dashboard
    setTestResult(result);
    setCurrentTestToTake(null); // Clear the test-to-take context
    navigateTo('results');
  };


  const renderView = () => {
    if (!session) {
      return <AuthView />;
    }

    const dashboardProps = {
      navigateTo,
      onStartTest: handleStartTest,
      onViewSubmissions: handleViewSubmissions,
      onEditTest: handleEditTest,
      onViewResultDetails: handleViewResultDetails, // Pass the new handler
    };

    switch (view) {
      case 'dashboard':
        return <DashboardView {...dashboardProps} />;
      case 'create-test':
        return <CreateTestView navigateTo={navigateTo} onPreviewTest={handlePreviewTest} />;
      case 'edit-test':
        return currentTestToEdit ? (
            <CreateTestView navigateTo={navigateTo} testToEdit={currentTestToEdit} onPreviewTest={handlePreviewTest} />
        ) : (
            <DashboardView {...dashboardProps} />
        );
      case 'take-test':
        return currentTestToTake ? (
          <TakeTestView test={currentTestToTake} onSubmitTest={handleSubmitTest} navigateTo={navigateTo} />
        ) : (
          <DashboardView {...dashboardProps} />
        );
      case 'preview-test':
        return currentTestToPreview ? (
          <PreviewTestView
            test={currentTestToPreview}
            onBack={() => navigateTo(currentTestToEdit ? 'edit-test' : 'create-test')}
          />
        ) : (
          <DashboardView {...dashboardProps} />
        );
      case 'results':
        return testResult ? (
          <ResultsView result={testResult} navigateTo={navigateTo} onRetakeTest={handleRetakeTest} />
        ) : (
          <DashboardView {...dashboardProps} />
        );
      case 'submissions':
        return currentTestToView ? (
          <SubmissionsView test={currentTestToView} navigateTo={navigateTo} onViewDetail={handleViewSubmissionDetail} />
        ) : (
          <DashboardView {...dashboardProps} />
        );
      case 'submission-detail':
        return currentTestToView && currentSubmissionToView ? (
          <SubmissionDetailView test={currentTestToView} submission={currentSubmissionToView} navigateTo={navigateTo} />
        ) : (
          <DashboardView {...dashboardProps} />
        );
      case 'user-management':
        return <UserManagementView navigateTo={navigateTo} />;
      default:
        return <DashboardView {...dashboardProps} />;
    }
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider session={session}>
          <main className="container mx-auto px-4 py-8">
            {renderView()}
          </main>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;