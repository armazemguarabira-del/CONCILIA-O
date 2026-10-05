import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Package, 
  AlertCircle, 
  Check, 
  Layers, 
  DollarSign, 
  Droplet, 
  Boxes, 
  Calendar,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { ProductMaster } from '../types';
import { normalizeSku } from '../utils/parsers';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: ProductMaster) => void;
  editingProduct: ProductMaster | null;
  productsMap: Map<string, ProductMaster>;
  existingGroups: string[];
}

const COMMON_PACKAGING = [
  'PET 1L',
  'PET 2L',
  'PET 2,5L',
  'PET 200ML',
  'INTEIRA',
  'LITRÃO',
  'LATA 350ML',
  'LATA 269ML',
  'LATA 473ML',
  'LONG NECK 355ML',
  'BARRIL',
  'GFA VD 1L',
  'VIDRO 300ML',
  'NÃO IDENTIFICADA'
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingProduct,
  productsMap,
  existingGroups
}) => {
  const isEditing = !!editingProduct;

  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [grupo, setGrupo] = useState('CERVEJA');
  const [customGrupo, setCustomGrupo] = useState('');
  const [isCustomGrupo, setIsCustomGrupo] = useState(false);
  const [fatorSku, setFatorSku] = useState<number>(12);
  const [fatorPallet, setFatorPallet] = useState<number>(84);
  const [lastro, setLastro] = useState<number | undefined>(undefined);
  const [pallet, setPallet] = useState<number | undefined>(undefined);
  const [valor, setValor] = useState<number>(0);
  const [valorUnit, setValorUnit] = useState<number>(0);
  const [fatorHl, setFatorHl] = useState<number>(0.07);
  const [embalagem, setEmbalagem] = useState('INTEIRA');
  const [idade, setIdade] = useState<number>(180);
  const [autoCalcUnit, setAutoCalcUnit] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Combine groups
  const groupsList = React.useMemo(() => {
    const defaultGroups = ['CERVEJA', 'NAB', 'MARKETPLACE', 'MATCH', 'VINHOS', 'DESTILADOS', 'AGUA', 'GERAL'];
    const merged = Array.from(new Set([...defaultGroups, ...existingGroups])).filter(Boolean).sort();
    return merged;
  }, [existingGroups]);

  // Sync state when editingProduct changes or modal opens
  useEffect(() => {
    if (editingProduct) {
      setCodigo(editingProduct.codigo);
      setDescricao(editingProduct.descricao);
      
      const grp = (editingProduct.grupo || 'GERAL').toUpperCase();
      if (groupsList.includes(grp)) {
        setGrupo(grp);
        setIsCustomGrupo(false);
        setCustomGrupo('');
      } else {
        setGrupo('OUTRO');
        setIsCustomGrupo(true);
        setCustomGrupo(grp);
      }

      setFatorSku(editingProduct.fatorSku || 1);
      setFatorPallet(editingProduct.fatorPallet || 84);
      setLastro(editingProduct.lastro);
      setPallet(editingProduct.pallet ?? editingProduct.fatorPallet);
      setValor(editingProduct.valor || 0);
      setValorUnit(editingProduct.valorUnit || (editingProduct.valor / (editingProduct.fatorSku || 1)));
      setFatorHl(editingProduct.fatorHl || 0);
      setEmbalagem(editingProduct.embalagem || '');
      setIdade(editingProduct.idade || 180);
      setAutoCalcUnit(false);
    } else {
      // Reset defaults for a new product
      setCodigo('');
      setDescricao('');
      setGrupo('CERVEJA');
      setIsCustomGrupo(false);
      setCustomGrupo('');
      setFatorSku(12);
      setFatorPallet(84);
      setLastro(undefined);
      setPallet(84);
      setValor(0);
      setValorUnit(0);
      setFatorHl(0.07);
      setEmbalagem('INTEIRA');
      setIdade(180);
      setAutoCalcUnit(true);
    }
    setErrorMsg('');
  }, [editingProduct, isOpen, groupsList]);

  // Auto-calculate unit price when box price or factor changes
  useEffect(() => {
    if (autoCalcUnit && fatorSku > 0) {
      const calc = Number((valor / fatorSku).toFixed(2));
      setValorUnit(calc);
    }
  }, [valor, fatorSku, autoCalcUnit]);

  if (!isOpen) return null;

  const normalizedCode = normalizeSku(codigo);
  const isDuplicateCode = !isEditing && normalizedCode !== '' && productsMap.has(normalizedCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCode = normalizeSku(codigo);
    if (!cleanCode) {
      setErrorMsg('O código do SKU é obrigatório.');
      return;
    }

    if (!descricao.trim()) {
      setErrorMsg('A descrição do produto é obrigatória.');
      return;
    }

    if (fatorSku <= 0) {
      setErrorMsg('O Fator SKU (unidades por caixa) deve ser maior que 0.');
      return;
    }

    const finalGrupo = isCustomGrupo ? (customGrupo.trim().toUpperCase() || 'GERAL') : grupo;

    const product: ProductMaster = {
      codigo: cleanCode,
      descricao: descricao.trim().toUpperCase(),
      fatorSku: Number(fatorSku),
      fatorPallet: Number(fatorPallet) || 1,
      lastro: lastro !== undefined && !isNaN(lastro) ? Number(lastro) : undefined,
      pallet: pallet !== undefined && !isNaN(pallet) ? Number(pallet) : Number(fatorPallet) || 1,
      valor: Number(valor) || 0,
      valorUnit: Number(valorUnit) || 0,
      fatorHl: Number(fatorHl) || 0,
      grupo: finalGrupo,
      embalagem: embalagem.trim() || 'NÃO IDENTIFICADA',
      idade: Number(idade) || 0
    };

    onSave(product);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isEditing ? `Editar SKU: ${editingProduct.codigo}` : 'Cadastrar Novo Produto (SKU)'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing 
                  ? 'Atualize os fatores logísticos, fiscais e parâmetros de precificação.' 
                  : 'Preencha as especificações mestras do produto para a base de estoque.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {isDuplicateCode && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Atenção:</strong> O SKU <strong>{normalizedCode}</strong> já existe na base ({productsMap.get(normalizedCode)?.descricao}). Salvar irá sobrescrever seus dados.
              </span>
            </div>
          )}

          {/* Identification Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              <span>Identificação do SKU & Categoria</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Código SKU */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código SKU <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: 347, 982"
                  className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:bg-white ${
                    isEditing ? 'opacity-70 cursor-not-allowed bg-slate-100 border-slate-200' : 'border-slate-300 focus:border-teal-500'
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Código identificador no WMS
                </span>
              </div>

              {/* Descrição do Produto */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição Completa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: SUKITA PET 1L CAIXA C/12"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Nome padrão do produto no catálogo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Grupo / Família */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Grupo / Família <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-1.5">
                  <select
                    value={isCustomGrupo ? 'OUTRO' : grupo}
                    onChange={(e) => {
                      if (e.target.value === 'OUTRO') {
                        setIsCustomGrupo(true);
                      } else {
                        setIsCustomGrupo(false);
                        setGrupo(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
                  >
                    {groupsList.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    <option value="OUTRO">+ Outro Grupo Customizado...</option>
                  </select>

                  {isCustomGrupo && (
                    <input
                      type="text"
                      value={customGrupo}
                      onChange={(e) => setCustomGrupo(e.target.value)}
                      placeholder="Digite o nome do novo grupo..."
                      className="w-full bg-white border border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none font-semibold uppercase"
                    />
                  )}
                </div>
              </div>

              {/* Embalagem */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Embalagem
                </label>
                <input
                  type="text"
                  list="packaging-options"
                  value={embalagem}
                  onChange={(e) => setEmbalagem(e.target.value)}
                  placeholder="Ex: PET 1L, INTEIRA, LATA 350ML"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                />
                <datalist id="packaging-options">
                  {COMMON_PACKAGING.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Logistics & Packaging Parameters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Boxes className="w-3.5 h-3.5 text-teal-600" />
              <span>Parâmetros Logísticos & Conversão Física</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Fator SKU */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fator SKU (un/cx) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={fatorSku}
                  onChange={(e) => setFatorSku(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Unidades por caixa
                </span>
              </div>

              {/* Fator HL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fator HL (HL/cx)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={fatorHl}
                  onChange={(e) => setFatorHl(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Hectolitros por caixa
                </span>
              </div>

              {/* Caixas por Palete */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Palete (cx/palete)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={fatorPallet}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    setFatorPallet(val);
                    setPallet(val);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Capacidade do palete
                </span>
              </div>

              {/* Lastro */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lastro (cx/camada)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={lastro ?? ''}
                  onChange={(e) => setLastro(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="Opcional"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Caixas por camada
                </span>
              </div>
            </div>

            {/* Validade / Idade */}
            <div className="w-full sm:w-1/2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prazo de Validade / Shelf Life (dias)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={idade}
                  onChange={(e) => setIdade(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">dias</span>
              </div>
            </div>
          </div>

          {/* Pricing & Financial Reference */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                <span>Preços de Referência (Cálculo Automático de Prejuízo)</span>
              </div>

              <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCalcUnit}
                  onChange={(e) => setAutoCalcUnit(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span className="text-[11px] font-medium">Auto-calcular unitário</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Preço Caixa */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preço por Caixa / Fardo (R$) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    R$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={valor}
                    onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Valor contábil da embalagem fechada
                </span>
              </div>

              {/* Preço Unitário */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preço Unitário (R$ / garrafa ou lata)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    R$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={autoCalcUnit}
                    value={valorUnit}
                    onChange={(e) => setValorUnit(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className={`w-full border rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:bg-white ${
                      autoCalcUnit ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-90' : 'bg-slate-50 border-slate-300 focus:border-teal-500'
                    }`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {autoCalcUnit ? `Calculado: R$ ${valor.toFixed(2)} / ${fatorSku} un` : 'Valor manual por unidade avulsa'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar SKU'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
