import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, AlertTriangle, CheckCircle2, Clock, TrendingUp, Info, Loader2 } from "lucide-react";
import { transactionsApi, alertsApi, casesApi } from "@/lib/api";
import { format } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const [tab, setTab] = useState("all");

  // Fetch all transactions from transaction monitoring table for accurate totals
  // First, get total count without time filter to show actual total
  const { data: allTransactionsData } = useQuery({
    queryKey: ["dashboard-all-transactions"],
    queryFn: async () => {
      return transactionsApi.getList({ page: 1, pageSize: 10000 });
    },
  });

  // Fetch transactions with time range filter for display
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["dashboard-transactions", timeRange],
    queryFn: async () => {
      const params: any = {
        page: 1,
        pageSize: 10000, // Fetch all transactions for accurate totals
      };

      if (timeRange === "24h") {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        params.from = yesterday.toISOString();
      } else if (timeRange === "7d") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.from = weekAgo.toISOString();
      } else if (timeRange === "30d") {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        params.from = monthAgo.toISOString();
      }

      return transactionsApi.getList(params);
    },
  });

  // Fetch alerts for stats
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      return alertsApi.getList({ page: 1, pageSize: 1000 });
    },
  });

  // Fetch cases to check resolved status
  const { data: casesData } = useQuery({
    queryKey: ["cases"],
    queryFn: () => casesApi.getList({ page: 1, pageSize: 1000 }),
  });

  const allTransactions = transactionsData?.items || [];
  const allAlerts = alertsData?.items || []; // These are transactions with risk score > 0
  const cases = casesData?.items || [];
  
  // Calculate KPIs based on real data from transaction monitoring table
  // Use ALL transactions (without time filter) for total count and amount
  const allTransactionsForTotal = allTransactionsData?.items || [];
  const totalTransactionsCount = allTransactionsData?.total || 0;
  const totalAmount = allTransactionsForTotal.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  // For display, show only the first 10 transactions from the time-filtered results
  const transactions = allTransactions.slice(0, 10);
  
  // Flagged alerts: All transactions with risk score > 0 (which is what alerts API returns)
  const flaggedAlertsCount = allAlerts.length;
  
  // Resolved cases: Cases with status = Closed (2)
  const resolvedCases = cases.filter((c) => {
    const status = typeof c.status === 'string' 
      ? parseInt(c.status, 10) 
      : c.status;
    return status === 2; // Closed/Resolved
  });
  const resolvedCasesCount = resolvedCases.length;
  
  // Pending cases: Cases with status = Open (0) or UnderInvestigation (1)
  const pendingCases = cases.filter((c) => {
    const status = typeof c.status === 'string' 
      ? parseInt(c.status, 10) 
      : c.status;
    return status === 0 || status === 1; // Open or UnderInvestigation
  });
  const pendingCasesCount = pendingCases.length;
  
  // Total cases count
  const totalCasesCount = cases.length;

  // Filter transactions based on tab
  const filteredTransactions = transactions.filter((t) => {
    if (tab === "flagged") {
      // Flagged only: transactions with risk score > 0
      return (t.riskScore || 0) > 0;
    }
    if (tab === "resolved") {
      // Resolved: transactions with cases that have status = Closed (2)
      const caseForTransaction = cases.find(c => c.transactionId === t.id);
      if (caseForTransaction) {
        const status = typeof caseForTransaction.status === 'string' 
          ? parseInt(caseForTransaction.status, 10) 
          : caseForTransaction.status;
        return status === 2; // Closed/Resolved
      }
      return false;
    }
    return true;
  });

  const getSeverityLabel = (riskScore: number) => {
    if (riskScore >= 80) return "high";
    if (riskScore >= 50) return "medium";
    return "low";
  };
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">High-level summary of financial activities.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All Transactions</TabsTrigger>
              <TabsTrigger value="flagged">Flagged Only</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {transactionsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    totalAmount >= 1000000
                      ? `₦${(totalAmount / 1000000).toFixed(1)}M`
                      : totalAmount >= 1000
                      ? `₦${(totalAmount / 1000).toFixed(1)}K`
                      : `₦${totalAmount.toLocaleString()}`
                  )}
                </div>
                <p className="text-xs text-success">
                  <TrendingUp className="mr-1 inline h-3 w-3" />
                  {totalTransactionsCount} transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flagged Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {alertsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    flaggedAlertsCount
                  )}
                </div>
                <p className="text-xs text-destructive">
                  {totalTransactionsCount > 0
                    ? `${((flaggedAlertsCount / totalTransactionsCount) * 100).toFixed(1)}% of transactions`
                    : "No transactions"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved Cases</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {alertsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    resolvedCasesCount
                  )}
                </div>
                <p className="text-xs text-success">
                  {totalCasesCount > 0
                    ? `${((resolvedCasesCount / totalCasesCount) * 100).toFixed(1)}% of cases`
                    : flaggedAlertsCount > 0
                    ? `${((resolvedCasesCount / flaggedAlertsCount) * 100).toFixed(1)}% of flagged alerts`
                    : "No cases"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Cases</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {alertsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    pendingCasesCount
                  )}
                </div>
                <p className="text-xs text-yellow-600">
                  {totalCasesCount > 0
                    ? `${((pendingCasesCount / totalCasesCount) * 100).toFixed(1)}% of cases`
                    : flaggedAlertsCount > 0
                    ? `${((pendingCasesCount / flaggedAlertsCount) * 100).toFixed(1)}% of flagged alerts`
                    : "No cases"}
                </p>
              </CardContent>
            </Card>
          </div>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => {
                        const severity = getSeverityLabel(transaction.riskScore || 0);
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">
                              {transaction.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>{transaction.senderAccountNumber}</TableCell>
                            <TableCell>₦{transaction.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              {format(new Date(transaction.createdAt), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  severity === "high"
                                    ? "destructive"
                                    : severity === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  severity === "medium"
                                    ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                    : ""
                                }
                              >
                                {severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="link" 
                                size="sm"
                                className="text-primary"
                                onClick={() => navigate(`/transactions/${transaction.id}`)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flagged" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Flagged Transactions (Risk Score &gt; 0)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No flagged transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => {
                        const severity = getSeverityLabel(transaction.riskScore || 0);
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">
                              {transaction.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>{transaction.senderAccountNumber}</TableCell>
                            <TableCell>₦{transaction.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              {format(new Date(transaction.createdAt), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{transaction.riskScore || 0}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  severity === "high"
                                    ? "destructive"
                                    : severity === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  severity === "medium"
                                    ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                    : ""
                                }
                              >
                                {severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="link" 
                                size="sm"
                                className="text-primary"
                                onClick={() => navigate(`/transactions/${transaction.id}`)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolved" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resolved Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No resolved transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => {
                        const severity = getSeverityLabel(transaction.riskScore || 0);
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">
                              {transaction.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>{transaction.senderAccountNumber}</TableCell>
                            <TableCell>₦{transaction.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              {format(new Date(transaction.createdAt), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{transaction.riskScore || 0}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  severity === "high"
                                    ? "destructive"
                                    : severity === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  severity === "medium"
                                    ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                    : ""
                                }
                              >
                                {severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="link" 
                                size="sm"
                                className="text-primary"
                                onClick={() => navigate(`/transactions/${transaction.id}`)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
