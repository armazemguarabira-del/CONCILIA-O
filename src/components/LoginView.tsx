import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Unlock, 
  Mail, 
  Building2, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  Search, 
  Eye, 
  EyeOff, 
  LogOut, 
  LogIn, 
  Shield, 
  UserCheck, 
  X,
  AlertTriangle,
  BadgeCheck,
  ArrowRight
} from 'lucide-react';
import { UserAccount, UserRole, DepositoId, ViewTab } from '../types';
import { DEPOSITOS } from '../data/initialData';
import { loginWithGoogle } from '../services/firebaseSyncService';

interface LoginViewProps {
  users: UserAccount[];
  setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  currentUser: UserAccount | null;
  setCurrentUser: (user: UserAccount | null) => void;
  onNavigateTab: (tab: ViewTab) => void;
  onLogout?: () => void;
}

const ROLES_INFO: Record<UserRole, { label: string; badgeColor: string; description: string }> = {
  ADMIN: {
    label: 'Administrador Geral',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Acesso irrestrito a todos os depósitos, importações, cadastros e parametrizações DPO.',
  },
  GESTOR_DPO: {
    label: 'Gestor DPO',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Visualização e gestão de indicadores, conciliação e relatórios executivos.',
  },
  SUPERVISOR_ESTOQUE: {
    label: 'Supervisor de Armazém',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Acompanhamento operacional de quebras, percas por área e contagem física.',
  },
  CONFERENTE: {
    label: 'Conferente de Doca',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Registro de faltas mapeadas em carga, vales e conferência de recebimento.',
  },
};

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-purple-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-slate-700',
];

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  setUsers,
  currentUser,
  setCurrentUser,
  onNavigateTab,
  onLogout,
}) => {
  // Authentication Form State
  const [authCardTab, setAuthCardTab] = useState<'login' | 'register'>('login');
  const [showSwitchLoginBox, setShowSwitchLoginBox] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notFoundLogin, setNotFoundLogin] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // Table Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'ALL'>('ALL');
  const [filterDeposito, setFilterDeposito] = useState<DepositoId | 'ALL'>('ALL');

  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserAccount | null>(null);

  // Form State for User Modal / Registration (Create / Edit)
  const [formNome, setFormNome] = useState('');
  const [formUsuario, setFormUsuario] = useState(''); // Matrícula
  const [formEmail, setFormEmail] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formConfirmSenha, setFormConfirmSenha] = useState('');
  const [formPerfil, setFormPerfil] = useState<UserRole>('SUPERVISOR_ESTOQUE');
  const [formCargo, setFormCargo] = useState('');
  const [formDeposito, setFormDeposito] = useState<DepositoId | 'ALL'>('ALL');
  const [formAtivo, setFormAtivo] = useState(true);
  const [formAvatarCor, setFormAvatarCor] = useState(AVATAR_COLORS[0]);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Visible Passwords map for quick toggle in table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Perform Login with Matrícula, Username, or Email
  const handlePerformLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError(null);
    setNotFoundLogin(null);
    setLoginSuccess(null);

    const trimmedLogin = loginInput.trim().toUpperCase();
    if (!trimmedLogin) {
      setLoginError('Por favor, informe a Matrícula do colaborador para entrar.');
      return;
    }

    const foundUser = users.find(
      (u) =>
        (u.matricula && u.matricula.trim().toUpperCase() === trimmedLogin) ||
        (u.usuario && u.usuario.trim().toUpperCase() === trimmedLogin) ||
        (u.email && u.email.trim().toUpperCase() === trimmedLogin)
    );

    if (!foundUser) {
      setLoginError(`Matrícula ou login "${loginInput.trim()}" não encontrado no sistema.`);
      setNotFoundLogin(loginInput.trim().toUpperCase());
      return;
    }

    if (!foundUser.ativo) {
      setLoginError('Este colaborador está inativo/bloqueado. Contate o administrador.');
      return;
    }

    if (foundUser.senha !== passwordInput) {
      setLoginError('Senha incorreta para esta matrícula.');
      return;
    }

    // Success
    const updatedUser = {
      ...foundUser,
      matricula: foundUser.matricula || foundUser.usuario,
      ultimoAcesso: `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    };

    setUsers((prev) => prev.map((u) => (u.id === foundUser.id ? updatedUser : u)));
    setCurrentUser(updatedUser);
    setLoginSuccess(`Log in efetuado com sucesso! Bem-vindo, ${foundUser.nome} (Matrícula: ${updatedUser.matricula}).`);
    setPasswordInput('');
    setShowSwitchLoginBox(false);
  };

  // Quick switch to registration when matrícula wasn't found
  const handleStartRegisterFromLogin = (mat: string) => {
    setAuthCardTab('register');
    setFormUsuario(mat.toUpperCase());
    setFormNome('');
    setFormEmail('');
    setFormSenha('');
    setFormConfirmSenha('');
    setFormPerfil('SUPERVISOR_ESTOQUE');
    setFormCargo(ROLES_INFO.SUPERVISOR_ESTOQUE.label);
    setFormDeposito('ALL');
    setFormError(null);
    setLoginError(null);
    setNotFoundLogin(null);
    setShowSwitchLoginBox(true);
  };

  // Quick switch / Direct Login from table
  const handleQuickLogin = (user: UserAccount) => {
    if (!user.ativo) {
      alert('Não é possível entrar com um usuário inativo.');
      return;
    }
    const updatedUser = {
      ...user,
      matricula: user.matricula || user.usuario,
      ultimoAcesso: `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    };
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    setCurrentUser(updatedUser);
    setLoginSuccess(`Você alternou para a conta: ${user.nome} (Matrícula: ${updatedUser.matricula}).`);
    setLoginError(null);
    setShowSwitchLoginBox(false);
  };

  // Logout
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      setCurrentUser(null);
      setShowSwitchLoginBox(true);
      setLoginSuccess(null);
      setLoginError(null);
    }
  };

  // Open Create User Modal
  const handleOpenCreateModal = (presetMatricula?: string) => {
    setEditingUser(null);
    setFormNome('');
    setFormUsuario(presetMatricula ? presetMatricula.toUpperCase() : '');
    setFormEmail('');
    setFormSenha('');
    setFormConfirmSenha('');
    setFormPerfil('SUPERVISOR_ESTOQUE');
    setFormCargo(ROLES_INFO.SUPERVISOR_ESTOQUE.label);
    setFormDeposito('ALL');
    setFormAtivo(true);
    setFormAvatarCor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
    setFormError(null);
    setIsUserModalOpen(true);
  };

  // Open Edit User Modal
  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setFormNome(user.nome);
    setFormUsuario(user.matricula || user.usuario);
    setFormEmail(user.email || '');
    setFormSenha(''); // Empty means keep current
    setFormConfirmSenha('');
    setFormPerfil(user.perfil);
    setFormCargo(user.cargo);
    setFormDeposito(user.depositoPermitido);
    setFormAtivo(user.ativo);
    setFormAvatarCor(user.avatarCor || AVATAR_COLORS[0]);
    setFormError(null);
    setIsUserModalOpen(true);
  };

  // Save User (Create or Update)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedNome = formNome.trim();
    const trimmedMatricula = formUsuario.trim().toUpperCase();
    const trimmedEmail = formEmail.trim().toLowerCase();

    if (!trimmedMatricula) {
      setFormError('Informe a Matrícula do colaborador (ex: G1002).');
      return;
    }

    if (!trimmedNome) {
      setFormError('Informe o nome completo do colaborador.');
      return;
    }

    // Check duplicate matricula or login
    const duplicate = users.find(
      (u) =>
        ((u.matricula && u.matricula.trim().toUpperCase() === trimmedMatricula) ||
          (u.usuario && u.usuario.trim().toUpperCase() === trimmedMatricula)) &&
        (!editingUser || u.id !== editingUser.id)
    );
    if (duplicate) {
      setFormError(`A matrícula / login "${trimmedMatricula}" já está cadastrada para "${duplicate.nome}".`);
      return;
    }

    // Password validation for new users
    if (!editingUser) {
      if (!formSenha) {
        setFormError('Defina uma senha de acesso para o novo login.');
        return;
      }
      if (formSenha !== formConfirmSenha) {
        setFormError('A confirmação de senha não coincide com a senha digitada.');
        return;
      }
    } else {
      // Editing: if password is entered, must match confirmation
      if (formSenha && formSenha !== formConfirmSenha) {
        setFormError('A confirmação de senha não coincide com a nova senha digitada.');
        return;
      }
    }

    if (editingUser) {
      // Update existing
      const updatedUser: UserAccount = {
        ...editingUser,
        nome: trimmedNome,
        matricula: trimmedMatricula,
        usuario: trimmedMatricula,
        email: trimmedEmail || undefined,
        senha: formSenha ? formSenha : editingUser.senha,
        perfil: formPerfil,
        cargo: formCargo.trim() || ROLES_INFO[formPerfil].label,
        depositoPermitido: formDeposito,
        ativo: formAtivo,
        avatarCor: formAvatarCor,
      };

      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updatedUser : u)));

      // If editing currently active user, update state too
      if (currentUser?.id === editingUser.id) {
        setCurrentUser(updatedUser);
      }

      setIsUserModalOpen(false);
      setShowSwitchLoginBox(false);
      setLoginSuccess(`Dados da matrícula ${trimmedMatricula} atualizados com sucesso!`);
    } else {
      // Create new
      const newUser: UserAccount = {
        id: `usr-${Date.now().toString().slice(-6)}`,
        nome: trimmedNome,
        matricula: trimmedMatricula,
        usuario: trimmedMatricula,
        email: trimmedEmail || undefined,
        senha: formSenha,
        perfil: formPerfil,
        cargo: formCargo.trim() || ROLES_INFO[formPerfil].label,
        depositoPermitido: formDeposito,
        ativo: formAtivo,
        criadoEm: new Date().toISOString().slice(0, 10),
        ultimoAcesso: `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        avatarCor: formAvatarCor,
      };

      setUsers((prev) => [newUser, ...prev]);
      setCurrentUser(newUser); // Automatically log in as the newly registered user
      setIsUserModalOpen(false);
      setShowSwitchLoginBox(false);
      setAuthCardTab('login');
      setLoginSuccess(`Matrícula ${trimmedMatricula} cadastrada com sucesso e conectada na plataforma!`);
    }
  };

  // Delete User Confirmation
  const handleDeleteUser = () => {
    if (!deleteConfirmUser) return;

    if (users.length <= 1) {
      alert('Não é possível excluir o único login do sistema.');
      setDeleteConfirmUser(null);
      return;
    }

    const wasCurrent = currentUser?.id === deleteConfirmUser.id;

    setUsers((prev) => prev.filter((u) => u.id !== deleteConfirmUser.id));

    if (wasCurrent) {
      setCurrentUser(null);
      setShowSwitchLoginBox(true);
      setLoginSuccess(null);
    }

    setDeleteConfirmUser(null);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !searchTerm.trim() ||
        u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.matricula && u.matricula.toLowerCase().includes(searchTerm.toLowerCase())) ||
        u.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        u.cargo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = filterRole === 'ALL' || u.perfil === filterRole;
      const matchDep = filterDeposito === 'ALL' || u.depositoPermitido === filterDeposito;

      return matchSearch && matchRole && matchDep;
    });
  }, [users, searchTerm, filterRole, filterDeposito]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-slate-900 text-white flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Ambev Pau Brasil • Controle de Acesso
            </span>
            <span className="text-xs text-slate-500 font-semibold">• Gestão de Usuários</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Guia de Log In & Cadastros de Usuários
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
            Acesse e cadastre logins utilizando a <strong className="text-slate-900 font-bold">Matrícula do Colaborador</strong> (ex: <span className="font-mono text-emerald-700 font-bold">G1002</span>). Cadastre, edite ou exclua permissões operacionais e de gestão.
          </p>
        </div>

        <button
          onClick={() => handleOpenCreateModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-2 whitespace-nowrap active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Cadastrar Nova Matrícula</span>
        </button>
      </div>

      {/* Grid: Active Session / Sign In Box + Quick Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Col 1 & 2: Active User Card or Log In / Registration Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          {currentUser && !showSwitchLoginBox ? (
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Sessão Autenticada Atualmente</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ONLINE
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div
                  className={`w-14 h-14 rounded-xl ${
                    currentUser.avatarCor || 'bg-emerald-600'
                  } text-white flex items-center justify-center font-bold text-xl shadow-xs flex-shrink-0`}
                >
                  {currentUser.nome.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      {currentUser.nome}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ROLES_INFO[currentUser.perfil]?.badgeColor || 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {ROLES_INFO[currentUser.perfil]?.label || currentUser.perfil}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">Matrícula (Login):</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-xs inline-flex items-center gap-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {currentUser.matricula || currentUser.usuario}
                    </span>
                    {currentUser.email && (
                      <span className="text-slate-500 text-xs font-sans">({currentUser.email})</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      Depósito:{' '}
                      <strong className="text-slate-800">
                        {currentUser.depositoPermitido === 'ALL'
                          ? 'Todos os Depósitos'
                          : `Depósito ${currentUser.depositoPermitido}`}
                      </strong>
                    </span>
                    {currentUser.ultimoAcesso && (
                      <span className="text-slate-400">• Acesso: {currentUser.ultimoAcesso}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button
                    onClick={() => {
                      setAuthCardTab('login');
                      setShowSwitchLoginBox(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Trocar Matrícula</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(currentUser)}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Perfil</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <span>Deseja alternar para outro usuário? Escolha na tabela abaixo e clique em <strong>"Entrar"</strong>.</span>
                <button
                  onClick={() => onNavigateTab('dashboard')}
                  className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline"
                >
                  Ir para o Dashboard →
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Card Header with Tab Switch: Entrar vs Cadastrar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 mb-4 gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthCardTab('login');
                      setLoginError(null);
                      setNotFoundLogin(null);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                      authCardTab === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Entrar com Matrícula</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthCardTab('register');
                      setLoginError(null);
                      setFormError(null);
                      if (!formUsuario) setFormUsuario('G');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                      authCardTab === 'register'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                    <span>+ Cadastrar Nova Matrícula</span>
                  </button>
                </div>

                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setShowSwitchLoginBox(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium hover:underline self-end sm:self-auto"
                  >
                    Voltar para {currentUser.nome} ({currentUser.matricula || currentUser.usuario})
                  </button>
                )}
              </div>

              {/* Error Alert with Call to Action */}
              {loginError && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                  {notFoundLogin && (
                    <div className="pt-2 border-t border-rose-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-slate-700">
                        A matrícula <strong>{notFoundLogin}</strong> ainda não está no cadastro.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartRegisterFromLogin(notFoundLogin)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs flex items-center justify-center gap-1 transition shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Cadastrar {notFoundLogin} agora</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Form Error for inline registration */}
              {formError && authCardTab === 'register' && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Success Alert */}
              {loginSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{loginSuccess}</span>
                </div>
              )}

              {/* TAB 1: ENTRAR COM MATRÍCULA */}
              {authCardTab === 'login' ? (
                <form onSubmit={handlePerformLogin} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Matrícula (Login de Acesso) *</span>
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                          ex: G1002
                        </span>
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={loginInput}
                          onChange={(e) => setLoginInput(e.target.value)}
                          placeholder="Digite a Matrícula (ex: G1002)"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                          required
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Utilize sua matrícula de colaborador como login.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Senha de Acesso *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Digite sua senha"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-10 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((p) => !p)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                          title={showLoginPassword ? 'Ocultar Senha' : 'Ver Senha'}
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Senha cadastrada para sua matrícula.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 gap-3">
                    <div className="text-xs text-slate-500">
                      Sugestão de teste rápido: Matrícula <strong className="font-mono text-slate-800">G1002</strong> (senha: <strong>admin</strong>)
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const fbUser = await loginWithGoogle();
                            if (fbUser) {
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
                              setCurrentUser(resolvedUser);
                              setShowSwitchLoginBox(false);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-lg text-xs font-bold border border-slate-300 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" />
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                        </svg>
                        <span>Google Firebase</span>
                      </button>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Entrar no Sistema</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* TAB 2: CADASTRAR NOVA MATRÍCULA (INLINE) */
                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Matrícula */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Matrícula do Colaborador (Login) *</span>
                        <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded">
                          Login Principal
                        </span>
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-purple-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          value={formUsuario}
                          onChange={(e) => setFormUsuario(e.target.value.toUpperCase())}
                          placeholder="ex: G1002"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono font-bold uppercase"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Esta matrícula será utilizada pelo colaborador para fazer login.
                      </p>
                    </div>

                    {/* Nome Completo */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome Completo do Colaborador *
                      </label>
                      <input
                        type="text"
                        required
                        value={formNome}
                        onChange={(e) => setFormNome(e.target.value)}
                        placeholder="ex: Carlos Alberto Ferreira"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Nome de identificação nas ações e relatórios.</p>
                    </div>

                    {/* Senha */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Senha de Acesso *
                      </label>
                      <input
                        type="password"
                        required
                        value={formSenha}
                        onChange={(e) => setFormSenha(e.target.value)}
                        placeholder="Crie uma senha de acesso"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      />
                    </div>

                    {/* Confirmar Senha */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Confirmar Senha *
                      </label>
                      <input
                        type="password"
                        required
                        value={formConfirmSenha}
                        onChange={(e) => setFormConfirmSenha(e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      />
                    </div>

                    {/* Perfil */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Perfil de Permissão *
                      </label>
                      <select
                        value={formPerfil}
                        onChange={(e) => {
                          const role = e.target.value as UserRole;
                          setFormPerfil(role);
                          setFormCargo(ROLES_INFO[role].label);
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                      >
                        <option value="ADMIN">Administrador Geral (Acesso Total)</option>
                        <option value="GESTOR_DPO">Gestor DPO</option>
                        <option value="SUPERVISOR_ESTOQUE">Supervisor de Armazém</option>
                        <option value="CONFERENTE">Conferente de Doca</option>
                      </select>
                    </div>

                    {/* Depósito */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Depósito Vinculado
                      </label>
                      <select
                        value={formDeposito}
                        onChange={(e) => setFormDeposito(e.target.value as DepositoId | 'ALL')}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                      >
                        <option value="ALL">Todos os Depósitos</option>
                        {DEPOSITOS.map((d) => (
                          <option key={d.id} value={d.id}>
                            Depósito {d.id} - {d.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* E-mail (Opcional) */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>E-mail Corporativo</span>
                        <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                      </label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="ex: colaborador@ambev.com.br"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3">
                    <span className="text-[11px] text-slate-500">
                      O novo colaborador será salvo e conectado automaticamente na sessão.
                    </span>
                    <button
                      type="submit"
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Cadastrar Matrícula e Conectar</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Col 3: Quick Role Summary & System Stats */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
              <Shield className="w-4 h-4 text-purple-600" />
              <span>Resumo de Logins & Acessos</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 font-medium">Total Cadastrados</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">{users.length}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-[11px] text-emerald-700 font-medium">Logins Ativos</p>
                <p className="text-xl font-black text-emerald-800 mt-0.5">
                  {users.filter((u) => u.ativo).length}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-[11px] text-purple-700 font-medium">Administradores</p>
                <p className="text-xl font-black text-purple-800 mt-0.5">
                  {users.filter((u) => u.perfil === 'ADMIN').length}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-[11px] text-blue-700 font-medium">Supervisores/DPO</p>
                <p className="text-xl font-black text-blue-800 mt-0.5">
                  {users.filter((u) => u.perfil === 'GESTOR_DPO' || u.perfil === 'SUPERVISOR_ESTOQUE').length}
                </p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex items-center gap-1.5 mt-3">
            <KeyRound className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>Senhas e credenciais vinculadas por matrícula com persistência local.</span>
          </div>
        </div>

      </div>

      {/* Main Table: Cadastros de Log In */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              Contas e Matrículas Cadastradas ({filteredUsers.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por matrícula (ex: G1002), nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRole | 'ALL')}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Todos os Perfis</option>
              <option value="ADMIN">Administrador Geral</option>
              <option value="GESTOR_DPO">Gestor DPO</option>
              <option value="SUPERVISOR_ESTOQUE">Supervisor de Armazém</option>
              <option value="CONFERENTE">Conferente de Doca</option>
            </select>

            {/* Depósito Filter */}
            <select
              value={filterDeposito}
              onChange={(e) => setFilterDeposito(e.target.value as DepositoId | 'ALL')}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Todos os Depósitos</option>
              {DEPOSITOS.map((d) => (
                <option key={d.id} value={d.id}>
                  Depósito {d.id} - {d.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">COLABORADOR</th>
                <th className="py-3 px-4">MATRÍCULA / LOGIN</th>
                <th className="py-3 px-4">PERFIL / CARGO</th>
                <th className="py-3 px-4">DEPÓSITO</th>
                <th className="py-3 px-4">SENHA</th>
                <th className="py-3 px-4 text-center">STATUS</th>
                <th className="py-3 px-4">ÚLTIMO ACESSO</th>
                <th className="py-3 px-4 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhum login encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isPasswordVisible = visiblePasswords[u.id];
                  const userMatricula = u.matricula || u.usuario;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isCurrent ? 'bg-emerald-50/40 font-medium' : ''
                      }`}
                    >
                      {/* Colaborador */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg ${
                              u.avatarCor || 'bg-emerald-600'
                            } text-white flex items-center justify-center font-bold text-sm flex-shrink-0`}
                          >
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{u.nome}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                  VOCÊ
                                </span>
                              )}
                            </div>
                            {u.email ? (
                              <span className="text-[10px] text-slate-400 block">{u.email}</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic block">Sem e-mail informado</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Matrícula / Login */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold text-xs inline-flex items-center gap-1 shadow-2xs">
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                            {userMatricula}
                          </span>
                        </div>
                      </td>

                      {/* Perfil & Cargo */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ROLES_INFO[u.perfil]?.badgeColor || 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {ROLES_INFO[u.perfil]?.label || u.perfil}
                        </span>
                        <span className="block text-[11px] text-slate-600 mt-0.5">{u.cargo}</span>
                      </td>

                      {/* Depósito */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {u.depositoPermitido === 'ALL' ? (
                          <span className="text-purple-700 font-bold">Todos os Depósitos</span>
                        ) : (
                          <span>Depósito {u.depositoPermitido}</span>
                        )}
                      </td>

                      {/* Senha */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">
                            {isPasswordVisible ? u.senha : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                            title={isPasswordVisible ? 'Ocultar Senha' : 'Ver Senha'}
                          >
                            {isPasswordVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {u.ativo ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ATIVO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            INATIVO
                          </span>
                        )}
                      </td>

                      {/* Último Acesso */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {u.ultimoAcesso || `Criado em ${u.criadoEm}`}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Log in with this user */}
                          <button
                            onClick={() => handleQuickLogin(u)}
                            disabled={isCurrent || !u.ativo}
                            className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                              isCurrent
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                            title="Entrar com esta matrícula"
                          >
                            <LogIn className="w-3 h-3" />
                            <span>{isCurrent ? 'Ativo' : 'Entrar'}</span>
                          </button>

                          {/* Edit User */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition"
                            title="Editar Matrícula / Permissões"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                            title="Excluir Matrícula"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Criar / Editar Usuário */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  {editingUser ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {editingUser ? 'Editar Cadastro de Matrícula' : 'Cadastrar Nova Matrícula (Login)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingUser
                      ? `Atualizando dados da matrícula ${editingUser.matricula || editingUser.usuario}`
                      : 'A matrícula cadastrada será o login oficial de acesso do colaborador'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Matrícula (Login) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Matrícula do Colaborador (Login) *</span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                      ex: G1002
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsuario}
                    onChange={(e) => setFormUsuario(e.target.value.toUpperCase())}
                    placeholder="ex: G1002"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Identificador exclusivo para login no sistema.</p>
                </div>

                {/* Nome Completo */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nome Completo do Colaborador *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="ex: Carlos Alberto Ferreira"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Nome exibido na plataforma e relatórios.</p>
                </div>

                {/* Senha */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {editingUser ? 'Nova Senha (em branco para manter)' : 'Senha de Acesso *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      value={formSenha}
                      onChange={(e) => setFormSenha(e.target.value)}
                      placeholder={editingUser ? 'Manter senha atual' : 'Digite a senha'}
                      required={!editingUser}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 pr-8 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword((p) => !p)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showModalPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Senha */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Confirmar Senha
                  </label>
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    value={formConfirmSenha}
                    onChange={(e) => setFormConfirmSenha(e.target.value)}
                    placeholder="Repita a senha"
                    required={!editingUser || Boolean(formSenha)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                {/* Perfil */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Perfil de Permissão *
                  </label>
                  <select
                    value={formPerfil}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setFormPerfil(role);
                      if (!formCargo || Object.values(ROLES_INFO).some((r) => r.label === formCargo)) {
                        setFormCargo(ROLES_INFO[role].label);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="ADMIN">Administrador Geral</option>
                    <option value="GESTOR_DPO">Gestor DPO</option>
                    <option value="SUPERVISOR_ESTOQUE">Supervisor de Armazém</option>
                    <option value="CONFERENTE">Conferente de Doca</option>
                  </select>
                </div>

                {/* Cargo */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cargo / Função Operacional
                  </label>
                  <input
                    type="text"
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value)}
                    placeholder="ex: Coordenador de Estoque"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Depósito */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Depósito Permitido
                  </label>
                  <select
                    value={formDeposito}
                    onChange={(e) => setFormDeposito(e.target.value as DepositoId | 'ALL')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">Todos os Depósitos (Geral)</option>
                    {DEPOSITOS.map((d) => (
                      <option key={d.id} value={d.id}>
                        Depósito {d.id} - {d.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* E-mail (Opcional) */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>E-mail Corporativo</span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ex: colaborador@ambev.com.br"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Status Ativo / Inativo */}
                <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">Status da Matrícula:</span>
                    <p className="text-[11px] text-slate-500">
                      Logins inativos não conseguem entrar no sistema.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAtivo}
                      onChange={(e) => setFormAtivo(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-2 font-bold text-xs text-slate-700">
                      {formAtivo ? 'Ativo' : 'Bloqueado / Inativo'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{editingUser ? 'Salvar Alterações' : 'Cadastrar Matrícula'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Exclusão */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Excluir Matrícula de Login</h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Tem certeza que deseja excluir o cadastro da matrícula <strong className="font-mono text-slate-900">{deleteConfirmUser.matricula || deleteConfirmUser.usuario}</strong> ({deleteConfirmUser.nome})? Esta ação removerá definitivamente o acesso deste colaborador.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Matrícula</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

