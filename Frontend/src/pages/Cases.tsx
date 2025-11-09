import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Plus, Calendar as CalendarIcon, Filter, Loader2, Trash2, MessageSquare, History, Send, X, Check, ChevronsUpDown } from "lucide-react";
import { casesApi, Case, transactionsApi, Transaction, commentsApi, auditLogsApi, Comment, usersApi, User } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { isAxiosError } from "axios";
import { DateRange } from "react-day-picker";

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
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isCaseDetailsOpen, setIsCaseDetailsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [transactionSearchOpen, setTransactionSearchOpen] = useState(false);
  const [transactionSearchValue, setTransactionSearchValue] = useState("");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all-assignees");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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

  // Fetch users for assignee filter
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getList({ page: 1, pageSize: 1000 }),
  });

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

  // Fetch transactions with risk score > 0 for case creation
  const { data: flaggedTransactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["flagged-transactions"],
    queryFn: () => transactionsApi.getList({ page: 1, pageSize: 1000, minRisk: 1 }),
  });

  // Get cases list
  const allCases = data?.items || [];
  const users = usersData?.items || [];

  // Get assignees - show all analysts/investigators, plus any users assigned to cases
  const assignees = useMemo(() => {
    // Get all analysts and investigators from users
    const analystUsers = users.filter((u: User) => 
      u.role === "Analyst" || u.role === "Investigator"
    );
    
    // Get all unique investigator IDs from cases
    const assignedInvestigatorIds = new Set(
      allCases
        .map((c: Case) => c.investigatorId)
        .filter((id): id is string => !!id)
    );
    
    // Get users who are assigned to cases but might not be analysts/investigators
    const assignedUsers = users.filter((u: User) => 
      assignedInvestigatorIds.has(u.id)
    );
    
    // Combine and deduplicate
    const allAssignees = [...analystUsers, ...assignedUsers];
    const uniqueAssignees = Array.from(
      new Map(allAssignees.map((u: User) => [u.id, u])).values()
    );
    
    // Map to assignee format
    return uniqueAssignees.map((user: User) => ({
      id: user.id,
      name: user.fullName || user.email || user.id.substring(0, 8),
    }));
  }, [users, allCases]);

  // Apply filters to cases
  const cases = useMemo(() => {
    let filtered = [...allCases];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c: Case) => {
        const idMatch = c.id.toLowerCase().includes(query);
        const titleMatch = c.title?.toLowerCase().includes(query);
        const descMatch = c.description?.toLowerCase().includes(query);
        return idMatch || titleMatch || descMatch;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      const statusMap: Record<string, number> = {
        "new": 0,
        "investigating": 1,
        "resolved": 2,
      };
      const statusValue = statusMap[statusFilter];
      if (statusValue !== undefined) {
        filtered = filtered.filter((c: Case) => c.status === statusValue);
      }
    }

    // Assignee filter
    if (assigneeFilter !== "all-assignees") {
      filtered = filtered.filter((c: Case) => {
        // Handle null/undefined and ensure string comparison (case-insensitive for GUIDs)
        if (!c.investigatorId) return false;
        const caseInvestigatorId = c.investigatorId.toString().trim().toLowerCase();
        const filterValue = assigneeFilter.toString().trim().toLowerCase();
        return caseInvestigatorId === filterValue;
      });
    }

    // Date range filter
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter((c: Case) => {
        const caseDate = new Date(c.createdAt);
        return caseDate >= dateRange.from! && caseDate <= dateRange.to!;
      });
    } else if (dateRange?.from) {
      filtered = filtered.filter((c: Case) => {
        const caseDate = new Date(c.createdAt);
        return caseDate >= dateRange.from!;
      });
    }

    return filtered;
  }, [allCases, searchQuery, statusFilter, assigneeFilter, dateRange]);
  
  // Filter out transactions that already have cases
  const flaggedTransactions = (() => {
    try {
      const allFlaggedTransactions = flaggedTransactionsData?.items || [];
      return allFlaggedTransactions.filter((tx: Transaction) => {
        if (!tx || !tx.id) return false;
        const hasCase = allCases.some((c: Case) => c && c.transactionId === tx.id);
        return !hasCase && (tx.riskScore || 0) > 0;
      });
    } catch (error) {
      console.error("Error filtering flagged transactions:", error);
      return [];
    }
  })();

  // Handle apply filters
  const handleApplyFilters = () => {
    // Filters are already applied via useMemo, this is just for UI feedback
    toast({
      title: "Filters Applied",
      description: "Case list has been filtered based on your criteria.",
    });
  };

  // Filter transactions for autocomplete
  const filteredTransactionsForAutocomplete = useMemo(() => {
    if (!transactionSearchValue.trim()) {
      return flaggedTransactions;
    }
    const searchLower = transactionSearchValue.toLowerCase().trim();
    return flaggedTransactions.filter((tx: Transaction) => {
      if (!tx || !tx.id) return false;
      return (
        tx.id.toLowerCase().includes(searchLower) ||
        tx.senderAccountNumber?.toLowerCase().includes(searchLower) ||
        tx.receiverAccountNumber?.toLowerCase().includes(searchLower)
      );
    });
  }, [flaggedTransactions, transactionSearchValue]);

  // Get selected transaction display value
  const selectedTransactionDisplay = useMemo(() => {
    if (!caseForm.transactionId) return "";
    const tx = flaggedTransactions.find((t: Transaction) => t.id === caseForm.transactionId);
    if (!tx) return caseForm.transactionId; // Fallback to ID if not found
    return `${tx.senderAccountNumber || 'N/A'} - ₦${(tx.amount || 0).toLocaleString()} (Risk: ${tx.riskScore || 0})`;
  }, [caseForm.transactionId, flaggedTransactions]);

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setAssigneeFilter("all-assignees");
    setDateRange(undefined);
    toast({
      title: "Filters Cleared",
      description: "All filters have been reset.",
    });
  };

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
      queryClient.invalidateQueries({ queryKey: ["users"] }); // Refresh users to update assignee filter
      queryClient.invalidateQueries({ queryKey: ["analysts"] }); // Refresh analysts list
      setIsAddDialogOpen(false);
      setCaseForm({
        title: "",
        description: "",
        transactionId: "",
        investigatorId: "",
      });
      setTransactionSearchValue("");
      setTransactionSearchOpen(false);
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
      investigatorId: caseForm.investigatorId && caseForm.investigatorId.trim() !== "" 
        ? caseForm.investigatorId 
        : undefined,
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

  const handleCaseClick = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setIsCaseDetailsOpen(true);
  };

  // Fetch comments for selected case
  const { data: caseComments, refetch: refetchCaseComments } = useQuery({
    queryKey: ["case-comments", selectedCase?.id],
    queryFn: () => commentsApi.getByCase(selectedCase!.id),
    enabled: !!selectedCase?.id && isCaseDetailsOpen,
  });

  // Fetch audit logs for selected case
  const { data: caseAuditLogsData } = useQuery({
    queryKey: ["case-audit-logs", selectedCase?.id],
    queryFn: () => auditLogsApi.getByEntity("Case", selectedCase!.id, { page: 1, pageSize: 50 }),
    enabled: !!selectedCase?.id && isCaseDetailsOpen,
  });

  const createCaseCommentMutation = useMutation({
    mutationFn: (data: { content: string; isInternal: boolean }) =>
      commentsApi.createForCase(selectedCase!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-comments", selectedCase?.id] });
      setCommentText("");
      setIsInternal(false);
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  const deleteCaseCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-comments", selectedCase?.id] });
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    },
  });

  const handleAddCaseComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedCase) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }
    createCaseCommentMutation.mutate({ content: commentText, isInternal });
  };

  const caseCommentsList = caseComments || [];
  const caseAuditLogs = caseAuditLogsData?.items || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Case Management</h1>
            <p className="text-muted-foreground">Investigate, resolve, and document fraud cases.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search case ID or description..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-assignees">All Assignees</SelectItem>
                {assignees.map((assignee) => (
                  <SelectItem key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Date Range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    // Close popover when both dates are selected
                    if (range?.from && range?.to) {
                      setIsDatePickerOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                />
                {dateRange && (
                  <div className="flex items-center justify-end gap-2 p-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateRange(undefined);
                        setIsDatePickerOpen(false);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Button 
              variant="default" 
              className="bg-primary"
              onClick={handleApplyFilters}
            >
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
            {(searchQuery || statusFilter !== "all" || assigneeFilter !== "all-assignees" || dateRange) && (
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                title="Clear all filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
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
                    <Card key={caseItem.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => handleCaseClick(caseItem)}>
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
                    <Card key={caseItem.id} className="cursor-pointer border-l-4 border-l-yellow-500 transition-shadow hover:shadow-md" onClick={() => handleCaseClick(caseItem)}>
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
                    <Card key={caseItem.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => handleCaseClick(caseItem)}>
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

        {/* Case Details Dialog */}
        <Dialog open={isCaseDetailsOpen} onOpenChange={setIsCaseDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedCase && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedCase.title}</DialogTitle>
                  <DialogDescription>
                    Case ID: {selectedCase.id.substring(0, 8)}... • Created: {format(new Date(selectedCase.createdAt), "MMM dd, yyyy HH:mm")}
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="details" className="w-full">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="comments">
                      Comments ({caseCommentsList.length})
                    </TabsTrigger>
                    <TabsTrigger value="audit">Audit Log ({caseAuditLogs.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold">Description</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedCase.description || "No description provided"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold">Status</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            <Badge variant="outline">{getStatusLabel(selectedCase.status)}</Badge>
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-semibold">Transaction ID</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedCase.transactionId.substring(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="comments" className="space-y-4">
                    <form onSubmit={handleAddCaseComment} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="case-comment">Add Comment</Label>
                        <Textarea
                          id="case-comment"
                          placeholder="Enter your comment or note..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="case-internal"
                            checked={isInternal}
                            onCheckedChange={setIsInternal}
                          />
                          <Label htmlFor="case-internal" className="text-sm">
                            Internal Note
                          </Label>
                        </div>
                        <Button
                          type="submit"
                          disabled={createCaseCommentMutation.isPending || !commentText.trim()}
                        >
                          {createCaseCommentMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Add Comment
                            </>
                          )}
                        </Button>
                      </div>
                    </form>

                    <div className="space-y-4">
                      {caseCommentsList.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No comments yet. Be the first to add a comment.</p>
                        </div>
                      ) : (
                        caseCommentsList.map((comment) => (
                          <div
                            key={comment.id}
                            className={`p-4 rounded-lg border ${
                              comment.isInternal
                                ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                                : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm">
                                    {comment.createdByName}
                                  </span>
                                  {comment.isInternal && (
                                    <Badge variant="outline" className="text-xs">
                                      Internal
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(comment.createdAt), "MMM dd, yyyy HH:mm")}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                              </div>
                              {(currentUser?.role === "Admin" || currentUser?.role === "Analyst") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this comment?")) {
                                      deleteCaseCommentMutation.mutate(comment.id);
                                    }
                                  }}
                                  disabled={deleteCaseCommentMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="audit" className="space-y-4">
                    {caseAuditLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No audit logs available for this case.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {caseAuditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-4 p-4 rounded-lg border bg-gray-50 dark:bg-gray-900"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm">{log.action}</span>
                                <span className="text-xs text-muted-foreground">
                                  by {log.userName}
                                </span>
                              </div>
                              {log.details && (
                                <p className="text-sm text-muted-foreground mb-1">
                                  {log.details}
                                </p>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Case Dialog */}
        <Dialog 
          open={isAddDialogOpen} 
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              // Reset form and search state when dialog closes
              setCaseForm({
                title: "",
                description: "",
                transactionId: "",
                investigatorId: "",
              });
              setTransactionSearchValue("");
              setTransactionSearchOpen(false);
            }
          }}
        >
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
                  <Popover open={transactionSearchOpen} onOpenChange={setTransactionSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={transactionSearchOpen}
                        className="w-full justify-between"
                        disabled={isLoadingTransactions}
                      >
                        {caseForm.transactionId ? (
                          <span className="truncate">{selectedTransactionDisplay}</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {isLoadingTransactions ? "Loading transactions..." : "Enter or select a transaction ID"}
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search by transaction ID, sender, or receiver account..."
                          value={transactionSearchValue}
                          onValueChange={setTransactionSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingTransactions ? (
                              <div className="py-6 text-center text-sm">Loading transactions...</div>
                            ) : transactionSearchValue.trim() ? (
                              <div className="py-6 text-center">
                                <div className="text-sm mb-2">No transactions found matching "{transactionSearchValue}"</div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCaseForm({ ...caseForm, transactionId: transactionSearchValue.trim() });
                                    setTransactionSearchValue("");
                                    setTransactionSearchOpen(false);
                                  }}
                                >
                                  Use "{transactionSearchValue.substring(0, 20)}{transactionSearchValue.length > 20 ? '...' : ''}" as Transaction ID
                                </Button>
                              </div>
                            ) : null}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredTransactionsForAutocomplete.map((tx: Transaction) => {
                              if (!tx || !tx.id) return null;
                              const displayText = `${tx.senderAccountNumber || 'N/A'} - ₦${(tx.amount || 0).toLocaleString()} (Risk: ${tx.riskScore || 0})`;
                              return (
                                <CommandItem
                                  key={tx.id}
                                  value={tx.id}
                                  onSelect={() => {
                                    setCaseForm({ ...caseForm, transactionId: tx.id });
                                    setTransactionSearchValue("");
                                    setTransactionSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      caseForm.transactionId === tx.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{tx.id.substring(0, 8)}...</span>
                                    <span className="text-xs text-muted-foreground">{displayText}</span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {caseForm.transactionId && !flaggedTransactions.find((t: Transaction) => t.id === caseForm.transactionId) && (
                    <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2">
                      <p className="text-xs text-yellow-800">
                        Transaction ID entered manually. Make sure it exists and has a risk score above 0.
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {flaggedTransactions.length > 0 
                      ? `Type to search or select from ${flaggedTransactions.length} flagged transaction(s) (excluding those with existing cases)`
                      : "Only transactions with risk score above 0 and without existing cases are shown"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="investigatorId">Analyst (Optional)</Label>
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
