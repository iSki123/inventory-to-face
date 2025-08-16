import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Database, Car, Zap, Clock, CheckCircle2, Image, Shield, Server, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";
import ConsoleLogsViewer from "@/components/ConsoleLogsViewer";

export default function AdminPanel() {
  const { profile, loading: authLoading } = useAuth();

  // Check if user is admin/owner
  if (authLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access the admin dashboard. Only administrators and owners can access this area.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  const [isForceDecoding, setIsForceDecoding] = useState(false);
  const [isBatchDecoding, setIsBatchDecoding] = useState(false);
  const [singleVin, setSingleVin] = useState("");
  const [isDecodingSingle, setIsDecodingSingle] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Site settings
  const { getSetting, updateSetting, loading: settingsLoading } = useSiteSettings();

  // Get VIN statistics
  const { data: vinStats, refetch: refetchStats } = useQuery({
    queryKey: ['vin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, vin, vin_decoded_at')
        .not('vin', 'is', null);
      
      if (error) throw error;
      
      const totalWithVin = data.length;
      const decoded = data.filter(v => v.vin_decoded_at).length;
      const needsDecoding = totalWithVin - decoded;
      const lastDecoded = data
        .filter(v => v.vin_decoded_at)
        .sort((a, b) => new Date(b.vin_decoded_at).getTime() - new Date(a.vin_decoded_at).getTime())[0];

      return {
        totalWithVin,
        decoded,
        needsDecoding,
        lastDecoded: lastDecoded?.vin_decoded_at || null
      };
    }
  });

  const handleForceMassDecoding = async () => {
    setIsForceDecoding(true);
    try {
      // Instead of clearing all data first, let's just trigger decoding with force flag
      // This will re-decode all VINs without losing the current data during the process
      
      // Get all vehicles with VINs for batch processing
      const { data: allVehicles, error: fetchError } = await supabase
        .from('vehicles')
        .select('id, vin')
        .not('vin', 'is', null);

      if (fetchError) throw fetchError;

      // Process in batches to avoid overwhelming the system
      const batchSize = 20;
      let totalProcessed = 0;
      
      for (let i = 0; i < (allVehicles?.length || 0); i += batchSize) {
        const batch = allVehicles?.slice(i, i + batchSize) || [];
        
        // Clear vin_decoded_at only for current batch to force re-decoding
        const vehicleIds = batch.map(v => v.id);
        await supabase
          .from('vehicles')
          .update({ vin_decoded_at: null })
          .in('id', vehicleIds);

        // Then trigger batch decoding for this batch
        const { data, error } = await supabase.functions.invoke('vin-decoder', {
          body: {
            action: 'batch_decode',
            batch_size: batchSize
          }
        });

        if (error) throw error;
        
        totalProcessed += batch.length;
        console.log(`Processed batch ${Math.floor(i/batchSize) + 1}, total processed: ${totalProcessed}`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast.success(`Force decode completed: ${totalProcessed} vehicles processed in batches`);
      refetchStats();
    } catch (error: any) {
      console.error('Force decode error:', error);
      toast.error(error.message || "Failed to force mass decoding");
    } finally {
      setIsForceDecoding(false);
    }
  };

  const handleBatchDecode = async () => {
    setIsBatchDecoding(true);
    try {
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: {
          action: 'batch_decode',
          batch_size: 10
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success(`Batch decode completed: ${data.message}`);
      refetchStats();
    } catch (error: any) {
      console.error('Batch decode error:', error);
      toast.error(error.message || "Failed to run batch decode");
    } finally {
      setIsBatchDecoding(false);
    }
  };

  const handleSingleVinDecode = async () => {
    if (!singleVin || singleVin.length !== 17) {
      toast.error("Please enter a valid 17-character VIN");
      return;
    }

    setIsDecodingSingle(true);
    try {
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: { vin: singleVin }
      });

      if (error) throw error;

      setResult(data);
      toast.success("VIN decoded successfully!");
      refetchStats();
    } catch (error: any) {
      console.error('Single VIN decode error:', error);
      toast.error(error.message || "Failed to decode VIN");
    } finally {
      setIsDecodingSingle(false);
    }
  };

  const handleAIImageToggle = async (enabled: boolean) => {
    await updateSetting('ai_image_generation_enabled', { enabled });
  };

  // Edge function control handlers
  const handleGlobalEdgeFunctionsToggle = async (enabled: boolean) => {
    await updateSetting('edge_functions_enabled', { enabled });
    toast.success(`Edge functions ${enabled ? 'enabled' : 'disabled'} globally`);
  };

  const handleSpecificEdgeFunctionToggle = async (functionName: string, enabled: boolean) => {
    const currentSettings = getSetting('edge_function_overrides', {}) || {};
    const newSettings = {
      ...currentSettings,
      [functionName]: enabled
    };
    await updateSetting('edge_function_overrides', newSettings);
    toast.success(`${functionName} ${enabled ? 'enabled' : 'disabled'}`);
  };

  // List of edge functions that can be controlled
  const edgeFunctions = [
    { name: 'generate-vehicle-images', label: 'AI Vehicle Image Generation', description: 'Generates AI images for vehicles using OpenAI' },
    { name: 'generate-vehicle-description', label: 'AI Vehicle Descriptions', description: 'Generates AI-powered vehicle descriptions' },
    { name: 'facebook-poster', label: 'Facebook Poster', description: 'Posts vehicles to Facebook Marketplace' },
    { name: 'octoparse-scraper', label: 'Octoparse Scraper', description: 'Scrapes vehicle data from dealership websites' },
    { name: 'generate-lead-response', label: 'AI Lead Responses', description: 'Generates AI responses for customer leads' },
    { name: 'vin-decoder', label: 'VIN Decoder', description: 'Decodes vehicle VIN numbers' },
    { name: 'scrape-vehicle', label: 'Vehicle Scraper', description: 'Individual vehicle scraping functionality' }
  ];

  const globalEdgeFunctionsEnabled = getSetting('edge_functions_enabled', { enabled: true })?.enabled;
  const edgeFunctionOverrides = getSetting('edge_function_overrides', {}) || {};

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage site settings and VIN decoding operations
        </p>
      </div>

      {/* VIN Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            VIN Decoding Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{vinStats?.totalWithVin || 0}</div>
              <div className="text-sm text-muted-foreground">Total Vehicles with VIN</div>
            </div>
            <div className="text-center p-4 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{vinStats?.decoded || 0}</div>
              <div className="text-sm text-muted-foreground">Decoded VINs</div>
            </div>
            <div className="text-center p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{vinStats?.needsDecoding || 0}</div>
              <div className="text-sm text-muted-foreground">Need Decoding</div>
            </div>
            <div className="text-center p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium">Last Decoded</div>
              <div className="text-xs text-muted-foreground">
                {vinStats?.lastDecoded 
                  ? new Date(vinStats.lastDecoded).toLocaleString()
                  : 'Never'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Site Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Site Settings
          </CardTitle>
          <CardDescription>
            Configure global site functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="ai-image-toggle">AI Image Generation</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable AI-generated images for vehicles site-wide
              </p>
            </div>
            <Switch
              id="ai-image-toggle"
              checked={getSetting('ai_image_generation_enabled', { enabled: true })?.enabled}
              onCheckedChange={handleAIImageToggle}
              disabled={settingsLoading}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="console-logging-toggle">Console Logging</Label>
              <p className="text-sm text-muted-foreground">
                Enable collection of console logs from Chrome extension for debugging
              </p>
            </div>
            <Switch
              id="console-logging-toggle"
              checked={getSetting('console_logging_enabled', { enabled: false })?.enabled}
              onCheckedChange={(enabled) => updateSetting('console_logging_enabled', { enabled })}
              disabled={settingsLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Edge Functions Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Edge Functions Control
          </CardTitle>
          <CardDescription>
            Enable or disable edge functions globally or individually
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="global-edge-functions-toggle" className="font-semibold">Global Edge Functions</Label>
                {!globalEdgeFunctionsEnabled && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    DISABLED
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Master switch to enable/disable all edge functions system-wide
              </p>
            </div>
            <Switch
              id="global-edge-functions-toggle"
              checked={globalEdgeFunctionsEnabled}
              onCheckedChange={handleGlobalEdgeFunctionsToggle}
              disabled={settingsLoading}
            />
          </div>
          
          <Separator />
          
          {/* Individual Function Controls */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Individual Function Controls</Label>
            <p className="text-xs text-muted-foreground mb-4">
              Override individual functions (requires global functions to be enabled)
            </p>
          </div>
          
          <div className="grid gap-3">
            {edgeFunctions.map((func) => {
              const isEnabled = globalEdgeFunctionsEnabled && (edgeFunctionOverrides[func.name] !== false);
              const isOverridden = edgeFunctionOverrides.hasOwnProperty(func.name);
              
              return (
                <div key={func.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`${func.name}-toggle`} className="text-sm font-medium">
                        {func.label}
                      </Label>
                      {!isEnabled && (
                        <Badge variant="outline" className="text-xs">
                          DISABLED
                        </Badge>
                      )}
                      {isOverridden && (
                        <Badge variant="secondary" className="text-xs">
                          OVERRIDE
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {func.description}
                    </p>
                  </div>
                  <Switch
                    id={`${func.name}-toggle`}
                    checked={edgeFunctionOverrides[func.name] !== false}
                    onCheckedChange={(enabled) => handleSpecificEdgeFunctionToggle(func.name, enabled)}
                    disabled={settingsLoading || !globalEdgeFunctionsEnabled}
                  />
                </div>
              );
            })}
          </div>
          
          {!globalEdgeFunctionsEnabled && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">⚠️ Edge Functions Disabled</p>
              <p className="text-xs text-muted-foreground mt-1">
                All edge functions are currently disabled. Enable global edge functions to allow individual controls.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Features Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            AI Image Generation Control
          </CardTitle>
          <CardDescription>
            Configure AI vehicle image generation settings globally
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Image Generation Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-image-gen">AI Vehicle Image Generation</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable AI-generated vehicle images for all users
              </p>
            </div>
            <Switch
              id="ai-image-gen"
              checked={getSetting('ai_image_generation_enabled', { enabled: true })?.enabled !== false}
              onCheckedChange={(checked) => {
                updateSetting('ai_image_generation_enabled', { enabled: checked });
              }}
              disabled={settingsLoading}
            />
          </div>

          <Separator />

          {/* AI Image Generation Configuration */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-count">Number of Images to Generate</Label>
              <p className="text-sm text-muted-foreground mb-2">
                How many AI images to generate per vehicle (1-4)
              </p>
              <Input
                id="image-count"
                type="number"
                min="1"
                max="4"
                value={getSetting('ai_image_generation_count', 2)}
                onChange={(e) => {
                  const value = Math.min(4, Math.max(1, parseInt(e.target.value) || 2));
                  updateSetting('ai_image_generation_count', value);
                }}
                disabled={settingsLoading}
              />
            </div>

            <div>
              <Label htmlFor="image-prompts">AI Image Generation Prompt Template</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Configure the prompt template used for AI image generation. Available variables: {`{{SEED_IMAGE_URL}}, {{YEAR}}, {{MAKE}}, {{MODEL}}, {{TRIM}}, {{EXTERIOR_COLOR}}, {{INTERIOR_COLOR}}, {{MILEAGE}}, {{ENGINE}}, {{DRIVETRAIN}}, {{FUEL_TYPE}}, {{DEALERSHIP_NAME}}, {{VIEW_DESCRIPTION}}`}
              </p>
              <Textarea
                id="image-prompts"
                rows={12}
                value={getSetting('ai_image_generation_prompt', `Reference this image for vehicle styling, lighting, background, damage, and customization:
{{SEED_IMAGE_URL}}

GOAL: Generate a clean, realistic photo that matches the seed image in **near-identical likeness**. The seed image is the **single source of truth**.

HARD CONSTRAINTS — DO NOT VIOLATE:
• Do NOT add, invent, or "upgrade" any feature that is not clearly visible in the seed image.
• Default to OEM/STOCK appearance for any part that is not clearly visible.
• If uncertain about a feature (occluded, blurry, partially cropped), OMIT it and keep OEM/STOCK.
• Ignore and REMOVE ad frames, banners, price boxes, watermarks, emoji/stickers, lot signage graphics, or any non-vehicle overlays from the seed image. These are NOT vehicle features.
• Keep the vehicle's ride height and stance exactly as in the seed image. **No lift/no lower** unless clearly shown.
• Keep wheels/tires exactly as shown (diameter/width/style/finish/sidewall look). Do NOT swap styles or sizes.
• Lighting mods: ONLY replicate lights that are clearly visible in the seed image (e.g., roof LED bar, grille lights, fogs, halos, pods). Match the **exact style, housing, lens, mounting location, and color temperature**. If not clearly present, DO NOT add any extra lights.
• Other mods/damage to replicate ONLY if clearly visible: step/nerf bars, racks, rain guards, body kits/flares, vinyl/wraps/decals, badges, mismatched panels, scratches, dents, chips, rust, scuffs, cracked parts. Match their exact location, size, and severity.

Vehicle data for accuracy:
{{YEAR}} {{MAKE}} {{MODEL}} {{TRIM}}, exterior: {{EXTERIOR_COLOR}}, interior: {{INTERIOR_COLOR}}, mileage: {{MILEAGE}}, engine: {{ENGINE}}, drivetrain: {{DRIVETRAIN}}, fuel: {{FUEL_TYPE}}.

View / Angle:
{{VIEW_DESCRIPTION}}

Composition:
• Vertical 9:16 (iPhone portrait)
• Vehicle occupies 65–70% of the frame
• ≥ 100px clear margin on both left & right sides
• Balanced space above & below
• Preserve the original background & lighting from the seed (sky, shadows, pavement/ground texture)
• Ensure the full vehicle is visible — no cropping/cutoffs

STRICT NO-TEXT POLICY:
No visible text of any kind in the image (no labels, overlays, price tags, UI boxes, borders, captions, numbers, or dealership graphics). The only allowed text is the **physical license plate** rendered as part of the car:
License plate: "{{DEALERSHIP_NAME}}".

Photography Style:
Ultra-high-resolution, realistic automotive photography with natural dynamic range, sharp focus, subtle depth-of-field. Keep the candid, modern iPhone look. Match perspective and lighting direction from the seed image.`)}
                onChange={(e) => updateSetting('ai_image_generation_prompt', e.target.value)}
                disabled={settingsLoading}
              />
            </div>

            <div>
              <Label htmlFor="image-views">Image View Descriptions</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Define the view descriptions for each image (one per line, up to 4). These will replace {`{{VIEW_DESCRIPTION}}`} in the prompt.
              </p>
              <Textarea
                id="image-views"
                rows={4}
                value={getSetting('ai_image_generation_views', [
                  'Front 3/4 — grille, headlights, driver\'s side',
                  'Side profile — all wheels, full body',
                  'Rear 3/4 — taillights, passenger side',
                  'Interior — dashboard, seats, controls'
                ]).join('\n')}
                onChange={(e) => {
                  const views = e.target.value.split('\n').filter(v => v.trim()).slice(0, 4);
                  updateSetting('ai_image_generation_views', views);
                }}
                disabled={settingsLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Console Logs Viewer */}
      <ConsoleLogsViewer />

      {/* VIN Decoding Controls */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Force Mass Decoding
            </CardTitle>
            <CardDescription>
              Clear all VIN decode timestamps and re-decode all vehicles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">⚠️ Warning</p>
              <p className="text-xs text-muted-foreground mt-1">
                This will force re-decode all VINs, even ones already decoded. Use with caution.
              </p>
            </div>
            <Button 
              onClick={handleForceMassDecoding}
              disabled={isForceDecoding}
              variant="destructive"
              className="w-full"
            >
              {isForceDecoding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Force Decoding...
                </>
              ) : (
                'Force Mass Decode'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Regular Batch Decode
            </CardTitle>
            <CardDescription>
              Run the same process as the automated cron job
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will decode up to 10 vehicles with VINs that need decoding.
            </p>
            <Button 
              onClick={handleBatchDecode}
              disabled={isBatchDecoding}
              className="w-full"
            >
              {isBatchDecoding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Run Batch Decode'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Single VIN Decode
            </CardTitle>
            <CardDescription>
              Test decoding a specific VIN
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="single-vin">VIN (17 characters)</Label>
              <Input
                id="single-vin"
                value={singleVin}
                onChange={(e) => setSingleVin(e.target.value.toUpperCase())}
                placeholder="Enter VIN..."
                maxLength={17}
              />
            </div>
            <Button 
              onClick={handleSingleVinDecode}
              disabled={isDecodingSingle || !singleVin || singleVin.length !== 17}
              className="w-full"
            >
              {isDecodingSingle ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Decoding...
                </>
              ) : (
                'Decode VIN'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>


      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Last Operation Result</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={JSON.stringify(result, null, 2)}
              readOnly
              className="font-mono text-sm"
              rows={10}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}