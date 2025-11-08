import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, Clock, AlertTriangle, Users, Loader2 } from "lucide-react";
import { alertsApi, casesApi, transactionsApi } from "@/lib/api";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";

export default function Reports() {
  const [timeRange, setTimeRange] = useState("6m");

  // Calculate date range based on selection
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    
    if (timeRange === "6m") {
      startDate = subMonths(now, 6);
    } else if (timeRange === "1y") {
      startDate = subMonths(now, 12);
    } else {
      // All time - use a very old date
      startDate = new Date(2020, 0, 1);
    }
    
    return { startDate, endDate: now };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch all alerts for the time range
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["reports-alerts", timeRange],
    queryFn: async () => {
      return alertsApi.getList({ page: 1, pageSize: 10000 });
    },
  });

  // Fetch all cases
  const { data: casesData, isLoading: casesLoading } = useQuery({
    queryKey: ["reports-cases"],
    queryFn: () => casesApi.getList({ page: 1, pageSize: 1000 }),
  });

  // Fetch all transactions for time range
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["reports-transactions", timeRange],
    queryFn: async () => {
      return transactionsApi.getList({
        page: 1,
        pageSize: 10000,
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      });
    },
  });

  // Fetch top accounts
  const { data: topAccountsData } = useQuery({
    queryKey: ["reports-top-accounts"],
    queryFn: () => alertsApi.getTopAccounts(100),
  });

  const alerts = alertsData?.items || [];
  const cases = casesData?.items || [];
  const transactions = transactionsData?.items || [];
  const topAccounts = topAccountsData || [];

  // Filter alerts by time range
  const filteredAlerts = alerts.filter((alert) => {
    const alertDate = new Date(alert.createdAt);
    return alertDate >= startDate && alertDate <= endDate;
  });

  // Calculate KPIs
  const totalAlerts = filteredAlerts.length;
  
  // Resolution rate: resolved cases / total cases
  const resolvedCases = cases.filter((c) => {
    const status = typeof c.status === 'string' ? parseInt(c.status, 10) : c.status;
    return status === 2; // Closed/Resolved
  });
  const resolutionRate = cases.length > 0 
    ? ((resolvedCases.length / cases.length) * 100).toFixed(1)
    : "0.0";

  // Average resolution time (in days) - calculate from cases
  const resolvedCasesWithTime = resolvedCases.filter((c) => c.updatedAt);
  const avgResolutionTime = resolvedCasesWithTime.length > 0
    ? (resolvedCasesWithTime.reduce((sum, c) => {
        const created = new Date(c.createdAt);
        const updated = new Date(c.updatedAt!);
        const days = (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0) / resolvedCasesWithTime.length).toFixed(1)
    : "0.0";

  // High-risk accounts: accounts with multiple flagged transactions
  const highRiskAccountsCount = topAccounts.filter((acc) => acc.count >= 3).length;

  // Calculate monthly trends
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  const monthlyData = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthAlerts = filteredAlerts.filter((alert) => {
      const alertDate = new Date(alert.createdAt);
      return alertDate >= monthStart && alertDate <= monthEnd;
    });
    const monthResolved = monthAlerts.filter((alert) => {
      const caseForAlert = cases.find((c) => c.transactionId === alert.id);
      if (caseForAlert) {
        const status = typeof caseForAlert.status === 'string' 
          ? parseInt(caseForAlert.status, 10) 
          : caseForAlert.status;
        return status === 2; // Resolved
      }
      return false;
    });
    return {
      month: format(month, "MMM"),
      total: monthAlerts.length,
      resolved: monthResolved.length,
    };
  });

  // Calculate severity distribution
  const severityDistribution = {
    high: filteredAlerts.filter((a) => (a.riskScore || 0) >= 80).length,
    medium: filteredAlerts.filter((a) => (a.riskScore || 0) >= 50 && (a.riskScore || 0) < 80).length,
    low: filteredAlerts.filter((a) => (a.riskScore || 0) > 0 && (a.riskScore || 0) < 50).length,
  };
  const totalSeverity = severityDistribution.high + severityDistribution.medium + severityDistribution.low;
  const severityPercentages = {
    high: totalSeverity > 0 ? ((severityDistribution.high / totalSeverity) * 100).toFixed(0) : "0",
    medium: totalSeverity > 0 ? ((severityDistribution.medium / totalSeverity) * 100).toFixed(0) : "0",
    low: totalSeverity > 0 ? ((severityDistribution.low / totalSeverity) * 100).toFixed(0) : "0",
  };

  // Calculate pie chart paths
  const calculatePiePath = (percentage: number, startAngle: number) => {
    const radius = 80;
    const endAngle = startAngle + (percentage / 100) * 360;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = 100 + radius * Math.cos(startRad);
    const y1 = 100 + radius * Math.sin(startRad);
    const x2 = 100 + radius * Math.cos(endRad);
    const y2 = 100 + radius * Math.sin(endRad);
    const largeArc = percentage > 50 ? 1 : 0;
    return `M 100 100 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  const highStart = 0;
  const mediumStart = parseFloat(severityPercentages.high) * 3.6;
  const lowStart = mediumStart + parseFloat(severityPercentages.medium) * 3.6;

  const isLoading = alertsLoading || casesLoading || transactionsLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">View comprehensive fraud detection analytics and export reports.</p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-primary">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalAlerts.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {timeRange === "6m" ? "Last 6 months" : timeRange === "1y" ? "Last year" : "All time"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{resolutionRate}%</div>
                  <p className="text-xs text-success">
                    {resolvedCases.length} of {cases.length} cases resolved
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Resolution Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgResolutionTime} days</div>
                  <p className="text-xs text-muted-foreground">
                    Based on {resolvedCasesWithTime.length} resolved cases
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">High-Risk Accounts</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{highRiskAccountsCount}</div>
                  <p className="text-xs text-destructive">Requiring attention</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Fraud Summary Report</CardTitle>
                  <CardDescription>
                    Monthly alert trends over the {timeRange === "6m" ? "last 6 months" : timeRange === "1y" ? "last year" : "selected period"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    {monthlyData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        No data available
                      </div>
                    ) : (
                      <svg viewBox="0 0 800 300" className="h-full w-full">
                        {/* Y-axis labels */}
                        <text x="10" y="20" className="text-xs fill-muted-foreground">
                          {Math.max(...monthlyData.map((d) => d.total), 1)}
                        </text>
                        <text x="10" y="150" className="text-xs fill-muted-foreground">
                          {Math.max(...monthlyData.map((d) => d.total), 1) / 2}
                        </text>
                        <text x="10" y="280" className="text-xs fill-muted-foreground">0</text>
                        
                        {/* Month labels */}
                        {monthlyData.map((data, index) => {
                          const xPos = 40 + (index * (720 / monthlyData.length));
                          return (
                            <text
                              key={index}
                              x={xPos + 40}
                              y="290"
                              className="text-xs fill-muted-foreground"
                            >
                              {data.month}
                            </text>
                          );
                        })}
                        
                        {/* Bars */}
                        {monthlyData.map((data, index) => {
                          const xPos = 40 + (index * (720 / monthlyData.length));
                          const maxValue = Math.max(...monthlyData.map((d) => d.total), 1);
                          const barWidth = 60;
                          const totalHeight = (data.total / maxValue) * 240;
                          const resolvedHeight = data.total > 0 ? (data.resolved / data.total) * totalHeight : 0;
                          const totalY = 260 - totalHeight;
                          const resolvedY = 260 - resolvedHeight;
                          
                          return (
                            <g key={index}>
                              {/* Total alerts bar */}
                              <rect
                                x={xPos}
                                y={totalY}
                                width={barWidth}
                                height={totalHeight}
                                className="fill-destructive"
                              />
                              {/* Resolved alerts bar */}
                              {resolvedHeight > 0 && (
                                <rect
                                  x={xPos}
                                  y={resolvedY}
                                  width={barWidth}
                                  height={resolvedHeight}
                                  className="fill-success"
                                />
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm bg-destructive" />
                      <span>Total Alerts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm bg-success" />
                      <span>Resolved</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alert Severity Distribution</CardTitle>
                  <CardDescription>Breakdown by severity level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-[300px] items-center justify-center">
                    {totalSeverity === 0 ? (
                      <div className="text-muted-foreground">No alerts to display</div>
                    ) : (
                      <svg viewBox="0 0 200 200" className="h-48 w-48">
                        {/* Pie chart segments */}
                        {parseFloat(severityPercentages.high) > 0 && (
                          <path
                            d={calculatePiePath(parseFloat(severityPercentages.high), highStart)}
                            className="fill-destructive"
                          />
                        )}
                        {parseFloat(severityPercentages.medium) > 0 && (
                          <path
                            d={calculatePiePath(parseFloat(severityPercentages.medium), mediumStart)}
                            className="fill-yellow-500"
                          />
                        )}
                        {parseFloat(severityPercentages.low) > 0 && (
                          <path
                            d={calculatePiePath(parseFloat(severityPercentages.low), lowStart)}
                            className="fill-success opacity-70"
                          />
                        )}
                      </svg>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-destructive" />
                        <span>High Severity</span>
                      </div>
                      <span className="font-medium">
                        {severityPercentages.high}% ({severityDistribution.high})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-yellow-500" />
                        <span>Medium Severity</span>
                      </div>
                      <span className="font-medium">
                        {severityPercentages.medium}% ({severityDistribution.medium})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-success opacity-70" />
                        <span>Low Severity</span>
                      </div>
                      <span className="font-medium">
                        {severityPercentages.low}% ({severityDistribution.low})
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
