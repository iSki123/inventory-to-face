import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, MessageSquare, TrendingUp, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Dashboard() {
  const testVinDecoding = async () => {
    try {
      toast.loading("Testing VIN decoding...");
      
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: { vin: 'KNAGT4L3XH5156979' }
      });

      if (error) {
        console.error('VIN decoding error:', error);
        toast.error(`VIN decoding failed: ${error.message}`);
        return;
      }

      console.log('VIN decoding result:', data);
      
      if (data.success) {
        toast.success(`VIN decoded successfully! Vehicle Type: ${data.vehicle_type_nhtsa || 'Unknown'}, Body Style: ${data.body_style_nhtsa || 'Unknown'}`);
      } else {
        toast.error(`VIN decoding failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing VIN decoding:', error);
      toast.error('Failed to test VIN decoding');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your dealership automation center
        </p>
      </div>

      {/* VIN Test Button */}
      <Card>
        <CardHeader>
          <CardTitle>VIN Decoder Test</CardTitle>
          <CardDescription>Test the NHTSA VIN decoding functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={testVinDecoding}>
            Test VIN: KNAGT4L3XH5156979
          </Button>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">124</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">32</div>
            <p className="text-xs text-muted-foreground">
              +5 new today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.2%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest actions in your dealership
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Vehicle posted to Facebook Marketplace</p>
                  <p className="text-xs text-muted-foreground">2022 Honda Civic - 2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New lead received</p>
                  <p className="text-xs text-muted-foreground">Interest in Toyota Camry - 15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">AI response sent</p>
                  <p className="text-xs text-muted-foreground">Lead follow-up - 1 hour ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <span className="text-sm font-medium">Post New Vehicle</span>
                <Badge variant="outline">Quick</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <span className="text-sm font-medium">Review Leads</span>
                <Badge variant="outline">3 new</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <span className="text-sm font-medium">Purchase Credits</span>
                <Badge variant="outline">Billing</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}