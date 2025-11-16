
import { supabase } from './supabase';
import { functionService } from './functionService';
import type { Test, TestResult, EvaluationResult, AnalyticsData } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const dataService = {
  async createTest(test: Test) {
    // Reroute to the new unified 'save-test' function which now handles creation.
    return await functionService.invoke('save-test', test);
  },

  async updateTest(test: Test) {
    if (!test.id) throw new Error("Test ID is required for updating.");
    // This now points to the new, robust 'save-test' function.
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

  async getAnalyticsData(): Promise<AnalyticsData> {
    return await functionService.invoke<AnalyticsData>('get-analytics-data');
  },

  async deleteTestResult(resultId: string) {
    const { error } = await supabase
      .from('test_results')
      .delete()
      .eq('id', resultId);
    if (error) throw error;
    return true;
  },

  async uploadMediaFile(userId: string, file: File): Promise<string> {
    const filePath = `${userId}/${uuidv4()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
        .from('media') // Assumes a bucket named 'media'
        .upload(filePath, file);

    if (uploadError) {
        // Attempt to provide a more helpful error message for common issues.
        if (uploadError.message.includes('Bucket not found')) {
            throw new Error("Storage setup needed: A 'media' bucket is required in Supabase Storage. Please create it and set public access policies.");
        }
        throw new Error(`Storage error: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from('media').getPublicUrl(filePath);
    return data.publicUrl;
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
