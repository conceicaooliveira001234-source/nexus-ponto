import React from 'react';

interface TechInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
}

const TechInput: React.FC<TechInputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-xs font-mono text-cyan-400 tracking-wider uppercase ml-1">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
          {icon}
        </div>
        <input
          {...props}
          className="w-full bg-slate-950/50 border border-slate-700 text-white placeholder-slate-600 text-sm rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 block pl-10 p-3 transition-all duration-300 backdrop-blur-sm outline-none"
        />
        {/* Glowing border effect on bottom */}
        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-all duration-500 group-focus-within:w-full"></div>
      </div>
    </div>
  );
};

export default TechInput;