import React, { useState } from "react";
import { X, Mail, Lock, Sparkles, AlertCircle, LogIn, UserPlus } from "lucide-react";
import { getSupabaseClientAsync } from "../services/supabaseClient";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLanguage: "vi" | "en";
}

const tDict = {
  vi: {
    title: "Đồng bộ hóa đám mây",
    subtitle: "Đăng nhập để tự động sao lưu & đồng bộ dữ liệu bản tin đa thiết bị.",
    loginTab: "Đăng nhập",
    registerTab: "Đăng ký",
    emailLabel: "Địa chỉ Email",
    emailPlaceholder: "ten_cua_ban@example.com",
    passwordLabel: "Mật khẩu",
    passwordPlaceholder: "Tối thiểu 6 ký tự",
    btnSubmitLogin: "Đăng nhập ngay",
    btnSubmitRegister: "Đăng ký tài khoản",
    orWith: "Hoặc đăng nhập bằng",
    googleBtn: "Tiếp tục với Google",
    errorHeader: "Có lỗi xảy ra",
    successRegister: "Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác nhận tài khoản (nếu cần) hoặc đăng nhập trực tiếp.",
    successLogin: "Đăng nhập thành công!",
    loading: "Đang xử lý...",
    invalidEmail: "Email không hợp lệ.",
    invalidPassword: "Mật khẩu phải dài ít nhất 6 ký tự."
  },
  en: {
    title: "Cloud Synchronization",
    subtitle: "Sign in to automatically backup & sync your briefings across multiple devices.",
    loginTab: "Sign In",
    registerTab: "Sign Up",
    emailLabel: "Email Address",
    emailPlaceholder: "your_name@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "At least 6 characters",
    btnSubmitLogin: "Sign In Now",
    btnSubmitRegister: "Create Account",
    orWith: "Or continue with",
    googleBtn: "Continue with Google",
    errorHeader: "An error occurred",
    successRegister: "Account created! Please check your email to confirm or log in directly.",
    successLogin: "Successfully signed in!",
    loading: "Processing...",
    invalidEmail: "Invalid email format.",
    invalidPassword: "Password must be at least 6 characters."
  }
};

export default function LoginModal({ isOpen, onClose, uiLanguage }: LoginModalProps) {
  const t = tDict[uiLanguage];
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const validate = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg(t.invalidEmail);
      return false;
    }
    if (password.length < 6) {
      setErrorMsg(t.invalidPassword);
      return false;
    }
    return true;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const supabase = await getSupabaseClientAsync();
    if (!supabase) {
      setErrorMsg(uiLanguage === "vi" ? "Không kết nối được dịch vụ Supabase." : "Unable to connect to Supabase Cloud.");
      setLoading(false);
      return;
    }

    try {
      if (activeTab === "login") {
        // Log in
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        
        setSuccessMsg(t.successLogin);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // Sign up
        const { error, data } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;

        setSuccessMsg(t.successRegister);
        setActiveTab("login");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setErrorMsg(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const supabase = await getSupabaseClientAsync();
    if (!supabase) {
      setErrorMsg(uiLanguage === "vi" ? "Không kết nối được dịch vụ Supabase." : "Unable to connect to Supabase Cloud.");
      setLoading(false);
      return;
    }

    try {
      // Supabase Google Auth redirects the browser with fallback URL
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Điền chính xác đường link web thật của bạn vào đây:
          redirectTo: "https://pthanhnew.onrender.com/"
        }
      });
      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setErrorMsg(
        uiLanguage === "vi"
          ? `Lỗi Đăng nhập Google: ${err.message || "Không thể khởi tạo phiên xác thực."}`
          : `Google Sign-In Error: ${err.message || "Failed to initialize Google Authentication."}`
      );
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden relative shadow-2xl shadow-cyan-950/40"
        id="login-modal-panel"
      >
        
        {/* Banner header gradient */}
        <div className="bg-gradient-to-tr from-cyan-950 via-slate-900 to-amber-950/20 px-6 pt-6 pb-4 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 text-cyan-400 mb-1">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest">{uiLanguage === "vi" ? "Đám mây" : "Cloud Sync"}</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">{t.title}</h2>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">{t.subtitle}</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
          <button
            onClick={() => { setActiveTab("login"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 text-sm font-bold border-b-2 px-4 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "login"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{t.loginTab}</span>
          </button>
          <button
            onClick={() => { setActiveTab("register"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 text-sm font-bold border-b-2 px-4 flex items-center gap-2 transition cursor-pointer ${
              activeTab === "register"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.registerTab}</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          
          {/* Notifications */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t.errorHeader}</p>
                <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-emerald-300">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 animate-bounce" />
              <p className="leading-relaxed font-medium">{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.emailLabel}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.passwordLabel}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-400/10 active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>{activeTab === "login" ? t.btnSubmitLogin : t.btnSubmitRegister}</span>
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-slate-600 text-[10px] font-mono font-bold uppercase tracking-wider">{t.orWith}</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Google Auth Button */}
          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2.5 transition active:scale-98 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>{t.googleBtn}</span>
          </button>

        </div>
      </div>
    </div>
  );
}
