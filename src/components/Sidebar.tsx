import React, { useState } from 'react';
import { 
  Building2, 
  UploadCloud, 
  PlusCircle, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  TrendingDown, 
  Layers, 
  AlertTriangle,
  X,
  Search,
  ChevronRight,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  CheckCircle,
  BarChart3,
  Sparkles,
  KeyRound,
  UserCheck,
  User,
  LogOut,
  FolderDown,
  ArrowLeftRight,
  Boxes,
  CalendarCheck2,
  CalendarRange
} from 'lucide-react';
import { ViewTab, UserAccount } from '../types';

interface SidebarProps {
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;
  isRecountApplied: boolean;
  onResetData: () => void;
  onClearAllData?: () => void;
  onExportReport: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isRecountApplied,
  onResetData,
  onClearAllData,
  onExportReport,
  isOpenMobile,
  onCloseMobile,
  currentUser,
  onLogout,
}) => {
  // Sidebar expansion state: collapsed (compact) or expanded
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const navItems = [
    { 
      id: 'dashboard', 
      title: 'DASHBOARD & BI', 
      subtitle: 'Indicadores, Avarias & Gráficos', 
      icon: BarChart3,
      iconBg: 'bg-blue-600 text-white',
      badge: undefined
    },
    { 
      id: 'conciliacao', 
      title: 'CONCILIAÇÃO DE ESTOQUE', 
      subtitle: 'Sem Ajustes / Com Ajustes', 
      icon: FileSpreadsheet,
      iconBg: 'bg-emerald-600 text-white',
      badge: isRecountApplied ? '01.11 Ativo' : undefined 
    },
    { 
      id: 'grade_estoque', 
      title: 'GRADE DE ESTOQUE', 
      subtitle: 'Geração 1;SKU;QTD c/ Reserva', 
      icon: Boxes,
      iconBg: 'bg-teal-600 text-white',
      badge: 'SAP / Grade'
    },
    { 
      id: 'dif_diaria', 
      title: 'DIFERENÇA DIÁRIA', 
      subtitle: 'Diferença Congelada do Dia (02.05.02)', 
      icon: CalendarCheck2,
      iconBg: 'bg-amber-500 text-slate-950 font-black',
      badge: 'Diário'
    },
    { 
      id: 'dif_mensal', 
      title: 'DIFERENÇA MENSAL', 
      subtitle: 'Estratificada por Mês & Dias (1 a 31)', 
      icon: CalendarRange,
      iconBg: 'bg-indigo-600 text-white font-black',
      badge: 'Estratificada'
    },
    { 
      id: 'inversao', 
      title: 'INVERSÃO DE PRODUTOS', 
      subtitle: 'Chamados Sobra vs Falta do Mesmo Grupo', 
      icon: ArrowLeftRight,
      iconBg: 'bg-cyan-600 text-white',
      badge: 'Chamados'
    },
    { 
      id: 'quebras', 
      title: 'QUEBRAS CONGELADAS', 
      subtitle: 'Avarias de Armazém & Retrabalho', 
      icon: TrendingDown,
      iconBg: 'bg-amber-600 text-white',
      badge: undefined
    },
    { 
      id: 'vales', 
      title: 'VALES DE EQUIPE', 
      subtitle: 'Responsabilidade & Rota', 
      icon: AlertTriangle,
      iconBg: 'bg-yellow-500 text-slate-950',
      badge: undefined
    },
    { 
      id: 'trocas', 
      title: 'TROCAS & REPOSIÇÕES', 
      subtitle: 'Mercadorias em Clientes', 
      icon: RefreshCw,
      iconBg: 'bg-purple-600 text-white',
      badge: undefined
    },
    { 
      id: 'faltas', 
      title: 'FALTAS MAPEADAS', 
      subtitle: 'Conferência de Doca e Cargas', 
      icon: PlusCircle,
      iconBg: 'bg-rose-600 text-white',
      badge: undefined
    },
    { 
      id: 'produtos', 
      title: 'CADASTRO DE SKUS', 
      subtitle: 'Fatores, Embalagens & Preços', 
      icon: Building2,
      iconBg: 'bg-sky-600 text-white',
      badge: undefined
    },
    { 
      id: 'login', 
      title: 'LOG IN & CADASTROS', 
      subtitle: 'Contas, Acessos & Permissões', 
      icon: KeyRound,
      iconBg: 'bg-purple-600 text-white',
      badge: currentUser ? 'Conectado' : undefined
    },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!sidebarSearch.trim()) return true;
    const term = sidebarSearch.toLowerCase();
    return item.title.toLowerCase().includes(term) || item.subtitle.toLowerCase().includes(term);
  });

  const handleSelectTab = (tabId: ViewTab) => {
    setCurrentTab(tabId);
    onCloseMobile();
  };

  const sidebarContent = (
    <aside 
      className={`${
        isCollapsed ? 'w-20' : 'w-72 lg:w-80'
      } bg-[#0A101D] text-white flex flex-col h-full flex-shrink-0 select-none shadow-2xl border-r border-slate-800 transition-all duration-300 ease-in-out relative z-40`}
    >
      {/* 1. Header: Pau Brasil Distribuidora Ambev & Collapse Toggle */}
      <div className={`p-3.5 border-b border-slate-800/80 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 flex items-center justify-center p-1 shadow-sm border border-slate-700">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-emerald-500 flex items-center justify-center text-white font-black text-xs tracking-tighter">
                  PB
                </div>
              </div>
              
              <div className="leading-tight truncate">
                <h1 className="text-sm font-black tracking-wider text-white">
                  PAU BRASIL
                </h1>
                <p className="text-[11px] font-bold text-slate-400">
                  DISTRIBUIDORA <span className="text-blue-400 font-extrabold">AMBEV</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800 transition shadow-xs cursor-pointer"
                title="Recolher barra lateral"
              >
                <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>

              {isOpenMobile && (
                <button 
                  onClick={onCloseMobile}
                  className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 flex items-center justify-center text-blue-400 hover:text-white transition shadow-sm group cursor-pointer"
              title="Expandir barra lateral"
            >
              <PanelLeftOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Card do Colaborador: Nome e Cargo */}
      {!isCollapsed ? (
        <div className="px-3 pt-3">
          <button
            onClick={() => handleSelectTab('login')}
            className="w-full bg-[#0f172a]/90 hover:bg-slate-800/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between shadow-xs text-left transition group cursor-pointer"
            title="Clique para gerenciar perfil e conta"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              {/* Avatar quadrado verde com inicial */}
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0">
                {currentUser?.nome ? currentUser.nome.charAt(0).toUpperCase() : 'D'}
              </div>
              <div className="leading-tight truncate">
                <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition truncate" title={currentUser?.nome || 'Djeanderson Soares'}>
                  {currentUser?.nome || 'Djeanderson Soares'}
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate" title={currentUser?.cargo || 'Supervisor de Armazém'}>
                  {currentUser?.cargo || 'Supervisor de Armazém'}
                </div>
              </div>
            </div>
            {/* Ponto verde status online */}
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.7)] ml-2" />
          </button>
        </div>
      ) : (
        <div className="py-3 flex flex-col items-center border-b border-slate-800/60">
          <div className="relative group">
            <button
              onClick={() => handleSelectTab('login')}
              className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition flex items-center justify-center text-white font-bold text-sm shadow-md cursor-pointer relative"
              title={`${currentUser?.nome || 'Djeanderson Soares'} (${currentUser?.cargo || 'Supervisor de Armazém'})`}
            >
              <span>{currentUser?.nome ? currentUser.nome.charAt(0).toUpperCase() : 'D'}</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A101D]" />
            </button>
            {/* Floating Profile Tooltip */}
            <div className="fixed left-[76px] top-16 px-3 py-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
              <div className="text-white font-bold">{currentUser?.nome || 'Djeanderson Soares'}</div>
              <div className="text-[10px] text-emerald-400 font-normal">{currentUser?.cargo || 'Supervisor de Armazém'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Search Bar */}
      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar guia ou módulo..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Navigation Cards List */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2 py-4 space-y-3 flex flex-col items-center' : 'p-3 space-y-2'} overflow-y-auto scrollbar-none`}>
        {filteredNavItems.map((item) => {
          const isActive = currentTab === item.id || (item.id === 'conciliacao' && currentTab === 'conciliacao_ajustes');
          const Icon = item.icon;

          if (isCollapsed) {
            return (
              <div key={item.id} className="relative group flex items-center justify-center w-full">
                {/* Active Indicator Bar on left edge */}
                {isActive && (
                  <div className="absolute left-0 w-1 h-6 bg-blue-400 rounded-r-full shadow-[0_0_8px_rgba(96,165,250,0.8)] z-10" />
                )}

                <button
                  onClick={() => handleSelectTab(item.id as ViewTab)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative group ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/60' 
                      : 'bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 hover:border-slate-700'
                  }`}
                  aria-label={item.title}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`} />
                  
                  {item.badge && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A101D] shadow-xs" />
                  )}
                </button>

                {/* Modern Contextual Tooltip anchored to the icon */}
                <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0 whitespace-nowrap drop-shadow-2xl">
                  {/* Caret arrow */}
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 rotate-45" />
                  
                  <div className="relative bg-slate-900/98 backdrop-blur-md border border-slate-700/90 text-white px-3.5 py-2.5 rounded-xl shadow-2xl min-w-[180px]">
                    <div className="text-xs font-bold flex items-center justify-between gap-2.5">
                      <span className="text-white tracking-wide">{item.title}</span>
                      {item.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-normal">{item.subtitle}</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              onClick={() => handleSelectTab(item.id as ViewTab)}
              className={`p-3 rounded-xl flex items-center space-x-3 cursor-pointer transition border ${
                isActive
                  ? 'bg-gradient-to-r from-blue-950/60 to-slate-900 border-blue-500/80 shadow-md shadow-blue-950/40'
                  : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700 text-slate-300'
              }`}
            >
              {/* Ícone arredondado com fundo colorido */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.iconBg} shadow-md`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Título e subtítulo explicativo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold tracking-tight truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                    {item.title}
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5 leading-snug">
                  {item.subtitle}
                </p>
                {item.badge && (
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Seta Chevron Right */}
              <ChevronRight className={`w-4 h-4 flex-shrink-0 transition ${
                isActive ? 'text-blue-400 translate-x-0.5' : 'text-slate-600'
              }`} />
            </div>
          );
        })}
      </nav>

      {/* 5. Footer Actions: Zerar Base, Restaurar e Exportar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        {!isCollapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Gestão de Dados</span>
              <span className="text-[10px] text-slate-500">v3.2 CDD</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onExportReport}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="Exportar Relatório Geral Consolidado"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Exportar</span>
              </button>

              {onClearAllData ? (
                <button
                  onClick={onClearAllData}
                  className="p-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 hover:text-rose-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Limpar todos os dados e começar base zerada para importação manual"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Zerar Bases</span>
                </button>
              ) : (
                <button
                  onClick={onResetData}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Restaurar Dados Iniciais de Demonstração"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exemplo</span>
                </button>
              )}
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full py-1.5 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                title="Sair do sistema e voltar para a tela de log in"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Sair da Plataforma</span>
              </button>
            )}

            <button
              onClick={() => setIsCollapsed(true)}
              className="w-full py-1 text-[10px] text-slate-500 hover:text-slate-300 text-center flex items-center justify-center gap-1 cursor-pointer"
            >
              <PanelLeftClose className="w-3 h-3" />
              <span>Diminuir barra lateral</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2.5">
            <div className="relative group w-full flex justify-center">
              <button
                onClick={onExportReport}
                className="w-11 h-11 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-blue-400 hover:text-white flex items-center justify-center transition shadow-xs cursor-pointer group-hover:scale-105"
                title="Exportar Relatório"
                aria-label="Exportar Relatório"
              >
                <Download className="w-4 h-4" />
              </button>
              <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-xl text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0 shadow-2xl z-50">
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 rotate-45" />
                Exportar Relatório Consolidado
              </div>
            </div>

            {onClearAllData && (
              <div className="relative group w-full flex justify-center">
                <button
                  onClick={onClearAllData}
                  className="w-11 h-11 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 hover:text-rose-200 flex items-center justify-center transition shadow-xs cursor-pointer group-hover:scale-105"
                  title="Zerar Bases para Importação Manual"
                  aria-label="Zerar Bases de Dados"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-xl text-rose-300 text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0 shadow-2xl z-50">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 rotate-45" />
                  Zerar Bases de Dados
                </div>
              </div>
            )}

            {onLogout && (
              <div className="relative group w-full flex justify-center">
                <button
                  onClick={onLogout}
                  className="w-11 h-11 rounded-xl bg-rose-950/40 hover:bg-rose-900/70 border border-rose-900/50 text-rose-300 hover:text-white transition cursor-pointer flex items-center justify-center group-hover:scale-105"
                  title="Sair do sistema"
                  aria-label="Sair da Plataforma"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                </button>
                <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-xl text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0 shadow-2xl z-50">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 rotate-45" />
                  Sair da Plataforma
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex h-full flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Backdrop & Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

