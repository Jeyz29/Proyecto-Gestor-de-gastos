import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Tag,
  ChevronDown,
  ChevronRight,
  Edit3,
  Check,
  CornerDownRight,
} from 'lucide-react';
import type {
  Category,
  Subcategory,
  CreateCategoryInput,
  CreateSubcategoryInput,
} from '../../types/index.ts';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  subcategories: Subcategory[];
  onCreateCategory: (data: CreateCategoryInput) => Promise<void>;
  onUpdateCategory: (id: string, data: CreateCategoryInput) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onCreateSubcategory: (data: CreateSubcategoryInput) => Promise<void>;
  onUpdateSubcategory: (id: string, name: string) => Promise<void>;
  onDeleteSubcategory: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#64748B', // Slate
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  subcategories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Estado para expandir/colapsar las subcategorías de una categoría
  const [expandedCatId, setExpandedCatId] = useState<string | null>(
    categories[0]?.id || null
  );

  // Edición de categoría padre
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');

  // Nueva subcategoría por categoría
  const [newSubName, setNewSubName] = useState('');

  // Edición de subcategoría
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');

  if (!isOpen) return null;

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCreateCategory({ name: name.trim(), color });
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditCategory = async (catId: string) => {
    if (!editCatName.trim()) return;
    setError(null);
    try {
      await onUpdateCategory(catId, { name: editCatName.trim(), color: editCatColor });
      setEditingCatId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al editar categoría');
    }
  };

  const handleDeleteCat = async (id: string) => {
    setError(null);
    try {
      await onDeleteCategory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  const handleAddSub = async (e: React.FormEvent, categoryId: string) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    setError(null);
    try {
      await onCreateSubcategory({
        category_id: categoryId,
        name: newSubName.trim(),
      });
      setNewSubName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear subcategoría');
    }
  };

  const handleSaveEditSub = async (subId: string) => {
    if (!editSubName.trim()) return;
    setError(null);
    try {
      await onUpdateSubcategory(subId, editSubName.trim());
      setEditingSubId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al editar subcategoría');
    }
  };

  const handleDeleteSub = async (subId: string) => {
    setError(null);
    try {
      await onDeleteSubcategory(subId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar subcategoría');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Categorías y Subcategorías
              </h2>
              <p className="text-xs text-slate-400">
                Crea o modifica categorías y sus divisiones (ej. Proteína, Verduras...)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Formulario nueva categoría principal */}
          <form
            onSubmit={handleSubmitCategory}
            className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3"
          >
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Nueva Categoría Principal
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Gimnasio, Mascotas, Educación..."
                className="flex-1 px-3.5 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Crear
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              <span className="text-xs text-slate-500 mr-1">Color:</span>
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                    color === preset
                      ? 'scale-125 ring-2 ring-offset-2 ring-slate-800'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
          </form>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Lista de categorías y sus subcategorías */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Categorías Existentes ({categories.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Haz clic en una categoría para ver/agregar subcategorías
              </span>
            </div>

            <div className="space-y-2.5">
              {categories.map((cat) => {
                const catSubs = subcategories.filter((s) => s.category_id === cat.id);
                const isExpanded = expandedCatId === cat.id;
                const isEditingCat = editingCatId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="border border-slate-200/90 rounded-xl overflow-hidden bg-white"
                  >
                    {/* Cabecera de Categoría */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                      {isEditingCat ? (
                        <div className="flex-1 flex flex-wrap items-center gap-2 pr-2">
                          <input
                            type="text"
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            className="flex-1 min-w-36 px-2.5 py-1 bg-white border border-indigo-300 rounded-lg text-sm focus:outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-1">
                            {PRESET_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditCatColor(c)}
                                className={`w-4 h-4 rounded-full cursor-pointer ${
                                  editCatColor === c ? 'ring-2 ring-slate-800' : ''
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveEditCategory(cat.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Guardar cambios"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-200 rounded cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedCatId(isExpanded ? null : cat.id);
                              setNewSubName('');
                            }}
                            className="flex items-center gap-2.5 flex-1 text-left cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-sm font-semibold text-slate-800">
                              {cat.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                              {catSubs.length} sub.
                            </span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditCatName(cat.name);
                                setEditCatColor(cat.color);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Editar nombre o color de categoría"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCat(cat.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar categoría"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Panel desplegable de Subcategorías */}
                    {isExpanded && (
                      <div className="p-3.5 bg-white border-t border-slate-100 space-y-3">
                        {/* Lista de subcategorías actuales */}
                        {catSubs.length === 0 ? (
                          <p className="text-xs text-slate-400 italic pl-2">
                            Sin subcategorías aún. Añade una abajo (ej. Proteína, Verduras...).
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {catSubs.map((sub) => {
                              const isEditingSub = editingSubId === sub.id;
                              return (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between pl-3 pr-2 py-1.5 rounded-lg bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                                >
                                  {isEditingSub ? (
                                    <div className="flex items-center gap-1.5 flex-1">
                                      <input
                                        type="text"
                                        value={editSubName}
                                        onChange={(e) => setEditSubName(e.target.value)}
                                        className="flex-1 px-2 py-1 bg-white border border-indigo-300 rounded text-xs focus:outline-none"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditSub(sub.id)}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                        title="Guardar"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingSubId(null)}
                                        className="p-1 text-slate-400 hover:bg-slate-200 rounded cursor-pointer"
                                        title="Cancelar"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                                        <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{sub.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingSubId(sub.id);
                                            setEditSubName(sub.name);
                                          }}
                                          className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                          title="Renombrar subcategoría"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSub(sub.id)}
                                          className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                          title="Eliminar subcategoría"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Formulario rápido para añadir subcategoría */}
                        <form
                          onSubmit={(e) => handleAddSub(e, cat.id)}
                          className="flex items-center gap-2 pt-1"
                        >
                          <input
                            type="text"
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            placeholder={`Nueva subcategoría en ${cat.name} (ej: Proteína, Frutas...)`}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={!newSubName.trim()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Subcategoría
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
