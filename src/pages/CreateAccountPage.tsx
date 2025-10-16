import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000';
const ALLOWED_DOMAINS = ['bears.unco.edu', 'unco.edu'];

const sendVerification = async (email: string, password: string) => {
  const accountID = email.split('@')[0];
  const accountType = email.includes('bears') ? 'Student' : 'Faculty';
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountID, accountType, email, password }),
  });
  if (!res.ok) throw new Error('Failed to register user.');
};

const verifyAccount = async (email: string, code: string) => {
  const accountID = email.split('@')[0];
  const res = await fetch(`${API_BASE_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountID, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Verification failed.');
  }
};

const Rule: React.FC<{ ok: boolean; text: string }> = ({ ok, text }) => (
  <li className={`flex items-center text-xs ${ok ? 'text-green-600' : 'text-gray-500'}`}>
    <svg aria-hidden="true" className="mr-2 h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      {ok ? (
        <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0z" />
      ) : (
        <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-5h2v2H9v-2Zm0-8h2v6H9V5Z" />
      )}
    </svg>
    {text}
  </li>
);

const CreateAccountForm: React.FC = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  useEffect(() => {
    if ((location.state as any)?.freshSignup) {
      setEmail(''); setPassword(''); setConfirm('');
    }
  }, [location.state]);

  const pwRules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const isPwValid = Object.values(pwRules).every(Boolean);

  const validate = (): string | null => {
    let err: string | null = null;
    const trimmed = email.trim();
    if (!trimmed) { setEmailErr('Email is required.'); err = 'Fix errors.'; }
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) { setEmailErr('Enter a valid email.'); err = 'Fix errors.'; }
    else {
      const domain = trimmed.split('@')[1]?.toLowerCase();
      if (!ALLOWED_DOMAINS.includes(domain)) { setEmailErr('Use your official UNCO email.'); err = 'Fix errors.'; }
      else setEmailErr(null);
    }
    if (!isPwValid) { setPasswordErr('Password does not meet requirements.'); err = 'Fix errors.'; }
    else setPasswordErr(null);
    if (confirm !== password) err = 'Fix errors.';
    return err;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = validate();
    if (msg) return setError(msg);
    setError(null); setSubmitting(true);
    try { await sendVerification(email.trim(), password); setVerificationSent(true); }
    catch { setError('Could not send verification email.'); }
    finally { setSubmitting(false); }
  };

  const onResend = async () => {
    setError(null); setSendingVerification(true);
    try { await sendVerification(email.trim(), password); setVerificationSent(true); }
    catch { setError('Could not send verification email.'); }
    finally { setSendingVerification(false); }
  };

  if (verificationSent) {
    return (
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md">
        <h1 className="mb-1 text-2xl font-semibold text-brand-blue">Verify your email</h1>
        <p className="mb-4 text-sm text-gray-600">
          We sent a 6‑digit code to <span className="font-medium text-gray-800">{email}</span>.
        </p>
        {error && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800" role="alert" aria-live="polite">
            {error}
          </div>
        )}
        <label htmlFor="code" className="mb-1 block text-sm font-medium text-gray-700">Verification code</label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-brand-gold"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-white bg-brand-blue hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-60"
            disabled={verifying || code.trim().length !== 6}
            onClick={async () => {
              try { setVerifying(true); setError(null); await verifyAccount(email.trim(), code.trim()); alert('Account verified.'); }
              catch (e: any) { setError(e?.message || 'Verification failed.'); }
              finally { setVerifying(false); }
            }}
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-brand-blue bg-brand-gold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-60"
            onClick={onResend}
            disabled={sendingVerification}
          >
            {sendingVerification ? 'Resending…' : 'Resend email'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-md">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-brand-blue">Create your account</h1>
        <p className="text-sm text-gray-600">Use your Bear email to sign up.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="off"
          className={`w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-gold ${emailErr ? 'border-red-400' : 'border-gray-300'}`}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailErr(null); }}
          required
          aria-invalid={!!emailErr}
        />
        {emailErr && <p className="mt-1 text-xs text-red-600">{emailErr}</p>}
      </div>

      <div className="mb-4">
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
        <div className="relative">
          <input
            id="password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            className={`w-full rounded-md border px-3 py-2 pr-14 outline-none focus:ring-2 focus:ring-brand-gold ${passwordErr ? 'border-red-400' : 'border-gray-300'}`}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordErr(null); }}
            required
            aria-invalid={!!passwordErr}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={() => setShowPwd(v => !v)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? 'Hide' : 'Show'}
          </button>
        </div>

        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <Rule ok={pwRules.length}  text="At least 8 characters" />
          <Rule ok={pwRules.upper}   text="One uppercase letter" />
          <Rule ok={pwRules.lower}   text="One lowercase letter" />
          <Rule ok={pwRules.digit}   text="One number" />
          <Rule ok={pwRules.special} text="One symbol" />
        </ul>
        {passwordErr && <p className="mt-1 text-xs text-red-600">{passwordErr}</p>}
      </div>

      <div className="mb-6">
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
        <input
          id="confirm"
          type={showPwd ? 'text' : 'password'}
          autoComplete="new-password"
          className={`w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-gold ${confirm && confirm !== password ? 'border-red-400' : 'border-gray-300'}`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          aria-invalid={confirm !== password && !!confirm}
        />
        {confirm && confirm !== password && <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>}
      </div>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-md bg-brand-gold px-4 py-2 font-medium text-brand-blue hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:opacity-60"
        disabled={!isPwValid || !!emailErr || confirm !== password || !email.trim() || submitting}
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
};

const CreateAccountPage: React.FC = () => (
  <section className="min-h-screen w-full bg-gradient-to-b from-brand-blue via-brand-blue to-brand-blue/10">
    <div className="mx-auto grid min-h-screen max-w-7xl place-items-center px-4 py-12">
      <CreateAccountForm />
    </div>
  </section>
);

export default CreateAccountPage;
