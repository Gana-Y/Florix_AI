import React from 'react';

const Onboarding = ({ onComplete }) => {
  return (
    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white">Let's start your journey.</h2>
        <p className="text-zinc-500 text-sm mt-1">Help us customize your Florix experience.</p>
      </div>

      <div className="space-y-5">
        
        {/* NAME */}
        <div>
          <label className="block text-zinc-300 font-medium mb-2">Your name</label>
          <input 
            type="text" 
            placeholder="Enter your full name" 
            className="w-full bg-black border border-zinc-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        {/* LANGUAGE */}
        <div>
          <label className="block text-zinc-300 font-medium mb-2">Preferred Language</label>
          <div className="relative">
            <select className="w-full bg-black border border-zinc-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer transition-all">
              <option value="en">🇺🇸 English (United States)</option>
              <option value="es">🇪🇸 Spanish (Español)</option>
              <option value="fr">🇫🇷 French (Français)</option>
              <option value="de">🇩🇪 German (Deutsch)</option>
              <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
              <option value="ja">🇯🇵 Japanese (日本語)</option>
            </select>
            <div className="absolute right-4 top-4 pointer-events-none text-zinc-500 text-xs">▼</div>
          </div>
        </div>

        {/* USAGE PLAN */}
        <div>
          <label className="block text-zinc-300 font-medium mb-2">How do you plan to use Florix?</label>
          <div className="relative">
            <select className="w-full bg-black border border-zinc-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer transition-all">
              <option value="" disabled selected>Select your primary goal...</option>
              <option value="student">🎓 Academic & Research (Student)</option>
              <option value="dev">💻 Coding & System Design (Developer)</option>
              <option value="business">💼 Enterprise Automation (Manager)</option>
              <option value="personal">⚡ Personal Productivity</option>
            </select>
            <div className="absolute right-4 top-4 pointer-events-none text-zinc-500 text-xs">▼</div>
          </div>
        </div>

        <button 
          onClick={onComplete}
          className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95 shadow-lg shadow-indigo-600/20"
        >
          Complete Setup
        </button>

      </div>
    </div>
  );
};

export default Onboarding;