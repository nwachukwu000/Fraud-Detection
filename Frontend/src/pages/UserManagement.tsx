import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, Edit2, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { usersApi, User } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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
import { Label } from "@/components/ui/label";
import { isAxiosError } from "axios";

export default function UserManagement() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState({ email: "", fullName: "", role: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [editForm, setEditForm] = useState({ email: "", fullName: "", role: "" });
  const [newRole, setNewRole] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user role
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        return JSON.parse(userStr) as User;
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const isAdmin = currentUser?.role === "Admin";

  // Fetch users with role filter
  const { data, isLoading, error } = useQuery({
    queryKey: ["users", page, pageSize, roleFilter],
    queryFn: () => usersApi.getList({ page, pageSize, role: roleFilter || undefined }),
    retry: false,
  });

  // Fetch available roles
  const { data: availableRoles = [] } = useQuery({
    queryKey: ["user-roles"],
    queryFn: () => usersApi.getRoles(),
  });

  // Fetch all users for role statistics
  const { data: allUsersData } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => usersApi.getList({ page: 1, pageSize: 10000 }),
  });

  const allUsers = allUsersData?.items || [];
  const users = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Calculate user counts per role
  const roleCounts = availableRoles.reduce((acc, role) => {
    acc[role] = allUsers.filter((u) => u.role === role).length;
    return acc;
  }, {} as Record<string, number>);

  // Role descriptions
  const roleDescriptions: Record<string, string> = {
    Admin: "Full system access, user management, and configuration settings.",
    Analyst: "Monitor transactions, manage cases, view dashboards and reports.",
    Investigator: "Investigate cases, manage alerts, and create reports.",
    Viewer: "View-only access to dashboards. Cannot modify data or cases.",
  };

  const roleColors: Record<string, string> = {
    Admin: "bg-purple-100 text-purple-700 border-purple-200",
    Analyst: "bg-blue-100 text-blue-700 border-blue-200",
    Investigator: "bg-green-100 text-green-700 border-green-200",
    Viewer: "bg-gray-100 text-gray-700 border-gray-200",
  };

  // Filter users by search query
  const filteredUsers = searchQuery
    ? users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: { email: string; fullName: string; role: string; password: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setIsCreateDialogOpen(false);
      setCreateForm({ email: "", fullName: "", role: "", password: "" });
      setShowPassword(false);
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: unknown) => {
      let message = "Failed to create user";
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

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { email?: string; fullName?: string; role?: string } }) => {
      // Update user details
      const user = await usersApi.update(id, { email: data.email, fullName: data.fullName });
      // If role changed, update it separately
      if (data.role && data.role !== selectedUser?.role) {
        await usersApi.changeRole(id, data.role);
      }
      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      setEditForm({ email: "", fullName: "", role: "" });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      usersApi.changeRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
      setNewRole("");
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({ email: user.email, fullName: user.fullName, role: user.role });
    setIsEditDialogOpen(true);
  };

  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleDialogOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email || !createForm.fullName || !createForm.role || !createForm.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    if (createForm.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(createForm);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!editForm.email || !editForm.fullName || !editForm.role) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ id: selectedUser.id, data: editForm });
  };

  const handleRoleChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newRole) return;
    changeRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage users and their roles in the system.</p>
          </div>
          {isAdmin && (
            <Button className="bg-primary" onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Create New User
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={roleFilter || "all"} onValueChange={(value) => setRoleFilter(value === "all" ? null : value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {availableRoles.map((role) => (
            <Card key={role} className={`border-2 ${roleColors[role]?.split(' ').pop() || 'border-gray-200'}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${roleColors[role] || 'bg-gray-100 text-gray-700'}`}>
                    {role}
                  </span>
                </CardTitle>
                <CardDescription className="text-foreground">
                  {roleDescriptions[role] || "No description available"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roleCounts[role] || 0}</div>
                <p className="text-xs text-muted-foreground">users</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users ({data?.total || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-8 text-center">
                <div className="text-destructive font-semibold mb-2">
                  Error loading users
                </div>
                <div className="text-sm text-muted-foreground">
                  {isAxiosError(error) && error.response?.status === 403
                    ? "You don't have permission to view users. Admin access required."
                    : isAxiosError(error) && error.response?.status === 401
                    ? "Please log in to view users."
                    : isAxiosError(error) && error.response?.data
                    ? (error.response.data as { message?: string })?.message || "An error occurred"
                    : "Please try again or contact support if the issue persists."}
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No users found
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                        {user.fullName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{user.fullName}</h4>
                        <Badge
                          variant="secondary"
                          className={
                            user.role.toLowerCase() === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : user.role.toLowerCase() === "analyst"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }
                        >
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                        title="Edit user"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleChangeRole(user)}
                        title="Change role"
                      >
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}

        {/* Create User Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. They will be able to access the platform based on their assigned role.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password (min. 6 characters)"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters long
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(value) => setCreateForm({ ...createForm, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User & Access Level</DialogTitle>
              <DialogDescription>
                Update user information and access level. Changes will be saved immediately.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="user@example.com"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-fullName">Full Name</Label>
                  <Input
                    id="edit-fullName"
                    placeholder="John Doe"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Access Level (Role)</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select access level" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editForm.role && roleDescriptions[editForm.role] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {roleDescriptions[editForm.role]}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Changing the role will update the user's access permissions immediately.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditForm({ email: "", fullName: "", role: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Change Role Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update the role for {selectedUser?.fullName}. This will change their access permissions.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRoleChangeSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-role">Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newRole && roleDescriptions[newRole] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {roleDescriptions[newRole]}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRoleDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={changeRoleMutation.isPending}>
                  {changeRoleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Role"
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
