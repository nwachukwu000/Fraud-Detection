import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings } from "lucide-react";

export default function BehavioralAnalytics() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Behavioral & Device Analytics</h1>
            <p className="text-muted-foreground">Visualize and configure analytics for user behavior, devices, and more.</p>
          </div>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Configure Checks
          </Button>
        </div>

        <Tabs defaultValue="behavioral" className="space-y-4">
          <TabsList>
            <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
            <TabsTrigger value="device">Device Fingerprinting</TabsTrigger>
            <TabsTrigger value="geolocation">Geolocation</TabsTrigger>
            <TabsTrigger value="velocity">Velocity Checks</TabsTrigger>
          </TabsList>

          <TabsContent value="behavioral" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>User Behavior Deviations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex gap-2">
                    <Button variant="default" size="sm" className="rounded-full bg-primary">
                      24h
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full">
                      7d
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full">
                      30d
                    </Button>
                  </div>
                  <div className="h-[300px] w-full">
                    <svg viewBox="0 0 800 300" className="h-full w-full">
                      {/* X-axis labels */}
                      <text x="40" y="290" className="text-xs fill-muted-foreground">00:00</text>
                      <text x="140" y="290" className="text-xs fill-muted-foreground">02:00</text>
                      <text x="240" y="290" className="text-xs fill-muted-foreground">04:00</text>
                      <text x="340" y="290" className="text-xs fill-muted-foreground">06:00</text>
                      <text x="440" y="290" className="text-xs fill-muted-foreground">08:00</text>
                      <text x="540" y="290" className="text-xs fill-muted-foreground">10:00</text>
                      <text x="640" y="290" className="text-xs fill-muted-foreground">12:00</text>
                      <text x="740" y="290" className="text-xs fill-muted-foreground">14:00</text>
                      
                      {/* Bars */}
                      <rect x="40" y="235" width="30" height="30" className="fill-primary" rx="2" />
                      <rect x="90" y="225" width="30" height="40" className="fill-primary" rx="2" />
                      <rect x="140" y="210" width="30" height="55" className="fill-primary" rx="2" />
                      <rect x="190" y="185" width="30" height="80" className="fill-primary" rx="2" />
                      <rect x="240" y="170" width="30" height="95" className="fill-primary" rx="2" />
                      <rect x="290" y="150" width="30" height="115" className="fill-primary" rx="2" />
                      <rect x="340" y="120" width="30" height="145" className="fill-primary" rx="2" />
                      <rect x="390" y="95" width="30" height="170" className="fill-primary" rx="2" />
                      <rect x="440" y="70" width="30" height="195" className="fill-primary" rx="2" />
                      <rect x="490" y="55" width="30" height="210" className="fill-primary" rx="2" />
                      <rect x="540" y="40" width="30" height="225" className="fill-primary" rx="2" />
                      <rect x="590" y="60" width="30" height="205" className="fill-primary" rx="2" />
                      <rect x="640" y="70" width="30" height="195" className="fill-primary" rx="2" />
                      <rect x="690" y="80" width="30" height="185" className="fill-primary" rx="2" />
                      <rect x="740" y="95" width="30" height="170" className="fill-primary" rx="2" />
                      
                      {/* Trend line */}
                      <polyline
                        points="55,250 105,240 155,230 205,215 255,205 305,190 355,170 405,150 455,130 505,115 555,100 605,110 655,120 705,130 755,145"
                        fill="none"
                        className="stroke-destructive"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sensitivity Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Deviation Threshold</Label>
                    <Select defaultValue="high">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Flag New Payee</Label>
                      <p className="text-xs text-muted-foreground">
                        Alert on first-time recipients
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <Button className="w-full bg-yellow-500 text-white hover:bg-yellow-600">
                    Update Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="device">
            <Card>
              <CardHeader>
                <CardTitle>Device Fingerprinting</CardTitle>
                <CardDescription>Track and analyze device patterns to detect suspicious activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <p>Device analytics will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geolocation">
            <Card>
              <CardHeader>
                <CardTitle>Geolocation Analysis</CardTitle>
                <CardDescription>Monitor geographic patterns and detect unusual locations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <p>Geolocation analytics will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="velocity">
            <Card>
              <CardHeader>
                <CardTitle>Velocity Checks</CardTitle>
                <CardDescription>Monitor transaction frequency and detect rapid succession patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <p>Velocity check analytics will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
