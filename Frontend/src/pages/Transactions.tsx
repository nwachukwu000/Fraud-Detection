import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Download, Plus, Loader2 } from "lucide-react";
import { transactionsApi } from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";

export default function Transactions() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all-scores");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    senderAccountNumber: "",
    receiverAccountNumber: "",
    transactionType: "Transfer",
    amount: "",
    location: "",
    device: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions", page, pageSize, statusFilter, riskFilter, searchQuery],
    queryFn: async () => {
      const params: any = {
        page,
        pageSize,
      };

      if (statusFilter === "flagged") {
        // Note: Backend doesn't have a direct "flagged" status filter, 
        // but we can filter by status or use isFlagged
        // For now, we'll fetch all and filter client-side if needed
      }

      if (riskFilter !== "all-scores") {
        if (riskFilter === "high") {
          params.minRisk = 80;
        } else if (riskFilter === "medium") {
          params.minRisk = 50;
        }
      }

      if (searchQuery) {
        params.account = searchQuery;
      }

      return transactionsApi.getList(params);
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data: {
      senderAccountNumber: string;
      receiverAccountNumber: string;
      transactionType: string;
      amount: number;
      location?: string;
      device?: string;
    }) => transactionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setIsAddDialogOpen(false);
      setTransactionForm({
        senderAccountNumber: "",
        receiverAccountNumber: "",
        transactionType: "Transfer",
        amount: "",
        location: "",
        device: "",
      });
      toast({
        title: "Success",
        description: "Transaction created successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to create transaction";
      if (isAxiosError(error)) {
        const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;
        if (backendMessage) {
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

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transactionForm.senderAccountNumber ||
      !transactionForm.receiverAccountNumber ||
      !transactionForm.amount
    ) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    const amount = parseFloat(transactionForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    createTransactionMutation.mutate({
      senderAccountNumber: transactionForm.senderAccountNumber,
      receiverAccountNumber: transactionForm.receiverAccountNumber,
      transactionType: transactionForm.transactionType,
      amount,
      location: transactionForm.location || undefined,
      device: transactionForm.device || undefined,
    });
  };

  const transactions = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transaction Monitoring</h1>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Account, Transaction ID..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status: All</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-scores">All Scores</SelectItem>
                    <SelectItem value="high">High (80+)</SelectItem>
                    <SelectItem value="medium">Medium (50-79)</SelectItem>
                    <SelectItem value="low">Low (&lt;50)</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="bg-primary">
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-8 text-center text-destructive">
                Error loading transactions. Please try again.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DATE</TableHead>
                      <TableHead>AMOUNT (₦)</TableHead>
                      <TableHead>ACCOUNT</TableHead>
                      <TableHead>RISK SCORE</TableHead>
                      <TableHead>STATUS</TableHead>
                      <TableHead>ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions
                        .filter((t) => {
                          if (statusFilter === "flagged") return t.isFlagged;
                          if (statusFilter === "normal") return !t.isFlagged;
                          return true;
                        })
                        .filter((t) => {
                          if (riskFilter === "low") return t.riskScore < 50;
                          return true;
                        })
                        .map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {format(new Date(transaction.createdAt), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>₦{transaction.amount.toLocaleString()}</TableCell>
                            <TableCell>{transaction.senderAccountNumber}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
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
                                variant={transaction.isFlagged ? "destructive" : "secondary"}
                              >
                                {transaction.isFlagged ? "Flagged" : "Normal"}
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
                        ))
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

        {/* Add Transaction Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Transaction</DialogTitle>
              <DialogDescription>
                Create a new transaction. The system will automatically calculate the risk score.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddTransaction}>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="senderAccount">Sender Account Number *</Label>
                    <Input
                      id="senderAccount"
                      placeholder="1234567890"
                      value={transactionForm.senderAccountNumber}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, senderAccountNumber: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receiverAccount">Receiver Account Number *</Label>
                    <Input
                      id="receiverAccount"
                      placeholder="0987654321"
                      value={transactionForm.receiverAccountNumber}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, receiverAccountNumber: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="transactionType">Transaction Type *</Label>
                    <Select
                      value={transactionForm.transactionType}
                      onValueChange={(value) =>
                        setTransactionForm({ ...transactionForm, transactionType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transfer">Transfer</SelectItem>
                        <SelectItem value="Withdrawal">Withdrawal</SelectItem>
                        <SelectItem value="Deposit">Deposit</SelectItem>
                        <SelectItem value="Payment">Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₦) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="1000000"
                      value={transactionForm.amount}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, amount: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="Lagos, Nigeria"
                      value={transactionForm.location}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, location: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="device">Device</Label>
                    <Input
                      id="device"
                      placeholder="Mobile, Desktop, etc."
                      value={transactionForm.device}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, device: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTransactionMutation.isPending}>
                  {createTransactionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Transaction"
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
