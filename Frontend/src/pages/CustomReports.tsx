import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, Loader2, FileText, X } from "lucide-react";
import { transactionsApi, alertsApi, casesApi } from "@/lib/api";
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface GeneratedReport {
  id: string;
  name: string;
  createdAt: Date;
  dateRange: string;
  filters: ReportFilters;
  data: any;
}

interface ReportFilters {
  dateRange: string;
  fraudType: string;
  riskLevel: string;
  userSegment: string;
}

export default function CustomReports() {
  const { toast } = useToast();
  const [reportName, setReportName] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [fraudType, setFraudType] = useState("all");
  const [riskLevel, setRiskLevel] = useState("all-risks");
  const [userSegment, setUserSegment] = useState("all-segments");
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    
    if (dateRange === "30") {
      startDate = subDays(now, 30);
    } else if (dateRange === "90") {
      startDate = subDays(now, 90);
    } else if (dateRange === "180") {
      startDate = subDays(now, 180);
    } else {
      startDate = subDays(now, 365);
    }
    
    return { startDate, endDate: now };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["custom-reports-transactions", dateRange],
    queryFn: async () => {
      return transactionsApi.getList({
        page: 1,
        pageSize: 10000,
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      });
    },
  });

  // Fetch alerts
  const { data: alertsData } = useQuery({
    queryKey: ["custom-reports-alerts", dateRange],
    queryFn: async () => {
      return alertsApi.getList({ page: 1, pageSize: 10000 });
    },
  });

  const transactions = transactionsData?.items || [];
  const alerts = alertsData?.items || [];

  // Filter transactions based on criteria
  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter((t) => {
      const tDate = new Date(t.createdAt);
      return tDate >= startDate && tDate <= endDate;
    });

    // Filter by risk level
    if (riskLevel !== "all-risks") {
      filtered = filtered.filter((t) => {
        const risk = t.riskScore || 0;
        if (riskLevel === "high") return risk >= 80;
        if (riskLevel === "medium") return risk >= 50 && risk < 80;
        if (riskLevel === "low") return risk > 0 && risk < 50;
        return true;
      });
    }

    // Filter by fraud type (based on transaction characteristics)
    if (fraudType !== "all") {
      filtered = filtered.filter((t) => {
        if (fraudType === "high-value") return (t.amount || 0) > 200000;
        if (fraudType === "multiple") {
          // Transactions from same account with multiple alerts
          const accountAlerts = alerts.filter((a) => a.senderAccountNumber === t.senderAccountNumber);
          return accountAlerts.length > 3;
        }
        if (fraudType === "device") return t.device === "NewDevice";
        return true;
      });
    }

    return filtered;
  }, [transactions, alerts, startDate, endDate, riskLevel, fraudType]);

  // Calculate monthly fraud volume
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthTransactions = filteredTransactions.filter((t) => {
        const tDate = new Date(t.createdAt);
        return tDate >= monthStart && tDate <= monthEnd && (t.riskScore || 0) > 0;
      });
      const totalAmount = monthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      return {
        month: format(month, "MMM"),
        amount: totalAmount,
        count: monthTransactions.length,
      };
    });
  }, [filteredTransactions, startDate, endDate]);

  const maxAmount = Math.max(...monthlyData.map((d) => d.amount), 1);

  const handleGenerateReport = () => {
    if (!reportName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a report name",
        variant: "destructive",
      });
      return;
    }

    const newReport: GeneratedReport = {
      id: Date.now().toString(),
      name: reportName,
      createdAt: new Date(),
      dateRange: dateRange,
      filters: {
        dateRange,
        fraudType,
        riskLevel,
        userSegment,
      },
      data: {
        totalTransactions: filteredTransactions.length,
        totalAmount: filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        highRiskCount: filteredTransactions.filter((t) => (t.riskScore || 0) >= 80).length,
        mediumRiskCount: filteredTransactions.filter((t) => (t.riskScore || 0) >= 50 && (t.riskScore || 0) < 80).length,
        lowRiskCount: filteredTransactions.filter((t) => (t.riskScore || 0) > 0 && (t.riskScore || 0) < 50).length,
      },
    };

    setGeneratedReports([newReport, ...generatedReports]);
    setReportName("");
    toast({
      title: "Success",
      description: "Report generated successfully",
    });
  };

  const handleExportCSV = (report?: GeneratedReport) => {
    const dataToExport = report ? filteredTransactions : filteredTransactions;
    const headers = ["Transaction ID", "Sender Account", "Receiver Account", "Amount", "Risk Score", "Date", "Device", "Location"];
    const rows = dataToExport.map((t) => [
      t.id,
      t.senderAccountNumber,
      t.receiverAccountNumber,
      t.amount.toString(),
      (t.riskScore || 0).toString(),
      format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss"),
      t.device || "N/A",
      t.location || "N/A",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = report ? `${report.name}_${format(new Date(), "yyyy-MM-dd")}.csv` : `custom_report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Report exported successfully",
    });
  };

  const handleDeleteReport = (id: string) => {
    setGeneratedReports(generatedReports.filter((r) => r.id !== id));
    toast({
      title: "Success",
      description: "Report deleted",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Custom Reports</h1>
            <p className="text-muted-foreground">Generate, view, and export custom reports</p>
          </div>
          <Button className="bg-primary" variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Report
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create a New Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  placeholder="e.g. Q4 High-Risk Transactions"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="180">Last 6 Months</SelectItem>
                    <SelectItem value="365">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fraud Type</Label>
                <Select value={fraudType} onValueChange={setFraudType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fraud Types</SelectItem>
                    <SelectItem value="high-value">High Value Transactions</SelectItem>
                    <SelectItem value="multiple">Multiple Transactions</SelectItem>
                    <SelectItem value="device">New Device Login</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Risk Level</Label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-risks">All Risk Levels</SelectItem>
                    <SelectItem value="high">High Risk Only</SelectItem>
                    <SelectItem value="medium">Medium Risk Only</SelectItem>
                    <SelectItem value="low">Low Risk Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>User Segment</Label>
                <Select value={userSegment} onValueChange={setUserSegment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-segments">All Segments</SelectItem>
                    <SelectItem value="vip">VIP Customers</SelectItem>
                    <SelectItem value="regular">Regular Customers</SelectItem>
                    <SelectItem value="new">New Customers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full bg-primary" onClick={handleGenerateReport} disabled={transactionsLoading}>
                {transactionsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Fraud Volume (₦)</CardTitle>
              <CardDescription>
                Total suspected fraud value over the selected period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex h-[400px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="h-[400px] w-full">
                  <svg viewBox="0 0 600 400" className="h-full w-full">
                    {monthlyData.map((data, index) => {
                      const xPos = 40 + (index * (520 / Math.max(monthlyData.length - 1, 1)));
                      const barHeight = maxAmount > 0 ? (data.amount / maxAmount) * 300 : 0;
                      const yPos = 360 - barHeight;
                      return (
                        <g key={index}>
                          <text
                            x={xPos + 30}
                            y={380}
                            className="text-xs fill-muted-foreground"
                          >
                            {data.month}
                          </text>
                          <rect
                            x={xPos}
                            y={yPos}
                            width="60"
                            height={barHeight}
                            className="fill-primary"
                            rx="4"
                          />
                          <text
                            x={xPos + 30}
                            y={yPos - 5}
                            className="text-xs fill-muted-foreground text-center"
                            textAnchor="middle"
                          >
                            {data.count > 0 ? data.count : ""}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Total: ₦{filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Reports</CardTitle>
                <CardDescription>
                  {filteredTransactions.length} transactions match your current filters
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => handleExportCSV()}>
                <Download className="mr-2 h-4 w-4" />
                Export Current View
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {generatedReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No reports generated yet. Create your first custom report above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {generatedReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-semibold">{report.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Created {format(report.createdAt, "MMM dd, yyyy HH:mm")} •{" "}
                            {report.data.totalTransactions} transactions • ₦
                            {report.data.totalAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportCSV(report)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReport(report.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
