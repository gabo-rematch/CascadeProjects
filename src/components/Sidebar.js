import React from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { text: "Matching", icon: "🔗", path: "/matching" },
  { text: "Matches", icon: "📋", path: "/matches" },
  { text: "Client Requirements", icon: "👤", path: "/client-requirements" },
  { text: "Listings", icon: "🏢", path: "/listings" },
  { text: "Import", icon: "⬆️", path: "/import" },
];

export default function Sidebar() {
  return (
    <aside className="h-screen w-56 flex flex-col bg-primary text-primary-foreground shadow-lg">
      {/* Logo */}
      <div className="flex items-center justify-center h-20 border-b border-accent/20">
        <img src="/rematch-logo-main--black.png" alt="ReMatch Logo" className="h-10 max-h-12 w-auto object-contain" style={{ filter: 'brightness(0) invert(0)' }} onError={e => { e.target.style.display = 'none'; }} />
      </div>
      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.text}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 rounded-lg text-base font-medium gap-3 transition-colors w-full
              ${isActive ? 'bg-accent text-accent-foreground font-bold shadow' : 'hover:bg-accent hover:text-accent-foreground'}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.text}
          </NavLink>
        ))}
      </nav>
      {/* Version info */}
      <div className="px-4 py-2 border-t border-accent/20 text-xs text-primary-foreground/70 flex items-center gap-2">
        <span className="opacity-60">v1.0.3</span>
      </div>
    </aside>
  );
}
