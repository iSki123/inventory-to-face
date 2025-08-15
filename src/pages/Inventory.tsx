import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit, Trash2, Facebook, Eye, Settings, RefreshCw, Sparkles, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles, Vehicle } from "@/hooks/useVehicles";
import { supabase } from "@/integrations/supabase/client";
import { useVehicleSources } from "@/hooks/useVehicleSources";
import { VehicleForm } from "@/components/VehicleForm";
import { VehicleSourceForm } from "@/components/VehicleSourceForm";
import { VehicleImageWithBlur } from "@/components/VehicleImageWithBlur";
import { VehicleImageGallery } from "@/components/VehicleImageGallery";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function Inventory() {
  const { vehicles, loading, addVehicle, updateVehicle, deleteVehicle, bulkDeleteVehicles, postToFacebook, generateAIDescriptions, generateAIImages, refetch } = useVehicles();
  const { sources, loading: sourcesLoading, addSource, startScraping, importSpecificTask, listAvailableTasks } = useVehicleSources(refetch);
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const { getSetting } = useSiteSettings();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("vehicles");
  const [taskIdInput, setTaskIdInput] = useState("");
  
  // Default prompt (our improved version)
  const defaultPrompt = "Create a compelling and professional vehicle listing description for Facebook Marketplace that highlights the vehicle's key selling points and ends with a call to action for interested buyers. Write in flowing paragraph format without using hyphens, dashes, or asterisks for formatting. Use emojis very sparingly (maximum 2-3 total) and keep the tone conversational but professional.";
  
  // Load saved prompt from profile or use default
  const [aiDescriptionPrompt, setAiDescriptionPrompt] = useState(
    profile?.custom_ai_description_prompt || defaultPrompt
  );
  
  const [isImporting, setIsImporting] = useState(false);
  const [showTaskBrowser, setShowTaskBrowser] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Update prompt when profile changes
  useEffect(() => {
    if (profile?.custom_ai_description_prompt) {
      setAiDescriptionPrompt(profile.custom_ai_description_prompt);
    } else {
      setAiDescriptionPrompt(defaultPrompt);
    }
  }, [profile, defaultPrompt]);

  // Save prompt to user profile
  const handleSavePrompt = async () => {
    if (!profile) {
      toast({
        title: "Error",
        description: "User profile not found",
        variant: "destructive",
      });
      return;
    }

    setIsSavingPrompt(true);
    try {
      const { error } = await updateProfile({
        custom_ai_description_prompt: aiDescriptionPrompt
      });

      if (!error) {
        toast({
          title: "Success",
          description: "AI description prompt saved to your account",
        });
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
    } finally {
      setIsSavingPrompt(false);
    }
  };

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

  const handleAddSource = async (sourceData: any) => {
    await addSource(sourceData);
  };

  const handleImportTask = async () => {
    if (!taskIdInput.trim()) {
      return;
    }
    
    setIsImporting(true);
    try {
      const result = await importSpecificTask(taskIdInput.trim(), aiDescriptionPrompt);
      if (result) {
        // Real-time updates will handle refreshing, but we still manually refresh as backup
        setTaskIdInput("");
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleBrowseTasks = async () => {
    setLoadingTasks(true);
    setShowTaskBrowser(true);
    try {
      const tasks = await listAvailableTasks();
      setAvailableTasks(tasks);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleSelectTask = (taskId: string) => {
    setTaskIdInput(taskId);
    setShowTaskBrowser(false);
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

  const handleBulkPost = async () => {
    if (selectedVehicles.length === 0) return;
    
    for (const vehicleId of selectedVehicles) {
      await postToFacebook(vehicleId);
    }
    setSelectedVehicles([]);
  };

  const handleBulkDelete = async () => {
    if (selectedVehicles.length === 0) return;
    
    const success = await bulkDeleteVehicles(selectedVehicles);
    if (success) {
      setSelectedVehicles([]);
    }
  };

  const toggleVehicleSelection = (vehicleId: string) => {
    setSelectedVehicles(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedVehicles.length === filteredVehicles.length) {
      setSelectedVehicles([]);
    } else {
      setSelectedVehicles(filteredVehicles.map(v => v.id));
    }
  };

  if (loading || sourcesLoading) {
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
            Manage vehicles, automate scraping, and post to Facebook Marketplace
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSourceForm(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Data Sources
          </Button>
          {getSetting('ai_image_generation_enabled', { enabled: true })?.enabled && (
            <Button 
              variant="outline" 
              onClick={() => generateAIImages(vehicles.map(v => v.id))}
              disabled={loading || vehicles.length === 0}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate AI Images
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vehicles">Vehicles ({vehicles.length})</TabsTrigger>
          <TabsTrigger value="sources">Data Sources ({sources.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="space-y-6">
          {/* Search and Filter with Bulk Actions */}
          <div className="flex gap-4 flex-wrap items-center">
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
            
            {selectedVehicles.length > 0 && (
              <>
                <Button 
                  onClick={() => generateAIDescriptions(selectedVehicles)} 
                  variant="outline"
                  disabled={loading}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Descriptions ({selectedVehicles.length})
                </Button>
                <Button 
                  onClick={() => generateAIImages(selectedVehicles)} 
                  variant="outline"
                  disabled={loading}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Images ({selectedVehicles.length})
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 hover:text-red-700">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected ({selectedVehicles.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Selected Vehicles</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedVehicles.length} selected vehicle{selectedVehicles.length > 1 ? 's' : ''}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete {selectedVehicles.length} Vehicle{selectedVehicles.length > 1 ? 's' : ''}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button 
                  onClick={() => setSelectedVehicles([])} 
                  variant="outline"
                  size="sm"
                >
                  Clear Selection
                </Button>
              </>
            )}
          </div>

          {/* Inventory Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  <div className="flex items-center justify-between">
                    Total Vehicles
                    <Checkbox
                      checked={selectedVehicles.length === filteredVehicles.length && filteredVehicles.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{vehicles.length}</div>
                {selectedVehicles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedVehicles.length} selected
                  </p>
                )}
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {sources.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sources.filter(s => s.scraping_enabled).length} active
                </p>
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
                    <p className="text-sm">Get started by adding your first vehicle or setting up data sources</p>
                  </div>
                ) : (
                  <p>No vehicles match your current filters</p>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {filteredVehicles.map((vehicle) => {
                const postStatus = getPostStatus(vehicle.facebook_post_status || 'draft');
                
                return (
                  <Card key={vehicle.id} className="overflow-hidden">
                    <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
                      <Checkbox
                        checked={selectedVehicles.includes(vehicle.id)}
                        onCheckedChange={() => toggleVehicleSelection(vehicle.id)}
                        className="absolute top-2 left-2 z-10"
                      />
                      {vehicle.images && vehicle.images.length > 0 ? (
                        <VehicleImageWithBlur
                          src={vehicle.images[0]} 
                          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="text-muted-foreground text-sm">
                          No Image
                        </div>
                      )}
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
                        
                        <div className="space-y-2">
                          {vehicle.ai_description && (
                            <div className="flex items-center gap-1 mb-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              <Badge variant="outline" className="text-xs text-purple-600">AI Generated</Badge>
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {vehicle.ai_description || vehicle.description || 'No description available'}
                          </p>
                        </div>

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
        </TabsContent>

        <TabsContent value="sources" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Vehicle Data Sources</h3>
              <p className="text-sm text-muted-foreground">
                Configure automatic vehicle data scraping from dealer websites
              </p>
            </div>
            <Button onClick={() => setShowSourceForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Source
            </Button>
          </div>

          {/* Manual Task Import */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import from Octoparse Task</CardTitle>
              <CardDescription>
                Directly import vehicle data from a specific Octoparse task ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">AI Description Prompt</label>
                <Textarea
                  placeholder="Enter custom prompt for AI-generated descriptions..."
                  value={aiDescriptionPrompt}
                  onChange={(e) => setAiDescriptionPrompt(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This prompt will be used to generate AI descriptions for vehicles that have missing or short descriptions.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSavePrompt}
                    disabled={isSavingPrompt}
                  >
                    {isSavingPrompt ? (
                      <>
                        <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-3 w-3" />
                        Save Prompt
                      </>
                    )}
                  </Button>
                  {profile?.custom_ai_description_prompt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAiDescriptionPrompt(defaultPrompt)}
                    >
                      Reset to Default
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Input
                  placeholder="Enter Octoparse Task ID (e.g., 7e9f5fcf-7257-470e-a20b-41f84293a152)"
                  value={taskIdInput}
                  onChange={(e) => setTaskIdInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleBrowseTasks}
                  disabled={loadingTasks}
                >
                  {loadingTasks ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Browse Tasks
                </Button>
                <Button
                  onClick={handleImportTask}
                  disabled={isImporting || !taskIdInput.trim()}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Import Now
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This will fetch and import all vehicle data from the specified Octoparse task with AI-generated descriptions.
              </p>
            </CardContent>
          </Card>

          {sources.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-muted-foreground">
                <p className="text-lg mb-2">No data sources configured</p>
                <p className="text-sm">Add a source to start automatically importing vehicle data</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sources.map((source) => (
                <Card key={source.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{source.dealership_name}</CardTitle>
                        <CardDescription className="mt-1">
                          {source.website_url}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={source.scraping_enabled ? "default" : "secondary"}>
                          {source.scraping_enabled ? "Active" : "Disabled"}
                        </Badge>
                        {source.last_scraped_at && (
                          <Badge variant="outline">
                            Last: {new Date(source.last_scraped_at).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <p>Frequency: Every {source.scraping_frequency} hours</p>
                        {source.octoparse_task_id && (
                          <p>Task ID: {source.octoparse_task_id}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startScraping(source.id)}
                          disabled={!source.scraping_enabled}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Scrape Now
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>

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

      {/* Vehicle Source Form */}
      <VehicleSourceForm
        open={showSourceForm}
        onOpenChange={setShowSourceForm}
        onSubmit={handleAddSource}
      />

      {/* Task Browser Dialog */}
      <Dialog open={showTaskBrowser} onOpenChange={setShowTaskBrowser}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Browse Octoparse Tasks</DialogTitle>
            <DialogDescription>
              Select a task to import vehicle data from your Octoparse account
            </DialogDescription>
          </DialogHeader>
          
          {loadingTasks ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading available tasks...</span>
            </div>
          ) : availableTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tasks found in your Octoparse account</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableTasks.map((task) => (
                <Card key={task.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-medium">{task.name}</h4>
                            <p className="text-sm text-muted-foreground">ID: {task.id}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                              {task.status}
                            </Badge>
                            {task.itemCount > 0 && (
                              <Badge variant="outline">
                                {task.itemCount} items
                              </Badge>
                            )}
                          </div>
                        </div>
                        {task.lastRun && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last run: {new Date(task.lastRun).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleSelectTask(task.id)}
                        size="sm"
                      >
                        Select Task
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}