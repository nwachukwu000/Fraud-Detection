import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { rulesApi, Rule } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { isAxiosError } from "axios";

export default function RulesEngine() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    field: "",
    condition: "",
    value: "",
    isEnabled: true,
  });

  const { data: rules, isLoading, error } = useQuery({
    queryKey: ["rules"],
    queryFn: () => rulesApi.getList(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => rulesApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      toast({
        title: "Success",
        description: "Rule status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rule",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      toast({
        title: "Success",
        description: "Rule deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      deleteMutation.mutate(id);
    }
  };

  const createRuleMutation = useMutation({
    mutationFn: (data: {
      name: string;
      field: string;
      condition: string;
      value: string;
      isEnabled?: boolean;
    }) => rulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      setIsAddDialogOpen(false);
      setRuleForm({
        name: "",
        field: "",
        condition: "",
        value: "",
        isEnabled: true,
      });
      toast({
        title: "Success",
        description: "Rule created successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to create rule";
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;
        if (status === 403) {
          message = "You don't have permission to create rules. Admin role required.";
        } else if (status === 401) {
          message = "Please log in to create rules.";
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

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; field: string; condition: string; value: string; isEnabled?: boolean } }) =>
      rulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      setIsEditDialogOpen(false);
      setEditingRule(null);
      setRuleForm({
        name: "",
        field: "",
        condition: "",
        value: "",
        isEnabled: true,
      });
      toast({
        title: "Success",
        description: "Rule updated successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to update rule";
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const backendMessage = (error.response?.data as { message?: string } | undefined)?.message;
        if (status === 403) {
          message = "You don't have permission to update rules. Admin role required.";
        } else if (status === 401) {
          message = "Please log in to update rules.";
        } else if (status === 404) {
          message = "Rule not found.";
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

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name || !ruleForm.field || !ruleForm.condition || !ruleForm.value) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createRuleMutation.mutate(ruleForm);
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      field: rule.field,
      condition: rule.condition,
      value: rule.value,
      isEnabled: rule.isEnabled,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (!ruleForm.name || !ruleForm.field || !ruleForm.condition || !ruleForm.value) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    updateRuleMutation.mutate({
      id: editingRule.id,
      data: ruleForm,
    });
  };

  const rulesList = rules || [];
  const activeRules = rulesList.filter((r) => r.isEnabled).length;
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fraud Detection Rules</h1>
            <p className="text-muted-foreground">Configure fraud detection rules to automatically flag suspicious activities.</p>
          </div>
          <Button className="bg-primary" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Rule
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Active Rules ({activeRules}/{rulesList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-8 text-center text-destructive">
                Error loading rules. Please try again.
              </div>
            ) : rulesList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No rules found. Create your first rule to get started.
              </div>
            ) : (
              rulesList.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{rule.name}</h4>
                      <Badge variant="default" className="bg-primary">
                        {rule.isEnabled ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rule.field} {rule.condition} {rule.value}
                    </p>
                    <p className="text-xs text-muted-foreground">Rule ID: {rule.id.substring(0, 8)}...</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {rule.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <Switch
                        checked={rule.isEnabled}
                        onCheckedChange={() => handleToggle(rule.id)}
                        disabled={toggleMutation.isPending}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(rule)}
                        title="Edit rule"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(rule.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete rule"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Add New Rule Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Rule</DialogTitle>
              <DialogDescription>
                Create a new fraud detection rule. Rules are automatically applied to all transactions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRule}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ruleName">Rule Name *</Label>
                  <Input
                    id="ruleName"
                    placeholder="e.g., High Value Transaction"
                    value={ruleForm.name}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ruleField">Field *</Label>
                    <Select
                      value={ruleForm.field}
                      onValueChange={(value) =>
                        setRuleForm({ ...ruleForm, field: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Amount">Amount</SelectItem>
                        <SelectItem value="Device">Device</SelectItem>
                        <SelectItem value="Location">Location</SelectItem>
                        <SelectItem value="TransactionType">Transaction Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ruleCondition">Condition *</Label>
                    <Select
                      value={ruleForm.condition}
                      onValueChange={(value) =>
                        setRuleForm({ ...ruleForm, condition: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GreaterThan">Greater Than</SelectItem>
                        <SelectItem value="LessThan">Less Than</SelectItem>
                        <SelectItem value="Equals">Equals</SelectItem>
                        <SelectItem value="NotEquals">Not Equals</SelectItem>
                        <SelectItem value="Contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ruleValue">Value *</Label>
                  <Input
                    id="ruleValue"
                    placeholder="e.g., 1000000 or NewDevice"
                    value={ruleForm.value}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, value: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the value to compare against (e.g., amount threshold or device name)
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="ruleEnabled">Enable Rule</Label>
                    <p className="text-sm text-muted-foreground">
                      Rules are automatically applied when enabled
                    </p>
                  </div>
                  <Switch
                    id="ruleEnabled"
                    checked={ruleForm.isEnabled}
                    onCheckedChange={(checked) =>
                      setRuleForm({ ...ruleForm, isEnabled: checked })
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
                <Button type="submit" disabled={createRuleMutation.isPending}>
                  {createRuleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Rule"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Rule Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Rule</DialogTitle>
              <DialogDescription>
                Update the fraud detection rule. Changes will be applied to all future transactions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateRule}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editRuleName">Rule Name *</Label>
                  <Input
                    id="editRuleName"
                    placeholder="e.g., High Value Transaction"
                    value={ruleForm.name}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="editRuleField">Field *</Label>
                    <Select
                      value={ruleForm.field}
                      onValueChange={(value) =>
                        setRuleForm({ ...ruleForm, field: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Amount">Amount</SelectItem>
                        <SelectItem value="Device">Device</SelectItem>
                        <SelectItem value="Location">Location</SelectItem>
                        <SelectItem value="TransactionType">Transaction Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editRuleCondition">Condition *</Label>
                    <Select
                      value={ruleForm.condition}
                      onValueChange={(value) =>
                        setRuleForm({ ...ruleForm, condition: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GreaterThan">Greater Than</SelectItem>
                        <SelectItem value="LessThan">Less Than</SelectItem>
                        <SelectItem value="Equals">Equals</SelectItem>
                        <SelectItem value="NotEquals">Not Equals</SelectItem>
                        <SelectItem value="Contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editRuleValue">Value *</Label>
                  <Input
                    id="editRuleValue"
                    placeholder="e.g., 1000000 or NewDevice"
                    value={ruleForm.value}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, value: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the value to compare against (e.g., amount threshold or device name)
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="editRuleEnabled">Enable Rule</Label>
                    <p className="text-sm text-muted-foreground">
                      Rules are automatically applied when enabled
                    </p>
                  </div>
                  <Switch
                    id="editRuleEnabled"
                    checked={ruleForm.isEnabled}
                    onCheckedChange={(checked) =>
                      setRuleForm({ ...ruleForm, isEnabled: checked })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingRule(null);
                    setRuleForm({
                      name: "",
                      field: "",
                      condition: "",
                      value: "",
                      isEnabled: true,
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRuleMutation.isPending}>
                  {updateRuleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Rule"
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
