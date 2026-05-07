import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PiggyBank, TrendingUp, LayoutDashboard } from 'lucide-react';
import FinanceDailyTab from '@/components/finance/FinanceDailyTab';
import FinanceSavingsTab from '@/components/finance/FinanceSavingsTab';
import FinanceInvestTab from '@/components/finance/FinanceInvestTab';
import FinanceSummaryTab from '@/components/finance/FinanceSummaryTab';

export default function Finanzas() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-3xl font-grotesk font-bold text-foreground">Finanzas</h1>
        <p className="text-muted-foreground mt-1">Control total de tu economía</p>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="bg-muted/30 w-full grid grid-cols-4">
          <TabsTrigger value="summary" className="data-[state=active]:bg-finance/20 data-[state=active]:text-finance gap-1.5 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="daily" className="data-[state=active]:bg-finance/20 data-[state=active]:text-finance gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Día a día
          </TabsTrigger>
          <TabsTrigger value="savings" className="data-[state=active]:bg-finance/20 data-[state=active]:text-finance gap-1.5 text-xs">
            <PiggyBank className="w-3.5 h-3.5" /> Ahorro
          </TabsTrigger>
          <TabsTrigger value="invest" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5" /> Inversión
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary"><FinanceSummaryTab /></TabsContent>
        <TabsContent value="daily"><FinanceDailyTab /></TabsContent>
        <TabsContent value="savings"><FinanceSavingsTab /></TabsContent>
        <TabsContent value="invest"><FinanceInvestTab /></TabsContent>
      </Tabs>
    </div>
  );
}