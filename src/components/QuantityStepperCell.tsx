import React, { useState, useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

interface QuantityStepperCellProps {
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  variant?: 'emerald' | 'rose' | 'amber';
  title?: string;
  size?: 'sm' | 'md';
}

export const QuantityStepperCell: React.FC<QuantityStepperCellProps> = ({
  value,
  onChange,
  min = 0,
  max,
  variant = 'amber',
  title,
  size = 'sm'
}) => {
  // Estado de texto local permite apagar totalmente o número (backspace/delete),
  // digitar livremente qualquer dígito e manter sincronizado com o par em tempo real.
  const [localText, setLocalText] = useState<string>(String(value ?? 0));
  const isFocusedRef = useRef(false);

  // Sincroniza se o valor mudar externamente e o usuário não estiver digitando ativamente
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalText(String(value ?? 0));
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Permite que o campo fique vazio temporariamente enquanto o usuário apaga e digita
    setLocalText(raw);

    if (raw.trim() !== '') {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) {
        let finalVal = Math.max(min, parsed);
        if (max !== undefined) {
          finalVal = Math.min(max, finalVal);
        }
        onChange(finalVal);
      }
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    // Se o usuário deixou o campo vazio ao sair, restaura para o mínimo ou 1
    if (localText.trim() === '' || isNaN(parseInt(localText, 10))) {
      const fallback = Math.max(min, 1);
      setLocalText(String(fallback));
      onChange(fallback);
    } else {
      const parsed = parseInt(localText, 10);
      let finalVal = Math.max(min, parsed);
      if (max !== undefined) {
        finalVal = Math.min(max, finalVal);
      }
      setLocalText(String(finalVal));
      onChange(finalVal);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    // Seleciona todo o texto ao focar para substituição imediata ao digitar
    e.target.select();
  };

  const handleIncrement = () => {
    const current = parseInt(localText, 10);
    const base = isNaN(current) ? (value ?? 0) : current;
    const next = max !== undefined ? Math.min(max, base + 1) : base + 1;
    setLocalText(String(next));
    onChange(next);
  };

  const handleDecrement = () => {
    const current = parseInt(localText, 10);
    const base = isNaN(current) ? (value ?? 0) : current;
    const next = Math.max(min, base - 1);
    setLocalText(String(next));
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    } else if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  // Cores personalizadas conforme a ponta (Entrada = esmeralda, Saída = rosa/vermelho, Neutro = âmbar)
  const styles = {
    emerald: {
      wrapper: 'bg-emerald-50/80 border-emerald-300 text-emerald-950',
      btn: 'hover:bg-emerald-200 text-emerald-900 active:bg-emerald-300',
      input: 'border-emerald-300 focus:ring-emerald-500 text-emerald-950 focus:border-emerald-500'
    },
    rose: {
      wrapper: 'bg-rose-50/80 border-rose-300 text-rose-950',
      btn: 'hover:bg-rose-200 text-rose-900 active:bg-rose-300',
      input: 'border-rose-300 focus:ring-rose-500 text-rose-950 focus:border-rose-500'
    },
    amber: {
      wrapper: 'bg-amber-100/70 border-amber-300 text-slate-900',
      btn: 'hover:bg-amber-300 text-slate-900 active:bg-amber-400',
      input: 'border-amber-300 focus:ring-amber-500 text-slate-900 focus:border-amber-500'
    }
  }[variant];

  const isSmall = size === 'sm';

  return (
    <div 
      className={`inline-flex items-center justify-center gap-1 border rounded-lg p-0.5 shadow-2xs font-mono font-black ${styles.wrapper}`}
      title={title || 'Alterar quantidade livremente'}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className={`${isSmall ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm'} rounded flex items-center justify-center font-black transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${styles.btn}`}
        title="Diminuir quantidade (-1)"
      >
        <Minus className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} stroke-[2.5]`} />
      </button>

      <input
        type="number"
        min={min}
        max={max}
        value={localText}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${isSmall ? 'w-12 text-xs py-0.5' : 'w-14 text-sm py-1'} text-center font-black bg-white rounded border focus:outline-none focus:ring-2 shadow-inner font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 ${styles.input}`}
        title="Digite o número desejado ou use as setas"
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={max !== undefined && value >= max}
        className={`${isSmall ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm'} rounded flex items-center justify-center font-black transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${styles.btn}`}
        title="Aumentar quantidade (+1)"
      >
        <Plus className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} stroke-[2.5]`} />
      </button>
    </div>
  );
};
