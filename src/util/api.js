import { supabase } from './supabase';

export const api = {
  // Fetch subjects from the real database
  getSubjects: async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Add a subject to the real database
  addSubject: async (subjectData) => {
    // Note: Map frontend fields to SQL schema fields
    const { data, error } = await supabase
      .from('subjects')
      .insert([{
        title: subjectData.name,
        branch: subjectData.department, // Maps 'CSE' to 'branch'
        semester: parseInt(subjectData.sem),
        description: subjectData.description
      }])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Delete a subject
  deleteSubject: async (id) => {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};