import axios from 'axios';

// Base API URL - adjust port if needed
// Use HTTP for local development to avoid certificate issues
// If backend redirects to HTTPS, use HTTPS directly: 'https://localhost:51173/api'
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:51174/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // For development with self-signed certificates - handled by browser
});

// Request interceptor for adding auth token if needed
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're already on the auth page (login/register failures)
      const isAuthEndpoint = error.config?.url?.includes('/auths/');
      if (!isAuthEndpoint) {
        // Handle unauthorized - clear token and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface Transaction {
  id: string;
  senderAccountNumber: string;
  receiverAccountNumber: string;
  transactionType: string;
  isFlagged: boolean;
  status: string;
  location?: string;
  device?: string;
  ipAddress?: string;
  email?: string;
  createdAt: string;
  amount: number;
  riskScore: number;
}

export interface TriggeredRule {
  ruleName: string;
  description: string;
}

export interface CustomerInfo {
  name: string;
  accountNumber: string;
  customerSince: string;
  avgTransactionValue: number;
}

export interface TransactionDetails extends Transaction {
  triggeredRules: TriggeredRule[];
  senderInfo?: CustomerInfo;
  receiverInfo?: CustomerInfo;
}

export interface TransactionListResponse {
  total: number;
  items: Transaction[];
}

// Alerts endpoint now returns transactions with risk score > 0
export interface AlertListResponse {
  total: number;
  items: Transaction[];
}

export interface TopAccount {
  accountNumber: string;
  count: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export interface UserListResponse {
  total: number;
  items: User[];
}

export interface Rule {
  id: string;
  name: string;
  field: string;
  condition: string;
  value: string;
  isEnabled: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  text: string;
  message?: string; // For backward compatibility
  type?: string;
  markedAsRead: boolean;
  createdAt: string;
}

// API Functions

// Transactions
export const transactionsApi = {
  getList: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    account?: string;
    type?: string;
    from?: string;
    to?: string;
    minRisk?: number;
  }): Promise<TransactionListResponse> => {
    const response = await api.get<TransactionListResponse>('/transactions', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const response = await api.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },

  getDetails: async (id: string): Promise<TransactionDetails> => {
    const response = await api.get<TransactionDetails>(`/transactions/${id}/details`);
    return response.data;
  },

  getByAccount: async (accountNumber: string): Promise<Transaction[]> => {
    const response = await api.get<Transaction[]>(`/transactions/account/${accountNumber}`);
    return response.data;
  },

  create: async (data: {
    senderAccountNumber: string;
    receiverAccountNumber: string;
    transactionType: string;
    amount: number;
    location?: string;
    device?: string;
    ipAddress?: string;
    email?: string;
  }): Promise<Transaction> => {
    const response = await api.post<Transaction>('/transactions', data);
    return response.data;
  },

  flag: async (id: string, isFlagged: boolean = true): Promise<void> => {
    await api.put(`/transactions/${id}/flag`, null, { params: { isFlagged } });
  },

  resendEmail: async (id: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(`/transactions/${id}/resend-email`);
    return response.data;
  },
};

// Alerts - returns transactions with risk score > 0
export const alertsApi = {
  getList: async (params?: {
    page?: number;
    pageSize?: number;
    month?: number;
    severity?: number;
    status?: number;
    ruleName?: string;
  }): Promise<AlertListResponse> => {
    const response = await api.get<AlertListResponse>('/alerts', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const response = await api.get<Transaction>(`/alerts/${id}`);
    return response.data;
  },

  resolve: async (id: string): Promise<void> => {
    // Resolve by unflagging the transaction
    await transactionsApi.flag(id, false);
  },

  getTopAccounts: async (topN: number = 10): Promise<TopAccount[]> => {
    const response = await api.get<TopAccount[]>('/alerts/top-accounts', { params: { topN } });
    return response.data;
  },
};

// Users
export const usersApi = {
  getList: async (params?: {
    page?: number;
    pageSize?: number;
    role?: string;
  }): Promise<UserListResponse> => {
    const response = await api.get<UserListResponse>('/users', { params });
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    fullName: string;
    role: string;
    password: string;
  }): Promise<User> => {
    const response = await api.post<User>('/users', data);
    return response.data;
  },

  update: async (id: string, data: {
    email?: string;
    fullName?: string;
  }): Promise<User> => {
    const response = await api.put<User>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  getRoles: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/users/roles');
    return response.data;
  },

  changeRole: async (userId: string, role: string): Promise<User> => {
    const response = await api.put<User>(`/users/${userId}/roles`, { role });
    return response.data;
  },
};

// Rules
export const rulesApi = {
  getList: async (): Promise<Rule[]> => {
    const response = await api.get<Rule[]>('/rules');
    return response.data;
  },

  getById: async (id: string): Promise<Rule> => {
    const response = await api.get<Rule>(`/rules/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    field: string;
    condition: string;
    value: string;
    isEnabled?: boolean;
  }): Promise<Rule> => {
    const response = await api.post<Rule>('/rules', data);
    return response.data;
  },

  update: async (id: string, data: {
    name: string;
    field: string;
    condition: string;
    value: string;
    isEnabled?: boolean;
  }): Promise<Rule> => {
    const response = await api.put<Rule>(`/rules/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/rules/${id}`);
  },

  toggle: async (id: string): Promise<{ isEnabled: boolean }> => {
    const response = await api.put<{ isEnabled: boolean }>(`/rules/${id}/toggle`);
    return response.data;
  },
};

// Comments
export interface Comment {
  id: string;
  content: string;
  transactionId?: string;
  caseId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  isInternal: boolean;
}

export const commentsApi = {
  getByTransaction: async (transactionId: string): Promise<Comment[]> => {
    const response = await api.get<Comment[]>(`/comments/transaction/${transactionId}`);
    return response.data;
  },

  getByCase: async (caseId: string): Promise<Comment[]> => {
    const response = await api.get<Comment[]>(`/comments/case/${caseId}`);
    return response.data;
  },

  createForTransaction: async (transactionId: string, data: {
    content: string;
    isInternal?: boolean;
  }): Promise<Comment> => {
    const response = await api.post<Comment>(`/comments/transaction/${transactionId}`, data);
    return response.data;
  },

  createForCase: async (caseId: string, data: {
    content: string;
    isInternal?: boolean;
  }): Promise<Comment> => {
    const response = await api.post<Comment>(`/comments/case/${caseId}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/comments/${id}`);
  },
};

// Audit Logs
export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  userName: string;
  details?: string;
  createdAt: string;
}

export interface AuditLogListResponse {
  total: number;
  items: AuditLog[];
}

export const auditLogsApi = {
  getList: async (params?: {
    page?: number;
    pageSize?: number;
    entityType?: string;
    entityId?: string;
  }): Promise<AuditLogListResponse> => {
    const response = await api.get<AuditLogListResponse>('/auditlogs', { params });
    return response.data;
  },

  getByEntity: async (entityType: string, entityId: string, params?: {
    page?: number;
    pageSize?: number;
  }): Promise<AuditLogListResponse> => {
    const response = await api.get<AuditLogListResponse>(`/auditlogs/entity/${entityType}/${entityId}`, { params });
    return response.data;
  },
};

// Auth
export const authApi = {
  login: async (email: string, password: string): Promise<{ token: string; user: User }> => {
    const response = await api.post<{ token: string; user: User }>('/auths/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string, fullName: string): Promise<{ token: string; user: User }> => {
    const response = await api.post<{ token: string; user: User }>('/auths/register', { email, password, fullName });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auths/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (email: string, token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auths/reset-password', { email, token, newPassword });
    return response.data;
  },
};

// Notifications
export const notificationsApi = {
  getList: async (params?: {
    isRead?: boolean;
    isUnread?: boolean;
  }): Promise<Notification[]> => {
    const response = await api.get<Notification[]>('/inappnotifications', { params });
    return response.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await api.put(`/inappnotifications/${id}/mark-read`);
  },

  markAsUnread: async (id: string): Promise<void> => {
    await api.put(`/inappnotifications/${id}/mark-unread`);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/inappnotifications/${id}`);
  },

  deleteMultiple: async (ids: string[]): Promise<void> => {
    await api.delete('/inappnotifications', { data: { ids } });
  },
};

// Cases
export interface Case {
  id: string;
  title: string;
  description?: string;
  transactionId: string;
  investigatorId?: string;
  status: number; // 0: Open, 1: UnderInvestigation, 2: Closed, etc.
  createdAt: string;
  updatedAt?: string;
}

export interface CaseListResponse {
  total: number;
  items: Case[];
}

export const casesApi = {
  getList: async (params?: {
    page?: number;
    pageSize?: number;
    status?: number;
  }): Promise<CaseListResponse> => {
    const response = await api.get<CaseListResponse>('/cases', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Case> => {
    const response = await api.get<Case>(`/cases/${id}`);
    return response.data;
  },

  create: async (data: {
    title: string;
    description?: string;
    transactionId: string;
    investigatorId?: string;
  }): Promise<Case> => {
    const response = await api.post<Case>('/cases', data);
    return response.data;
  },

  update: async (id: string, data: {
    title?: string;
    description?: string;
    investigatorId?: string;
    status?: number;
  }): Promise<Case> => {
    const response = await api.put<Case>(`/cases/${id}`, data);
    return response.data;
  },

  updateStatus: async (id: string, status: number): Promise<Case> => {
    const response = await api.put<Case>(`/cases/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/cases/${id}`);
  },
};

export default api;

