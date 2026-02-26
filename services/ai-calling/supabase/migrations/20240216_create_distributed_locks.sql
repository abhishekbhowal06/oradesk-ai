-- Create distributed_locks table for application-level locking
CREATE TABLE IF NOT EXISTS public.distributed_locks (
    lock_key TEXT PRIMARY KEY,
    holder_id TEXT NOT NULL,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS (though service role bypasses it, good practice)
ALTER TABLE public.distributed_locks ENABLE ROW LEVEL SECURITY;

-- Create policy for reading (anyone can read to check locks)
CREATE POLICY "Anyone can read locks" ON public.distributed_locks
    FOR SELECT USING (true);

-- Create policy for inserting/deleting (service role only ideally, but for now public if needed for logic, likely service role)
-- Actually, the application uses the service key in distributed-lock.ts?
-- No, distributed-lock.ts imports `supabase` from `./supabase`.
-- lib/supabase.ts uses SERVICE_KEY. So RLS doesn't block it.

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires_at ON public.distributed_locks(expires_at);
