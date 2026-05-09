import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  ChevronDown, Plus, RefreshCw, Search, Bell, Settings,
  ArrowUpRight, ArrowDownRight, Check, X, Calendar, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── COLORES PARA BENCHMARKS (Máx 6) ───
const BENCHMARK_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function FinanceInvestTab() {
  // ─── ESTADOS DE LA CARTERA ───
  const [portfolios, setPortfolios] = useState([
    { id: '1', name: 'Cartera de inversión' },
    { id: '2', name: 'Jubilación' }
  ]);
  const [activePortfolioId, setActivePortfolioId] = useState('1');
  const [displayMode, setDisplayMode] = useState('value'); // 'value' | 'performance'
  const [refreshing, setRefreshing] = useState(false);

  // ─── ESTADOS DE GRÁFICO Y BENCHMARKS ───
  const [chartTimeframe, setChartTimeframe] = useState('1A'); // 1D, 1S, 1M, YTD, 1A, MAX
  const [benchmarks, setBenchmarks] = useState([
    { id: 'portfolio', name: 'Cartera de inversión', color: '#22c55e', active: true, isBase: true },
    // Ejemplo de un benchmark ya añadido:
    // { id: 'sp500', name: 'S&P 500', color: BENCHMARK_COLORS[0], active: true, isBase: false }
  ]);
  const [showBenchmarkDetail, setShowBenchmarkDetail] = useState(false);
  
  // Fechas personalizadas para la vista detallada
  const [dateRange, setDateRange] = useState({ 
    min: format(new Date(new Date().setFullYear(new Date().getFullYear() - 1)), 'yyyy-MM-dd'), 
    max: format(new Date(), 'yyyy-MM-dd') 
  });

  // Modales
  const [showNewPortfolioModal, setShowNewPortfolioModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [showAddBenchmarkModal, setShowAddBenchmarkModal] = useState(false);

  // ─── MOCK DATA Y CÁLCULOS ───
  const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || portfolios[0];
  const totalValue = 116.42; // Simulado
  const absoluteGain = 4.12; // Simulado
  const percentageGain = 3.67; // Simulado
  const isPositive = absoluteGain >= 0;

  // Generador de datos simulados para múltiples líneas
  const chartData = useMemo(() => {
    const data = [];
    const points = chartTimeframe === '1S' ? 7 : chartTimeframe === '1M' ? 30 : chartTimeframe === 'YTD' ? 90 : chartTimeframe === '1A' ? 12 : 30;
    
    for (let i = points; i >= 0; i--) {
      const d = new Date();
      if (chartTimeframe === '1A' || chartTimeframe === 'MAX') d.setMonth(d.getMonth() - i);
      else d.setDate(d.getDate() - i);
      
      const dataPoint = { date: format(d, chartTimeframe === '1A' ? 'MMM yy' : 'dd MMM', { locale: es }) };
      
      // Generar un valor para cada benchmark activo
      benchmarks.filter(b => b.active).forEach(b => {
        const base = b.isBase ? totalValue * 0.8 : 100;
        const variance = (Math.random() - 0.4) * (base * 0.05);
        dataPoint[b.id] = i === 0 ? (b.isBase ? totalValue : base * 1.1) : base + ((points - i) * (b.isBase ? totalValue - base : base * 0.1) / points) + variance;
      });
      data.push(dataPoint);
    }
    return data;
  }, [totalValue, chartTimeframe, benchmarks]);

  // ─── HANDLERS ───
  const handleAddPortfolio = () => {
    if (!newPortfolioName.trim()) return;
    const newId = Date.now().toString();
    setPortfolios([...portfolios, { id: newId, name: newPortfolioName }]);
    setActivePortfolioId(newId);
    setShowNewPortfolioModal(false);
    setNewPortfolioName('');
  };

  const toggleBenchmark = (id) => {
    setBenchmarks(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
  };

  const removeBenchmark = (id) => {
    setBenchmarks(prev => prev.filter(b => b.id !== id));
    // Si quitamos benchmarks y solo queda la cartera, salir de la vista detallada
    if (benchmarks.length <= 2) setShowBenchmarkDetail(false);
  };

  const handleAddMockBenchmark = (name) => {
    if (benchmarks.length >= 6) return alert("Máximo 6 puntos de referencia permitidos.");
    const newId = name.toLowerCase().replace(/\s/g, '');
    if (benchmarks.some(b => b.id === newId)) return; // Ya existe

    const nextColor = BENCHMARK_COLORS[(benchmarks.length - 1) % BENCHMARK_COLORS.length];
    const newBenchmarks = [...benchmarks, { id: newId, name, color: nextColor, active: true, isBase: false }];
    setBenchmarks(newBenchmarks);
    setShowAddBenchmarkModal(false);
    
    // Si tenemos al menos una referencia aparte de la base, mostrar vista detallada
    if (newBenchmarks.length > 1) {
      setShowBenchmarkDetail(true);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // ─── TOOLTIP PERSONALIZADO ───
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border/50 rounded-xl p-3 shadow-xl min-w-[150px]">
          <p className="text-xs text-muted-foreground mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1.5">
            {payload.map(entry => (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{benchmarks.find(b => b.id === entry.dataKey)?.name}</span>
                </div>
                <span className="font-semibold text-foreground">
                  {entry.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })} {entry.dataKey === 'portfolio' ? '€' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-24 font-sans text-foreground">
      
      {/* ─── HEADER / TOP BAR ─── */}
      <div className="flex items-center justify-between mb-8 px-2">
        {/* Selector de Cartera */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-xl md:text-2xl font-bold tracking-tight px-2 hover:bg-muted/30">
              {activePortfolio.name}
              <ChevronDown className="w-5 h-5 ml-2 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-card border-border/50 rounded-2xl shadow-xl">
            {portfolios.map(p => (
              <DropdownMenuItem key={p.id} onClick={() => setActivePortfolioId(p.id)} className="rounded-xl cursor-pointer">
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">{p.name}</span>
                  {activePortfolioId === p.id && <Check className="w-4 h-4 text-blue-500" />}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem onClick={() => setShowNewPortfolioModal(true)} className="rounded-xl cursor-pointer text-blue-500 font-medium">
              <Plus className="w-4 h-4 mr-2" /> Añadir cartera
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Iconos de acción derechos */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleRefresh} className="rounded-full text-muted-foreground hover:text-foreground">
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground"><Search className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground"><Bell className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground"><Settings className="w-5 h-5" /></Button>
        </div>
      </div>

      {/* ─── MAIN HERO (Número Gigante) ─── */}
      <div className="px-4 mb-8">
        {displayMode === 'value' ? (
          <>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tighter mb-2 font-grotesk">
              {totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })} <span className="text-4xl text-muted-foreground font-normal">€</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className={`flex items-center font-semibold text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <ArrowUpRight className="w-5 h-5 mr-0.5" /> : <ArrowDownRight className="w-5 h-5 mr-0.5" />}
                {absoluteGain.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € 
                <span className="ml-1">({isPositive ? '+' : ''}{percentageGain.toFixed(2)}%)</span>
              </div>
              
              {/* Toggle de modo de visualización */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground bg-muted/20 hover:bg-muted/40 rounded-lg">
                    Rendimiento absoluto <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-card border-border/50 rounded-xl">
                  <DropdownMenuItem onClick={() => setDisplayMode('value')} className="text-xs">Rendimiento absoluto</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDisplayMode('performance')} className="text-xs">Rendimiento porcentual</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : (
          /* Vista alternativa si seleccionan Rendimiento como número principal */
          <>
            <h1 className={`text-6xl md:text-7xl font-bold tracking-tighter mb-2 font-grotesk ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{percentageGain.toFixed(2)} <span className="text-4xl font-normal">%</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="text-xl font-semibold text-muted-foreground">
                {totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground bg-muted/20 hover:bg-muted/40 rounded-lg">
                    Valor de la cartera <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-card border-border/50 rounded-xl">
                  <DropdownMenuItem onClick={() => setDisplayMode('value')} className="text-xs">Valor de la cartera</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      {/* ─── GRÁFICO Y CONTROLES (Modo Normal o Detallado) ─── */}
      <div className={`transition-all duration-300 ${showBenchmarkDetail ? 'bg-card border border-border/40 rounded-3xl p-6 shadow-lg' : ''}`}>
        
        {/* Controles de Rango de Fechas (Solo en modo Benchmark) */}
        {showBenchmarkDetail && (
          <div className="flex items-center justify-between mb-6 animate-in fade-in">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" /> Comparativa de rendimiento
            </h3>
            <div className="flex items-center gap-2 bg-muted/20 p-1.5 rounded-2xl border border-border/30">
              <div className="flex items-center px-3 py-1 bg-background rounded-xl text-sm font-medium border border-border/50">
                <span className="text-muted-foreground mr-2 text-xs uppercase">Mín</span>
                <input type="date" value={dateRange.min} onChange={e => setDateRange({...dateRange, min: e.target.value})} className="bg-transparent border-none outline-none cursor-pointer" />
              </div>
              <div className="text-muted-foreground">-</div>
              <div className="flex items-center px-3 py-1 bg-background rounded-xl text-sm font-medium border border-border/50">
                <span className="text-muted-foreground mr-2 text-xs uppercase">Máx</span>
                <input type="date" value={dateRange.max} onChange={e => setDateRange({...dateRange, max: e.target.value})} className="bg-transparent border-none outline-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Área del Gráfico */}
        <div className={`${showBenchmarkDetail ? 'h-[400px]' : 'h-[300px]'} w-full relative mb-6`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={showBenchmarkDetail ? 0.3 : 0} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }} />
              
              {/* Renderizar una línea por cada benchmark activo */}
              {benchmarks.filter(b => b.active).map(b => (
                <Line 
                  key={b.id} 
                  type="monotone" 
                  dataKey={b.id} 
                  stroke={b.color} 
                  strokeWidth={b.isBase ? 3 : 2} 
                  dot={false} 
                  activeDot={{ r: 6, fill: b.color, stroke: '#fff', strokeWidth: 2 }} 
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Timeframes (Solo se muestran en modo normal) */}
        {!showBenchmarkDetail && (
          <div className="flex justify-center mb-8">
            <div className="flex items-center bg-muted/20 rounded-xl p-1 border border-border/30">
              {['1D', '1S', '1M', 'YTD', '1A', 'MAX'].map(tf => (
                <button 
                  key={tf} onClick={() => setChartTimeframe(tf)} 
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${chartTimeframe === tf ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Píldoras de Benchmarks / Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {benchmarks.map(b => (
            <div key={b.id} className={`flex items-center pl-1 pr-3 py-1 rounded-full border transition-colors ${b.active ? 'bg-background border-border/50' : 'bg-muted/10 border-transparent opacity-50'}`}>
              <button onClick={() => toggleBenchmark(b.id)} className="flex items-center gap-2 flex-1 outline-none">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-background ${b.active ? '' : 'opacity-50'}`} style={{ backgroundColor: b.color }}>
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium">{b.name}</span>
              </button>
              
              {/* Botón para eliminar (no se puede eliminar la base) */}
              {!b.isBase && (
                <button onClick={() => removeBenchmark(b.id)} className="ml-2 p-1 text-muted-foreground hover:text-red-500 rounded-full transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Botón Añadir Benchmark */}
          {benchmarks.length < 6 && (
            <Button 
              variant="outline" 
              onClick={() => setShowAddBenchmarkModal(true)} 
              className="rounded-full border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Añadir
            </Button>
          )}
          
          <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
            {benchmarks.length}/6 referencias
          </div>
        </div>
      </div>

      {/* ─── MODALES ─── */}

      {/* Modal: Añadir Cartera */}
      <Dialog open={showNewPortfolioModal} onOpenChange={setShowNewPortfolioModal}>
        <DialogContent className="bg-card border-border/50 rounded-[2rem] sm:max-w-sm p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">Nueva cartera</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nombre de la cartera</label>
              <Input 
                value={newPortfolioName} 
                onChange={e => setNewPortfolioName(e.target.value)} 
                placeholder="Ej. Ahorros casa" 
                className="bg-muted/50 border-border/40 rounded-xl h-12" 
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddPortfolio()}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowNewPortfolioModal(false)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button onClick={handleAddPortfolio} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold">Crear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Añadir Punto de Referencia (Benchmark) */}
      <Dialog open={showAddBenchmarkModal} onOpenChange={setShowAddBenchmarkModal}>
        <DialogContent className="bg-card border-border/50 rounded-[2rem] sm:max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold">Añadir punto de referencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input placeholder="Buscar índice, fondo, acción..." className="w-full pl-11 pr-4 h-12 text-base bg-muted/30 border-border/50 rounded-xl" />
            </div>
            
            <div className="pt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Populares</p>
              <div className="space-y-2">
                {['MSCI World', 'S&P 500', 'Nasdaq 100', 'Bitcoin', 'Oro'].map(name => {
                  const alreadyAdded = benchmarks.some(b => b.name === name);
                  return (
                    <button 
                      key={name}
                      disabled={alreadyAdded}
                      onClick={() => handleAddMockBenchmark(name)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${alreadyAdded ? 'bg-muted/10 border-transparent opacity-50 cursor-not-allowed' : 'bg-background border-border/40 hover:border-blue-500/50 hover:bg-blue-500/5'}`}
                    >
                      <span className="font-medium text-sm">{name}</span>
                      {alreadyAdded ? <Check className="w-4 h-4 text-muted-foreground" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
