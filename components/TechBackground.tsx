import React from 'react';

const TechBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-slate-950 opacity-90 z-10"></div>
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      ></div>

      {/* Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      
      {/* Floating Particles (Simulated with static divs for performance, could be animated) */}
      <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full blur-[1px] opacity-60"></div>
      <div className="absolute top-3/4 left-1/3 w-1 h-1 bg-fuchsia-400 rounded-full blur-[1px] opacity-60"></div>
      <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-indigo-500 rounded-full blur-[2px] opacity-40"></div>

      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_4px,6px_100%] pointer-events-none"></div>
    </div>
  );
};

export default TechBackground;