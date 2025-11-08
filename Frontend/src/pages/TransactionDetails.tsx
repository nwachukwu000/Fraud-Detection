import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { transactionsApi, casesApi } from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function TransactionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ["transaction-details", id],
    queryFn: () => transactionsApi.getDetails(id!),
    enabled: !!id,
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
      </div>
    </AppLayout>
  );
}

