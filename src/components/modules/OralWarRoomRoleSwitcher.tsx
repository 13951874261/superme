import React from 'react';
import { motion } from 'motion/react';
import { Users } from 'lucide-react';
import { playRoleSwitch } from '../../utils/soundEffects';
import type { RoleSwitcherRole } from './oralWarRoom/types';

interface Props {
  roles: RoleSwitcherRole[];
  currentTarget: string;
  onTargetChange: (roleName: string) => void;
}

export default function OralWarRoomRoleSwitcher({ roles, currentTarget, onTargetChange }: Props) {
  if (roles.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">
        <Users className="w-3 h-3" />
        对话对象
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {roles.map((role) => {
          const isActive = currentTarget === role.name;
          return (
            <motion.button
              key={role.name}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playRoleSwitch();
                onTargetChange(isActive ? '' : role.name);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border
                ${isActive
                  ? `${role.avatarColor} border-current shadow-[var(--shadow-sm)]`
                  : 'bg-white border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-border)]'
                }`}
            >
              <span>{role.name}</span>
              {isActive && <span className="text-[8px]">@</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
