import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, PiggyBank, TrendingUp, LayoutDashboard, Search, Bot } from 'lucide-react';
import FinanceDailyTab from '@/components/finance/FinanceDailyTab';
import FinanceSavingsTab from '@/components/finance/FinanceSavingsTab';
import FinanceInvestTab from '@/components/finance/FinanceInvestTab';
import FinanceSummaryTab from '@/components/finance/FinanceSummaryTab';
import FinanceSearchTab from '@/components/finance/FinanceSearchTab';
import FinanceAIAgent from '@/components/finance/FinanceAIAgent';
 
export default function Finanzas() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-3xl font-grotesk font-bold text-foreground">Finanzas</h1>
        <p className="text-muted-foreground mt-1">Control total de tu economía</p>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="bg-muted/30 w-full grid grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="summary" className="data-[state=active]:bg-finance/20 data-[state=active]:text-finance gap-1 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="daily" className="data-[state=active]:bg-finance/20 data-[state=active]:text-finance gap-1 text-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Día a día</span>
          </TabsTrigger>
          <TabsTrigger value="savings" className="data-[state=active]:bg-finance/20 data-[state=active]:text-finance gap-1 text-xs">
            <PiggyBank className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ahorro</span>
          </TabsTrigger>
          <TabsTrigger value="invest" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inversión</span>
          </TabsTrigger>
          <TabsTrigger value="search" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 gap-1 text-xs">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buscador</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1 text-xs">
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">IA Agent</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary"><FinanceSummaryTab /></TabsContent>
        <TabsContent value="daily"><FinanceDailyTab /></TabsContent>
        <TabsContent value="savings"><FinanceSavingsTab /></TabsContent>
        <TabsContent value="invest"><FinanceInvestTab /></TabsContent>
        <TabsContent value="search"><FinanceSearchTab /></TabsContent>
        <TabsContent value="ai"><FinanceAIAgent /></TabsContent>
      </Tabs>
    </div>
  );
}
