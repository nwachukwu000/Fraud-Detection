export const mockTransactions = [
  {
    id: "TXN-987123",
    user: "Eleanor Pena",
    amount: 2450000,
    account: "ACC-0012345",
    date: "2023-10-27 14:30",
    riskScore: 92,
    status: "flagged",
    severity: "high"
  },
  {
    id: "TXN-987121",
    user: "Jenny Wilson",
    amount: 890750,
    account: "ACC-0023456",
    date: "2023-10-27 14:29",
    riskScore: 65,
    status: "flagged",
    severity: "medium"
  },
  {
    id: "TXN-987120",
    user: "Guy Hawkins",
    amount: 5120000,
    account: "ACC-0034567",
    date: "2023-10-27 14:29",
    riskScore: 88,
    status: "flagged",
    severity: "high"
  },
  {
    id: "TXN-987118",
    user: "Jacob Jones",
    amount: 450000,
    account: "ACC-0045678",
    date: "2023-10-27 14:27",
    riskScore: 58,
    status: "normal",
    severity: "medium"
  },
  {
    id: "TXN-987117",
    user: "Esther Howard",
    amount: 15500.5,
    account: "ACC-0056789",
    date: "2023-10-27 14:30",
    riskScore: 22,
    status: "normal",
    severity: "low"
  }
];

export const mockAlerts = [
  {
    id: "ALT-001",
    transactionId: "TXN-987123",
    customer: "Eleanor Pena",
    severity: "high",
    status: "pending",
    createdAt: "2023-10-27 14:30",
    reason: "Amount exceeds ₦2,000,000 threshold"
  },
  {
    id: "ALT-002",
    transactionId: "TXN-987121",
    customer: "Jenny Wilson",
    severity: "medium",
    status: "under review",
    createdAt: "2023-10-27 14:29",
    reason: "Multiple transactions within 5 minutes"
  },
  {
    id: "ALT-003",
    transactionId: "TXN-987120",
    customer: "Guy Hawkins",
    severity: "high",
    status: "pending",
    createdAt: "2023-10-27 14:29",
    reason: "Amount exceeds ₦5,000,000 threshold"
  },
  {
    id: "ALT-004",
    transactionId: "TXN-987118",
    customer: "Jacob Jones",
    severity: "medium",
    status: "under review",
    createdAt: "2023-10-27 14:27",
    reason: "New device detected"
  },
  {
    id: "ALT-005",
    transactionId: "TXN-987117",
    customer: "Robert Fox",
    severity: "high",
    status: "resolved",
    createdAt: "2023-10-27 14:25",
    reason: "Amount exceeds ₦2,000,000 threshold"
  },
  {
    id: "ALT-006",
    transactionId: "TXN-987115",
    customer: "Annette Black",
    severity: "high",
    status: "pending",
    createdAt: "2023-10-27 14:15",
    reason: "Unusual location and high amount"
  }
];

export const mockCases = [
  {
    id: "FRD-83472",
    title: "High-value international transfer to a new beneficiary.",
    severity: "high",
    status: "new",
    assignee: null,
    date: "Oct 26, 2023"
  },
  {
    id: "FRD-83471",
    title: "Suspicious login from a new device followed by a transfer.",
    severity: "medium",
    status: "investigating",
    assignee: "MG",
    date: "Oct 25, 2023"
  },
  {
    id: "FRD-83470",
    title: "Rapid succession of small transfers to multiple accounts.",
    severity: "medium",
    status: "investigating",
    assignee: "MG",
    date: "Oct 25, 2023"
  },
  {
    id: "FRD-83469",
    title: "Transaction flagged, confirmed as legitimate by customer.",
    severity: "low",
    status: "resolved",
    assignee: "JS",
    date: "Oct 24, 2023"
  }
];

export const mockRules = [
  {
    id: "RULE-001",
    name: "High Value Transaction",
    description: "amount greater than 500000",
    status: "Active",
    enabled: true
  },
  {
    id: "RULE-002",
    name: "Multiple Transactions",
    description: "time_window count greater than 3 in 5 minutes",
    status: "Active",
    enabled: true
  },
  {
    id: "RULE-003",
    name: "New Device Login",
    description: "device not recognized true",
    status: "Active",
    enabled: true
  },
  {
    id: "RULE-004",
    name: "Unusual Location",
    description: "location outside normal area true",
    status: "Active",
    enabled: true
  }
];

export const mockUsers = [
  {
    id: "1",
    name: "John Doe",
    email: "john@fraudguard.com",
    role: "analyst",
    description: "Monitor, investigate, and manage cases"
  },
  {
    id: "2",
    name: "Sarah Admin",
    email: "admin@fraudguard.com",
    role: "admin",
    description: "Full system access and user management"
  },
  {
    id: "3",
    name: "Mike Viewer",
    email: "viewer@fraudguard.com",
    role: "viewer",
    description: "View-only access to dashboards"
  }
];
