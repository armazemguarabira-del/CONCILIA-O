import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  UploadCloud, 
  Layers, 
  Boxes, 
  Droplet, 
  DollarSign,
  Download,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Filter,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { ProductMaster, StockPositionItem } from '../types';
import { formatCurrency, formatHectoliters } from '../utils/parsers';
import { ProductFormModal } from './ProductFormModal';
import { DeleteProductModal } from './DeleteProductModal';

interface ProdutosViewProps {
  productsMap: Map<string, ProductMaster>;
  setProductsMap?: React.Dispatch<React.SetStateAction<Map<string, ProductMaster>>>;
  stockPositions?: StockPositionItem[];
  setStockPositions?: React.Dispatch<React.SetStateAction<StockPositionItem[]>>;
  onOpenImportModal: () => void;
}

export const ProdutosView: React.FC<ProdutosViewProps> = ({
  productsMap,
  setProductsMap,
  stockPositions = [],
  setStockPositions,
  onOpenImportModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [grupoFilter, setGrupoFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductMaster | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const productsList = useMemo(() => {
    return Array.from(productsMap.values());
  }, [productsMap]);

  const grupos = useMemo(() => {
    const set = new Set<string>();
    productsList.forEach(p => { if (p.grupo) set.add(p.grupo); });
    return Array.from(set).sort();
  }, [productsList]);

  // Filtered products
  const filtered = useMemo(() => {
    return productsList.filter(p => {
      if (grupoFilter !== 'ALL' && p.grupo !== grupoFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = p.codigo.toLowerCase().includes(q);
        const matchDesc = p.descricao.toLowerCase().includes(q);
        const matchGroup = p.grupo ? p.grupo.toLowerCase().includes(q) : false;
        if (!matchCode && !matchDesc && !matchGroup) return false;
      }
      return true;
    });
  }, [productsList, grupoFilter, searchTerm]);

  // Reset page when filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, grupoFilter, pageSize]);

  // Pagination slice
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Handlers for CRUD
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (product: ProductMaster) => {
    setEditingProduct(product);
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (product: ProductMaster) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleSaveProduct = (product: ProductMaster) => {
    if (!setProductsMap) {
      showToast('Modificação não disponível neste modo.', 'error');
      return;
    }

    const isExisting = productsMap.has(product.codigo);

    // Update productsMap
    setProductsMap(prev => {
      const next = new Map(prev);
      next.set(product.codigo, product);
      return next;
    });

    // If existing stock positions reference this product, recalculate financial and unit numbers
    if (setStockPositions && stockPositions.length > 0) {
      setStockPositions(prev => prev.map(item => {
        if (item.produto === product.codigo) {
          const fatorSku = product.fatorSku || 1;
          const valorUnitario = product.valorUnit;
          const valorCaixa = product.valor;
          const fatorHl = product.fatorHl;
          
          const diferencaTotalUnits = item.diferencaTotalUnits;
          const impactoFinanceiro = diferencaTotalUnits * valorUnitario;
          const prejuizoFinanceiro = item.status === 'FALTA' ? Math.abs(impactoFinanceiro) : 0;
          const sobraFinanceira = item.status === 'SOBRA' ? impactoFinanceiro : 0;
          const impactoHl = (diferencaTotalUnits / fatorSku) * fatorHl;

          return {
            ...item,
            descricao: product.descricao,
            fatorSku,
            valorUnitario,
            valorCaixa,
            fatorHl,
            impactoFinanceiro,
            prejuizoFinanceiro,
            sobraFinanceira,
            impactoHl
          };
        }
        return item;
      }));
    }

    setIsFormModalOpen(false);
    setEditingProduct(null);
    showToast(
      isExisting 
        ? `SKU ${product.codigo} (${product.descricao}) atualizado com sucesso!` 
        : `SKU ${product.codigo} (${product.descricao}) cadastrado com sucesso!`,
      'success'
    );
  };

  const handleConfirmDelete = (codigo: string) => {
    if (!setProductsMap) {
      showToast('Exclusão não disponível neste modo.', 'error');
      return;
    }

    setProductsMap(prev => {
      const next = new Map(prev);
      next.delete(codigo);
      return next;
    });

    setIsDeleteModalOpen(false);
    setProductToDelete(null);
    showToast(`SKU ${codigo} excluído da base com sucesso.`, 'info');
  };

  // Export current catalog to CSV
  const handleExportCsv = () => {
    const headers = 'Código;Descrição;Fator SKU;FATOR PALLET; VALOR ; VALOR UNIT ;Fator Hecto (HL);GRUPO;EMBALAGEM;IDADE;LASTRO';
    const lines = productsList.map(p => {
      return `${p.codigo};"${p.descricao}";${p.fatorSku};${p.fatorPallet || 84};${p.valor.toFixed(2).replace('.', ',')};${p.valorUnit.toFixed(2).replace('.', ',')};${p.fatorHl.toString().replace('.', ',')};${p.grupo || 'GERAL'};${p.embalagem || ''};${p.idade || 180};${p.lastro ?? ''}`;
    });

    const csvContent = [headers, ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cadastro_skus_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Base mestra exportada com sucesso em arquivo CSV.', 'success');
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Toast notification */}
      {toastMessage && (
        <div className={`p-4 rounded-xl shadow-lg border flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'success' ? 'bg-teal-50 border-teal-300 text-teal-900' :
          toastMessage.type === 'info' ? 'bg-blue-50 border-blue-300 text-blue-900' :
          'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className={`w-4 h-4 ${
              toastMessage.type === 'success' ? 'text-teal-600' :
              toastMessage.type === 'info' ? 'text-blue-600' : 'text-rose-600'
            }`} />
            <span>{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner with Action Buttons */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1" />
              Base Mestra de Cadastro de Produtos
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            Cadastro Mestre de SKUs, Fatores & Parâmetros Físicos
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Cadastre novos produtos, edite fatores logísticos (un/cx, lastro, palete, HL) e preços de referência, ou exclua SKUs da base mestra.
          </p>
        </div>

        {/* Action Buttons: Cadastrar Novo, Exportar, Importar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition shadow-sm active:scale-95 flex items-center space-x-1.5 cursor-pointer"
            title="Cadastrar um novo produto na base mestra de SKUs"
          >
            <Plus className="w-4 h-4" />
            <span>Novo SKU</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-2xs active:scale-95 flex items-center space-x-1.5 cursor-pointer"
            title="Baixar toda a base mestra em arquivo CSV"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={onOpenImportModal}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition shadow-2xs active:scale-95 flex items-center space-x-1.5 cursor-pointer"
            title="Importar planilha de cadastro para atualizar em lote"
          >
            <UploadCloud className="w-4 h-4 text-slate-300" />
            <span>Importar CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Produtos Cadastrados</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {productsList.length} <span className="text-xs text-slate-400 font-normal">SKUs ativos</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Categorias / Grupos</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {grupos.length} <span className="text-xs text-slate-400 font-normal">famílias</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Fator SKU Médio</span>
          <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
            {(productsList.reduce((acc, p) => acc + p.fatorSku, 0) / (productsList.length || 1)).toFixed(1)} <span className="text-xs text-slate-400 font-normal">un/cx</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Preço Médio Caixa</span>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
            {formatCurrency(productsList.reduce((acc, p) => acc + p.valor, 0) / (productsList.length || 1))}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição do produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Group filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium text-[11px]">Grupo:</span>
            <select
              value={grupoFilter}
              onChange={(e) => setGrupoFilter(e.target.value)}
              className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">Todos os Grupos ({productsList.length})</option>
              {grupos.map(g => {
                const count = productsList.filter(p => p.grupo === g).length;
                return (
                  <option key={g} value={g}>{g} ({count})</option>
                );
              })}
            </select>
          </div>

          {/* Page size */}
          <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
            <span className="text-slate-500 font-medium text-[11px]">Exibir:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              className="bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:border-teal-500"
            >
              <option value={25}>25 / pág</option>
              <option value={50}>50 / pág</option>
              <option value={100}>100 / pág</option>
              <option value={-1}>Todos ({filtered.length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-20">CÓDIGO SKU</th>
                <th className="py-3 px-3 min-w-[240px]">DESCRIÇÃO DO PRODUTO</th>
                <th className="py-3 px-3">GRUPO / FAMÍLIA</th>
                <th className="py-3 px-3 text-center">FATOR SKU (UN/CX)</th>
                <th className="py-3 px-3 text-center">LASTRO</th>
                <th className="py-3 px-3 text-center">PALETE</th>
                <th className="py-3 px-3 text-right">FATOR HL (HL/CX)</th>
                <th className="py-3 px-3 text-right">PREÇO CAIXA (R$)</th>
                <th className="py-3 px-3 text-right">PREÇO UNITÁRIO (R$)</th>
                <th className="py-3 px-3 text-center w-28">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">Nenhum produto encontrado</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Verifique o termo pesquisado ou filtre por outro grupo.
                    </p>
                    <button
                      onClick={handleOpenCreateModal}
                      className="mt-3 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cadastrar Este SKU</span>
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr 
                    key={item.codigo} 
                    className="hover:bg-slate-50/80 transition group"
                  >
                    {/* Código SKU */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-center">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {item.codigo}
                      </span>
                    </td>

                    {/* Descrição do Produto */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800">
                        {item.descricao}
                      </div>
                      {item.embalagem && item.embalagem !== 'NÃO IDENTIFICADA' && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          Embalagem: {item.embalagem} {item.idade ? `• Validade: ${item.idade}d` : ''}
                        </div>
                      )}
                    </td>

                    {/* Grupo / Família */}
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        item.grupo === 'CERVEJA' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        item.grupo === 'NAB' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        item.grupo === 'MARKETPLACE' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                        item.grupo === 'MATCH' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {item.grupo || 'GERAL'}
                      </span>
                    </td>

                    {/* Fator SKU */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                      {item.fatorSku}
                    </td>

                    {/* Lastro */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {item.lastro ? `${item.lastro} cx` : <span className="text-slate-300">-</span>}
                    </td>

                    {/* Palete */}
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {(item.pallet || item.fatorPallet) ? `${item.pallet || item.fatorPallet} cx` : <span className="text-slate-300">-</span>}
                    </td>

                    {/* Fator HL */}
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-medium">
                      {formatHectoliters(item.fatorHl)}
                    </td>

                    {/* Preço Caixa */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.valor)}
                    </td>

                    {/* Preço Unitário */}
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                      {formatCurrency(item.valorUnit)}
                    </td>

                    {/* Ações: Editar e Excluir */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 border border-transparent hover:border-teal-200 transition cursor-pointer"
                          title="Editar SKU"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                          title="Excluir SKU"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Exibindo <strong>{pageSize === -1 ? filtered.length : Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}</strong> a <strong>{pageSize === -1 ? filtered.length : Math.min(filtered.length, currentPage * pageSize)}</strong> de <strong>{filtered.length}</strong> produtos
              {searchTerm && <span> (filtrados de {productsList.length} totais)</span>}
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <span className="font-semibold text-slate-700 px-2 font-mono">
                  {currentPage} / {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center space-x-1"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Cadastro / Edição de SKU */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        editingProduct={editingProduct}
        productsMap={productsMap}
        existingGroups={grupos}
      />

      {/* Modal de Confirmação de Exclusão */}
      <DeleteProductModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        product={productToDelete}
        isInStockPositions={
          !!productToDelete && stockPositions.some(s => s.produto === productToDelete.codigo)
        }
      />
    </div>
  );
};
