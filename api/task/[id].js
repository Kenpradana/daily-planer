import { supabase } from '../lib/supabase';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).send('');

  const { id } = req.query;

  try {

    // —— PUT /:id ——
    // dipakai: toggleTask() → body: { done: true/false }
    if (req.method === 'PUT') {
      const { data, error } = await supabase
        .from('tasks')
        .update(req.body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    // —— DELETE /:id ——
    // dipakai: deleteTask()
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Task [id] API:', err);
    return res.status(500).json({ error: err.message });
  }
}