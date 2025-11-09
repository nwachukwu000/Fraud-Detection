import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, AlertTriangle, Loader2, MessageSquare, History, Trash2, Send } from "lucide-react";
import { transactionsApi, casesApi, commentsApi, auditLogsApi, Comment } from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

export default function TransactionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ["transaction-details", id],
    queryFn: () => transactionsApi.getDetails(id!),
    enabled: !!id,
  });

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ["transaction-comments", id],
    queryFn: () => commentsApi.getByTransaction(id!),
    enabled: !!id,
  });

  const { data: auditLogsData } = useQuery({
    queryKey: ["transaction-audit-logs", id],
    queryFn: () => auditLogsApi.getByEntity("Transaction", id!, { page: 1, pageSize: 50 }),
    enabled: !!id,
  });

  const currentUser = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch {
      return null;
    }
    return null;
  }, []);

  const createCommentMutation = useMutation({
    mutationFn: (data: { content: string; isInternal: boolean }) =>
      commentsApi.createForTransaction(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-comments", id] });
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

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-comments", id] });
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

  const handleCreateCase = async () => {
    if (!transaction) return;
    
    try {
      await casesApi.create({
        title: `Case for Transaction ${transaction.id.substring(0, 8)}`,
        description: `Case created from transaction details page`,
        transactionId: transaction.id,
      });
      toast({
        title: "Success",
        description: "Case created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create case",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }
    createCommentMutation.mutate({ content: commentText, isInternal });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !transaction) {
    return (
      <AppLayout>
        <div className="p-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/transactions")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transactions
          </Button>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Transaction not found</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-600";
    if (score >= 50) return "text-yellow-600";
    return "text-green-600";
  };

  const getRiskLabel = (score: number) => {
    if (score >= 80) return "High risk of fraudulent activity detected.";
    if (score >= 50) return "Medium risk transaction.";
    return "Low risk transaction.";
  };

  const formatAccountNumber = (account: string) => {
    if (account.length > 10) {
      return `ACC-${account.substring(account.length - 5)}`;
    }
    return account;
  };

  const auditLogs = auditLogsData?.items || [];
  const transactionComments = comments || [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/transactions")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Transaction Details</h1>
              <p className="text-sm text-muted-foreground">
                TXN-{transaction.id.substring(0, 6).toUpperCase()}
              </p>
            </div>
          </div>
          <Button onClick={handleCreateCase} className="gap-2">
            <FileText className="h-4 w-4" />
            Create Case
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">
              Comments ({transactionComments.length})
            </TabsTrigger>
            <TabsTrigger value="audit">Audit Log ({auditLogs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Transaction Overview Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Amount</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">
                          {formatCurrency(transaction.amount)}
                        </span>
                        {transaction.isFlagged && (
                          <Badge variant="destructive" className="ml-2">
                            flagged
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          From Account
                        </p>
                        <p className="font-medium">
                          {transaction.senderInfo?.name || "Unknown"} (
                          {formatAccountNumber(transaction.senderAccountNumber)})
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          To Account
                        </p>
                        <p className="font-medium">
                          {transaction.receiverInfo?.name || "Unknown"} (
                          {transaction.receiverAccountNumber})
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Transaction Date
                        </p>
                        <p className="font-medium">
                          {format(new Date(transaction.createdAt), "yyyy-MM-dd HH:mm")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Transaction Type
                        </p>
                        <p className="font-medium">{transaction.transactionType}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Triggered Rules Card */}
                {transaction.triggeredRules.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Triggered Rules</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {transaction.triggeredRules.map((rule, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900"
                        >
                          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-sm mb-1">
                              {rule.ruleName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {rule.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Risk Score Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="relative w-32 h-32 mb-4">
                        <svg className="transform -rotate-90 w-32 h-32">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-gray-200 dark:text-gray-800"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${(transaction.riskScore / 100) * 351.86} 351.86`}
                            className={getRiskColor(transaction.riskScore)}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className={`text-3xl font-bold ${getRiskColor(transaction.riskScore)}`}
                          >
                            {transaction.riskScore}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-center text-muted-foreground">
                        {getRiskLabel(transaction.riskScore)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Info Card */}
                {transaction.senderInfo && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Customer Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Name</p>
                        <p className="font-medium">{transaction.senderInfo.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Customer Since
                        </p>
                        <p className="font-medium">
                          {format(
                            new Date(transaction.senderInfo.customerSince),
                            "MMM dd, yyyy"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Avg. Txn Value
                        </p>
                        <p className="font-medium">
                          {formatCurrency(transaction.senderInfo.avgTransactionValue)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Device & Location Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Device & Location</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Device</p>
                      <p className="font-medium">
                        {transaction.device || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        IP Address
                      </p>
                      <p className="font-medium">
                        {transaction.ipAddress || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Location</p>
                      <p className="font-medium">
                        {transaction.location
                          ? transaction.location
                              .split("-")
                              .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
                              .join(", ")
                          : "Unknown"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments & Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="comment">Add Comment</Label>
                    <Textarea
                      id="comment"
                      placeholder="Enter your comment or note..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="internal"
                        checked={isInternal}
                        onCheckedChange={setIsInternal}
                      />
                      <Label htmlFor="internal" className="text-sm">
                        Internal Note (only visible to team)
                      </Label>
                    </div>
                    <Button
                      type="submit"
                      disabled={createCommentMutation.isPending || !commentText.trim()}
                    >
                      {createCommentMutation.isPending ? (
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

                {/* Comments List */}
                <div className="space-y-4">
                  {transactionComments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No comments yet. Be the first to add a comment.</p>
                    </div>
                  ) : (
                    transactionComments.map((comment) => (
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
                                  deleteCommentMutation.mutate(comment.id);
                                }
                              }}
                              disabled={deleteCommentMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No audit logs available for this transaction.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
