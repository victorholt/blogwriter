'use client';

import { useState, useRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { enhanceText } from '@/lib/admin-api';

interface EnhancedTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  token?: string;
  enhanceEnabled?: boolean;
  enhanceContext?: string;
  readOnly?: boolean;
  disabled?: boolean;
}

export default function EnhancedTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  token,
  enhanceEnabled = false,
  enhanceContext,
  readOnly = false,
  disabled = false,
}: EnhancedTextAreaProps): React.ReactElement {
  const [enhancing, setEnhancing] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleEnhance(): Promise<void> {
    if (!token || !value.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const result = await enhanceText(token, value, enhanceContext);
      if (result.success && result.data) {
        onChange(result.data.text);
      }
    } finally {
      setEnhancing(false);
    }
  }

  const showToolbar = enhanceEnabled && token && !readOnly && !disabled;
  const canEnhance = value.trim().length > 0;

  return (
    <div
      className={`textarea-field${focused ? ' textarea-field--focused' : ''}${disabled ? ' textarea-field--disabled' : ''}`}
      onClick={() => textareaRef.current?.focus()}
    >
      <textarea
        ref={textareaRef}
        className="textarea-field__input"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        readOnly={readOnly}
        disabled={disabled}
      />
      {showToolbar && (
        <div className="textarea-field__toolbar">
          <button
            type="button"
            className="textarea-field__enhance"
            onClick={(e) => { e.stopPropagation(); handleEnhance(); }}
            disabled={enhancing || !canEnhance}
            title="Enhance with AI"
          >
            {enhancing ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
            {enhancing ? 'Enhancing...' : 'Enhance'}
          </button>
        </div>
      )}
    </div>
  );
}
