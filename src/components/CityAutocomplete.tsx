import React, { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface City {
  city_name: string;
  state_name: string;
  full_name: string;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Select a city...",
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search function
  useEffect(() => {
    const searchCities = async () => {
      if (searchQuery.length < 2) {
        setCities([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_us_cities', {
          search_term: searchQuery
        });

        if (error) {
          console.error('Error searching cities:', error);
          setCities([]);
        } else {
          setCities(data || []);
        }
      } catch (error) {
        console.error('Error searching cities:', error);
        setCities([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchCities, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelect = (fullName: string) => {
    onChange(fullName);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search cities..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading && <div className="p-2 text-sm text-muted-foreground">Searching...</div>}
            {!isLoading && searchQuery.length >= 2 && cities.length === 0 && (
              <CommandEmpty>No cities found.</CommandEmpty>
            )}
            {!isLoading && searchQuery.length < 2 && (
              <div className="p-2 text-sm text-muted-foreground">Type at least 2 characters to search</div>
            )}
            <CommandGroup>
              {cities.map((city) => {
                return (
                  <CommandItem
                    key={`${city.city_name}-${city.state_name}`}
                    value={city.full_name}
                    onSelect={() => handleSelect(city.full_name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === city.full_name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {city.full_name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};