import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { ProductMaster } from '../types';
import { formatCurrency } from '../utils/parsers';

interface DeleteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (codigo: string) => void;
  product: ProductMaster | null;
  isInStockPositions?: boolean;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  product,
  isInStockPositions = false
}) => {
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-rose-700">
            <div className="p-2 rounded-xl bg-rose-100 border border-rose-200">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Confirmar Exclusão de SKU
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                Esta ação removerá o produto do cadastro mestre.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                SKU {product.codigo}
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                {product.grupo}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-800">
              {product.descricao}
            </div>
            <div className="text-xs text-slate-500 flex items-center space-x-2 pt-1 border-t border-slate-200/60 font-mono">
              <span>Fator: <strong>{product.fatorSku} un/cx</strong></span>
              <span>•</span>
              <span>Cx: <strong>{formatCurrency(product.valor)}</strong></span>
            </div>
          </div>

          {isInStockPositions ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Atenção: Produto com movimentações ativas</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Existem posições de estoque ou desvios associados a este SKU. Ao excluí-lo, cálculos de conciliação podem ficar sem referência de preço e fator de conversão.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza que deseja excluir o cadastro mestre deste SKU? Os cálculos futuros não encontrarão os fatores deste produto a menos que seja recadastrado.
            </p>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(product.codigo)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center space-x-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Sim, Excluir SKU</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
