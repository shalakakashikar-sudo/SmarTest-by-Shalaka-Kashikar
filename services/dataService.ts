

import { supabase } from './supabase';
import { functionService } from './functionService';
import type { Test, TestResult, EvaluationResult } from '../types';

export const dataService = {
  async createTest(test: Test) {
    return await functionService.invoke('save-test', test);
  },

  async updateTest(test: Test) {
    if (!test.id) throw new Error("Test ID is required for updating.");
    return await functionService.invoke('save-test', test);
  },

  async deleteTest(testId: string) {
    await functionService.invoke('delete-test', { testId });
    return true;
  },

  async getTests() {
    const data = await functionService.invoke<Test[]>('get-tests');
    return data;
  },
  
  async saveTestResult(result: TestResult) {
    const { data, error } = await supabase
        .from('test_results')
        .insert([result])
        .select()
        .single();
    if(error) throw error;
    return data;
  },
  
  async updateTestResult(resultId: string, newEvaluation: EvaluationResult) {
    const { data, error } = await supabase
        .from('test_results')
        .update({ evaluation: newEvaluation })
        .eq('id', resultId)
        .select()
        .single();
    if(error) throw error;
    return data;
  },

  async getTestResults(testId: string) {
    const data = await functionService.invoke<TestResult[]>('get-submissions', { testId });
    return data;
  },

  async getMyTestResults() {
    const data = await functionService.invoke<TestResult[]>('get-my-results');
    return data;
  },

  async deleteTestResult(resultId: string) {
    const { error } = await supabase
      .from('test_results')
      .delete()
      .eq('id', resultId);
    if (error) throw error;
    return true;
  },

  async getUsers() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }
    return await functionService.invoke('admin-get-users');
  },

  async deleteUser(userId: string) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }
    await functionService.invoke('admin-delete-user', { userId });
    return true;
  },
};