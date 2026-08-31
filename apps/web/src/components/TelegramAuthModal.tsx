import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';

const getApiBaseUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim() !== '') return envUrl;
  return ''; // Use relative pathing so Vite proxy (/api -> http://localhost:3000) handles requests seamlessly
};

export const TelegramAuthModal: React.FC = () => {
  const { showAuthModal, setShowAuthModal, loginUser } = useStore();

  // Modal Step State: 1 = OTP Code Entry, 2 = Profile Name Registration (for new users)
  const [authStep, setAuthStep] = useState<1 | 2>(1);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [fullName, setFullName] = useState<string>('');
  const [verifiedPhone, setVerifiedPhone] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isHasError, setIsHasError] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const BOT_USERNAME = 'microstore21_bot';

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAuthModal) {
      if (authStep === 1 && inputRefs[0].current) {
        inputRefs[0].current.focus();
      } else if (authStep === 2 && nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }
  }, [showAuthModal, authStep]);

  if (!showAuthModal) return null;

  const handleOtpChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (isHasError) {
      setIsHasError(false);
      setErrorMsg('');
    }

    if (!clean) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (clean.length >= 4) {
      const pasted = clean.slice(0, 4).split('');
      const newDigits = ['', '', '', ''];
      pasted.forEach((ch, i) => {
        newDigits[i] = ch;
      });
      setOtpDigits(newDigits);
      inputRefs[3].current?.focus();
      return;
    }

    const char = clean.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    // Auto-focus next input box
    if (index < 3 && inputRefs[index + 1].current) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData.length > 0) {
      const digits = pastedData.slice(0, 4).split('');
      const newDigits = ['', '', '', ''];
      digits.forEach((d, i) => {
        newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const focusIndex = Math.min(digits.length - 1, 3);
      inputRefs[focusIndex].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  // Step 1: Clean 4-Digit Concatenation & API OTP Verification
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = String(otpDigits.join('')).trim();

    if (cleanCode.length < 4) {
      setIsHasError(true);
      setErrorMsg("Iltimos, bot bergan 4 xonali kodni to'liq kiriting!");
      return;
    }

    setIsVerifying(true);
    setIsHasError(false);
    setErrorMsg('');

    try {
      const baseUrl = getApiBaseUrl();
      const digitsOnly = verifiedPhone ? verifiedPhone.replace(/\D/g, '') : '';
      const normalizedPhone = digitsOnly ? `+${digitsOnly}` : undefined;

      const payload = {
        phone: normalizedPhone,
        code: cleanCode,
        otp: cleanCode,
      };

      console.log(`🌐 Submitting OTP code "${cleanCode}" to ${baseUrl}/api/v1/auth/verify-otp`);

      // Send JSON payload with clean phone and 4-digit code string
      const response = await fetch(`${baseUrl}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ success: false, error: 'Server javobida xatolik yuz berdi' }));

      if (!response.ok || !data.success) {
        // Highlight inputs with red border and set error text
        setIsHasError(true);
        setErrorMsg(data.error || "Kiritilgan kod xato yoki muddati o'tgan!");
        setIsVerifying(false);
        return; // STOP EXECUTION HERE STRICTLY
      }

      // Successful OTP Verification: Reset error states
      setIsHasError(false);
      setErrorMsg('');
      setVerifiedPhone(data.user?.phone || '');

      if (data.is_new_user) {
        setIsVerifying(false);
        setAuthStep(2); // Open "Ismingizni kiriting" step
      } else {
        loginUser({
          id: data.user.id,
          name: data.user.name,
          username: data.user.username || 'microstore_user',
          phone: data.user.phone,
          role: data.user.role || 'owner',
          storeId: data.user.storeId || 'store_main',
          photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.user.name || 'User')}`,
        });
        setIsVerifying(false);
        resetModal();
      }
    } catch (err) {
      console.error('OTP Verification Network Error:', err);
      setIsHasError(true);
      setErrorMsg("Server bilan aloqa o'rnatib bo'lmadi! Backend (port 3000) ishlayotganini tekshiring.");
      setIsVerifying(false);
    }
  };

  // Step 2: Complete Registration with Name
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setIsHasError(true);
      setErrorMsg("Iltimos, ismingizni yoki do'koningiz nomini kiriting!");
      return;
    }

    setIsVerifying(true);
    setIsHasError(false);
    setErrorMsg('');

    const fullOtp = otpDigits.join('').trim() || '1234';

    setTimeout(() => {
      loginUser({
        id: `tg-${fullOtp}`,
        name: fullName.trim(),
        username: 'microstore_user',
        phone: verifiedPhone || '+998 90 123 45 67',
        photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName.trim())}`,
      });
      setIsVerifying(false);
      resetModal();
    }, 400);
  };

  const resetModal = () => {
    setOtpDigits(['', '', '', '']);
    setAuthStep(1);
    setFullName('');
    setIsHasError(false);
    setErrorMsg('');
    setIsVerifying(false);
    setShowAuthModal(false);
  };

  const handleOpenBot = () => {
    window.open(`https://t.me/${BOT_USERNAME}`, '_blank');
  };

  return (
    <div
      onClick={resetModal}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999999] flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant p-6 sm:p-7 flex flex-col gap-5 relative animate-scaleUp"
      >
        {/* Modal Close Button */}
        <button
          type="button"
          onClick={resetModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-variant flex items-center justify-center text-on-surface-variant font-bold transition-all text-sm"
          title="Yopish"
        >
          ✕
        </button>

        {/* Modal Header Icon & Title */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-[#059669]/10 text-[#059669] flex items-center justify-center font-extrabold text-2xl mb-1 shadow-inner">
            <span className="material-symbols-outlined text-3xl">send</span>
          </div>
          <h2 className="font-headline font-extrabold text-xl text-on-surface">
            Telegram Orqali Avtorizatsiya
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
            Botimizga o'tib <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosing va olingan 4-xonali kodni kiriting.
          </p>
        </div>

        {authStep === 1 && (
          <>
            {/* Primary Bot Action Button */}
            <button
              type="button"
              onClick={handleOpenBot}
              className="w-full py-3 bg-[#24A1DE] hover:bg-[#1E88C7] text-white rounded-xl font-headline font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              @{BOT_USERNAME} ga o'tish
            </button>

            {/* OTP Code Section Label */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 border-t border-outline-variant"></div>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Telegram bergan 4-xonali kod
              </span>
              <div className="flex-1 border-t border-outline-variant"></div>
            </div>

            {/* 4-Digit Pin Inputs with Red Error Borders */}
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3">
              <div className="flex justify-center gap-3 py-1">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={inputRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className={`w-12 h-14 bg-surface-container-low border-2 rounded-2xl text-center text-2xl font-black text-on-surface focus:outline-none transition-all shadow-xs ${
                      isHasError
                        ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-600'
                        : 'border-outline-variant focus:border-[#059669]'
                    }`}
                  />
                ))}
              </div>

              {/* Explicit Red UI Error Display */}
              {errorMsg && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-700 text-center animate-shake">
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3.5 bg-[#059669] hover:bg-emerald-700 text-white rounded-xl font-headline font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] mt-1 flex items-center justify-center gap-1.5"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    Tekshirilmoqda...
                  </span>
                ) : (
                  'Tasdiqlash va Kirish'
                )}
              </button>
            </form>
          </>
        )}

        {/* STEP 2: Name Registration for New Users */}
        {authStep === 2 && (
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-4 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col gap-1 text-center pr-6">
              <h3 className="font-headline font-extrabold text-lg text-on-surface">
                Ismingizni kiriting
              </h3>
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                Ma'lumotlaringizni saqlash va tizimdan foydalanish uchun ismingizni yoki do'koningiz nomini kiriting.
              </p>
            </div>

            {/* Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant">
                Ismingiz yoki Do'kon nomi
              </label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Masalan: Sardorbek"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-surface-container-low border-2 border-outline-variant focus:border-[#059669] rounded-2xl px-4 py-3 text-sm font-bold text-on-surface focus:outline-none transition-all"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-700 text-center">
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 bg-[#059669] hover:bg-emerald-700 text-white rounded-xl font-headline font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] mt-1 flex items-center justify-center gap-1.5"
            >
              {isVerifying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  Saqlanmoqda...
                </span>
              ) : (
                'Ro\'yxatdan o\'tishni yakunlash'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
