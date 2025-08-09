import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, MessageSquare, TrendingUp, DollarSign, Sparkles } from "lucide-react";
import { useVehicles } from "@/hooks/useVehicles";
import { useLeads } from "@/hooks/useLeads";

export default function Dashboard() {
  const { vehicles, loading } = useVehicles();
  const { leads } = useLeads();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  // Get recent vehicles with AI descriptions
  const recentVehicles = vehicles
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const activeLeads = leads.filter(lead => ['new', 'responded', 'interested'].includes(lead.status));
  const totalRevenue = vehicles.reduce((sum, vehicle) => {
    if (vehicle.status === 'sold') {
      return sum + (vehicle.price || 0);
    }
    return sum;
  }, 0);

  const conversionRate = vehicles.length > 0 ? 
    (vehicles.filter(v => v.status === 'sold').length / vehicles.length * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome to your dealership automation center
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles.length}</div>
            <p className="text-xs text-muted-foreground">
              {vehicles.filter(v => v.status === 'available').length} available
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeads.length}</div>
            <p className="text-xs text-muted-foreground">
              {leads.filter(lead => lead.status === 'new').length} new today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {vehicles.filter(v => v.status === 'sold').length} vehicles sold
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From sold vehicles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Vehicles</CardTitle>
            <CardDescription>
              Latest vehicles added to inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles added yet</p>
              ) : (
                recentVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-start space-x-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                        {vehicle.ai_description && (
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-500" />
                            <Badge variant="outline" className="text-xs text-purple-600">AI</Badge>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {vehicle.ai_description || vehicle.description || 'No description available'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatPrice(vehicle.price || 0)} • {new Date(vehicle.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
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
                <Badge variant="outline">{activeLeads.length} new</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <span className="text-sm font-medium">Generate AI Descriptions</span>
                <Badge variant="outline" className="text-purple-600">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}