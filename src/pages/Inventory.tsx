import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Filter, Edit, Trash2, Facebook, Eye } from "lucide-react";
import { useVehicles, Vehicle } from "@/hooks/useVehicles";
import { VehicleForm } from "@/components/VehicleForm";

export default function Inventory() {
  const { vehicles, loading, addVehicle, updateVehicle, deleteVehicle, postToFacebook } = useVehicles();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = searchTerm === "" || 
      `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
    const matchesCondition = conditionFilter === "all" || vehicle.condition === conditionFilter;
    
    return matchesSearch && matchesStatus && matchesCondition;
  });

  const handleAddVehicle = async (data: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    await addVehicle(data);
  };

  const handleEditVehicle = async (data: Partial<Vehicle>) => {
    if (editingVehicle) {
      await updateVehicle(editingVehicle.id, data);
      setEditingVehicle(null);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    await deleteVehicle(vehicleId);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'sold': return 'bg-gray-100 text-gray-800';
      case 'draft': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPostStatus = (status: string) => {
    switch (status) {
      case 'posted': return { text: 'Posted', color: 'bg-green-100 text-green-800' };
      case 'draft': return { text: 'Draft', color: 'bg-gray-100 text-gray-800' };
      case 'error': return { text: 'Error', color: 'bg-red-100 text-red-800' };
      default: return { text: 'Not Posted', color: 'bg-yellow-100 text-yellow-800' };
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading inventory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-muted-foreground">
            Manage your vehicle listings and Facebook Marketplace posts
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search vehicles..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="used">Used</SelectItem>
            <SelectItem value="certified">Certified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {vehicles.filter(v => v.status === 'available').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Posted to Facebook</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {vehicles.filter(v => v.facebook_post_status === 'posted').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {vehicles.reduce((sum, v) => sum + (v.lead_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Grid */}
      {filteredVehicles.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            {vehicles.length === 0 ? (
              <div>
                <p className="text-lg mb-2">No vehicles in inventory</p>
                <p className="text-sm">Get started by adding your first vehicle</p>
              </div>
            ) : (
              <p>No vehicles match your current filters</p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const postStatus = getPostStatus(vehicle.facebook_post_status || 'draft');
            
            return (
              <Card key={vehicle.id} className="overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">
                    {vehicle.images && vehicle.images.length > 0 ? 'Image Available' : 'No Image'}
                  </div>
                </div>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                        {vehicle.is_featured && (
                          <Badge variant="secondary" className="ml-2">Featured</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {vehicle.trim && `${vehicle.trim} • `}
                        {vehicle.mileage?.toLocaleString()} miles
                        {vehicle.vin && ` • VIN: ${vehicle.vin.slice(-6)}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Badge className={getStatusColor(vehicle.status || 'draft')}>
                        {vehicle.status?.charAt(0).toUpperCase() + vehicle.status?.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold">{formatPrice(vehicle.price)}</span>
                      <Badge className={postStatus.color}>
                        {postStatus.text}
                      </Badge>
                    </div>
                    
                    {vehicle.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {vehicle.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <span>{vehicle.view_count || 0} views</span>
                      <span>•</span>
                      <span>{vehicle.lead_count || 0} leads</span>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => setEditingVehicle(vehicle)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => postToFacebook(vehicle.id)}
                        disabled={vehicle.facebook_post_status === 'posted'}
                      >
                        <Facebook className="mr-1 h-3 w-3" />
                        {vehicle.facebook_post_status === 'posted' ? 'Posted' : 'Post'}
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this vehicle? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vehicle Form */}
      <VehicleForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleAddVehicle}
      />

      {/* Edit Vehicle Form */}
      <VehicleForm
        open={!!editingVehicle}
        onOpenChange={(open) => !open && setEditingVehicle(null)}
        onSubmit={handleEditVehicle}
        vehicle={editingVehicle}
        isEditing={true}
      />
    </div>
  );
}