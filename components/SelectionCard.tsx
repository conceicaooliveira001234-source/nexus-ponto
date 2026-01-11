import React from 'react';
import { ChevronRight } from 'lucide-react';
import { SelectionCardProps } from '../types';

const SelectionCard: React.FC<SelectionCardProps> = ({ role, title, description, icon, color, onClick }) => {
  const isCyan = color === 'cyan';
  
  // Dynamic classes based on color prop
  const borderColor = isCyan ? 'group-hover:border-cyan-500' : 'group-hover:border-fuchsia-500';
  const shadowColor = isCyan ? 'group-hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)]' : 'group-hover:shadow-[0_0_40px_-10px_rgba(217,70,239,0.5)]';
  const iconColor = isCyan ? 'text-cyan-400' : 'text-fuchsia-400';
  const bgGradient = isCyan 
    ? 'bg-gradient-to-br from-cyan-500/10 via-slate-900/50 to-slate-900' 
    : 'bg-gradient-to-br from-fuchsia-500/10 via-slate-900/50 to-slate-900';
  const buttonBg = isCyan ? 'bg-cyan-500 group-hover:bg-cyan-400' : 'bg-fuchsia-600 group-hover:bg-fuchsia-500';

  return (
    <button
      onClick={() => onClick(role)}
      className={`
        group relative w-full md:w-[400px] h-[500px] 
        flex flex-col items-center justify-between p-8
        border border-slate-700/50 rounded-2xl
        backdrop-blur-md transition-all duration-500 ease-out
        ${bgGradient}
        ${borderColor}
        ${shadowColor}
        hover:-translate-y-2
      `}
    >
      {/* Top Decorator Line */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] ${isCyan ? 'bg-cyan-500' : 'bg-fuchsia-500'} shadow-[0_0_10px_currentColor] opacity-50 group-hover:opacity-100 transition-opacity`}></div>

      {/* Icon Section */}
      <div className="mt-10 relative">
        <div className={`absolute inset-0 ${isCyan ? 'bg-cyan-500' : 'bg-fuchsia-500'} blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity duration-500`}></div>
        <div className={`relative z-10 p-6 rounded-full border border-slate-700 bg-slate-950/50 ${iconColor} group-hover:scale-110 transition-transform duration-500`}>
          {icon}
        </div>
      </div>

      {/* Text Section */}
      <div className="flex flex-col items-center text-center space-y-4 z-10">
        <h2 className="font-tech text-3xl font-bold tracking-wider text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-all">
          {title}
        </h2>
        <p className="text-slate-400 font-light text-sm leading-relaxed max-w-[80%] group-hover:text-slate-200 transition-colors">
          {description}
        </p>
      </div>

      {/* Action Button Indicator */}
      <div className={`
        flex items-center justify-center space-x-2 
        py-3 px-8 rounded-full 
        text-white font-bold text-sm tracking-widest uppercase
        transition-all duration-300
        ${buttonBg}
        shadow-lg
      `}>
        <span>Acessar Sistema</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>

      {/* Corner Accents */}
      <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${isCyan ? 'bg-cyan-500' : 'bg-fuchsia-500'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
      <div className={`absolute bottom-4 left-4 w-2 h-2 rounded-full ${isCyan ? 'bg-cyan-500' : 'bg-fuchsia-500'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
    </button>
  );
};

export default SelectionCard;