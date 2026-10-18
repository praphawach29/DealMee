-- Free plan: 100 AI messages / month (was 500). New shops get a 14-day trial
-- with 300 messages first (src/lib/billing/trial.ts); Free is what remains after.
UPDATE public.plans SET messages = 100 WHERE key = 'free';
