import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

export default function CustomReports() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Custom Reports</h1>
            <p className="text-muted-foreground">Generate, view, and export custom reports</p>
          </div>
          <Button className="bg-primary">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Report
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create a New Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  placeholder="e.g. Q4 High-Risk Transactions"
                />
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select defaultValue="30">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="180">Last 6 Months</SelectItem>
                    <SelectItem value="365">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fraud Type</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fraud Types</SelectItem>
                    <SelectItem value="high-value">High Value Transactions</SelectItem>
                    <SelectItem value="multiple">Multiple Transactions</SelectItem>
                    <SelectItem value="device">New Device Login</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Risk Level</Label>
                <Select defaultValue="all-risks">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-risks">All Risk Levels</SelectItem>
                    <SelectItem value="high">High Risk Only</SelectItem>
                    <SelectItem value="medium">Medium Risk Only</SelectItem>
                    <SelectItem value="low">Low Risk Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>User Segment</Label>
                <Select defaultValue="all-segments">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-segments">All Segments</SelectItem>
                    <SelectItem value="vip">VIP Customers</SelectItem>
                    <SelectItem value="regular">Regular Customers</SelectItem>
                    <SelectItem value="new">New Customers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full bg-primary">Generate Report</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Fraud Volume (₦)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Total suspected fraud value over the last 6 months.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <svg viewBox="0 0 600 400" className="h-full w-full">
                  <text x="20" y="380" className="text-xs fill-muted-foreground">May</text>
                  <text x="110" y="380" className="text-xs fill-muted-foreground">Jun</text>
                  <text x="200" y="380" className="text-xs fill-muted-foreground">Jul</text>
                  <text x="290" y="380" className="text-xs fill-muted-foreground">Aug</text>
                  <text x="380" y="380" className="text-xs fill-muted-foreground">Sep</text>
                  <text x="470" y="380" className="text-xs fill-muted-foreground">Oct</text>
                  
                  <rect x="40" y="180" width="60" height="180" className="fill-primary" rx="4" />
                  <rect x="130" y="120" width="60" height="240" className="fill-primary" rx="4" />
                  <rect x="220" y="140" width="60" height="220" className="fill-primary" rx="4" />
                  <rect x="310" y="100" width="60" height="260" className="fill-primary" rx="4" />
                  <rect x="400" y="130" width="60" height="230" className="fill-primary" rx="4" />
                  <rect x="490" y="60" width="60" height="300" className="fill-primary" rx="4" />
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generated Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground">
              <p>No reports generated yet. Create your first custom report above.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
