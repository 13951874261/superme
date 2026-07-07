import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2 } from 'lucide-react';
import { saveUserCurrentProfile } from '../utils/profileHelper';
import { playClick, playWaterDrop } from '../utils/soundEffects';

interface ProfileEditModalProps {
  isOpen: boolean;
  profile: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileEditModal({ isOpen, profile, onClose, onSaved }: ProfileEditModalProps) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setDraft(profile);
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      saveUserCurrentProfile(draft.trim());
      playWaterDrop();
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (!window.confirm('确定清空全局短板画像？此操作不可自动恢复。')) return;
    playClick();
    saveUserCurrentProfile('');
    onSaved();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-zinc-900 tracking-wide">全局短板画像</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">查看、编辑或清空当前画像全文</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-zinc-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            className="w-full text-xs leading-relaxed p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#FF5722]/40 focus:bg-white resize-y min-h-[280px] font-medium text-zinc-800"
            placeholder="暂无画像内容。可直接输入或粘贴后保存。"
          />
          <p className="text-[10px] text-zinc-400 mt-2">
            写入时系统会自动做语义去重；手动编辑将直接覆盖保存。
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空画像
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-black text-white bg-zinc-950 hover:bg-[#FF5722] rounded-xl transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
