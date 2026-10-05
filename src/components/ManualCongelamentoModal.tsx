import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  PlusCircle, 
  Check, 
  TrendingDown, 
  AlertTriangle, 
  RefreshCw, 
  Calendar, 
  Building2,
  CheckCircle2,
  Boxes,
  User,
  Truck,
  FileText,
  DollarSign,
  Droplets,
  Package
} from 'lucide-react';
import { 
  ProductMaster, 
  DepositoId, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem 
} from '../types';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { DEPOSITOS } from '../data/initialData';

export type CongelamentoType = 'quebra' | 'vale' | 'troca' | 'falta';

interface ManualCongelamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: CongelamentoType;
  defaultDeposito?: DepositoId | 'ALL';
  productsMap: Map<string, ProductMaster>;
  onSaveQuebra: (novaQuebra: QuebraItem) => void;
  onSaveVale: (novoVale: ValeItem) => void;
  onSaveTroca: (novaTroca: TrocaItem) => void;
  onSaveFalta: (novaFalta: FaltaMapeadaItem) => void;
}

export const ManualCongelamentoModal: React.FC<ManualCongelamentoModalProps> = ({
  isOpen,
  onClose,
  initialType = 'quebra',
  defaultDeposito = '01',
  productsMap,
  onSaveQuebra,
  onSaveVale,
  onSaveTroca,
  onSaveFalta,
}) => {
  const [activeType, setActiveType] = useState<CongelamentoType>(initialType);
  const [deposito, setDeposito] = useState<DepositoId>(defaultDeposito === 'ALL' ? '01' : defaultDeposito);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductMaster | null>(null);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [dataOperacao, setDataOperacao] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  
  // Specific fields - Quebra
  const [areaQuebra, setAreaQuebra] = useState('ARMAZÉM');
  const [turnoQuebra, setTurnoQuebra] = useState('1º TURNO');
  const [motivoQuebra, setMotivoQuebra] = useState('AVARIA INTERNA');
  const [colaborador, setColaborador] = useState('');
  const [isFaturada, setIsFaturada] = useState(false);

  // Specific fields - Vale
  const [motoristaVale, setMotoristaVale] = useState('');
  const [equipeCompleta, setEquipeCompleta] = useState('');
  const [clienteVale, setClienteVale] = useState('');
  const [notaFiscalVale, setNotaFiscalVale] = useState('');
  const [mapaVale, setMapaVale] = useState('');
  const [rotaVale, setRotaVale] = useState('');
  const [statusVale, setStatusVale] = useState('Emitido');
  const [totalIntegrantes, setTotalIntegrantes] = useState(2);

  // Specific fields - Troca
  const [motoristaTroca, setMotoristaTroca] = useState('');
  const [clienteTroca, setClienteTroca] = useState('');
  const [notaFiscalTroca, setNotaFiscalTroca] = useState('');
  const [mapaTroca, setMapaTroca] = useState('');
  const [motivoTroca, setMotivoTroca] = useState('VALIDADE');
  const [tipoProcessoTroca, setTipoProcessoTroca] = useState<'Troca' | 'Reposição (Falta)'>('Troca');
  const [statusPromax, setStatusPromax] = useState('Pendente');

  // Specific fields - Falta
  const [motivoFalta, setMotivoFalta] = useState('Falta no Carregamento');
  const [observacaoFalta, setObservacaoFalta] = useState('');

  // Notification state
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveType(initialType);
      if (defaultDeposito && defaultDeposito !== 'ALL') {
        setDeposito(defaultDeposito);
      }
    }
  }, [isOpen, initialType, defaultDeposito]);

  // Search product suggestions
  const matchingProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    const list: ProductMaster[] = [];
    for (const prod of productsMap.values()) {
      if (prod.codigo.toLowerCase().includes(query) || prod.descricao.toLowerCase().includes(query)) {
        list.push(prod);
        if (list.length >= 8) break;
      }
    }
    return list;
  }, [searchQuery, productsMap]);

  // Live Calculations for selected product & quantity
  const metrics = useMemo(() => {
    if (!selectedProduct) return { valorTotal: 0, volumeHl: 0, totalUnits: 0 };
    const factor = selectedProduct.fatorSku || 1;
    const totalUnits = quantidade * factor;
    const valorTotal = quantidade * (selectedProduct.valor || (selectedProduct.valorUnit * factor));
    const volumeHl = quantidade * (selectedProduct.fatorHl || 0);
    return { valorTotal, volumeHl, totalUnits };
  }, [selectedProduct, quantidade]);

  if (!isOpen) return null;

  const formatDateDisplay = (isoDate: string) => {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  const handleSelectProduct = (prod: ProductMaster) => {
    setSelectedProduct(prod);
    setSearchQuery(`${prod.codigo} - ${prod.descricao}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('Por favor, selecione um produto cadastrado.');
      return;
    }
    if (quantidade <= 0) {
      alert('A quantidade deve ser maior que zero.');
      return;
    }

    const formattedDate = formatDateDisplay(dataOperacao);
    const idSuffix = Date.now().toString().slice(-6);

    if (activeType === 'quebra') {
      const novaQuebra: QuebraItem = {
        id: `manual-qb-${Date.now()}`,
        data: formattedDate,
        sku: selectedProduct.codigo,
        descricao: selectedProduct.descricao,
        quantidade: quantidade,
        area: areaQuebra,
        turno: turnoQuebra,
        codQuebra: `AV-${idSuffix}`,
        motivo: motivoQuebra,
        colaborador: colaborador.trim() || 'LANÇAMENTO MANUAL',
        valorTotal: metrics.valorTotal,
        volumeHl: metrics.volumeHl,
        deposito: deposito,
        faturado: isFaturada,
        dataFaturamento: isFaturada ? formattedDate : undefined,
        semanaRef: 'MANUAL',
      };
      onSaveQuebra(novaQuebra);
      setNotificationMsg(`Quebra de ${quantidade} cx (${selectedProduct.descricao}) inserida com sucesso!`);
    } else if (activeType === 'vale') {
      const valorRateado = totalIntegrantes > 0 ? metrics.valorTotal / totalIntegrantes : metrics.valorTotal;
      const novoVale: ValeItem = {
        id: `manual-vl-${Date.now()}`,
        data: formattedDate,
        codigo: selectedProduct.codigo,
        descricao: selectedProduct.descricao,
        quantidade: quantidade,
        valorTotal: metrics.valorTotal,
        volumeHl: metrics.volumeHl,
        motorista: motoristaVale.trim() || 'NÃO INFORMADO',
        equipeCompleta: equipeCompleta.trim() || motoristaVale.trim() || 'EQUIPE ARMAZÉM',
        cliente: clienteVale.trim() || 'AMBEV CDD',
        notaFiscal: notaFiscalVale.trim() || `NF-${idSuffix}`,
        mapa: mapaVale.trim() || `MP-${idSuffix}`,
        rotaSetor: rotaVale.trim() || 'ROTA GERAL',
        statusVale: statusVale,
        totalIntegrantes: totalIntegrantes,
        valorRateado: valorRateado,
        idValeSstr: `VL-${idSuffix}`,
        deposito: deposito,
        faturado: false,
      };
      onSaveVale(novoVale);
      setNotificationMsg(`Vale de ${quantidade} cx (${selectedProduct.descricao}) inserido com sucesso!`);
    } else if (activeType === 'troca') {
      const novaTroca: TrocaItem = {
        id: `manual-tr-${Date.now()}`,
        data: formattedDate,
        codigos: selectedProduct.codigo,
        sku: selectedProduct.codigo,
        descricao: selectedProduct.descricao,
        quantidade: quantidade,
        valorTotal: metrics.valorTotal,
        volumeHl: metrics.volumeHl,
        motorista: motoristaTroca.trim() || 'NÃO INFORMADO',
        ajudantes: 'NÃO INFORMADO',
        cliente: clienteTroca.trim() || 'CLIENTE CDD',
        notaFiscal: notaFiscalTroca.trim() || `NF-${idSuffix}`,
        mapa: mapaTroca.trim() || `MP-${idSuffix}`,
        setorRota: 'ROTA GERAL',
        unidadeMedida: 'CX',
        motivoDeclarado: motivoTroca,
        tipoProcesso: tipoProcessoTroca,
        statusPromax: statusPromax,
        observacoes: 'Lançamento manual avulso',
        deposito: deposito,
        faturado: false,
      };
      onSaveTroca(novaTroca);
      setNotificationMsg(`Troca de ${quantidade} cx (${selectedProduct.descricao}) inserida com sucesso!`);
    } else if (activeType === 'falta') {
      const novaFalta: FaltaMapeadaItem = {
        id: `manual-fl-${Date.now()}`,
        codigo: selectedProduct.codigo,
        produto: selectedProduct.codigo,
        descricao: selectedProduct.descricao,
        quantidade: quantidade,
        quantidadeSkus: quantidade,
        quantidadeUnidades: metrics.totalUnits,
        observacao: observacaoFalta.trim() || 'Lançamento manual avulso',
        motivo: motivoFalta,
        data: formattedDate,
        deposito: deposito,
        valorTotal: metrics.valorTotal,
        volumeHl: metrics.volumeHl,
      };
      onSaveFalta(novaFalta);
      setNotificationMsg(`Falta de ${quantidade} cx (${selectedProduct.descricao}) inserida com sucesso!`);
    }

    setTimeout(() => {
      setNotificationMsg(null);
      onClose();
    }, 1200);
  };

  const tabsConfig = [
    { 
      id: 'quebra' as CongelamentoType, 
      label: 'Quebra Congelada', 
      icon: TrendingDown, 
      activeClass: 'bg-amber-600 text-white border-amber-600',
      badge: 'Avaria/Quebra'
    },
    { 
      id: 'vale' as CongelamentoType, 
      label: 'Vale de Equipe', 
      icon: AlertTriangle, 
      activeClass: 'bg-yellow-500 text-slate-950 border-yellow-500 font-bold',
      badge: 'Responsabilidade'
    },
    { 
      id: 'troca' as CongelamentoType, 
      label: 'Troca / Reposição', 
      icon: RefreshCw, 
      activeClass: 'bg-purple-600 text-white border-purple-600',
      badge: 'Mercadoria em Rota'
    },
    { 
      id: 'falta' as CongelamentoType, 
      label: 'Falta Mapeada', 
      icon: PlusCircle, 
      activeClass: 'bg-rose-600 text-white border-rose-600',
      badge: 'Divergência Doca'
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-[#0A101D] text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Inserção Manual de Congelamento
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Lance desvios operacionais avulsos para amortização imediata na conciliação
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Congelamento Selector Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {tabsConfig.map((t) => {
              const Icon = t.icon;
              const isSelected = activeType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveType(t.id);
                    setNotificationMsg(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                    isSelected
                      ? `${t.activeClass} shadow-sm`
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Success Alert */}
        {notificationMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{notificationMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Top Row: Depósito & Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Depósito da Operação</span>
              </label>
              <select
                value={deposito}
                onChange={(e) => setDeposito(e.target.value as DepositoId)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEPOSITOS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} - {d.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Data do Ocorrido</span>
              </label>
              <input
                type="date"
                value={dataOperacao}
                onChange={(e) => setDataOperacao(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Product Auto-complete Search */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Buscar Produto / SKU (Código ou Nome)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 9083, Skol, Brahma, Corona, Coca..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedProduct) setSelectedProduct(null);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {selectedProduct && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-[11px] font-bold">
                  <Check className="w-4 h-4" />
                  <span>Selecionado</span>
                </div>
              )}
            </div>

            {/* Suggestions list */}
            {matchingProducts.length > 0 && !selectedProduct && (
              <div className="mt-1.5 bg-white border border-slate-300 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 z-20">
                {matchingProducts.map((p) => (
                  <button
                    key={p.codigo}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50/80 transition flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <span className="font-mono font-bold text-blue-600 mr-2">{p.codigo}</span>
                      <span className="font-semibold text-slate-800">{p.descricao}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {formatCurrency(p.valor || p.valorUnit * p.fatorSku)}/cx
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantity and Live Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-slate-500" />
                <span>Quantidade (Caixas / cx)</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Valor Total Estimado</span>
              </label>
              <div className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold font-mono text-emerald-700">
                {formatCurrency(metrics.valorTotal)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-blue-600" />
                <span>Volume em Hectolitros</span>
              </label>
              <div className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold font-mono text-blue-700">
                {formatHectoliters(metrics.volumeHl)}
              </div>
            </div>
          </div>

          {/* TYPE SPECIFIC FORM CONTROLS */}
          {activeType === 'quebra' && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span>Dados Complementares da Quebra</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Área / Setor</label>
                  <select
                    value={areaQuebra}
                    onChange={(e) => setAreaQuebra(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="ARMAZÉM">ARMAZÉM</option>
                    <option value="CARREGAMENTO">CARREGAMENTO</option>
                    <option value="ROTA">ROTA</option>
                    <option value="RECEBIMENTO">RECEBIMENTO</option>
                    <option value="PALETIZAÇÃO">PALETIZAÇÃO</option>
                    <option value="CROSSDOCKING">CROSSDOCKING</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Turno</label>
                  <select
                    value={turnoQuebra}
                    onChange={(e) => setTurnoQuebra(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="1º TURNO">1º TURNO</option>
                    <option value="2º TURNO">2º TURNO</option>
                    <option value="3º TURNO">3º TURNO</option>
                    <option value="COMERCIAL">COMERCIAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Motivo Avaria</label>
                  <select
                    value={motivoQuebra}
                    onChange={(e) => setMotivoQuebra(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="AVARIA INTERNA">AVARIA INTERNA</option>
                    <option value="QUEDA DE PALETE">QUEDA DE PALETE</option>
                    <option value="GARRAFA QUEBRADA">GARRAFA QUEBRADA</option>
                    <option value="LATA FURADA">LATA FURADA</option>
                    <option value="VENCIMENTO">VENCIMENTO</option>
                    <option value="RETRABALHO">RETRABALHO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Colaborador Responsável</label>
                  <input
                    type="text"
                    placeholder="Nome do operador ou conferente"
                    value={colaborador}
                    onChange={(e) => setColaborador(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isFaturada}
                      onChange={(e) => setIsFaturada(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span>Já Faturada (Sem baixa no estoque físico)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeType === 'vale' && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-yellow-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span>Dados Complementares do Vale</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Motorista</label>
                  <input
                    type="text"
                    placeholder="Nome do motorista"
                    value={motoristaVale}
                    onChange={(e) => setMotoristaVale(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Equipe Completa / Ajudantes</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos, Rafael"
                    value={equipeCompleta}
                    onChange={(e) => setEquipeCompleta(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Qtd Integrantes (Rateio)</label>
                  <input
                    type="number"
                    min="1"
                    value={totalIntegrantes}
                    onChange={(e) => setTotalIntegrantes(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nota Fiscal</label>
                  <input
                    type="text"
                    placeholder="Ex: NF 12345"
                    value={notaFiscalVale}
                    onChange={(e) => setNotaFiscalVale(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mapa / Rota</label>
                  <input
                    type="text"
                    placeholder="Ex: MP-980 / R-102"
                    value={mapaVale}
                    onChange={(e) => setMapaVale(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status Vale</label>
                  <select
                    value={statusVale}
                    onChange={(e) => setStatusVale(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="Emitido">Emitido</option>
                    <option value="Assinado">Assinado</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Baixado">Baixado</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeType === 'troca' && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <span>Dados Complementares da Troca</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tipo de Processo</label>
                  <select
                    value={tipoProcessoTroca}
                    onChange={(e) => setTipoProcessoTroca(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="Troca">Troca</option>
                    <option value="Reposição (Falta)">Reposição (Falta)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Motivo Declarado</label>
                  <select
                    value={motivoTroca}
                    onChange={(e) => setMotivoTroca(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="VALIDADE">VALIDADE</option>
                    <option value="DIVERGÊNCIA NO CLIENTE">DIVERGÊNCIA NO CLIENTE</option>
                    <option value="AVARIA">AVARIA</option>
                    <option value="QUALIDADE">QUALIDADE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Motorista</label>
                  <input
                    type="text"
                    placeholder="Nome do motorista"
                    value={motoristaTroca}
                    onChange={(e) => setMotoristaTroca(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Cliente</label>
                  <input
                    type="text"
                    placeholder="Nome ou código do PDV/Cliente"
                    value={clienteTroca}
                    onChange={(e) => setClienteTroca(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nota Fiscal / Mapa</label>
                  <input
                    type="text"
                    placeholder="Ex: NF-4421 / MP-887"
                    value={notaFiscalTroca}
                    onChange={(e) => setNotaFiscalTroca(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {activeType === 'falta' && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-rose-600" />
                <span>Dados Complementares da Falta</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Motivo da Falta</label>
                  <select
                    value={motivoFalta}
                    onChange={(e) => setMotivoFalta(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="Falta no Carregamento">Falta no Carregamento</option>
                    <option value="Diferença de Doca">Diferença de Doca</option>
                    <option value="Carga Incompleta">Carga Incompleta</option>
                    <option value="Inversão no Box">Inversão no Box</option>
                    <option value="Conferência Física">Conferência Física</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Observação / Justificativa</label>
                  <input
                    type="text"
                    placeholder="Ex: Conferido na doca 4 pelo conferente X"
                    value={observacaoFalta}
                    onChange={(e) => setObservacaoFalta(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Congelamento</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
