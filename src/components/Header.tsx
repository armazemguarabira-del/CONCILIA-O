import React from 'react';
import { 
  Building2, 
  Calendar, 
  UploadCloud, 
  PlusCircle, 
  RefreshCw, 
  Download, 
  Menu,
  User,
  KeyRound,
  LogIn,
  LogOut,
  CheckCircle2,
  Database
} from 'lucide-react';
import { DepositoId, ViewTab, UserAccount } from '../types';
import { CongelamentoType } from './ManualCongelamentoModal';
import { DEPOSITOS } from '../data/initialData';

interface HeaderProps {
  currentTab?: ViewTab;
  setCurrentTab?: (tab: ViewTab) => void;
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  onOpenImportModal: () => void;
  onOpenManualFaltaModal: () => void;
  onOpenManualModal?: (type?: CongelamentoType) => void;
  onResetData?: () => void;
  onExportReport?: () => void;
  isRecountApplied?: boolean;
  onToggleMobileMenu?: () => void;
  currentUser?: UserAccount | null;
  onNavigateLogin?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDeposito,
  setSelectedDeposito,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onOpenImportModal,
  onOpenManualFaltaModal,
  onOpenManualModal,
  onResetData,
  onExportReport,
  onToggleMobileMenu,
  currentUser,
  onNavigateLogin,
  onLogout,
}) => {
  const currentDepObj = DEPOSITOS.find(d => d.id === selectedDeposito);

  const handleOpenManual = () => {
    if (onOpenManualModal) {
      onOpenManualModal('quebra');
    } else {
      onOpenManualFaltaModal();
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-shrink-0 shadow-xs z-30">
      {/* Left: Mobile Menu & Depósito Selector & Dates */}
      <div className="flex items-center gap-3 sm:gap-5">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Abrir Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
            Depósito Selecionado:
          </label>
          <select
            value={selectedDeposito}
            onChange={(e) => setSelectedDeposito(e.target.value as DepositoId | 'ALL')}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
            title="Selecione o Depósito para filtragem e conciliação"
          >
            <option value="ALL">Todos os Depósitos</option>
            {DEPOSITOS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter Inputs */}
        <div className="hidden lg:flex items-center bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-600 gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-slate-700 text-xs focus:outline-none"
          />
          <span className="text-slate-400">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-slate-700 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Right: Last Update, Action Buttons & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        <div 
          className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
          title="Persistência contínua ativa: 02.05.02 e alterações são salvas automaticamente em disco local durável e na nuvem"
        >
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>Base Persistente Ativa</span>
        </div>

        <button
          onClick={onOpenImportModal}
          className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
          title="Importar arquivos 02.05.02, 01.11 ou bases de perda"
        >
          <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
          <span>Importar CSV</span>
        </button>

        <button
          onClick={handleOpenManual}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
          title="Lançar congelamento manual (Quebra, Vale, Troca ou Falta)"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">+ Lançamento Manual</span>
          <span className="sm:hidden">+ Manual</span>
        </button>

        {/* Botão Sair */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
            title="Sair do sistema e voltar à tela inicial de Log In"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>Sair</span>
          </button>
        )}
      </div>
    </header>
  );
};
