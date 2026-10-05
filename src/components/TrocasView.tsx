import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  Search, 
  UploadCloud, 
  Calendar, 
  Store, 
  Truck, 
  Droplet,
  CheckCircle2,
  AlertCircle,
  Check,
  RotateCcw,
  Sparkles,
  PlusCircle,
  Pencil,
  Trash2,
  X,
  Save,
  DollarSign,
  Package,
  Layers
} from 'lucide-react';
import { TrocaItem, DepositoId } from '../types';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { isTrocaPendente, isTrocaFaturada } from '../utils/desviosUtils';
import { DEPOSITOS } from '../data/initialData';

interface TrocasViewProps {
  trocas: TrocaItem[];
  selectedDeposito: DepositoId | 'ALL';
  onOpenImportModal: () => void;
  onOpenManualTroca?: () => void;
  onUpdateTrocas?: (trocas: TrocaItem[]) => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

export const TrocasView: React.FC<TrocasViewProps> = ({
  trocas,
  selectedDeposito,
  onOpenImportModal,
  onOpenManualTroca,
  onUpdateTrocas,
  weeklyBillingStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFilter, setMotivoFilter] = useState('ALL');
  const [baixaFilter, setBaixaFilter] = useState<'ALL' | 'PENDENTE' | 'BAIXADO'>('ALL');

  // Estado para Edição de Item
  const [editingItem, setEditingItem] = useState<TrocaItem | null>(null);
  
  // Estado para Lançamento Rápido Manual no componente
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTrocaData, setNewTrocaData] = useState<Partial<TrocaItem>>({
    data: new Date().toLocaleDateString('pt-BR'),
    sku: '',
    codigos: '',
    descricao: '',
    quantidade: 1,
    unidadeMedida: 'CX',
    valorTotal: 0,
    volumeHl: 0,
    cliente: '',
    motivo: 'Produto Avariado',
    motivoDeclarado: 'Produto Avariado',
    tipoProcesso: 'Troca',
    motorista: '',
    notaFiscal: '',
    mapa: '',
    setorRota: 'ROTA GERAL',
    deposito: (selectedDeposito !== 'ALL' ? selectedDeposito : '01') as DepositoId,
    faturado: false,
    statusPromax: 'Pendente'
  });

  const filtered = useMemo(() => {
    return trocas.filter(t => {
      if (selectedDeposito !== 'ALL' && t.deposito && t.deposito !== selectedDeposito) return false;
      
      const mot = t.motivo || t.motivoDeclarado || '';
      if (motivoFilter !== 'ALL' && mot !== motivoFilter) return false;

      const pendente = isTrocaPendente(t, weeklyBillingStatus);
      if (baixaFilter === 'PENDENTE' && !pendente) return false;
      if (baixaFilter === 'BAIXADO' && pendente) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const skuStr = (t.sku || t.codigos || '').toLowerCase();
        const descStr = (t.descricao || '').toLowerCase();
        const cliStr = (t.cliente || '').toLowerCase();
        const motStr = mot.toLowerCase();
        const nfStr = (t.notaFiscal || '').toLowerCase();
        const motaStr = (t.motorista || '').toLowerCase();
        if (!skuStr.includes(query) && !descStr.includes(query) && !cliStr.includes(query) && !motStr.includes(query) && !nfStr.includes(query) && !motaStr.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [trocas, selectedDeposito, motivoFilter, baixaFilter, searchTerm, weeklyBillingStatus]);

  const motivos = useMemo(() => {
    const set = new Set<string>();
    trocas.forEach(t => { 
      const m = t.motivo || t.motivoDeclarado;
      if (m) set.add(m); 
    });
    return Array.from(set).sort();
  }, [trocas]);

  const stats = useMemo(() => {
    let totalQtd = 0;
    let totalValor = 0;
    let totalHl = 0;
    let totalSkus = 0;
    let totalUnits = 0;

    let totalValorPendentes = 0;
    let totalQtdPendentes = 0;
    let totalHlPendentes = 0;
    let totalSkusPendentes = 0;
    let totalUnitsPendentes = 0;

    const pendentes = filtered.filter(t => isTrocaPendente(t, weeklyBillingStatus));
    const baixados = filtered.filter(t => !isTrocaPendente(t, weeklyBillingStatus));

    filtered.forEach(t => {
      const q = t.quantidade || 0;
      const v = t.valorTotal || 0;
      const hl = t.volumeHl || 0;
      totalQtd += q;
      totalValor += v;
      totalHl += hl;
      const um = (t.unidadeMedida || '').toUpperCase();
      if (['SKU', 'CX', 'CAIXA', 'FD', 'FARDO'].includes(um)) {
        totalSkus += q;
      } else {
        totalUnits += q;
      }
    });

    pendentes.forEach(t => {
      const q = t.quantidade || 0;
      totalValorPendentes += (t.valorTotal || 0);
      totalQtdPendentes += q;
      totalHlPendentes += (t.volumeHl || 0);
      const um = (t.unidadeMedida || '').toUpperCase();
      if (['SKU', 'CX', 'CAIXA', 'FD', 'FARDO'].includes(um)) {
        totalSkusPendentes += q;
      } else {
        totalUnitsPendentes += q;
      }
    });

    return { 
      totalQtd, 
      totalValor, 
      totalHl, 
      totalSkus,
      totalUnits,
      totalRecords: filtered.length,
      pendentesCount: pendentes.length,
      baixadosCount: baixados.length,
      totalValorPendentes,
      totalQtdPendentes,
      totalHlPendentes,
      totalSkusPendentes,
      totalUnitsPendentes
    };
  }, [filtered, weeklyBillingStatus]);

  // COMANDO REABRIR (Retorna para Pendente e Amortiza o estoque)
  const handleReabrirItem = (item: TrocaItem) => {
    const updated = trocas.map(t => {
      if (t.id === item.id) {
        return {
          ...t,
          faturado: false,
          statusPromax: 'Pendente',
          dataFaturamento: undefined,
          observacoes: (t.observacoes ? t.observacoes + ' ' : '') + '[Reaberto p/ Amortização]'
        };
      }
      return t;
    });
    if (onUpdateTrocas) onUpdateTrocas(updated);
  };

  // COMANDO DAR BAIXA (Marca como faturado / liquidado)
  const handleDarBaixaItem = (item: TrocaItem) => {
    const today = new Date().toLocaleDateString('pt-BR');
    const updated = trocas.map(t => {
      if (t.id === item.id) {
        return {
          ...t,
          faturado: true,
          statusPromax: 'Baixado',
          dataFaturamento: today
        };
      }
      return t;
    });
    if (onUpdateTrocas) onUpdateTrocas(updated);
  };

  // COMANDO EXCLUIR ITEM
  const handleDeleteItem = (item: TrocaItem) => {
    const skuName = item.sku || item.codigos || 'Item';
    if (window.confirm(`Deseja realmente excluir a troca do SKU ${skuName} (${item.descricao})?`)) {
      const updated = trocas.filter(t => t.id !== item.id);
      if (onUpdateTrocas) onUpdateTrocas(updated);
    }
  };

  // COMANDO SALVAR EDIÇÃO
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const updated = trocas.map(t => {
      if (t.id === editingItem.id) {
        return {
          ...editingItem,
          sku: editingItem.sku || editingItem.codigos,
          codigos: editingItem.sku || editingItem.codigos,
          motivo: editingItem.motivo || editingItem.motivoDeclarado || 'Produto Avariado',
          motivoDeclarado: editingItem.motivo || editingItem.motivoDeclarado || 'Produto Avariado',
        };
      }
      return t;
    });

    if (onUpdateTrocas) onUpdateTrocas(updated);
    setEditingItem(null);
  };

  // COMANDO SALVAR NOVA TROCA MANUAL
  const handleSaveNewTroca = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrocaData.sku || !newTrocaData.descricao || !newTrocaData.quantidade) {
      alert('Por favor, preencha SKU, Descrição e Quantidade.');
      return;
    }

    const skuClean = String(newTrocaData.sku).trim();
    const idSuffix = Date.now().toString().slice(-6);

    const novaTroca: TrocaItem = {
      id: `manual-tr-${Date.now()}`,
      data: newTrocaData.data || new Date().toLocaleDateString('pt-BR'),
      codigos: skuClean,
      sku: skuClean,
      descricao: newTrocaData.descricao.trim(),
      quantidade: Number(newTrocaData.quantidade) || 1,
      unidadeMedida: newTrocaData.unidadeMedida || 'CX',
      valorTotal: Number(newTrocaData.valorTotal) || 0,
      volumeHl: Number(newTrocaData.volumeHl) || 0,
      cliente: newTrocaData.cliente?.trim() || 'CLIENTE CDD',
      motivo: newTrocaData.motivo || 'Produto Avariado',
      motivoDeclarado: newTrocaData.motivoDeclarado || newTrocaData.motivo || 'Produto Avariado',
      tipoProcesso: newTrocaData.tipoProcesso || 'Troca',
      motorista: newTrocaData.motorista?.trim() || 'NÃO INFORMADO',
      ajudantes: 'NÃO INFORMADO',
      notaFiscal: newTrocaData.notaFiscal?.trim() || `NF-${idSuffix}`,
      mapa: newTrocaData.mapa?.trim() || `MP-${idSuffix}`,
      setorRota: newTrocaData.setorRota?.trim() || 'ROTA GERAL',
      deposito: (newTrocaData.deposito || (selectedDeposito !== 'ALL' ? selectedDeposito : '01')) as DepositoId,
      faturado: false,
      statusPromax: 'Pendente',
      observacoes: 'Lançamento manual avulso'
    };

    if (onUpdateTrocas) {
      onUpdateTrocas([novaTroca, ...trocas]);
    }

    setIsNewModalOpen(false);
    setNewTrocaData({
      data: new Date().toLocaleDateString('pt-BR'),
      sku: '',
      codigos: '',
      descricao: '',
      quantidade: 1,
      unidadeMedida: 'CX',
      valorTotal: 0,
      volumeHl: 0,
      cliente: '',
      motivo: 'Produto Avariado',
      motivoDeclarado: 'Produto Avariado',
      tipoProcesso: 'Troca',
      motorista: '',
      notaFiscal: '',
      mapa: '',
      setorRota: 'ROTA GERAL',
      deposito: (selectedDeposito !== 'ALL' ? selectedDeposito : '01') as DepositoId,
      faturado: false,
      statusPromax: 'Pendente'
    });
  };

  const handleBaixarTodosFiltrados = () => {
    const filteredIds = new Set(filtered.map(f => f.id));
    const today = new Date().toLocaleDateString('pt-BR');
    const updated = trocas.map(t => {
      if (filteredIds.has(t.id)) {
        return {
          ...t,
          faturado: true,
          statusPromax: 'Baixado',
          dataFaturamento: today
        };
      }
      return t;
    });
    if (onUpdateTrocas) onUpdateTrocas(updated);
  };

  const handleReabrirTodosFiltrados = () => {
    const filteredIds = new Set(filtered.map(f => f.id));
    const updated = trocas.map(t => {
      if (filteredIds.has(t.id)) {
        return {
          ...t,
          faturado: false,
          statusPromax: 'Pendente',
          dataFaturamento: undefined
        };
      }
      return t;
    });
    if (onUpdateTrocas) onUpdateTrocas(updated);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Guia de Trocas e Reposições
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Conexão Coerente em Todas as Telas
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Trocas de Mercadoria em Clientes e Reposições de Rota
          </h2>
          <p className="text-xs text-slate-500 max-w-3xl mt-0.5">
            Somente trocas com status <strong>Pendente</strong> amortizam as diferenças de estoque na <strong>Conciliação com Ajustes</strong>, na <strong>Grade de Estoque</strong> e no <strong>Dashboard</strong>. Utilize os comandos abaixo para reabrir, editar, excluir ou lançar manualmente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenManualTroca ? (
            <button
              onClick={onOpenManualTroca}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Lançar Troca</span>
            </button>
          ) : (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Lançar Troca</span>
            </button>
          )}

          {onUpdateTrocas && filtered.length > 0 && (
            <>
              <button
                onClick={handleReabrirTodosFiltrados}
                className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Reabrir todas as trocas filtradas para amortizarem no estoque"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reabrir Filtradas</span>
              </button>
              <button
                onClick={handleBaixarTodosFiltrados}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Dar baixa e liquidar todas as trocas filtradas"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Baixar Filtradas</span>
              </button>
            </>
          )}

          <button
            onClick={onOpenImportModal}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Trocas</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Registros</div>
          <div className="text-xl font-mono font-bold text-slate-900 mt-1">{stats.totalRecords} lançamentos</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {stats.pendentesCount} pendentes | {stats.baixadosCount} baixados
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-2xs bg-emerald-50/20">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Amortização Ativa (Pendentes)</span>
          </div>
          <div className="text-xl font-mono font-bold text-emerald-700 mt-1">
            {formatCurrency(stats.totalValorPendentes)}
          </div>
          <div className="text-xs text-emerald-600 mt-0.5 font-medium">
            {stats.totalSkusPendentes > 0 ? `${stats.totalSkusPendentes} cx ` : ''}
            {stats.totalUnitsPendentes > 0 ? `${stats.totalUnitsPendentes} un ` : ''}
            | {formatHectoliters(stats.totalHlPendentes)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Volume Físico Total</div>
          <div className="text-xl font-mono font-bold text-slate-900 mt-1">
            {stats.totalSkus > 0 ? `${stats.totalSkus} cx` : ''}
            {stats.totalSkus > 0 && stats.totalUnits > 0 ? ' • ' : ''}
            {stats.totalUnits > 0 ? `${stats.totalUnits} un` : ''}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {stats.totalQtd} registros totais | {formatHectoliters(stats.totalHl)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor Financeiro Total</div>
          <div className="text-xl font-mono font-bold text-purple-700 mt-1">{formatCurrency(stats.totalValor)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Trocas e Reposições brutas</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por SKU, descrição, cliente, motivo, NF ou motorista..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => setBaixaFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  baixaFilter === 'ALL' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({trocas.length})
              </button>
              <button
                onClick={() => setBaixaFilter('PENDENTE')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  baixaFilter === 'PENDENTE' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                Pendentes (Amortizam)
              </button>
              <button
                onClick={() => setBaixaFilter('BAIXADO')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  baixaFilter === 'BAIXADO' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Baixados
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <span className="text-xs font-semibold text-slate-500">Motivo:</span>
            <select
              value={motivoFilter}
              onChange={(e) => setMotivoFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">Todos os Motivos</option>
              {motivos.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-3">Dep.</th>
                <th className="py-3 px-3">Código/SKU</th>
                <th className="py-3 px-3">Descrição do Produto</th>
                <th className="py-3 px-3 text-right">Qtd / U.M</th>
                <th className="py-3 px-3">Cliente / PDV</th>
                <th className="py-3 px-3">Motivo / Tipo</th>
                <th className="py-3 px-3 text-right">Valor (R$)</th>
                <th className="py-3 px-3 text-right">Vol (HL)</th>
                <th className="py-3 px-3 text-center">Status Amortização</th>
                <th className="py-3 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">Nenhum registro de troca encontrado</p>
                      <p className="text-xs text-slate-400">
                        {searchTerm ? 'Nenhum item corresponde aos filtros selecionados.' : 'Lance uma troca manualmente ou importe a planilha de trocas.'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => setIsNewModalOpen(true)}
                          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-semibold transition cursor-pointer"
                        >
                          + Lançar Troca Manual
                        </button>
                        <button
                          onClick={onOpenImportModal}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold transition cursor-pointer"
                        >
                          Importar Planilha
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isPendente = isTrocaPendente(item, weeklyBillingStatus);
                  const skuDisplay = item.sku || item.codigos || '-';
                  const motivoDisplay = item.motivo || item.motivoDeclarado || 'Troca';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{item.data}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700">
                          {item.deposito || '01'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{skuDisplay}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-xs truncate" title={item.descricao}>
                        {item.descricao}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 whitespace-nowrap">
                        <span className="font-bold mr-1.5">{item.quantidade}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          ['SKU', 'CX', 'CAIXA'].includes((item.unidadeMedida || '').toUpperCase())
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-100 text-blue-900 border border-blue-300'
                        }`}>
                          {item.unidadeMedida || 'UN'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title={item.cliente}>
                        {item.cliente || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {motivoDisplay}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700">
                        {formatCurrency(item.valorTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatHectoliters(item.volumeHl)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isPendente ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                            <Check className="w-3 h-3 mr-1" />
                            Amortiza Estoque
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Baixado (Liquidado)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Botão de Toggle Reabrir / Dar Baixa */}
                          {onUpdateTrocas && (
                            <button
                              onClick={() => isPendente ? handleDarBaixaItem(item) : handleReabrirItem(item)}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer flex items-center space-x-1 ${
                                isPendente
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                              title={isPendente ? 'Dar baixa e liquidar troca' : 'Reabrir troca para amortizar no estoque'}
                            >
                              {isPendente ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Baixar</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reabrir</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Botão de Editar */}
                          <button
                            onClick={() => setEditingItem({ ...item })}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Editar dados da troca"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão de Excluir */}
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Excluir lançamento"
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

      {/* MODAL DE EDIÇÃO DE TROCA */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Editar Registro de Troca</h3>
                  <p className="text-xs text-slate-500">Altere quantidade, status de amortização ou informações de acompanhamento</p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Data da Operação</label>
                  <input
                    type="text"
                    value={editingItem.data || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, data: e.target.value })}
                    placeholder="DD/MM/AAAA"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Depósito</label>
                  <select
                    value={editingItem.deposito || '01'}
                    onChange={(e) => setEditingItem({ ...editingItem, deposito: e.target.value as DepositoId })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                  >
                    {DEPOSITOS.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código / SKU</label>
                  <input
                    type="text"
                    value={editingItem.sku || editingItem.codigos || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value, codigos: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descrição do Produto</label>
                <input
                  type="text"
                  value={editingItem.descricao || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, descricao: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Quantidade</label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.quantidade || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, quantidade: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Unidade de Medida</label>
                  <select
                    value={editingItem.unidadeMedida || 'CX'}
                    onChange={(e) => setEditingItem({ ...editingItem, unidadeMedida: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="CX">CX (Caixa Fechada)</option>
                    <option value="UND">UND (Unidade / Lata / Garrafa)</option>
                    <option value="SKU">SKU (Fardo / Palete)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.valorTotal || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, valorTotal: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-purple-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente / PDV</label>
                  <input
                    type="text"
                    value={editingItem.cliente || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, cliente: e.target.value })}
                    placeholder="Nome ou código do cliente"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Motivo Declarado</label>
                  <select
                    value={editingItem.motivo || editingItem.motivoDeclarado || 'Produto Avariado'}
                    onChange={(e) => setEditingItem({ ...editingItem, motivo: e.target.value, motivoDeclarado: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="Produto Avariado">Produto Avariado</option>
                    <option value="Falta de SKU Completo">Falta de SKU Completo</option>
                    <option value="VALIDADE">VALIDADE</option>
                    <option value="DIVERGÊNCIA NO CLIENTE">DIVERGÊNCIA NO CLIENTE</option>
                    <option value="QUALIDADE">QUALIDADE</option>
                    <option value="Inversão de Produto">Inversão de Produto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Motorista</label>
                  <input
                    type="text"
                    value={editingItem.motorista || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, motorista: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nota Fiscal</label>
                  <input
                    type="text"
                    value={editingItem.notaFiscal || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, notaFiscal: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mapa / Rota</label>
                  <input
                    type="text"
                    value={editingItem.mapa || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, mapa: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              {/* Status de Amortização */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Status de Liquidação e Amortização</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition ${
                    !editingItem.faturado 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="editStatus"
                      checked={!editingItem.faturado}
                      onChange={() => setEditingItem({ 
                        ...editingItem, 
                        faturado: false, 
                        statusPromax: 'Pendente',
                        dataFaturamento: undefined 
                      })}
                      className="text-emerald-600 focus:ring-emerald-500 mr-2.5"
                    />
                    <div>
                      <div className="text-xs font-bold">Pendente (Amortiza Estoque)</div>
                      <div className="text-[10px] opacity-80">Amortiza diferenças na Conciliação e Grade</div>
                    </div>
                  </label>

                  <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition ${
                    editingItem.faturado 
                      ? 'bg-purple-50 border-purple-300 text-purple-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="editStatus"
                      checked={!!editingItem.faturado}
                      onChange={() => setEditingItem({ 
                        ...editingItem, 
                        faturado: true, 
                        statusPromax: 'Baixado',
                        dataFaturamento: new Date().toLocaleDateString('pt-BR')
                      })}
                      className="text-purple-600 focus:ring-purple-500 mr-2.5"
                    />
                    <div>
                      <div className="text-xs font-bold">Baixado (Liquidado)</div>
                      <div className="text-[10px] opacity-80">Sem amortização no estoque físico</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO LANÇAMENTO MANUAL DE TROCA */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Lançar Troca Manualmente</h3>
                  <p className="text-xs text-slate-500">Insira a mercadoria reposta em cliente de acordo com o acompanhamento</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTroca} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Data da Operação</label>
                  <input
                    type="text"
                    value={newTrocaData.data || ''}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, data: e.target.value })}
                    placeholder="DD/MM/AAAA"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Depósito</label>
                  <select
                    value={newTrocaData.deposito || '01'}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, deposito: e.target.value as DepositoId })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold"
                  >
                    {DEPOSITOS.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código / SKU</label>
                  <input
                    type="text"
                    placeholder="Ex: 33820"
                    value={newTrocaData.sku || ''}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, sku: e.target.value, codigos: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Descrição do Produto</label>
                <input
                  type="text"
                  placeholder="Ex: BRAHMA CHOPP LT 350ML SH C/12"
                  value={newTrocaData.descricao || ''}
                  onChange={(e) => setNewTrocaData({ ...newTrocaData, descricao: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Quantidade</label>
                  <input
                    type="number"
                    step="any"
                    value={newTrocaData.quantidade || 1}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, quantidade: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Unidade de Medida</label>
                  <select
                    value={newTrocaData.unidadeMedida || 'CX'}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, unidadeMedida: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="CX">CX (Caixa Fechada)</option>
                    <option value="UND">UND (Unidade / Lata / Garrafa)</option>
                    <option value="SKU">SKU (Fardo / Palete)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Valor Total Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newTrocaData.valorTotal || 0}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, valorTotal: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-purple-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cliente / PDV Solicitante</label>
                  <input
                    type="text"
                    placeholder="Ex: 1440 - BAR CENTRAL"
                    value={newTrocaData.cliente || ''}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, cliente: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Motivo Declarado</label>
                  <select
                    value={newTrocaData.motivo || 'Produto Avariado'}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, motivo: e.target.value, motivoDeclarado: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="Produto Avariado">Produto Avariado</option>
                    <option value="Falta de SKU Completo">Falta de SKU Completo</option>
                    <option value="VALIDADE">VALIDADE</option>
                    <option value="DIVERGÊNCIA NO CLIENTE">DIVERGÊNCIA NO CLIENTE</option>
                    <option value="QUALIDADE">QUALIDADE</option>
                    <option value="Inversão de Produto">Inversão de Produto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Motorista</label>
                  <input
                    type="text"
                    placeholder="Nome do motorista"
                    value={newTrocaData.motorista || ''}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, motorista: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nota Fiscal</label>
                  <input
                    type="text"
                    placeholder="Ex: 247430"
                    value={newTrocaData.notaFiscal || ''}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, notaFiscal: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mapa / Rota</label>
                  <input
                    type="text"
                    placeholder="Ex: 15585 / 706"
                    value={newTrocaData.mapa || ''}
                    onChange={(e) => setNewTrocaData({ ...newTrocaData, mapa: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-800 font-medium">
                  Este lançamento será inserido como <strong>Pendente</strong> e amortizará imediatamente o estoque na conciliação e na grade de estoque.
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Lançar Troca</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
