import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uszsloljezycwqebultu.supabase.co';

const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzenNsb2xqZXp5Y3dxZWJ1bHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTI1ODcsImV4cCI6MjA4ODY4ODU4N30.HRt07mguyz1Is-0PaCVcw-qtdIQYleolbBckFv4cpYM'; 

export const supabase = createClient(supabaseUrl, supabaseKey);