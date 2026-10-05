import React, { useState } from 'react';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle, 
  KeyRound, 
  CheckCircle2, 
  ShieldCheck,
  User,
  Cloud,
  ArrowRight
} from 'lucide-react';
import { UserAccount } from '../types';
import { loginWithGoogle } from '../services/firebaseSyncService';

interface InitialLoginViewProps {
  users: UserAccount[];
  onLogin: (user: UserAccount) => void;
  logoutNotice?: boolean;
}

export const InitialLoginView: React.FC<InitialLoginViewProps> = ({
  users,
  onLogin,
  logoutNotice = false,
}) => {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      const fbUser = await loginWithGoogle();
      if (!fbUser) throw new Error('Não foi possível obter os dados da conta Google.');

      // Match or create user account
      const found = users.find(
        (u) => u.email?.toLowerCase() === fbUser.email?.toLowerCase() ||
               (u.usuario && u.usuario.toLowerCase() === fbUser.email?.toLowerCase())
      );

      const resolvedUser: UserAccount = found ? {
        ...found,
        ultimoAcesso: `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      } : {
        id: fbUser.uid,
        nome: fbUser.displayName || 'Gestor Ambev',
        matricula: 'G1002',
        usuario: fbUser.email || 'armazemguarabira@gmail.com',
        email: fbUser.email || 'armazemguarabira@gmail.com',
        senha: '',
        perfil: 'ADMIN',
        cargo: 'Administrador DPO / Armazém',
        depositoPermitido: 'ALL',
        ativo: true,
        criadoEm: new Date().toISOString(),
        ultimoAcesso: `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        avatarCor: 'bg-purple-600'
      };

      onLogin(resolvedUser);
    } catch (err: any) {
      console.error('Erro no login Google:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err?.message || 'Falha na autenticação com conta Google.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const loginInput = usuario.trim().toUpperCase();
    const senhaInput = senha.trim();

    if (!loginInput) {
      setErrorMessage('Informe o usuário ou matrícula.');
      return;
    }

    if (!senhaInput) {
      setErrorMessage('Informe a senha de acesso.');
      return;
    }

    setIsSubmitting(true);

    // Search user by matrícula, usuario or email
    const foundUser = users.find(
      (u) =>
        (u.matricula && u.matricula.trim().toUpperCase() === loginInput) ||
        (u.usuario && u.usuario.trim().toUpperCase() === loginInput) ||
        (u.email && u.email.trim().toUpperCase() === loginInput)
    );

    if (!foundUser) {
      setIsSubmitting(false);
      setErrorMessage(`Usuário ou matrícula "${usuario.trim()}" não encontrado.`);
      return;
    }

    if (foundUser.senha !== senhaInput) {
      setIsSubmitting(false);
      setErrorMessage('Senha incorreta. Verifique suas credenciais.');
      return;
    }

    if (!foundUser.ativo) {
      setIsSubmitting(false);
      setErrorMessage('Esta conta de acesso está inativa ou bloqueada.');
      return;
    }

    // Success login
    setTimeout(() => {
      setIsSubmitting(false);
      onLogin(foundUser);
    }, 200);
  };

  const handleFillDemo = (demoMatricula: string, demoPass: string) => {
    setUsuario(demoMatricula);
    setSenha(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#0A101D] text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 relative selection:bg-emerald-500 selection:text-white">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Placeholder / Space */}
      <div className="w-full max-w-md pt-4 sm:pt-8 flex justify-center">
        {logoutNotice && (
          <div className="w-full mb-3 p-3 bg-slate-800/80 border border-slate-700/80 text-emerald-400 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Você saiu do sistema com sucesso.</span>
          </div>
        )}
      </div>

      {/* Center: Main Login Card */}
      <div className="w-full max-w-md z-10 my-auto">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Logo & Platform Name */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-white mx-auto flex items-center justify-center p-1.5 shadow-lg border border-slate-700 mb-3">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-emerald-500 flex items-center justify-center text-white font-black text-xl tracking-tighter">
                PB
              </div>
            </div>

            <h1 className="text-lg sm:text-xl font-black tracking-wider text-white">
              PAU BRASIL
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              DISTRIBUIDORA <span className="text-blue-400 font-black">AMBEV</span>
            </p>
            <div className="mt-2 text-xs font-medium text-slate-300">
              Gestão de Perdas & Conciliação de Estoque
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-5 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo de Usuário / Matrícula */}
            <div>
              <label 
                htmlFor="login-usuario" 
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Usuário ou Matrícula
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="login-usuario"
                  type="text"
                  autoFocus
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="ex: G1002"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono tracking-wide transition"
                />
              </div>
            </div>

            {/* Campo de Senha */}
            <div>
              <label 
                htmlFor="login-senha" 
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="login-senha"
                  type={showSenha ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono tracking-wide transition"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((prev) => !prev)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition"
                  title={showSenha ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Entrar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isGoogleLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Entrar no Sistema</span>
                  </>
                )}
              </button>
            </div>

            {/* Divisor com Firebase */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-slate-900 px-3 text-slate-400 font-medium flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-amber-400" />
                  ou autenticação Firebase
                </span>
              </div>
            </div>

            {/* Botão Google Login via Firebase */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isGoogleLoading}
              className="w-full bg-slate-800 hover:bg-slate-700/90 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition border border-slate-700 flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-70 cursor-pointer shadow-xs"
            >
              {isGoogleLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Entrar com Conta Google</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400 mb-2 font-medium">
              Acesso rápido para testes de demonstração:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('G1002', 'admin')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 text-[11px] font-mono flex items-center gap-1.5 transition"
                title="Preencher login de Administrador"
              >
                <KeyRound className="w-3 h-3 text-emerald-400" />
                <span>G1002 (admin)</span>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('G1001', 'dpo')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 text-[11px] font-mono flex items-center gap-1.5 transition"
                title="Preencher login de Gestor DPO"
              >
                <KeyRound className="w-3 h-3 text-blue-400" />
                <span>G1001 (dpo)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Copyright */}
      <footer className="w-full max-w-md py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Autenticação Segura • CDD Pau Brasil Ambev</span>
      </footer>
    </div>
  );
};
