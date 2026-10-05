import React, { useState, useMemo } from 'react';
import { 
  PlusCircle, 
  Search, 
  UploadCloud, 
  FileText, 
  Trash2, 
  Check, 
  Edit3,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  CheckSquare,
  Square,
  X
} from 'lucide-react';
import { FaltaMapeadaItem, DepositoId } from '../types';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { isFaltaPendente, isFaltaFaturada } from '../utils/desviosUtils';
import { deleteFaltaFromFirestore, deleteFaltasBatchFromFirestore } from '../services/firebaseSyncService';

interface FaltasViewProps {
  faltasMapeadas: FaltaMapeadaItem[];
  setFaltasMapeadas: React.Dispatch<React.SetStateAction<FaltaMapeadaItem[]>>;
  selectedDeposito: DepositoId | 'ALL';
  onOpenManualFaltaModal: () => void;
  onOpenImportModal: () => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

export const FaltasView: React.FC<FaltasViewProps> = ({
  faltasMapeadas,
  setFaltasMapeadas,
  selectedDeposito,
  onOpenManualFaltaModal,
  onOpenImportModal,
  weeklyBillingStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [baixaFilter, setBaixaFilter] = useState<'ALL' | 'PENDENTE' | 'BAIXADO'>('ALL');
  const [editingObsId, setEditingObsId] = useState<string | null>(null);
  const [editingObsText, setEditingObsText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<FaltaMapeadaItem | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  const filtered = useMemo(() => {
    return faltasMapeadas.filter(f => {
      if (selectedDeposito !== 'ALL' && f.deposito && f.deposito !== selectedDeposito) return false;

      const pendente = isFaltaPendente(f, weeklyBillingStatus);
      if (baixaFilter === 'PENDENTE' && !pendente) return false;
      if (baixaFilter === 'BAIXADO' && pendente) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const code = (f.codigo || f.produto || '').toLowerCase();
        const desc = (f.descricao || '').toLowerCase();
        const obs = (f.observacao || '').toLowerCase();
        if (!code.includes(query) && !desc.includes(query) && !obs.includes(query)) return false;
      }
      return true;
    });
  }, [faltasMapeadas, selectedDeposito, baixaFilter, searchTerm, weeklyBillingStatus]);

  const stats = useMemo(() => {
    const totalCaixas = filtered.reduce((acc, f) => acc + (f.quantidade || f.quantidadeSkus || 0), 0);
    const totalValor = filtered.reduce((acc, f) => acc + (f.valorTotal || 0), 0);
    const totalHl = filtered.reduce((acc, f) => acc + (f.volumeHl || 0), 0);

    const pendentes = filtered.filter(f => isFaltaPendente(f, weeklyBillingStatus));
    const baixadas = filtered.filter(f => !isFaltaPendente(f, weeklyBillingStatus));

    const totalValorPendentes = pendentes.reduce((acc, f) => acc + (f.valorTotal || 0), 0);
    const totalCaixasPendentes = pendentes.reduce((acc, f) => acc + (f.quantidade || f.quantidadeSkus || 0), 0);

    return { 
      totalCaixas, 
      totalValor, 
      totalHl, 
      totalRecords: filtered.length,
      pendentesCount: pendentes.length,
      baixadasCount: baixadas.length,
      totalValorPendentes,
      totalCaixasPendentes
    };
  }, [filtered, weeklyBillingStatus]);

  const handleToggleBaixa = (item: FaltaMapeadaItem) => {
    const pendente = isFaltaPendente(item, weeklyBillingStatus);
    setFaltasMapeadas(prev => prev.map(f => {
      if (f.id === item.id) {
        return {
          ...f,
          faturado: pendente,
          dataFaturamento: pendente ? new Date().toLocaleDateString('pt-BR') : undefined
        };
      }
      return f;
    }));
  };

  const handleBaixarTodosFiltrados = () => {
    const filteredIds = new Set(filtered.map(f => f.id));
    const today = new Date().toLocaleDateString('pt-BR');
    setFaltasMapeadas(prev => prev.map(f => {
      if (filteredIds.has(f.id)) {
        return {
          ...f,
          faturado: true,
          dataFaturamento: today
        };
      }
      return f;
    }));
  };

  const handleReabrirTodosFiltrados = () => {
    const filteredIds = new Set(filtered.map(f => f.id));
    setFaltasMapeadas(prev => prev.map(f => {
      if (filteredIds.has(f.id)) {
        return {
          ...f,
          faturado: false,
          dataFaturamento: undefined
        };
      }
      return f;
    }));
  };

  // Safe non-blocking deletion handler
  const handleDeleteClick = (item: FaltaMapeadaItem) => {
    setItemToDelete(item);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    setFaltasMapeadas(prev => prev.filter(f => {
      if (f.id && targetId) return f.id !== targetId;
      return !(f.codigo === itemToDelete.codigo && f.data === itemToDelete.data && f.quantidade === itemToDelete.quantidade);
    }));
    if (targetId) {
      deleteFaltaFromFirestore(targetId).catch(console.error);
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    setItemToDelete(null);
  };

  const handleConfirmBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const idsArray: string[] = Array.from(selectedIds);
    setFaltasMapeadas(prev => prev.filter(f => !selectedIds.has(f.id)));
    deleteFaltasBatchFromFirestore(idsArray).catch(console.error);
    setSelectedIds(new Set());
    setShowBatchDeleteModal(false);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAllFiltered = () => {
    if (filtered.length === 0) return;
    const allFilteredSelected = filtered.every(f => selectedIds.has(f.id));
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(f => next.delete(f.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(f => next.add(f.id));
        return next;
      });
    }
  };

  const handleBatchBaixa = (faturar: boolean) => {
    const today = new Date().toLocaleDateString('pt-BR');
    setFaltasMapeadas(prev => prev.map(f => {
      if (selectedIds.has(f.id)) {
        return {
          ...f,
          faturado: faturar,
          dataFaturamento: faturar ? today : undefined
        };
      }
      return f;
    }));
  };

  const handleStartEditObs = (item: FaltaMapeadaItem) => {
    setEditingObsId(item.id);
    setEditingObsText(item.observacao || '');
  };

  const handleSaveObs = (id: string) => {
    setFaltasMapeadas(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        observacao: editingObsText.trim(),
      };
    }));
    setEditingObsId(null);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center">
              <PlusCircle className="w-3.5 h-3.5 mr-1" />
              Base de Faltas Mapeadas
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Amortização Ativa
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Faltas Operacionais & Justificativas (Baixa e Amortização)
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Mapeamento por <strong>Código, Descrição, Quantidade</strong> e controle de baixa. Faltas <strong>Pendentes</strong> amortizam a divergência na <strong>Conciliação com Ajustes</strong>. Faltas <strong>Baixadas</strong> são consideradas liquidadas.
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {filtered.length > 0 && (
            <>
              <button
                onClick={handleBaixarTodosFiltrados}
                className="px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                title="Dar baixa em todas as faltas da lista atual"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Baixar Filtradas</span>
              </button>
              <button
                onClick={handleReabrirTodosFiltrados}
                className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                title="Reabrir todas as faltas da lista atual como pendentes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reabrir Filtradas</span>
              </button>
            </>
          )}

          <button
            onClick={onOpenManualFaltaModal}
            className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Lançar Falta</span>
          </button>

          <button
            onClick={onOpenImportModal}
            className="px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Planilha</span>
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Quantidade Total em Falta</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {stats.totalCaixas.toLocaleString('pt-BR')} <span className="text-xs text-slate-400 font-normal">caixas</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{stats.totalRecords} registros cadastrados</p>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-800 font-bold">Pendentes (Amortiza Estoque)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
            {stats.pendentesCount} <span className="text-xs text-emerald-600 font-normal">({stats.totalCaixasPendentes} cx)</span>
          </div>
          <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">-{formatCurrency(stats.totalValorPendentes)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Baixadas / Já Liquidadas</span>
          <div className="text-2xl font-bold font-mono text-slate-700 mt-1">
            {stats.baixadasCount} <span className="text-xs text-slate-400 font-normal">faltas</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Sem impacto na conciliação</p>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-amber-700 font-medium">Volume Total</span>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
            {formatHectoliters(stats.totalHl)}
          </div>
          <p className="text-[11px] text-amber-600 mt-1">{(stats.totalHl * 100).toFixed(0)} L equivalentes</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, descrição ou texto da observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <select
            value={baixaFilter}
            onChange={(e) => setBaixaFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none font-medium"
          >
            <option value="ALL">Impacto: Todas as Faltas</option>
            <option value="PENDENTE">Apenas Pendentes (Amortiza Estoque)</option>
            <option value="BAIXADO">Apenas Baixadas (Já Liquidado)</option>
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap">
            {filtered.length} de {faltasMapeadas.length} itens
          </span>
        </div>
      </div>

      {/* Batch Actions Floating Toolbar */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold font-mono">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold">
              {selectedIds.size === 1 ? '1 item selecionado' : `${selectedIds.size} itens selecionados`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBatchBaixa(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Dar Baixa</span>
            </button>
            <button
              onClick={() => handleBatchBaixa(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reabrir</span>
            </button>
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Selecionados</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs transition cursor-pointer"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(f => selectedIds.has(f.id))}
                    onChange={handleToggleSelectAllFiltered}
                    className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                    title="Selecionar todos os itens filtrados"
                  />
                </th>
                <th className="py-3 px-3 w-28">Código</th>
                <th className="py-3 px-3 min-w-[220px]">Descrição</th>
                <th className="py-3 px-3 text-right w-32">Qtd (SKU)</th>
                <th className="py-3 px-3 text-right w-32">Valor Total (R$)</th>
                <th className="py-3 px-3 min-w-[240px]">Observação (Clique p/ Editar)</th>
                <th className="py-3 px-3 text-center w-36">Impacto no Estoque</th>
                <th className="py-3 px-3 text-center w-28">Baixa</th>
                <th className="py-3 px-3 text-center w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">Nenhuma falta encontrada</p>
                      <p className="text-xs text-slate-400">Lance manualmente ou importe a planilha de faltas para amortizar divergências.</p>
                      <div className="flex items-center space-x-2 pt-2">
                        <button
                          onClick={onOpenManualFaltaModal}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold transition shadow-xs cursor-pointer"
                        >
                          + Lançar Falta
                        </button>
                        <button
                          onClick={onOpenImportModal}
                          className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold transition cursor-pointer"
                        >
                          Importar Planilha
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isEditingThisObs = editingObsId === item.id;
                  const itemCode = item.codigo || item.produto;
                  const itemQtd = item.quantidade || item.quantidadeSkus || 0;
                  const isPendente = isFaltaPendente(item, weeklyBillingStatus);
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition ${isSelected ? 'bg-rose-50/50' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="w-4 h-4 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {itemCode}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {item.descricao}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {itemQtd.toLocaleString('pt-BR')} cx
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600 whitespace-nowrap">
                        -{formatCurrency(item.valorTotal || 0)}
                      </td>
                      
                      {/* Campo de Observação Editável */}
                      <td className="py-3 px-3">
                        {isEditingThisObs ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingObsText}
                              onChange={(e) => setEditingObsText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveObs(item.id);
                                if (e.key === 'Escape') setEditingObsId(null);
                              }}
                              placeholder="Digite a observação..."
                              className="flex-1 bg-white border border-rose-400 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-inner"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveObs(item.id)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center space-x-1 shadow-xs transition cursor-pointer"
                              title="Salvar Observação"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Salvar</span>
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleStartEditObs(item)}
                            className="group flex items-center justify-between cursor-pointer p-1.5 rounded-md hover:bg-slate-100 border border-transparent hover:border-slate-300 transition"
                            title="Clique para editar a observação"
                          >
                            <span className={item.observacao ? 'text-slate-700 text-xs' : 'text-slate-400 italic text-xs'}>
                              {item.observacao || 'Adicionar observação...'}
                            </span>
                            <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 ml-2 shrink-0 transition" />
                          </div>
                        )}
                      </td>

                      {/* Impacto no Estoque */}
                      <td className="py-3 px-3 text-center">
                        {isPendente ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
                            Amortiza Estoque
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Baixado (Liquidado)
                          </span>
                        )}
                      </td>

                      {/* Botão de Baixa / Reabrir */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleBaixa(item)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer flex items-center justify-center space-x-1 mx-auto ${
                            isPendente
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          }`}
                          title={isPendente ? 'Dar baixa na falta e liquidar' : 'Reabrir como pendente'}
                        >
                          {isPendente ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Dar Baixa</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>Reabrir</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteClick(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Remover Falta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão Individual (Safe & In-App) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Excluir Falta Mapeada</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tem certeza de que deseja remover este item de falta?
                </p>
              </div>
              <button
                onClick={() => setItemToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">SKU / Código:</span>
                <span className="font-mono font-bold text-slate-800">{itemToDelete.codigo || itemToDelete.produto}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Descrição:</span>
                <span className="font-semibold text-slate-800 text-right max-w-[240px] truncate">{itemToDelete.descricao}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Quantidade:</span>
                <span className="font-mono font-bold text-slate-800">{itemToDelete.quantidade || itemToDelete.quantidadeSkus || 0} cx</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Valor Total:</span>
                <span className="font-mono font-bold text-rose-600">-{formatCurrency(itemToDelete.valorTotal || 0)}</span>
              </div>
            </div>

            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              ⚠️ O estoque físico com ajustes e os rankings de conciliação serão recalculados imediatamente sem este item.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSingleDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Falta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão em Lote */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Excluir em Lote</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Você está prestes a excluir <strong className="text-slate-900">{selectedIds.size} itens</strong> de faltas de uma só vez.
                </p>
              </div>
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              ⚠️ Esta operação não pode ser desfeita. Todos os {selectedIds.size} registros selecionados serão removidos permanentemente.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmBatchDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir {selectedIds.size} Itens</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
