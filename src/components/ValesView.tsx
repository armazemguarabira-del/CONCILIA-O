import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search, 
  UploadCloud, 
  Users, 
  FileCheck2, 
  Droplet, 
  MapPin, 
  CheckCircle2,
  Download,
  Check,
  RotateCcw,
  Sparkles,
  PlusCircle,
  Trash2,
  Pencil
} from 'lucide-react';
import { ValeItem, DepositoId } from '../types';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { isValePendente, isValeFaturado } from '../utils/desviosUtils';

interface ValesViewProps {
  vales: ValeItem[];
  selectedDeposito: DepositoId | 'ALL';
  onOpenImportModal: () => void;
  onOpenManualVale?: () => void;
  onUpdateVales?: (vales: ValeItem[]) => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

export const ValesView: React.FC<ValesViewProps> = ({
  vales,
  selectedDeposito,
  onOpenImportModal,
  onOpenManualVale,
  onUpdateVales,
  weeklyBillingStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [baixaFilter, setBaixaFilter] = useState<'ALL' | 'PENDENTE' | 'BAIXADO'>('ALL');

  const filtered = useMemo(() => {
    return vales.filter(v => {
      if (selectedDeposito !== 'ALL' && v.deposito !== selectedDeposito) return false;
      if (statusFilter !== 'ALL' && v.statusVale !== statusFilter) return false;

      const pendente = isValePendente(v, weeklyBillingStatus);
      if (baixaFilter === 'PENDENTE' && !pendente) return false;
      if (baixaFilter === 'BAIXADO' && pendente) return false;

      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        const matchSku = v.codigo.toLowerCase().includes(t);
        const matchDesc = v.descricao.toLowerCase().includes(t);
        const matchMot = v.motorista.toLowerCase().includes(t);
        const matchCli = v.cliente.toLowerCase().includes(t);
        const matchNf = v.notaFiscal.toLowerCase().includes(t);
        if (!matchSku && !matchDesc && !matchMot && !matchCli && !matchNf) return false;
      }
      return true;
    });
  }, [vales, selectedDeposito, statusFilter, baixaFilter, searchTerm, weeklyBillingStatus]);

  const stats = useMemo(() => {
    const totalQtd = filtered.reduce((acc, v) => acc + v.quantidade, 0);
    const totalValor = filtered.reduce((acc, v) => acc + v.valorTotal, 0);
    const totalHl = filtered.reduce((acc, v) => acc + v.volumeHl, 0);
    const totalAssinados = filtered.filter(v => v.statusVale.toLowerCase().includes('assinado')).length;

    const pendentes = filtered.filter(v => isValePendente(v, weeklyBillingStatus));
    const baixados = filtered.filter(v => !isValePendente(v, weeklyBillingStatus));

    const totalValorPendentes = pendentes.reduce((acc, v) => acc + v.valorTotal, 0);
    const totalQtdPendentes = pendentes.reduce((acc, v) => acc + v.quantidade, 0);

    return { 
      totalQtd, 
      totalValor, 
      totalHl, 
      totalRecords: filtered.length, 
      totalAssinados,
      pendentesCount: pendentes.length,
      baixadosCount: baixados.length,
      totalValorPendentes,
      totalQtdPendentes
    };
  }, [filtered, weeklyBillingStatus]);

  const handleToggleBaixa = (item: ValeItem) => {
    const pendente = isValePendente(item, weeklyBillingStatus);
    const updated = vales.map(v => {
      if (v.id === item.id) {
        return {
          ...v,
          faturado: pendente, // Se estava pendente, agora marca faturado (true)
          statusVale: pendente ? 'Baixado' : 'Assinado',
          dataFaturamento: pendente ? new Date().toLocaleDateString('pt-BR') : undefined
        };
      }
      return v;
    });
    if (onUpdateVales) onUpdateVales(updated);
  };

  const handleDeleteVale = (item: ValeItem) => {
    if (window.confirm(`Deseja excluir o vale do SKU ${item.codigo} (${item.descricao})?`)) {
      const updated = vales.filter(v => v.id !== item.id);
      if (onUpdateVales) onUpdateVales(updated);
    }
  };

  const handleBaixarTodosFiltrados = () => {
    const filteredIds = new Set(filtered.map(f => f.id));
    const today = new Date().toLocaleDateString('pt-BR');
    const updated = vales.map(v => {
      if (filteredIds.has(v.id)) {
        return {
          ...v,
          faturado: true,
          statusVale: 'Baixado',
          dataFaturamento: today
        };
      }
      return v;
    });
    if (onUpdateVales) onUpdateVales(updated);
  };

  const handleReabrirTodosFiltrados = () => {
    const filteredIds = new Set(filtered.map(f => f.id));
    const updated = vales.map(v => {
      if (filteredIds.has(v.id)) {
        return {
          ...v,
          faturado: false,
          statusVale: 'Assinado',
          dataFaturamento: undefined
        };
      }
      return v;
    });
    if (onUpdateVales) onUpdateVales(updated);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Guia de Vales de Equipe de Rota
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Amortização Ativa
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Vales de Motoristas & Ajudantes (Rateio de Perdas e Baixa no Estoque)
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Acompanhamento dos vales emitidos e controle de baixa. Somente vales <strong>Pendentes</strong> amortizam a divergência na <strong>Conciliação com Ajustes</strong>. Vales já <strong>Baixados</strong> são considerados liquidados.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onUpdateVales && filtered.length > 0 && (
            <>
              <button
                onClick={handleBaixarTodosFiltrados}
                className="px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                title="Dar baixa em todos os vales da lista atual"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Baixar Filtrados</span>
              </button>
              <button
                onClick={handleReabrirTodosFiltrados}
                className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                title="Reabrir todos os vales da lista atual como pendentes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reabrir Filtrados</span>
              </button>
            </>
          )}

          {onOpenManualVale && (
            <button
              onClick={onOpenManualVale}
              className="px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-sm active:scale-95 flex items-center space-x-1.5 cursor-pointer"
              title="Lançamento manual de Vale de Rota"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Lançar Vale</span>
            </button>
          )}

          <button
            onClick={onOpenImportModal}
            className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm active:scale-95 flex items-center space-x-1.5 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar CSV de Vales</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Total de Vales</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {stats.totalRecords} <span className="text-xs text-slate-400 font-normal">vales ({stats.totalQtd} cx)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{formatCurrency(stats.totalValor)}</p>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-800 font-bold">Pendentes (Amortiza Estoque)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
            {stats.pendentesCount} <span className="text-xs text-emerald-600 font-normal">({stats.totalQtdPendentes} cx)</span>
          </div>
          <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">{formatCurrency(stats.totalValorPendentes)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Baixados / Já Liquidados</span>
          <div className="text-2xl font-bold font-mono text-slate-700 mt-1">
            {stats.baixadosCount} <span className="text-xs text-slate-400 font-normal">vales</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Sem impacto na conciliação</p>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-amber-700 font-medium">Volume Total em Vales</span>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
            {formatHectoliters(stats.totalHl)}
          </div>
          <p className="text-[11px] text-amber-600 mt-0.5">{stats.totalAssinados} Assinados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por motorista, SKU, NF, cliente ou mapa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={baixaFilter}
            onChange={(e) => setBaixaFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none font-medium"
          >
            <option value="ALL">Impacto: Todos</option>
            <option value="PENDENTE">Apenas Pendentes (Amortiza Estoque)</option>
            <option value="BAIXADO">Apenas Baixados (Já Liquidado)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="Emitido">Emitido</option>
            <option value="Assinado">Assinado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3 min-w-[200px]">Descrição</th>
                <th className="py-3 px-3 text-right">Qtd</th>
                <th className="py-3 px-3 min-w-[160px]">Motorista & Equipe</th>
                <th className="py-3 px-3">Cliente / NF</th>
                <th className="py-3 px-3 text-right">Valor Total</th>
                <th className="py-3 px-3 text-right">Volume (HL)</th>
                <th className="py-3 px-3 text-center">Status Vale</th>
                <th className="py-3 px-3 text-center">Impacto no Estoque</th>
                <th className="py-3 px-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertTriangle className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">Nenhum registro de vale encontrado</p>
                      <p className="text-xs text-slate-400">Importe a planilha de vales independente para acompanhar rateios de perdas de rota.</p>
                      <button
                        onClick={onOpenImportModal}
                        className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition shadow-xs cursor-pointer"
                      >
                        + Importar Planilha de Vales
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isPendente = isValePendente(item, weeklyBillingStatus);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-500">{item.data}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.codigo}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{item.descricao}</div>
                        <div className="text-[10px] text-slate-500">Mapa: {item.mapa} • Rota: {item.rotaSetor}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {item.quantidade} cx
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800 font-medium">{item.motorista}</div>
                        <div className="text-[10px] text-slate-500">Eq: {item.equipeCompleta}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{item.cliente}</div>
                        <div className="text-[10px] font-mono text-slate-400">NF: {item.notaFiscal}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(item.valorTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatHectoliters(item.volumeHl)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.statusVale.toLowerCase() === 'assinado'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.statusVale}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
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
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {onUpdateVales && (
                            <button
                              onClick={() => handleToggleBaixa(item)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer flex items-center justify-center space-x-1 ${
                                isPendente
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                              title={isPendente ? 'Dar baixa e liquidar divergência' : 'Reabrir como pendente'}
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
                          )}

                          {onUpdateVales && (
                            <button
                              onClick={() => handleDeleteVale(item)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Excluir lançamento de vale"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

    </div>
  );
};
