import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Download, Loader2 } from "lucide-react";
import { alertsApi, casesApi, Transaction, Case, usersApi, User } from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Alerts() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateCaseDialogOpen, setIsCreateCaseDialogOpen] = useState(false);
  const [selectedTransactionForCase, setSelectedTransactionForCase] = useState<Transaction | null>(null);
  const [caseForm, setCaseForm] = useState({
    title: "",
    description: "",
    investigatorId: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch: refetchAlerts } = useQuery({
    queryKey: ["alerts", page, pageSize, statusFilter, severityFilter],
    queryFn: async () => {
      const params: any = {
        page,
        pageSize,
      };

      if (statusFilter) {
        const statusMap: Record<string, number> = {
          pending: 0,
          "under review": 1,
          escalated: 2,
          resolved: 3,
        };
        params.status = statusMap[statusFilter.toLowerCase()];
      }

      if (severityFilter !== null) {
        params.severity = severityFilter;
      }

      return alertsApi.getList(params);
    },
  });

  // Fetch cases to get case status for transactions
  const { data: casesData, refetch: refetchCases } = useQuery({
    queryKey: ["cases"],
    queryFn: () => casesApi.getList({ page: 1, pageSize: 1000 }),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const cases = casesData?.items || [];

  // Fetch analysts/investigators for case assignment
  const { data: analystsData } = useQuery({
    queryKey: ["analysts"],
    queryFn: async () => {
      // Fetch both Analyst and Investigator roles
      const [analysts, investigators] = await Promise.all([
        usersApi.getList({ page: 1, pageSize: 1000, role: "Analyst" }),
        usersApi.getList({ page: 1, pageSize: 1000, role: "Investigator" }).catch(() => ({ items: [] })),
      ]);
      // Combine and deduplicate
      const allAnalysts = [...analysts.items, ...investigators.items];
      const uniqueAnalysts = Array.from(
        new Map(allAnalysts.map((u: User) => [u.id, u])).values()
      );
      return { items: uniqueAnalysts };
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      // Fetch all cases to find the one for this transaction
      const allCases = await casesApi.getList({ page: 1, pageSize: 1000 });
      const caseForTransaction = allCases.items.find(c => c.transactionId === transactionId);
      
      if (caseForTransaction) {
        // Update case status to Closed (resolved) - status 2
        await casesApi.updateStatus(caseForTransaction.id, 2);
      } else {
        // Just unflag the transaction if no case exists
        await alertsApi.resolve(transactionId);
      }
    },
    onSuccess: async () => {
      // Invalidate and immediately refetch both queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["cases"], refetchType: "active" }),
      ]);
      
      // Also explicitly refetch to ensure data is updated
      await Promise.all([
        refetchAlerts(),
        refetchCases(),
      ]);
      
      toast({
        title: "Success",
        description: "Alert resolved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      transactionId: string;
      investigatorId?: string;
    }) => {
      return casesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setIsCreateCaseDialogOpen(false);
      setSelectedTransactionForCase(null);
      setCaseForm({
        title: "",
        description: "",
        investigatorId: "",
      });
      toast({
        title: "Success",
        description: "Case created successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to create case";
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;
        if (status === 403) {
          message = "You don't have permission to create cases. Admin, Analyst, or Investigator role required.";
        } else if (status === 401) {
          message = "Please log in to create cases.";
        } else if (backendMessage) {
          message = backendMessage;
        }
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateCaseDialog = (transaction: Transaction) => {
    setSelectedTransactionForCase(transaction);
    setCaseForm({
      title: `Case for Transaction ${transaction.id.substring(0, 8)}`,
      description: "",
      investigatorId: "",
    });
    setIsCreateCaseDialogOpen(true);
  };

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransactionForCase || !caseForm.title) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createCaseMutation.mutate({
      title: caseForm.title,
      description: caseForm.description || undefined,
      transactionId: selectedTransactionForCase.id,
      investigatorId: caseForm.investigatorId || undefined,
    });
  };

  const updateCaseStatusMutation = useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: number }) => {
      return casesApi.updateStatus(caseId, status);
    },
    onSuccess: async () => {
      // Invalidate and refetch both queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alerts"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["cases"], refetchType: "active" }),
      ]);
      
      await Promise.all([
        refetchAlerts(),
        refetchCases(),
      ]);
      
      toast({
        title: "Success",
        description: "Case status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update case status",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (transactionId: string, newStatus: number) => {
    // Find the case for this transaction from cached cases
    const caseForTransaction = cases.find(c => c.transactionId === transactionId);
    
    if (caseForTransaction) {
      updateCaseStatusMutation.mutate({ caseId: caseForTransaction.id, status: newStatus });
    } else {
      toast({
        title: "Error",
        description: "No case found for this transaction",
        variant: "destructive",
      });
    }
  };

  const transactions = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Filter transactions by search query
  const filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.id.toLowerCase().includes(query) ||
      tx.senderAccountNumber.toLowerCase().includes(query) ||
      tx.receiverAccountNumber.toLowerCase().includes(query) ||
      (tx.device?.toLowerCase().includes(query) ?? false) ||
      (tx.location?.toLowerCase().includes(query) ?? false)
    );
  });

  // Map risk score to severity
  const getSeverityFromRiskScore = (riskScore: number): { label: string; num: number } => {
    if (riskScore >= 80) return { label: "High", num: 2 };
    if (riskScore >= 50) return { label: "Medium", num: 1 };
    return { label: "Low", num: 0 };
  };

  // Get status from case or transaction flag
  const getStatusFromTransaction = (transaction: Transaction): { label: string; num: number } => {
    const caseForTransaction = cases.find(c => c.transactionId === transaction.id);
    
    if (caseForTransaction) {
      // Use case status - map CaseStatus enum to display
      // 0 = Open (Pending), 1 = UnderInvestigation (Under Review), 2 = Closed (Resolved)
      // CaseStatus enum: Open=0, UnderInvestigation=1, Closed=2, Confirmed=3, Fraud=4, FalsePositive=5
      // Convert status to number if it's a string
      let statusNum: number;
      if (typeof caseForTransaction.status === 'string') {
        // Handle string enum values
        const statusStr = caseForTransaction.status.toLowerCase();
        if (statusStr === 'open') statusNum = 0;
        else if (statusStr === 'underinvestigation') statusNum = 1;
        else if (statusStr === 'closed') statusNum = 2;
        else statusNum = parseInt(caseForTransaction.status, 10) || 0;
      } else {
        statusNum = caseForTransaction.status;
      }
      
      if (statusNum === 0) return { label: "Pending", num: 0 };
      if (statusNum === 1) return { label: "Under Review", num: 1 };
      if (statusNum === 2) return { label: "Resolved", num: 3 };
      // Handle other statuses
      return { label: "Pending", num: 0 };
    }
    
    // Fallback: If no case exists, show Pending for transactions with risk score > 0
    // (since all transactions in alerts have risk score > 0)
    return { label: "Pending", num: 0 };
  };

  const handleExportCSV = async () => {
    try {
      // Fetch all alerts matching current filters (not just current page)
      const exportParams: any = {
        page: 1,
        pageSize: 10000, // Get all matching records
      };

      if (statusFilter) {
        const statusMap: Record<string, number> = {
          pending: 0,
          "under review": 1,
          escalated: 2,
          resolved: 3,
        };
        exportParams.status = statusMap[statusFilter.toLowerCase()];
      }

      if (severityFilter !== null) {
        exportParams.severity = severityFilter;
      }

      const exportData = await alertsApi.getList(exportParams);
      let exportTransactions = exportData.items || [];

      // Apply search filter if any
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        exportTransactions = exportTransactions.filter((tx) =>
          tx.id.toLowerCase().includes(query) ||
          tx.senderAccountNumber.toLowerCase().includes(query) ||
          tx.receiverAccountNumber.toLowerCase().includes(query) ||
          (tx.device?.toLowerCase().includes(query) ?? false) ||
          (tx.location?.toLowerCase().includes(query) ?? false)
        );
      }

      // Prepare CSV data
      const headers = [
        "Transaction ID",
        "Sender Account",
        "Receiver Account",
        "Transaction Type",
        "Amount",
        "Risk Score",
        "Severity",
        "Status",
        "Device",
        "Location",
        "IP Address",
        "Date",
        "Case ID",
      ];

      const rows = exportTransactions.map((tx) => {
        const severity = getSeverityFromRiskScore(tx.riskScore || 0);
        const status = getStatusFromTransaction(tx);
        const caseForTransaction = cases.find((c) => c.transactionId === tx.id);
        
        return [
          tx.id,
          tx.senderAccountNumber,
          tx.receiverAccountNumber,
          tx.transactionType,
          (tx.amount || 0).toString(),
          (tx.riskScore || 0).toString(),
          severity.label,
          status.label,
          tx.device || "N/A",
          tx.location || "N/A",
          tx.ipAddress || "N/A",
          format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm:ss"),
          caseForTransaction?.id || "N/A",
        ];
      });

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
      const filename = `alerts_export_${timestamp}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${exportTransactions.length} alerts to ${filename}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export alerts. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alerts & Cases</h1>
          </div>
          <Button variant="outline" onClick={handleExportCSV} disabled={isLoading}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Transaction ID or Account..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Button
                    variant={statusFilter === null ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStatusFilter(null)}
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === "pending" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStatusFilter("pending")}
                  >
                    Pending
                  </Button>
                  <Button
                    variant={statusFilter === "under review" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStatusFilter("under review")}
                  >
                    Under Review
                  </Button>
                  <Button
                    variant={statusFilter === "resolved" ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setStatusFilter("resolved")}
                  >
                    Resolved
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Severity:</span>
                  <Button
                    variant={severityFilter === null ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setSeverityFilter(null)}
                  >
                    All
                  </Button>
                  <Button
                    variant={severityFilter === 2 ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setSeverityFilter(2)}
                  >
                    High
                  </Button>
                  <Button
                    variant={severityFilter === 1 ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setSeverityFilter(1)}
                  >
                    Medium
                  </Button>
                  <Button
                    variant={severityFilter === 0 ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setSeverityFilter(0)}
                  >
                    Low
                  </Button>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold">All Alerts ({total})</h3>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-8 text-center text-destructive">
                Error loading alerts. Please try again.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Create Case</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No alerts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions
                        .filter((tx) => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            tx.id.toLowerCase().includes(query) ||
                            tx.senderAccountNumber.toLowerCase().includes(query) ||
                            tx.receiverAccountNumber.toLowerCase().includes(query) ||
                            (tx.device?.toLowerCase().includes(query) ?? false) ||
                            (tx.location?.toLowerCase().includes(query) ?? false)
                          );
                        })
                        .map((transaction) => {
                          const severity = getSeverityFromRiskScore(transaction.riskScore);
                          const status = getStatusFromTransaction(transaction);

                          return (
                            <TableRow key={transaction.id}>
                              <TableCell className="font-medium">
                                {transaction.id.substring(0, 8)}...
                              </TableCell>
                              <TableCell>{transaction.senderAccountNumber}</TableCell>
                              <TableCell>₦{transaction.amount.toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full ${
                                        transaction.riskScore >= 80
                                          ? "bg-destructive"
                                          : transaction.riskScore >= 50
                                          ? "bg-yellow-500"
                                          : "bg-success"
                                      }`}
                                      style={{ width: `${Math.min(transaction.riskScore, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium">{transaction.riskScore}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={severity.num === 2 ? "destructive" : "secondary"}
                                  className={
                                    severity.num === 1
                                      ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                      : ""
                                  }
                                >
                                  {severity.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {status.label ? (
                                  <Badge
                                    variant={
                                      status.num === 0
                                        ? "destructive"
                                        : status.num === 3
                                        ? "secondary"
                                        : "default"
                                    }
                                    className={
                                      status.num === 1
                                        ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                        : status.num === 3
                                        ? "bg-green-500 text-white hover:bg-green-600"
                                        : ""
                                    }
                                    style={
                                      status.num === 3
                                        ? { backgroundColor: "#22c55e", color: "white" }
                                        : undefined
                                    }
                                  >
                                    {status.label}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {format(new Date(transaction.createdAt), "MMM dd, yyyy HH:mm")}
                              </TableCell>
                              <TableCell>
                                {!cases.find(c => c.transactionId === transaction.id) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-primary"
                                    onClick={() => handleOpenCreateCaseDialog(transaction)}
                                    disabled={createCaseMutation.isPending}
                                  >
                                    {createCaseMutation.isPending ? (
                                      <>
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        Creating...
                                      </>
                                    ) : (
                                      "Create Case"
                                    )}
                                  </Button>
                                ) : (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                                    Case Exists
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2 items-center">
                                  {cases.find(c => c.transactionId === transaction.id) ? (
                                    <Select
                                      value={status.num === 0 ? "0" : status.num === 1 ? "1" : status.num === 3 ? "2" : "0"}
                                      onValueChange={(value) => {
                                        const newStatus = parseInt(value, 10);
                                        handleStatusChange(transaction.id, newStatus);
                                      }}
                                      disabled={updateCaseStatusMutation.isPending}
                                    >
                                      <SelectTrigger className="w-[140px] h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="0">Pending</SelectItem>
                                        <SelectItem value="1">Under Review</SelectItem>
                                        <SelectItem value="2">Resolved</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : null}
                                  <Button 
                                    variant="link" 
                                    size="sm" 
                                    className="text-primary"
                                    onClick={() => navigate(`/transactions/${transaction.id}`)}
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant="outline"
                        size="sm"
                        className={page === pageNum ? "bg-primary text-primary-foreground" : ""}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Case Dialog */}
        <Dialog open={isCreateCaseDialogOpen} onOpenChange={setIsCreateCaseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Case</DialogTitle>
              <DialogDescription>
                Create a new case for this flagged transaction. Only transactions with risk score above 0 can have cases.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCaseSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="caseTitle">Case Title *</Label>
                  <Input
                    id="caseTitle"
                    placeholder="e.g., Suspicious Large Transfer"
                    value={caseForm.title}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caseDescription">Description</Label>
                  <Textarea
                    id="caseDescription"
                    placeholder="Provide additional details about this case..."
                    value={caseForm.description}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, description: e.target.value })
                    }
                    rows={4}
                  />
                </div>
                {selectedTransactionForCase && (
                  <div className="space-y-2">
                    <Label>Transaction Details</Label>
                    <div className="rounded-lg border p-3 bg-muted/50">
                      <p className="text-sm">
                        <span className="font-medium">Account:</span> {selectedTransactionForCase.senderAccountNumber}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Amount:</span> ₦{selectedTransactionForCase.amount.toLocaleString()}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Risk Score:</span> {selectedTransactionForCase.riskScore}
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="investigatorId">Assign analyst</Label>
                  <Select
                    value={caseForm.investigatorId || undefined}
                    onValueChange={(value) =>
                      setCaseForm({ ...caseForm, investigatorId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an analyst to assign this case to (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {analystsData?.items && analystsData.items.length > 0 ? (
                        analystsData.items.map((analyst: User) => (
                          <SelectItem key={analyst.id} value={analyst.id}>
                            {analyst.fullName} ({analyst.email})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No analysts available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select an analyst to assign this case to. Leave unassigned to assign later.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateCaseDialogOpen(false);
                    setSelectedTransactionForCase(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createCaseMutation.isPending || !selectedTransactionForCase}>
                  {createCaseMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Case"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
