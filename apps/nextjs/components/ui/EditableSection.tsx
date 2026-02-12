'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';

interface EditableSectionProps {
  sectionId: string;
  editingSectionId: string | null;
  onEditingChange: (id: string | null) => void;
  children: ReactNode;
  renderEdit: (handlers: { onSave: () => void; onCancel: () => void }) => ReactNode;
  className?: string;
}

export default function EditableSection({
  sectionId,
  editingSectionId,
  onEditingChange,
  children,
  renderEdit,
  className = '',
}: EditableSectionProps): React.ReactElement {
  const isEditing = editingSectionId === sectionId;
  const anotherIsEditing = editingSectionId !== null && !isEditing;

  const handleCancel = useCallback(() => {
    onEditingChange(null);
  }, [onEditingChange]);

  const handleSave = useCallback(() => {
    onEditingChange(null);
  }, [onEditingChange]);

  useEffect(() => {
    if (!isEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isEditing, handleCancel]);

  if (isEditing) {
    return (
      <div className={`editable-section editable-section--editing ${className}`}>
        {renderEdit({ onSave: handleSave, onCancel: handleCancel })}
      </div>
    );
  }

  return (
    <div className={`editable-section ${anotherIsEditing ? 'editable-section--locked' : ''} ${className}`}>
      {children}
      {!anotherIsEditing && (
        <button
          className="editable-section__edit-btn"
          onClick={() => onEditingChange(sectionId)}
          aria-label="Edit section"
        >
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}
