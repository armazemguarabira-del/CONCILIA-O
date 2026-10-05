import React, { useState, useEffect } from 'react';
import { 
  StockPositionItem, 
  DepositoId, 
  ProductMaster, 
  QuebraItem, 
  ValeItem, 
  TrocaItem, 
  FaltaMapeadaItem, 
  ViewTab 
} from '../types';
import { ConciliacaoAjustesView } from './ConciliacaoAjustesView';
import { ConciliacaoPadraoView } from './ConciliacaoPadraoView';

export interface ConciliacaoViewProps {
  stockPositions: StockPositionItem[];
  setStockPositions: React.Dispatch<React.SetStateAction<StockPositionItem[]>>;
  selectedDeposito: DepositoId | 'ALL';
  setSelectedDeposito: (dep: DepositoId | 'ALL') => void;
  onOpenImportModal: (initialFile?: '020502' | '021101' | 'cadastro' | 'quebras' | 'vales' | 'trocas' | 'faltas') => void;
  onClearStockPositions?: () => void;
  productsMap: Map<string, ProductMaster>;
  isRecountApplied: boolean;
  quebras?: QuebraItem[];
  vales?: ValeItem[];
  trocas?: TrocaItem[];
  faltasMapeadas?: FaltaMapeadaItem[];
  initialSubTab?: 'padrao' | 'ajustes';
  onNavigateTab?: (tab: ViewTab) => void;
  onOpenSaveModal?: () => void;
  onOpenManualModal?: (type?: 'quebra' | 'vale' | 'troca' | 'falta') => void;
  weeklyBillingStatus?: Record<string, 'PENDENTE' | 'OK'>;
}

export const ConciliacaoView: React.FC<ConciliacaoViewProps> = (props) => {
  const [subTab, setSubTab] = useState<'padrao' | 'ajustes'>(props.initialSubTab || 'padrao');

  // Keep in sync with initialSubTab when parent tab selection changes
  useEffect(() => {
    if (props.initialSubTab) {
      setSubTab(props.initialSubTab);
    }
  }, [props.initialSubTab]);

  if (subTab === 'ajustes') {
    return (
      <ConciliacaoAjustesView
        stockPositions={props.stockPositions}
        quebras={props.quebras || []}
        vales={props.vales || []}
        trocas={props.trocas || []}
        faltasMapeadas={props.faltasMapeadas || []}
        selectedDeposito={props.selectedDeposito}
        setSelectedDeposito={props.setSelectedDeposito}
        productsMap={props.productsMap}
        isRecountApplied={props.isRecountApplied}
        onNavigateTab={(tab) => {
          if (tab === 'conciliacao') {
            setSubTab('padrao');
          } else if (props.onNavigateTab) {
            props.onNavigateTab(tab);
          }
        }}
        onToggleSubTab={(mode) => setSubTab(mode)}
        onOpenImportModal={props.onOpenImportModal}
        onOpenSaveModal={props.onOpenSaveModal}
        onOpenManualModal={props.onOpenManualModal}
        weeklyBillingStatus={props.weeklyBillingStatus}
      />
    );
  }

  return (
    <ConciliacaoPadraoView
      {...props}
      subTab={subTab}
      onToggleSubTab={(mode) => setSubTab(mode)}
    />
  );
};
