import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  PlusCircle, 
  Check, 
  AlertCircle, 
  Boxes, 
  FileText, 
  Calendar, 
  Building2,
  CheckCircle2
} from 'lucide-react';
import { ProductMaster, DepositoId, FaltaMapeadaItem } from '../types';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { DEPOSITOS } from '../data/initialData';

interface ManualFaltaModalProps {
  isOpen: boolean;
  onClose: () => void;
  productsMap: Map<string, ProductMaster>;
  onSaveFalta: (novaFalta: FaltaMapeadaItem) => void;
  defaultDeposito?: DepositoId;
}

export const ManualFaltaModal: React.FC<ManualFaltaModalProps> = ({
  isOpen,
  onClose,
  productsMap,
  onSaveFalta,
  defaultDeposito = '01',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductMaster | null>(null);
  const [deposito, setDeposito] = useState<DepositoId>(defaultDeposito === '05' ? '05' : '01');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [unitType, setUnitType] = useState<'SKU' | 'UNIDADES'>('SKU');
  const [dataFalta, setDataFalta] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [motivo, setMotivo] = useState('Falta no Carregamento');
  const [observacao, setObservacao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Search product candidates
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

  // Calculations
  const calculatedValues = useMemo(() => {
    if (!selectedProduct) return { totalUnits: 0, skus: 0, valorTotal: 0, volumeHl: 0 };
    const factor = selectedProduct.fatorSku || 1;
    let totalUnits = 0;
    let skus = 0;

    if (unitType === 'SKU') {
      skus = quantidade;
      totalUnits = quantidade * factor;
    } else {
      totalUnits = quantidade;
      skus = quantidade / factor;
    }

    const valorTotal = totalUnits * selectedProduct.valorUnit;
    const volumeHl = skus * (selectedProduct.fatorHl || 0);

    return { totalUnits, skus, valorTotal, volumeHl };
  }, [selectedProduct, quantidade, unitType]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (quantidade <= 0) return;

    // Format date to DD/MM/YYYY
    const parts = dataFalta.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataFalta;

    const novaFalta: FaltaMapeadaItem = {
      id: `manual-${Date.now()}`,
      codigo: selectedProduct.codigo,
      produto: selectedProduct.codigo,
      descricao: selectedProduct.descricao,
      quantidade: unitType === 'SKU' ? quantidade : Math.floor(calculatedValues.skus),
      data: formattedDate,
      deposito,
      quantidadeSkus: Math.floor(calculatedValues.skus),
      quantidadeUnidades: calculatedValues.totalUnits,
      motivo: motivo || 'Falta Mapeada',
      observacao: observacao.trim() || 'Lançamento manual de falta registrado pelo usuário.',
      valorTotal: calculatedValues.valorTotal,
      volumeHl: calculatedValues.volumeHl,
      responsavel: responsavel.trim() || 'Usuário do Sistema',
      origem: 'MANUAL',
    };

    onSaveFalta(novaFalta);
    setShowSuccessNotification(true);

    setTimeout(() => {
      setShowSuccessNotification(false);
      // Reset form
      setSelectedProduct(null);
      setSearchQuery('');
      setQuantidade(1);
      setObservacao('');
      setResponsavel('');
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Mapeamento Manual de Falta de Estoque
              </h3>
              <p className="text-xs text-slate-500">
                Pesquise o produto no cadastro, informe as quantidades e adicione a observação de auditoria
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {showSuccessNotification && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <div>
                <strong>Falta registrada com sucesso!</strong>
                <p className="text-[11px] text-emerald-700">O estoque e a saúde financeira foram equalizados automaticamente.</p>
              </div>
            </div>
          )}

          {/* 1. Depósito & Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Depósito Afetado:
              </label>
              <select
                value={deposito}
                onChange={(e) => setDeposito(e.target.value as DepositoId)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
              >
                {DEPOSITOS.map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Data do Registro:
              </label>
              <input
                type="date"
                value={dataFalta}
                onChange={(e) => setDataFalta(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* 2. Product Search (autocomplete by Code or Description) */}
          <div className="space-y-1.5">
            <label className="block font-medium text-slate-700">
              Buscar Produto no Cadastro (Digite Código ou Descrição):
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: 347, Skol, Brahma, Indaiá, Sukita, 33820..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            {/* Dropdown search suggestions */}
            {matchingProducts.length > 0 && !selectedProduct && (
              <div className="bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto shadow-lg divide-y divide-slate-100 mt-1">
                {matchingProducts.map(prod => (
                  <button
                    type="button"
                    key={prod.codigo}
                    onClick={() => {
                      setSelectedProduct(prod);
                      setSearchQuery(`${prod.codigo} - ${prod.descricao}`);
                    }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 mr-2">
                        #{prod.codigo}
                      </span>
                      <span className="text-slate-700">{prod.descricao}</span>
                    </div>
                    <div className="text-right text-[11px] text-slate-500 font-mono">
                      Fator: {prod.fatorSku} un | {formatCurrency(prod.valorUnit)}/un
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected product preview badge */}
            {selectedProduct && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between mt-2">
                <div>
                  <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                    Produto Selecionado:
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedProduct.descricao}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 space-x-2">
                    <span>SKU: <strong className="font-mono text-slate-900">{selectedProduct.codigo}</strong></span>
                    <span>•</span>
                    <span>Fator SKU: {selectedProduct.fatorSku} un/cx</span>
                    <span>•</span>
                    <span>Preço Caixa: {formatCurrency(selectedProduct.valor)}</span>
                    <span>•</span>
                    <span>Preço Unit: {formatCurrency(selectedProduct.valorUnit)}</span>
                    <span>•</span>
                    <span>Fator HL: {formatHectoliters(selectedProduct.fatorHl)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded text-xs transition"
                >
                  Alterar
                </button>
              </div>
            )}
          </div>

          {/* 3. Quantidade & Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Quantidade em Falta:
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-emerald-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Unidade da Quantidade:
              </label>
              <div className="flex bg-slate-100 rounded-md p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setUnitType('SKU')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                    unitType === 'SKU'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Caixas (SKU)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitType('UNIDADES')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                    unitType === 'UNIDADES'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Unidades
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Motivo Primário:
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
              >
                <option value="Falta no Carregamento">Falta no Carregamento</option>
                <option value="Falta em Palete Fechado">Falta em Palete Fechado</option>
                <option value="Diferença de Separação">Diferença de Separação</option>
                <option value="Inversão no Picking">Inversão no Picking</option>
                <option value="Transferência Doca">Transferência Doca</option>
                <option value="Ajuste de Estoque">Ajuste de Estoque</option>
                <option value="Outro Motivo">Outro Motivo</option>
              </select>
            </div>
          </div>

          {/* 4. Campo em aberto para Observação detalhada (User requested) */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Observação / Justificativa da Falta (Campo em Aberto):
            </label>
            <textarea
              rows={3}
              placeholder="Descreva a ocorrência, doca, número da carga, motorista, motivo da divergência ou histórico de conferência..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Responsável / Conferente:
            </label>
            <input
              type="text"
              placeholder="Ex: Alécya Ferreira, Josiclaudio, Monitoramento..."
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          {/* Impact preview */}
          {selectedProduct && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500">Total Unidades Mapeadas:</span>
                <div className="text-sm font-bold font-mono text-slate-900">
                  {calculatedValues.totalUnits} unidades
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-rose-600 font-semibold">Prejuízo Calculado:</span>
                <div className="text-sm font-bold font-mono text-rose-600">
                  -{formatCurrency(calculatedValues.valorTotal)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-amber-700 font-semibold">Volume (HL):</span>
                <div className="text-sm font-bold font-mono text-amber-700">
                  {formatHectoliters(calculatedValues.volumeHl)}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer with Save Button */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!selectedProduct || showSuccessNotification}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-semibold transition shadow-sm active:scale-95 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Registro Diretamente no Sistema</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
