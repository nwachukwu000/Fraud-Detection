import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, Calendar, Filter, Loader2, Trash2 } from "lucide-react";
import { casesApi, Case, transactionsApi, Transaction } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { isAxiosError } from "axios";

export default function Cases() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [caseForm, setCaseForm] = useState({
    title: "",
    description: "",
    transactionId: "",
    investigatorId: "",
  });

  // Get current user role for permission checks
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        return JSON.parse(userStr) as { role?: string };
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const isAdmin = currentUser?.role === "Admin";

  const { data, isLoading, error } = useQuery({
    queryKey: ["cases"],
    queryFn: () => casesApi.getList({ page: 1, pageSize: 1000 }),
  });

  // Fetch transactions with risk score > 0 for case creation
  const { data: flaggedTransactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["flagged-transactions"],
    queryFn: () => transactionsApi.getList({ page: 1, pageSize: 1000, minRisk: 1 }),
  });

  // Get cases list
  const cases = data?.items || [];
  
  // Filter out transactions that already have cases
  const flaggedTransactions = (() => {
    try {
      const allFlaggedTransactions = flaggedTransactionsData?.items || [];
      return allFlaggedTransactions.filter((tx: Transaction) => {
        if (!tx || !tx.id) return false;
        const hasCase = cases.some((c: Case) => c && c.transactionId === tx.id);
        return !hasCase && (tx.riskScore || 0) > 0;
      });
    } catch (error) {
      console.error("Error filtering flagged transactions:", error);
      return [];
    }
  })();

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      casesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
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

  const createCaseMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      transactionId: string;
      investigatorId?: string;
    }) => casesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["flagged-transactions"] });
      setIsAddDialogOpen(false);
      setCaseForm({
        title: "",
        description: "",
        transactionId: "",
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

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseForm.title || !caseForm.transactionId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Check if transaction already has a case
    const existingCase = cases.find((c: Case) => c.transactionId === caseForm.transactionId);
    if (existingCase) {
      toast({
        title: "Error",
        description: "This transaction already has a case",
        variant: "destructive",
      });
      return;
    }

    createCaseMutation.mutate({
      title: caseForm.title,
      description: caseForm.description || undefined,
      transactionId: caseForm.transactionId,
      investigatorId: caseForm.investigatorId || undefined,
    });
  };

  // Filter cases by status: 0 = Open (New), 1 = UnderInvestigation, 2 = Closed (Resolved)
  const newCases = cases.filter(c => c && c.status === 0);
  const investigatingCases = cases.filter(c => c && c.status === 1);
  const resolvedCases = cases.filter(c => c && c.status === 2);

  const getStatusLabel = (status: number) => {
    const statusMap: Record<number, string> = {
      0: "New",
      1: "Investigating",
      2: "Resolved",
      3: "Confirmed",
      4: "Fraud",
      5: "False Positive",
    };
    return statusMap[status] || "Unknown";
  };

  const handleStatusUpdate = (caseId: string, newStatus: number) => {
    updateStatusMutation.mutate({ id: caseId, status: newStatus });
  };

  const deleteCaseMutation = useMutation({
    mutationFn: (id: string) => casesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast({
        title: "Success",
        description: "Case deleted successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to delete case";
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;
        if (status === 403) {
          message = "You don't have permission to delete cases. Admin role required.";
        } else if (status === 401) {
          message = "Please log in to delete cases.";
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

  const handleDeleteCase = (caseId: string, caseTitle: string) => {
    if (confirm(`Are you sure you want to delete the case "${caseTitle}"? This action cannot be undone.`)) {
      deleteCaseMutation.mutate(caseId);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Case Management</h1>
            <p className="text-muted-foreground">Investigate, resolve, and document fraud cases.</p>
          </div>
          <Button className="bg-primary" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search case ID or description..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all-assignees">
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-assignees">All Assignees</SelectItem>
                <SelectItem value="mg">MG</SelectItem>
                <SelectItem value="js">JS</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Date Range
            </Button>
            <Button variant="default" className="bg-primary">
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-destructive">
            Error loading cases: {error instanceof Error ? error.message : "Unknown error"}. Please try again.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">New ({newCases.length})</h3>
              </div>
              <div className="space-y-3">
                {newCases.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      No new cases
                    </CardContent>
                  </Card>
                ) : (
                  newCases.map((caseItem) => (
                    <Card key={caseItem.id} className="cursor-pointer transition-shadow hover:shadow-md">
                      <CardHeader className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{caseItem.id.substring(0, 8)}...</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">High</Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCase(caseItem.id, caseItem.title);
                                  }}
                                  disabled={deleteCaseMutation.isPending}
                                  title="Delete case"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{caseItem.title}</p>
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(caseItem.createdAt), "MMM dd, yyyy")}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusUpdate(caseItem.id, 1)}
                              disabled={updateStatusMutation.isPending}
                            >
                              Start Investigation
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </div>

            <div className="border-x border-yellow-200 px-3">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Investigating ({investigatingCases.length})</h3>
              </div>
              <div className="space-y-3">
                {investigatingCases.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      No cases under investigation
                    </CardContent>
                  </Card>
                ) : (
                  investigatingCases.map((caseItem) => (
                    <Card key={caseItem.id} className="cursor-pointer border-l-4 border-l-yellow-500 transition-shadow hover:shadow-md">
                      <CardHeader className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{caseItem.id.substring(0, 8)}...</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600">
                                Investigating
                              </Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCase(caseItem.id, caseItem.title);
                                  }}
                                  disabled={deleteCaseMutation.isPending}
                                  title="Delete case"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{caseItem.title}</p>
                          <div className="flex items-center justify-between pt-2">
                            {caseItem.investigatorId ? (
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                                  {caseItem.investigatorId.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(caseItem.id, 2)}
                                disabled={updateStatusMutation.isPending}
                              >
                                Resolve
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Resolved ({resolvedCases.length})</h3>
              </div>
              <div className="space-y-3">
                {resolvedCases.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      No resolved cases
                    </CardContent>
                  </Card>
                ) : (
                  resolvedCases.map((caseItem) => (
                    <Card key={caseItem.id} className="cursor-pointer transition-shadow hover:shadow-md">
                      <CardHeader className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{caseItem.id.substring(0, 8)}...</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-success text-white hover:bg-success">
                                Resolved
                              </Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCase(caseItem.id, caseItem.title);
                                  }}
                                  disabled={deleteCaseMutation.isPending}
                                  title="Delete case"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{caseItem.title}</p>
                          <div className="flex items-center justify-between pt-2">
                            {caseItem.investigatorId ? (
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                                  {caseItem.investigatorId.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {caseItem.updatedAt
                                ? format(new Date(caseItem.updatedAt), "MMM dd, yyyy")
                                : format(new Date(caseItem.createdAt), "MMM dd, yyyy")}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Select a case to view details
          </CardContent>
        </Card>

        {/* Add Case Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Case</DialogTitle>
              <DialogDescription>
                Create a new case for a flagged transaction. Only transactions with risk score above 0 can have cases.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCase}>
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
                <div className="space-y-2">
                  <Label htmlFor="transactionId">Transaction *</Label>
                  <Select
                    value={caseForm.transactionId || undefined}
                    onValueChange={(value) =>
                      setCaseForm({ ...caseForm, transactionId: value })
                    }
                    disabled={isLoadingTransactions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingTransactions ? "Loading transactions..." : "Select a flagged transaction"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingTransactions ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Loading transactions...
                        </div>
                      ) : flaggedTransactions.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No flagged transactions available
                        </div>
                      ) : (
                        flaggedTransactions.map((tx: Transaction) => {
                          if (!tx || !tx.id) return null;
                          return (
                            <SelectItem key={tx.id} value={tx.id}>
                              {tx.senderAccountNumber || 'N/A'} - ₦{(tx.amount || 0).toLocaleString()} (Risk: {tx.riskScore || 0})
                            </SelectItem>
                          );
                        }).filter(Boolean)
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {flaggedTransactions.length > 0 
                      ? `${flaggedTransactions.length} flagged transaction(s) available (excluding those with existing cases)`
                      : "Only transactions with risk score above 0 and without existing cases are shown"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investigatorId">Investigator ID (Optional)</Label>
                  <Input
                    id="investigatorId"
                    placeholder="Enter investigator ID"
                    value={caseForm.investigatorId}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, investigatorId: e.target.value })
                    }
                  />
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
                <Button type="submit" disabled={createCaseMutation.isPending || flaggedTransactions.length === 0}>
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
