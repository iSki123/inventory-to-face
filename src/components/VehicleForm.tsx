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

interface VehicleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  vehicle?: Vehicle | null;
  isEditing?: boolean;
}

const fuelTypes = ['gasoline', 'diesel', 'hybrid', 'electric', 'plug-in hybrid'];
const transmissions = ['automatic', 'manual', 'cvt'];
const conditions = ['new', 'used', 'certified'];
const statuses = ['available', 'pending', 'sold', 'draft'];

export function VehicleForm({ open, onOpenChange, onSubmit, vehicle, isEditing }: VehicleFormProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    year: new Date().getFullYear(),
    make: '',
    model: '',
    price: 0,
    condition: 'used',
    fuel_type: 'gasoline',
    transmission: 'automatic',
    status: 'available',
    features: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when vehicle prop changes or profile loads
  useEffect(() => {
    console.log('VehicleForm useEffect triggered:', { vehicle, profile });
    if (vehicle) {
      setFormData(vehicle);
    } else {
      // When creating a new vehicle, populate with profile info
      setFormData(prev => ({
        year: new Date().getFullYear(),
        make: '',
        model: '',
        price: 0,
        condition: 'used',
        fuel_type: 'gasoline',
        transmission: 'automatic',
        status: 'available',
        features: [],
        contact_phone: profile?.phone || '',
        location: profile?.location || '',
      }));
    }
  }, [vehicle, profile]);

  // Additional effect to ensure contact info is populated when profile loads
  useEffect(() => {
    if (profile && !vehicle) {
      console.log('Populating contact info from profile:', profile);
      setFormData(prev => ({
        ...prev,
        contact_phone: prev.contact_phone || profile.phone || '',
        location: prev.location || profile.location || '',
      }));
    }
  }, [profile, vehicle]);

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
        fuel_type: formData.fuel_type || 'gasoline',
        transmission: formData.transmission || 'automatic',
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
          fuel_type: 'gasoline',
          transmission: 'automatic',
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
              <Input
                id="vin"
                value={formData.vin || ''}
                onChange={(e) => updateField('vin', e.target.value)}
                placeholder="17-character VIN"
                maxLength={17}
              />
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

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exterior_color">Exterior Color</Label>
              <Input
                id="exterior_color"
                value={formData.exterior_color || ''}
                onChange={(e) => updateField('exterior_color', e.target.value)}
                placeholder="Black, White, Silver..."
              />
            </div>
            <div>
              <Label htmlFor="interior_color">Interior Color</Label>
              <Input
                id="interior_color"
                value={formData.interior_color || ''}
                onChange={(e) => updateField('interior_color', e.target.value)}
                placeholder="Black, Tan, Gray..."
              />
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