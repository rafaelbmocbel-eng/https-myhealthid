import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlignCenter, LayoutDashboard, Menu, X, Bell, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Método Identidade', href: '/metodo-identidade', icon: null },
  { label: 'COB° ZERO', href: '/cob-zero', icon: AlignCenter },
];

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src={logoMetodo}
            alt="Método Identidade Logo"
            className="h-10 w-10 rounded-xl object-cover"
          />
          <div>
            <div className="text-sm font-bold leading-none text-foreground">
              MÉTODO <span className="text-gradient-primary">IDENTIDADE</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">+ COB° ZERO v8.2</div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive">
              3
            </Badge>
          </Button>
          <Button variant="ghost" className="hidden md:flex items-center gap-2 text-sm">
            <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            Dr. Silva
            <ChevronDown className="h-3 w-3" />
          </Button>
          {/* Mobile toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-card p-4 space-y-1 animate-slide-in">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
