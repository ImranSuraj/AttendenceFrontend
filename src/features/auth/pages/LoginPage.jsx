import { useEffect, useState } from "react";
import { LogIn, Eye, EyeOff, CheckCircle2, Circle, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { Btn } from "@/shared/components/Btn";
import { Spinner } from "@/shared/components/Spinner";
import { inputCls } from "@/shared/components/Modal";
import { useHostStore } from "@/shared/utils/teams";
import { signInWithPassword, verifyMfaCode, signInWithTeams, requestPasswordReset, resetPassword, authErrorMessage } from "../services/auth.service";
import { PASSWORD_RULES, passwordProblem, empNoProblem, emailProblem } from "../auth.validators";
import { getResetLinkToken, clearResetLinkToken } from "../services/resetLink";

// The sign-in page. Inside Microsoft Teams the user is signed in automatically with Teams single sign-on (no page to fill in); if that fails, or the app is
// opened outside Teams, the Employee No and password form is shown. Three screens share this one page:
//   login   Employee No + password, with "Forgot password?"
//   forgot  Employee No -> a one-time reset link is e-mailed (valid 30 minutes)
//   reset   a new password: opened from the e-mailed link, or after a sign-in whose password is older than 90 days
// The Employee No and the password are encrypted in the browser before they are sent (credentialCrypto.js); the server stores only a hash of the password.

function FieldError({ id, message }) {
  return message ? <span id={id} className="text-xs font-normal text-destructive" role="alert">{message}</span> : null;
}

function PasswordBox({ label, value, onChange, autoComplete, autoFocus, error, id }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">{label}
      <span className="relative block">
        <input type={shown ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus} autoComplete={autoComplete}
          maxLength={64} aria-invalid={error ? true : undefined} aria-describedby={error ? id + "-err" : undefined} className={inputCls + " w-full pr-9" + (error ? " border-destructive" : "")}/>
        <button type="button" onClick={() => setShown(s => !s)} aria-label={shown ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent cursor-pointer text-muted-foreground p-0.5">
          {shown ? <EyeOff size={15}/> : <Eye size={15}/>}
        </button>
      </span>
      <FieldError id={id + "-err"} message={error}/>
    </label>
  );
}

export default function LoginPage() {
  // inTeams is a guess at first and is corrected by the Teams SDK a moment later (a phone webview may not look like Teams until the SDK answers).
  const inTeams = useHostStore(s => s.inTeams);
  const [teamsTrying, setTeamsTrying] = useState(inTeams);

  const [mode, setMode] = useState(() => (getResetLinkToken() ? "reset" : "login"));
  const [resetToken, setResetToken] = useState(() => getResetLinkToken());
  const [empNo, setEmpNo] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  // A reset opened from the e-mailed link also needs the 6-digit code from that e-mail; one reached by an expired-password sign-in does not.
  const [resetNeedsOtp, setResetNeedsOtp] = useState(() => !!getResetLinkToken());
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!inTeams) return undefined;
    let cancelled = false;
    setTeamsTrying(true);
    signInWithTeams().catch((e) => { if (!cancelled) { setError(authErrorMessage(e)); setTeamsTrying(false); } });
    return () => { cancelled = true; };
  }, [inTeams]);

  const go = (next, message = "") => { setMode(next); setError(""); setFieldErrors({}); setInfo(message); setPassword(""); setNewPassword(""); setConfirm(""); setOtp(""); };

  const submitLogin = async (e) => {
    e.preventDefault();
    const errs = {};
    const e1 = empNoProblem(empNo); if (e1) errs.empNo = e1;
    if (!password) errs.password = "Please enter your password.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const result = await signInWithPassword(empNo, password);
      handleStep(result);
    } catch (err) { setError(authErrorMessage(err)); }
    setBusy(false);
  };

  // Where a password step or the code step leads: the code screen (first sign-in only), the new-password screen (password older than 90 days), or the app (the store takes over).
  const handleStep = (result) => {
    if (result.mfa) {
      setChallengeId(result.challengeId);
      go("mfa", `A 6-digit code was sent to ${result.maskedEmail}. You are asked for it only this one time.`);
    } else if (result.mustChange) {
      setResetToken(result.resetToken);
      setResetNeedsOtp(false);
      go("reset", "Your password is older than 90 days. Please choose a new password to continue.");
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) { setFieldErrors({ otp: "Please enter the 6-digit code." }); return; }
    setFieldErrors({}); setBusy(true); setError("");
    try { handleStep(await verifyMfaCode(challengeId, otp.trim())); }
    catch (err) { setFieldErrors({ otp: authErrorMessage(err) }); }
    setBusy(false);
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    const problem = emailProblem(email);
    setFieldErrors(problem ? { email: problem } : {});
    if (problem) return;
    setBusy(true); setError(""); setInfo("");
    // The server says "Your email is not configured. Please contact HR." when no employee has this address: shown under the box.
    try { setInfo(await requestPasswordReset(email)); }
    catch (err) { setFieldErrors({ email: authErrorMessage(err) }); }
    setBusy(false);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(empNo, newPassword);
    const mismatch = !problem && newPassword !== confirm ? "Both passwords should match!" : "";
    const errs = {};
    if (problem) errs.newPassword = problem;
    if (mismatch) errs.confirm = mismatch;
    if (resetNeedsOtp && !/^\d{6}$/.test(otp.trim())) errs.otp = "Please enter the 6-digit code from the e-mail.";
    setFieldErrors(errs);
    if (problem || mismatch || errs.otp) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const message = await resetPassword(resetToken, newPassword, resetNeedsOtp ? otp.trim() : undefined);
      clearResetLinkToken(); setResetToken("");
      go("login", message);
    } catch (err) {
      const msg = authErrorMessage(err);
      // A wrong / cancelled code belongs under the code box; anything else (rules, expired link) stays in the general message area.
      if (resetNeedsOtp && /code/i.test(msg)) setFieldErrors({ otp: msg }); else setError(msg);
    }
    setBusy(false);
  };

  const link = "text-xs border-0 bg-transparent cursor-pointer p-0 text-[var(--colorBrandForegroundLink)] hover:underline text-left";
  const notice = (
    <>
      {error && <span className="text-xs text-destructive" role="alert">{error}</span>}
      {info && <span className="text-xs text-foreground rounded-md bg-secondary/60 p-2" role="status">{info}</span>}
    </>
  );

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-sm bg-card rounded-lg border border-border shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}employee-connect.png`} alt="" className="w-9 h-9 rounded-md"/>
          <h1 className="text-lg" style={{ fontWeight: 700 }}>Employee Connect</h1>
        </div>

        {teamsTrying ? (
          <Spinner message="Signing you in with Microsoft Teams…"/>
        ) : mode === "login" ? (
          <form onSubmit={submitLogin} className="flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Employee ID
              <input autoFocus value={empNo} onChange={e => { setEmpNo(e.target.value); setError(""); setFieldErrors(f => ({ ...f, empNo: "" })); }} maxLength={10}
                autoComplete="username" aria-invalid={fieldErrors.empNo ? true : undefined} aria-describedby={fieldErrors.empNo ? "empNo-err" : undefined}
                className={inputCls + " w-full" + (fieldErrors.empNo ? " border-destructive" : "")}/>
              <FieldError id="empNo-err" message={fieldErrors.empNo}/>
            </label>
            <PasswordBox id="password" label="Password" value={password} onChange={v => { setPassword(v); setError(""); setFieldErrors(f => ({ ...f, password: "" })); }} autoComplete="current-password" error={fieldErrors.password}/>
            {notice}
            <Btn variant="primary" size="sm" loading={busy}><LogIn size={14}/> Login</Btn>
            <button type="button" className={link} onClick={() => go("forgot")}>Forgot password?</button>
          </form>
        ) : mode === "mfa" ? (
          <form onSubmit={submitMfa} className="flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">6-digit code
              <input autoFocus value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); setFieldErrors({}); }}
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-invalid={fieldErrors.otp ? true : undefined} aria-describedby={fieldErrors.otp ? "otp-err" : undefined}
                className={inputCls + " w-full tracking-[0.4em]" + (fieldErrors.otp ? " border-destructive" : "")}/>
              <FieldError id="otp-err" message={fieldErrors.otp}/>
            </label>
            {notice}
            <Btn variant="primary" size="sm" loading={busy}><ShieldCheck size={14}/> Verify</Btn>
            <button type="button" className={link} onClick={() => go("login")}>Back to sign in</button>
          </form>
        ) : mode === "forgot" ? (
          <form onSubmit={submitForgot} className="flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">E-mail address
              <input autoFocus type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); setInfo(""); setFieldErrors(f => ({ ...f, email: "" })); }} maxLength={255}
                autoComplete="email" aria-invalid={fieldErrors.email ? true : undefined} aria-describedby={fieldErrors.email ? "email-err" : undefined}
                className={inputCls + " w-full" + (fieldErrors.email ? " border-destructive" : "")}/>
              <FieldError id="email-err" message={fieldErrors.email}/>
            </label>
            {notice}
            <Btn variant="primary" size="sm" loading={busy}><Mail size={14}/> Send reset link</Btn>
            <button type="button" className={link} onClick={() => go("login")}>Back to sign in</button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="flex flex-col gap-3" noValidate>
            <p className="text-sm text-muted-foreground">{resetNeedsOtp ? "Enter the 6-digit code from the e-mail and choose a new password." : "Choose a new password."}</p>
            {resetNeedsOtp && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">6-digit code
                <input autoFocus value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); setFieldErrors(f => ({ ...f, otp: "" })); }}
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-invalid={fieldErrors.otp ? true : undefined} aria-describedby={fieldErrors.otp ? "otp-err" : undefined}
                  className={inputCls + " w-full tracking-[0.4em]" + (fieldErrors.otp ? " border-destructive" : "")}/>
                <FieldError id="otp-err" message={fieldErrors.otp}/>
              </label>
            )}
            <PasswordBox id="newPassword" label="New password" value={newPassword} onChange={v => { setNewPassword(v); setError(""); setFieldErrors(f => ({ ...f, newPassword: v ? passwordProblem("", v) : "", confirm: confirm && v !== confirm ? "Both passwords should match!" : "" })); }} autoComplete="new-password" autoFocus={!resetNeedsOtp} error={fieldErrors.newPassword}/>
            <PasswordBox id="confirm" label="Confirm new password" value={confirm} onChange={v => { setConfirm(v); setError(""); setFieldErrors(f => ({ ...f, confirm: v && v !== newPassword ? "Both passwords should match!" : "" })); }} autoComplete="new-password" error={fieldErrors.confirm}/>
            <ul className="flex flex-col gap-0.5 m-0 p-0 list-none">
              {PASSWORD_RULES.map(r => {
                const ok = r.test(newPassword);
                return (
                  <li key={r.id} className={"flex items-center gap-1.5 text-xs " + (ok ? "text-foreground" : newPassword ? "text-destructive" : "text-muted-foreground")}>
                    {ok ? <CheckCircle2 size={13}/> : <Circle size={13}/>} {r.label}
                  </li>
                );
              })}
              <li className="flex items-center gap-1.5 text-xs text-muted-foreground"><Circle size={13}/> Not one of your last 3 passwords</li>
            </ul>
            {notice}
            <Btn variant="primary" size="sm" loading={busy}><KeyRound size={14}/> Change password</Btn>
            <button type="button" className={link} onClick={() => { clearResetLinkToken(); setResetToken(""); go("login"); }}>Back to sign in</button>
          </form>
        )}
      </div>
    </div>
  );
}
