import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Vehicle } from "@/hooks/useVehicles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VehicleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  vehicle?: Vehicle | null;
  isEditing?: boolean;
}

// Facebook Marketplace standard options
const bodyStyles = ['Coupe', 'Truck', 'Sedan', 'Hatchback', 'SUV', 'Convertible', 'Wagon', 'Minivan', 'Small Car', 'Other'];
const exteriorColors = ['Black', 'Blue', 'Brown', 'Gold', 'Green', 'Gray', 'Pink', 'Purple', 'Red', 'Silver', 'Orange', 'White', 'Yellow', 'Charcoal', 'Off white'];
const interiorColors = ['Black', 'Blue', 'Brown', 'Gold', 'Green', 'Gray', 'Pink', 'Purple', 'Red', 'Silver', 'Orange', 'White', 'Yellow', 'Charcoal', 'Off white'];
const fuelTypes = ['Diesel', 'Electric', 'Gasoline', 'Flex', 'Hybrid', 'Petrol', 'Plug-in hybrid', 'Other'];
const transmissions = ['Manual transmission', 'Automatic transmission'];
const vehicleTypes = ['Car/Truck', 'Motorcycle', 'Powersport', 'RV/Camper', 'Trailer', 'Boat', 'Commercial/Industrial', 'Other'];
const conditions = ['new', 'used'];
const statuses = ['available', 'pending', 'sold', 'draft'];

export function VehicleForm({ open, onOpenChange, onSubmit, vehicle, isEditing }: VehicleFormProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    year: new Date().getFullYear(),
    make: '',
    model: '',
    price: 0,
    condition: 'used',
    fuel_type: 'Gasoline',
    transmission: 'Automatic transmission',
    status: 'available',
    features: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDecodingVin, setIsDecodingVin] = useState(false);

  const handleDecodeVin = async () => {
    if (!formData.vin || formData.vin.length !== 17) {
      toast.error('Please enter a valid 17-character VIN');
      return;
    }

    setIsDecodingVin(true);
    try {
      const { data, error } = await supabase.functions.invoke('vin-decoder', {
        body: { 
          vin: formData.vin,
          vehicleId: vehicle?.id // Pass vehicle ID if editing existing vehicle
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success && data?.vinData) {
        const vinData = data.vinData;
        
        // Map NHTSA decoded data to Facebook Marketplace format
        const updates: Partial<Vehicle> = {
          ...vinData // Store all NHTSA fields
        };

        // Map body style from NHTSA to Facebook format
        if (vinData.body_style_nhtsa) {
          const bodyStyle = vinData.body_style_nhtsa.toLowerCase();
          if (bodyStyle.includes('suv') || bodyStyle.includes('sport utility')) updates.body_style_nhtsa = 'SUV';
          else if (bodyStyle.includes('coupe')) updates.body_style_nhtsa = 'Coupe';
          else if (bodyStyle.includes('sedan')) updates.body_style_nhtsa = 'Sedan';
          else if (bodyStyle.includes('truck')) updates.body_style_nhtsa = 'Truck';
          else if (bodyStyle.includes('hatchback')) updates.body_style_nhtsa = 'Hatchback';
          else if (bodyStyle.includes('convertible')) updates.body_style_nhtsa = 'Convertible';
          else if (bodyStyle.includes('wagon')) updates.body_style_nhtsa = 'Wagon';
          else if (bodyStyle.includes('minivan')) updates.body_style_nhtsa = 'Minivan';
          else updates.body_style_nhtsa = 'Other';
        }

        // Map fuel type from NHTSA to Facebook format
        if (vinData.fuel_type_nhtsa) {
          const fuelType = vinData.fuel_type_nhtsa.toLowerCase();
          if (fuelType.includes('electric')) updates.fuel_type = 'Electric';
          else if (fuelType.includes('hybrid') && fuelType.includes('plug')) updates.fuel_type = 'Plug-in hybrid';
          else if (fuelType.includes('hybrid')) updates.fuel_type = 'Hybrid';
          else if (fuelType.includes('diesel')) updates.fuel_type = 'Diesel';
          else if (fuelType.includes('flex')) updates.fuel_type = 'Flex';
          else updates.fuel_type = 'Gasoline';
        }

        // Map transmission from NHTSA to Facebook format
        if (vinData.transmission_nhtsa) {
          const transmission = vinData.transmission_nhtsa.toLowerCase();
          if (transmission.includes('manual')) updates.transmission = 'Manual transmission';
          else updates.transmission = 'Automatic transmission';
        }

        // Map vehicle type from NHTSA
        if (vinData.vehicle_type_nhtsa) {
          const vehicleType = vinData.vehicle_type_nhtsa.toLowerCase();
          if (vehicleType.includes('motorcycle')) updates.vehicle_type_nhtsa = 'Motorcycle';
          else if (vehicleType.includes('rv') || vehicleType.includes('camper')) updates.vehicle_type_nhtsa = 'RV/Camper';
          else if (vehicleType.includes('trailer')) updates.vehicle_type_nhtsa = 'Trailer';
          else if (vehicleType.includes('boat')) updates.vehicle_type_nhtsa = 'Boat';
          else if (vehicleType.includes('commercial') || vehicleType.includes('industrial')) updates.vehicle_type_nhtsa = 'Commercial/Industrial';
          else updates.vehicle_type_nhtsa = 'Car/Truck';
        }

        // Map engine information
        if (vinData.engine_nhtsa) {
          updates.engine = vinData.engine_nhtsa;
        }

        setFormData(prev => ({
          ...prev,
          ...updates
        }));
        
        toast.success('VIN decoded successfully! Vehicle details updated.');
      } else {
        throw new Error(data?.error || 'Failed to decode VIN');
      }
    } catch (error) {
      console.error('VIN decoding error:', error);
      toast.error('Failed to decode VIN. Please try again.');
    } finally {
      setIsDecodingVin(false);
    }
  };

  // Update form data when vehicle prop changes or profile loads
  useEffect(() => {
    if (vehicle) {
      setFormData(vehicle);
    } else if (profile) {
      // When creating a new vehicle, populate with profile info only once
      setFormData({
        year: new Date().getFullYear(),
        make: '',
        model: '',
        price: 0,
        condition: 'used',
        fuel_type: 'Gasoline',
        transmission: 'Automatic transmission',
        status: 'available',
        features: [],
        contact_phone: profile?.phone || '',
        location: profile?.location || '',
      });
    }
  }, [vehicle, profile?.phone, profile?.location]); // Only depend on specific profile fields

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.make || !formData.model || !formData.year || !formData.price) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionData: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
        year: formData.year!,
        make: formData.make!,
        model: formData.model!,
        price: typeof formData.price === 'string' ? parseInt(formData.price) * 100 : (formData.price || 0) * 100,
        trim: formData.trim,
        vin: formData.vin,
        mileage: formData.mileage,
        exterior_color: formData.exterior_color,
        interior_color: formData.interior_color,
        exterior_color_standardized: formData.exterior_color_standardized,
        interior_color_standardized: formData.interior_color_standardized,
        fuel_type: formData.fuel_type || 'Gasoline',
        transmission: formData.transmission || 'Automatic transmission',
        engine: formData.engine,
        drivetrain: formData.drivetrain,
        original_price: formData.original_price,
        condition: formData.condition || 'used',
        description: formData.description,
        features: formData.features,
        images: formData.images,
        facebook_post_id: formData.facebook_post_id,
        facebook_post_status: formData.facebook_post_status || 'draft',
        last_posted_at: formData.last_posted_at,
        location: formData.location,
        contact_phone: formData.contact_phone,
        contact_email: formData.contact_email,
        status: formData.status || 'available',
        is_featured: formData.is_featured || false,
        view_count: formData.view_count || 0,
        lead_count: formData.lead_count || 0,
        // NHTSA decoded fields
        body_style_nhtsa: formData.body_style_nhtsa,
        drivetrain_nhtsa: formData.drivetrain_nhtsa,
        engine_nhtsa: formData.engine_nhtsa,
        fuel_type_nhtsa: formData.fuel_type_nhtsa,
        transmission_nhtsa: formData.transmission_nhtsa,
        vehicle_type_nhtsa: formData.vehicle_type_nhtsa,
        vin_decoded_at: formData.vin_decoded_at,
      };
      
      await onSubmit(submissionData);
      onOpenChange(false);
      if (!isEditing) {
        // Reset form with profile info for new vehicles
        setFormData({
          year: new Date().getFullYear(),
          make: '',
          model: '',
          price: 0,
          condition: 'used',
          fuel_type: 'Gasoline',
          transmission: 'Automatic transmission',
          status: 'available',
          features: [],
          contact_phone: profile?.phone || '',
          location: profile?.location || '',
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof Vehicle, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={formData.year || ''}
                onChange={(e) => updateField('year', parseInt(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="make">Make *</Label>
              <Input
                id="make"
                value={formData.make || ''}
                onChange={(e) => updateField('make', e.target.value)}
                placeholder="Toyota, Honda, Ford..."
                required
              />
            </div>
            <div>
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={formData.model || ''}
                onChange={(e) => updateField('model', e.target.value)}
                placeholder="Civic, Camry, F-150..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="trim">Trim Level</Label>
              <Input
                id="trim"
                value={formData.trim || ''}
                onChange={(e) => updateField('trim', e.target.value)}
                placeholder="LX, EX, Limited..."
              />
            </div>
            <div>
              <Label htmlFor="vin">VIN</Label>
              <div className="flex gap-2">
                <Input
                  id="vin"
                  value={formData.vin || ''}
                  onChange={(e) => updateField('vin', e.target.value)}
                  placeholder="17-character VIN"
                  maxLength={17}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDecodeVin}
                  disabled={!formData.vin || formData.vin.length !== 17 || isDecodingVin}
                >
                  {isDecodingVin ? 'Decoding...' : 'Decode VIN'}
                </Button>
              </div>
            </div>
          </div>

          {/* Condition and Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="condition">Condition</Label>
              <Select value={formData.condition} onValueChange={(value) => updateField('condition', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map(condition => (
                    <SelectItem key={condition} value={condition}>
                      {condition.charAt(0).toUpperCase() + condition.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="price">Price ($) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="1"
                value={typeof formData.price === 'number' ? formData.price / 100 : formData.price || ''}
                onChange={(e) => updateField('price', parseFloat(e.target.value))}
                placeholder="25000"
                required
              />
            </div>
            <div>
              <Label htmlFor="mileage">Mileage</Label>
              <Input
                id="mileage"
                type="number"
                min="0"
                value={formData.mileage || ''}
                onChange={(e) => updateField('mileage', parseInt(e.target.value))}
                placeholder="50000"
              />
            </div>
          </div>

          {/* Technical Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fuel_type">Fuel Type</Label>
              <Select value={formData.fuel_type} onValueChange={(value) => updateField('fuel_type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypes.map(fuel => (
                    <SelectItem key={fuel} value={fuel}>
                      {fuel.charAt(0).toUpperCase() + fuel.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transmission">Transmission</Label>
              <Select value={formData.transmission} onValueChange={(value) => updateField('transmission', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transmissions.map(trans => (
                    <SelectItem key={trans} value={trans}>
                      {trans.charAt(0).toUpperCase() + trans.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Facebook Marketplace Required Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vehicle_type">Vehicle Type</Label>
              <Select value={formData.vehicle_type_nhtsa || 'Car/Truck'} onValueChange={(value) => updateField('vehicle_type_nhtsa', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="body_style">Body Style</Label>
              <Select value={formData.body_style_nhtsa || ''} onValueChange={(value) => updateField('body_style_nhtsa', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select body style" />
                </SelectTrigger>
                <SelectContent>
                  {bodyStyles.map(style => (
                    <SelectItem key={style} value={style}>
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exterior_color">Exterior Color</Label>
              <Select value={formData.exterior_color_standardized || ''} onValueChange={(value) => updateField('exterior_color_standardized', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exterior color" />
                </SelectTrigger>
                <SelectContent>
                  {exteriorColors.map(color => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="interior_color">Interior Color</Label>
              <Select value={formData.interior_color_standardized} onValueChange={(value) => updateField('interior_color_standardized', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select interior color" />
                </SelectTrigger>
                <SelectContent>
                  {interiorColors.map(color => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone || ''}
                onChange={(e) => updateField('contact_phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="City, State"
              />
            </div>
          </div>

          {/* VIN Decoded Information (NHTSA) */}
          {(formData.body_style_nhtsa || formData.vehicle_type_nhtsa || formData.fuel_type_nhtsa || formData.transmission_nhtsa || formData.drivetrain_nhtsa || formData.engine_nhtsa) && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-md border">
              <h3 className="text-sm font-semibold text-muted-foreground">VIN Decoded Information (NHTSA)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {formData.vehicle_type_nhtsa && (
                  <div>
                    <span className="font-medium">Vehicle Type:</span> {formData.vehicle_type_nhtsa}
                  </div>
                )}
                {formData.body_style_nhtsa && (
                  <div>
                    <span className="font-medium">Body Style:</span> {formData.body_style_nhtsa}
                  </div>
                )}
                {formData.fuel_type_nhtsa && (
                  <div>
                    <span className="font-medium">Fuel Type:</span> {formData.fuel_type_nhtsa}
                  </div>
                )}
                {formData.transmission_nhtsa && (
                  <div>
                    <span className="font-medium">Transmission:</span> {formData.transmission_nhtsa}
                  </div>
                )}
                {formData.drivetrain_nhtsa && (
                  <div>
                    <span className="font-medium">Drivetrain:</span> {formData.drivetrain_nhtsa}
                  </div>
                )}
                {formData.engine_nhtsa && (
                  <div>
                    <span className="font-medium">Engine:</span> {formData.engine_nhtsa}
                  </div>
                )}
              </div>
              {formData.vin_decoded_at && (
                <p className="text-xs text-muted-foreground">
                  Decoded on: {new Date(formData.vin_decoded_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => updateField('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map(status => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <Label htmlFor="description">Description</Label>
            {formData.ai_description && (
              <div className="p-3 bg-muted/50 rounded-md border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">AI Generated Description</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateField('description', formData.ai_description || '')}
                  >
                    Use AI Description
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{formData.ai_description}</p>
              </div>
            )}
            <Textarea
              id="description"
              aria-describedby="description-help"
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Detailed description of the vehicle..."
              rows={4}
            />
            <p id="description-help" className="text-xs text-muted-foreground">
              This description will be used for Facebook Marketplace listings.
            </p>
          </div>

          {/* Featured checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_featured"
              checked={formData.is_featured || false}
              onCheckedChange={(checked) => updateField('is_featured', checked)}
            />
            <Label htmlFor="is_featured">Featured listing</Label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Vehicle' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}