import React, { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface City {
  name: string;
  state: string;
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
      console.log('Searching for:', searchQuery, 'Length:', searchQuery.length);
      
      if (searchQuery.length < 2) {
        console.log('Query too short, clearing cities');
        setCities([]);
        return;
      }

      console.log('Making RPC call with search_term:', searchQuery);
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_us_cities', {
          search_term: searchQuery
        });

        console.log('RPC response - data:', data, 'error:', error);

        if (error) {
          console.error('Error searching cities:', error);
          setCities([]);
        } else {
          console.log('Setting cities to:', data);
          setCities(data || []);
        }
      } catch (error) {
        console.error('Caught error searching cities:', error);
        setCities([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchCities, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelect = (cityName: string, stateName: string) => {
    const cityStateString = `${cityName}, ${stateName}`;
    onChange(cityStateString);
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
                const cityStateString = `${city.name}, ${city.state}`;
                return (
                  <CommandItem
                    key={`${city.name}-${city.state}`}
                    value={cityStateString}
                    onSelect={() => handleSelect(city.name, city.state)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === cityStateString ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {cityStateString}
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