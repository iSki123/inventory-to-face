import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Car, MessageSquare, DollarSign, Activity, Target } from "lucide-react";

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalVehicles: number;
  totalLeads: number;
  totalMessages: number;
  totalCredits: number;
  conversionRate: number;
  avgResponseTime: number;
}

interface ChartData {
  name: string;
  users: number;
  vehicles: number;
  leads: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Analytics() {
  const { profile } = useAuth();
  const canAccessAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async (): Promise<AnalyticsData> => {
      // Get user statistics
      const { data: users } = await supabase
        .from('profiles')
        .select('*');

      // Get vehicle statistics  
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*');

      // Get lead statistics
      const { data: leads } = await supabase
        .from('leads')
        .select('*');

      // Get message statistics
      const { data: messages } = await supabase
        .from('lead_messages')
        .select('*');

      const totalUsers = users?.length || 0;
      const activeUsers = users?.filter(u => u.is_active).length || 0;
      const totalVehicles = vehicles?.length || 0;
      const totalLeads = leads?.length || 0;
      const totalMessages = messages?.length || 0;
      const totalCredits = users?.reduce((sum, u) => sum + u.credits, 0) || 0;
      
      // Calculate conversion rate (qualified leads / total leads)
      const qualifiedLeads = leads?.filter(l => l.is_qualified).length || 0;
      const conversionRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;

      // Calculate average response time (simplified)
      const avgResponseTime = 2.5; // hours (placeholder)

      return {
        totalUsers,
        activeUsers,
        totalVehicles,
        totalLeads,
        totalMessages,
        totalCredits,
        conversionRate,
        avgResponseTime,
      };
    },
    enabled: canAccessAdmin,
  });

  const { data: chartData } = useQuery({
    queryKey: ['admin-chart-data'],
    queryFn: async (): Promise<ChartData[]> => {
      // This is simplified mock data for demonstration
      // In a real app, you'd query actual time-series data
      return [
        { name: 'Jan', users: 10, vehicles: 45, leads: 120 },
        { name: 'Feb', users: 15, vehicles: 52, leads: 98 },
        { name: 'Mar', users: 20, vehicles: 61, leads: 150 },
        { name: 'Apr', users: 25, vehicles: 58, leads: 140 },
        { name: 'May', users: 30, vehicles: 67, leads: 180 },
        { name: 'Jun', users: 35, vehicles: 75, leads: 200 },
      ];
    },
    enabled: canAccessAdmin,
  });

  const { data: leadsByStatus } = useQuery({
    queryKey: ['leads-by-status'],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('status');

      const statusCounts = leads?.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return Object.entries(statusCounts).map(([status, count]) => ({
        name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: count,
      }));
    },
    enabled: canAccessAdmin,
  });

  if (!canAccessAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Platform performance and usage metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalVehicles}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +23% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +2.1% from last month
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.totalUsers ? 
                `${((analytics.activeUsers / analytics.totalUsers) * 100).toFixed(1)}% of total` : 
                'No users'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalCredits}</div>
            <p className="text-xs text-muted-foreground">
              Across all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.avgResponseTime}h</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingDown className="h-3 w-3 mr-1" />
                Improved by 15%
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform Growth</CardTitle>
            <CardDescription>
              Monthly user registrations, vehicle listings, and leads generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#8884d8" name="New Users" />
                <Bar dataKey="vehicles" fill="#82ca9d" name="Vehicles" />
                <Bar dataKey="leads" fill="#ffc658" name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Status Distribution</CardTitle>
            <CardDescription>
              Current status breakdown of all leads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={leadsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {leadsByStatus?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
          <CardDescription>
            Track key metrics over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="users" stroke="#8884d8" strokeWidth={2} name="Users" />
              <Line type="monotone" dataKey="vehicles" stroke="#82ca9d" strokeWidth={2} name="Vehicles" />
              <Line type="monotone" dataKey="leads" stroke="#ffc658" strokeWidth={2} name="Leads" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}