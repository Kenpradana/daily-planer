import { supabase } from '../lib/supabase.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).send('');

  try {

    // —— GET ?date=YYYY-MM-DD ——
    // dipakai: renderTasks()
    if (req.method === 'GET' && req.query.date) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('date_key', req.query.date)
        .order('time', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.status(200).json(data);
    }

    // —— GET ?view=month&year=X&month=Y ——
    // dipakai: fetchMonthData()
    if (req.method === 'GET' && req.query.view === 'month') {
      const y = Number(req.query.year);
      const m = Number(req.query.month);
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .gte('date_key', start)
        .lte('date_key', end)
        .order('date_key', { ascending: true });

      if (error) throw error;
      return res.status(200).json(data);
    }

    // —— GET ?view=stats ——
    // dipakai: updateStats()
    if (req.method === 'GET' && req.query.view === 'stats') {
      const { count: total, error: e1 } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true });
      if (e1) throw e1;

      const { count: done, error: e2 } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('done', true);
      if (e2) throw e2;

      return res.status(200).json({ total: total || 0, done: done || 0 });
    }

    // —— POST / ——
    // dipakai: addTask()
    if (req.method === 'POST') {
      const { date_key, text, time, note, category } = req.body;
      if (!text || !date_key) {
        return res.status(400).json({ error: 'text dan date_key wajib' });
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          date_key,
          text: text.trim(),
          time: time || '',
          note: note || '',
          category: category || 'other',
          done: false
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Tasks API:', err);
    return res.status(500).json({ error: err.message });
  }
}